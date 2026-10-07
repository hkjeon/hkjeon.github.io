---
title: "보안 패치 후 라이브 마이그레이션이 깨졌다 — RabbitMQ 클러스터 장애 복구기"
date: 2026-10-07T14:00:00+09:00
summary: "운영 중인 OpenStack-Ansible 클러스터에서 보안 패치를 위해 VM을 옮기고 노드를 재기동한 뒤, 원래 노드로 되돌리는 라이브 마이그레이션이 실패했습니다. 원인은 RabbitMQ 클러스터 손상이었습니다. 증상 판정, force_boot을 이용한 복구, 포트 바인딩 잔재 정리, 재시도까지 실제 조치 순서대로 정리했습니다."
tags:
  - OpenStack-Ansible
  - OpenStack
  - RabbitMQ
  - Troubleshooting
  - 운영
authors:
  - me
featured: true
---

운영 중인 고객사 OpenStack 클러스터에서 리눅스 보안 취약점을 조치하던 중이었습니다. 순서는 흔한 롤링 패치였습니다.

1. 컴퓨트 노드의 VM을 다른 노드로 **라이브 마이그레이션**
2. 비운 노드의 커널 업데이트 · 보안 조치 → **재기동**
3. VM을 원래 노드로 **라이브 마이그레이션해서 원복**

그런데 3번에서 마이그레이션이 실패했습니다. 재시도하면 이번에는 `409 PortBindingAlreadyExists`가 났습니다. 이 글은 그때의 원인 분석과 실제 조치 순서를 정리한 것입니다.

## 0. 환경과 결론

| 항목 | 내용 |
|---|---|
| 환경 | 공공기관 운영 클러스터, OpenStack-Ansible **Antelope (2023.1)**, Ubuntu 22.04, 컨트롤러 3대 |
| 증상 | 라이브 마이그레이션 실패 → 재시도 시 409, Cinder `MessagingTimeout` 다발 |
| 원인 | **RabbitMQ 클러스터 손상.** 큐 메타데이터가 재기동 전의 죽은 프로세스를 가리킴 |
| 조치 | RabbitMQ 전체 정지 → 마지막에 정지한 노드에서 `force_boot` → 나머지 노드 재기동 · 합류 → OpenStack 서비스 재기동 → 포트 바인딩 잔재 정리 → 마이그레이션 재시도 |
| VM 영향 | 없음 (RabbitMQ는 컨트롤 플레인 전용. 기동 중인 VM은 계속 동작) |

## 1. 증상

| 위치 | 로그 |
|---|---|
| RabbitMQ | `operation queue.declare caused a channel exception not_found: failed to perform operation on queue 'notifications.info' in vhost '/nova' due to timeout` |
| RabbitMQ | `error discarding messages from <0.9916.6> to <0.4256.0> in an old incarnation 1734571049 of this node 1788339500` |
| Cinder | `MessagingTimeout` 다발 |
| Nova | 라이브 마이그레이션 재시도 시 `PortBindingAlreadyExists` (409) |
| RabbitMQ 재기동 시 | `waiting for mnesia tables for 30000ms` → `timeout waiting for tables` |

## 2. 원인 — 왜 마이그레이션까지 깨졌나

RabbitMQ 노드는 기동할 때마다 새로운 **incarnation(creation) 번호**를 받습니다. 로그의 `old incarnation`은 클러스터의 다른 노드가 **재기동 이전의 큐 프로세스를 계속 붙잡고 있다**는 뜻입니다.

```
큐 메타데이터가 이미 죽은 프로세스(PID)를 가리킴
  → queue.declare가 응답 없는 프로세스를 기다리다 타임아웃
  → Nova · Neutron · Cinder에는 404 not_found로 돌아옴
  → 라이브 마이그레이션이 중간에 끊김
  → 대상 노드에 INACTIVE 포트 바인딩이 정리되지 않고 남음
  → 재시도하면 409 PortBindingAlreadyExists
```

즉 **409는 결과일 뿐**이고, 시작점은 RabbitMQ였습니다. 409만 보고 포트 바인딩만 지우면 RabbitMQ가 그대로라서 다시 실패합니다.

**vhost 이름으로 큐 방식을 알 수 있다**

| vhost 형태 | 의미 |
|---|---|
| `/nova`, `/cinder` | classic mirrored queue 사용 (quorum queue 비활성) |
| `nova`, `cinder` | quorum queue 사용 |

이 클러스터는 `/nova` 형태, 즉 classic 방식이었습니다. classic mirrored queue는 노드 재기동 때 큐 마스터를 잃는 상황에 취약합니다.

## 3. 먼저 판정 — 큐만 굳었나, 클러스터가 깨졌나

증상이 같아도 조치 범위가 다릅니다. 배포 노드에서 세 가지를 확인합니다.

```bash
cd /opt/openstack-ansible/playbooks

# 1) 파티션 여부 — 3대 모두 [] 여야 정상
ansible rabbitmq_all -m shell -a "rabbitmqctl eval 'rabbit_node_monitor:partitions().'"

# 2) 각 노드가 인식하는 running 노드 — 3대 결과가 같아야 정상
ansible rabbitmq_all -m shell -a "rabbitmqctl eval 'rabbit_mnesia:cluster_status_from_mnesia().'"

# 3) 굳은 큐 — state가 비었거나 down인 큐
ansible rabbitmq_all[0] -m shell -a "rabbitmqctl list_queues -p /nova name messages consumers state"
```

| 판정 | 기준 | 조치 |
|---|---|---|
| 큐만 굳음 | 파티션 없음, 노드 목록 일치, 특정 큐만 state 이상 | 해당 큐만 삭제 → 서비스 재기동 |
| **클러스터 손상** | 파티션 존재, 노드 목록 불일치, `old incarnation` 로그 | **클러스터 복구** (4장) |

이번은 **클러스터 손상**이었습니다. 처음에는 `notifications.info` 큐를 먼저 지워 봤지만 해결되지 않았고, 결국 클러스터 복구로 해결됐습니다. 판정을 먼저 했다면 큐 삭제는 건너뛰어도 됐습니다.

## 4. RabbitMQ 클러스터 복구

### 4-1. 핵심: Galera와 기동 규칙이 다르다

| 항목 | Galera | RabbitMQ |
|---|---|---|
| 어느 노드가 최신인가 | `grastate.dat`의 seqno | **마지막에 정지한 노드** |
| 아무 노드나 먼저 기동 | 가능 | 다른 노드를 기다리며 무한 대기 |
| 강제 기동 | `safe_to_bootstrap` | `force_boot` (**1대에서만**) |

**정지 순서와 기동 순서는 반대**여야 합니다. (정지: infra03 → 02 → 01이면 기동: infra01 → 02 → 03)

### 4-2. 정지

```bash
ansible rabbitmq_all -m shell -a "systemctl stop rabbitmq-server"
```

정지 순서를 모르면 로그나 Mnesia 파일 시각으로 확인합니다. 시각이 가장 늦은 노드가 최신입니다.

```bash
ansible rabbitmq_all -m shell -a "stat -c '%y %n' /var/lib/rabbitmq/mnesia/*/rabbit_user.DCD"
```

### 4-3. 기동 — 마지막에 정지한 노드에서 force_boot

마지막에 정지한 노드를 먼저 기동했지만 `waiting for mnesia tables`에서 멈췄습니다. **그 노드에서만** 강제 부팅했습니다.

```bash
# 마지막에 정지한 노드에서만
systemctl stop rabbitmq-server
rabbitmqctl force_boot
systemctl start rabbitmq-server
rabbitmqctl await_startup; echo "exit=$?"   # 0이면 성공
rabbitmqctl cluster_status
```

이어서 나머지 노드를 차례로 재기동해 클러스터에 합류시켰습니다.

```bash
# 나머지 노드에서 하나씩
systemctl restart rabbitmq-server
rabbitmqctl await_startup; echo "exit=$?"
```

**force_boot을 쓸 때 반드시 알아둘 것**

| 실행 범위 | 결과 |
|---|---|
| 1대에서만 | 미처리 RPC 메시지만 유실 (이미 타임아웃된 것들이라 사실상 무해) |
| **2대 이상** | 각자 독립된 클러스터로 기동 → **split-brain** |

| 데이터 | force_boot 후 |
|---|---|
| vhost · 유저 · 권한 · 정책 | 유지 |
| 큐 정의 | 서비스가 다시 연결하면 재생성 |
| 미처리 RPC 메시지 | 유실 |

### 4-4. 검증

```bash
rabbitmqctl cluster_status
rabbitmqctl eval 'rabbit_node_monitor:partitions().'    # []
rabbitmqctl list_queues -p /nova name messages consumers state
```

| 항목 | 정상 기준 |
|---|---|
| Running Nodes | 3대 모두 |
| partitions | `[]` |
| 큐 state | 모두 `running` |
| `erlang:system_info(creation)` | 노드마다 **달라도 정상** |

> 이번에는 여기서 해결됐습니다. 그래도 합류에 실패하는 노드가 있다면 그 노드의 Mnesia 데이터를 지우고 `join_cluster`로 다시 넣습니다. 최후 수단은 전체 Mnesia 삭제 후 `rabbitmq-install.yml`과 `setup-openstack.yml --tags common-mq`로 재구성하는 것인데, vhost와 유저가 모두 재생성되므로 컨트롤 플레인 API가 멈춥니다.

## 5. OpenStack 서비스 재기동

```bash
ansible nova_all    -m shell -a "systemctl restart 'nova-*'"
ansible cinder_all  -m shell -a "systemctl restart 'cinder-*'"
ansible neutron_all -m shell -a "systemctl restart 'neutron-*'"

openstack compute service list
openstack volume service list
openstack network agent list
```

## 6. 포트 바인딩 잔재 정리

마이그레이션이 중간에 끊기면서 **대상 노드에 INACTIVE 바인딩**이 남아 있었습니다. 이것을 지워야 409가 사라집니다.

```bash
TOKEN=$(openstack token issue -f value -c id)
NEUTRON=$(openstack endpoint list --service network --interface internal -f value -c URL)

# 확인
curl -s -H "X-Auth-Token: $TOKEN" $NEUTRON/v2.0/ports/<PORT_ID>/bindings

# 삭제 — 204면 성공
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE \
  -H "X-Auth-Token: $TOKEN" $NEUTRON/v2.0/ports/<PORT_ID>/bindings/<DEST_HOST>
```

포트가 여러 개라면 Neutron이 제공하는 도구가 편합니다.

```bash
neutron-remove-duplicated-port-bindings --config-file /etc/neutron/neutron.conf [--port <PORT_ID>]
```

> DB에서 `ml2_port_bindings`를 직접 지우면 `ml2_port_binding_levels`의 연관 레코드가 남습니다. 조회는 DB로 해도 되지만 **삭제는 API나 위 도구로** 합니다.

인스턴스와 Placement 상태도 확인합니다.

```bash
openstack server show <VM_ID> -c status -c "OS-EXT-STS:task_state"
openstack server set --state active <VM_ID>        # migrating으로 굳어 있을 때만

openstack resource provider allocation show <VM_ID>
nova-manage placement audit --verbose              # --delete는 확인 후에만
```

출발지와 목적지 리소스 프로바이더 **양쪽에** 할당이 잡혀 있으면 목적지 쪽이 잔재입니다.

## 7. 마이그레이션 재시도

```bash
openstack server migrate --live-migration --host <DEST_HOST> --wait <VM_ID>
```

`--live <host>`는 스케줄러 검증을 건너뛰는 예전 옵션이라 `--live-migration --host`를 씁니다.

| 다시 실패하면 | 의심할 곳 |
|---|---|
| `MessagingTimeout` 재발 | RabbitMQ → 3장부터 다시 |
| `PortBindingAlreadyExists` 재발 | 바인딩 삭제가 반영되지 않음 → 도구 사용 |
| `pre_live_migration` 실패 | 대상 노드 스토리지 연결(멀티패스 등), CPU 모델 불일치 |

## 8. 재발 방지 (권고 — 이번에는 적용하지 않음)

| 대상 | user_variables.yml | 효과 |
|---|---|---|
| Ceilometer를 쓰지 않으면 알림 비활성 | `oslomsg_notify_configure: False` | `notifications.*` 큐 자체가 생기지 않음 |
| quorum queue 전환 | `oslomsg_rabbit_quorum_queues: True` | Raft 기반이라 노드 재기동 시 리더 재선출로 처리 |

**quorum 전환 시 주의**

- vhost 이름이 `/nova` → `nova`로 바뀌어 재생성됩니다. 모니터링 설정도 함께 고쳐야 합니다.
- 전환 중에는 서비스가 접속하지 못하므로 다운타임이 생깁니다.
- classic mirrored queue는 RabbitMQ 4.0에서 제거되었으므로, 브로커를 업그레이드하기 전에는 반드시 전환해야 합니다.

## 9. 정리하며

| 교훈 | 내용 |
|---|---|
| 409는 결과다 | 포트 바인딩 오류만 보고 지우면 다시 실패. 메시지 큐부터 봐야 함 |
| 판정이 먼저 | 큐 삭제로 끝날지, 클러스터 복구가 필요한지 먼저 가르면 시간을 아낌 |
| RabbitMQ ≠ Galera | 마지막에 정지한 노드부터 기동. `force_boot`은 반드시 1대에서만 |
| 롤링 패치 체크리스트 | 노드 재기동 후 **RabbitMQ 클러스터 상태 확인**을 원복 마이그레이션 전에 넣기 |

> 참고: oslo.messaging은 구독자가 늦게 떠도 메시지를 놓치지 않도록 **발행자 쪽에서 큐를 만듭니다.** 그래서 Ceilometer가 없어도 `notifications.info` 큐가 생기고, 소비자 없이 계속 쌓입니다. 이번에 굳은 큐가 바로 이것이었습니다.
