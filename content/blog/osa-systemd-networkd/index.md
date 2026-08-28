---
title: "systemd-networkd를 활용한 OpenStack 노드 네트워크 설정 자동화"
date: 2026-08-27
summary: "OSA 배포 전 단계인 타깃 노드의 bond·VLAN·bridge 구성을 openstack_hosts 롤의 systemd-networkd 변수로 코드화한 방법과, netplan을 쓰지 않은 이유를 정리했습니다."
tags:
  - OpenStack
  - OpenStack-Ansible
  - systemd-networkd
  - Ansible
  - 자동화
authors:
  - me
featured: true
---

OpenStack-Ansible(OSA) 공식 가이드는 타깃 노드의 브리지 네트워크를 Ubuntu netplan으로 구성하도록 안내합니다. 저도 그동안 그렇게 해왔습니다. 노드마다 netplan YAML을 작성해 bond, VLAN, 그리고 `br-mgmt`·`br-vxlan` 같은 브리지를 잡는 방식입니다.

문제는 이 작업이 **배포 자동화의 바깥에 있다는 점**입니다. Ceph까지 얹은 HCI 노드라면 한 대에 bond 3개, VLAN 3개, 브리지 5개를 손으로 잡아야 합니다. 노드가 열 대를 넘어가면 이 작업만으로 반나절이 지나가고, 오타 하나가 배포 실패로 이어집니다. 그리고 재구축할 때마다 처음부터 반복됩니다.

## 1. 시작은 오프라인 패키지 작업이었다

Caracal 릴리스를 다루면서 `openstack_hosts` 롤에 systemd-networkd 관련 변수가 있다는 걸 알게 됐습니다. 당시엔 그냥 알아만 두고 넘어갔습니다.

다시 꺼내게 된 건 Epoxy 오프라인 패키지를 구성하면서였습니다. 폐쇄망 배포용으로 **타깃 노드에서 수행해야 할 작업을 플레이북으로 묶는 중**이었는데, 정리하다 보니 노드 준비 작업이 이런 목록이었습니다.

- 패키지 설치
- 시간 동기화(timedatectl) 설정
- 네트워크 구성 (bond / VLAN)
- 브리지 구성

앞의 셋은 이미 플레이북으로 처리하고 있었습니다. 그런데 네트워크만 netplan으로 따로 빠져 있었습니다. 여기서 `openstack_hosts`의 systemd-networkd 변수가 떠올랐습니다.

**이걸 쓰면 노드에 OS만 설치하고, `ip addr`로 배포 노드와 통신할 임시 IP 하나만 붙여두면 나머지는 전부 플레이북이 끝낼 수 있겠다** 싶었습니다. 실제로 그렇게 됐습니다.

| 단계 | 이전 | 이후 |
|---|---|---|
| OS 설치 | 수동 | 수동 |
| 임시 IP 설정 | 수동 | 수동 (`ip addr` 한 줄) |
| 패키지 설치 | 플레이북 | 플레이북 |
| 시간 설정 | 플레이북 | 플레이북 |
| 네트워크·브리지 | **수동 (netplan)** | **플레이북** |

수동 구간이 "OS 설치 + IP 한 줄"로 줄어듭니다.

## 2. netplan을 굳이 쓰지 않은 이유

netplan으로도 자동화는 가능합니다. Jinja2 템플릿을 만들어 뿌리면 됩니다. 그럼에도 systemd-networkd를 택한 이유는 이렇습니다.

| 항목 | netplan | systemd-networkd |
|---|---|---|
| 위치 | OSA 외부, 별도 롤/템플릿 필요 | `openstack_hosts` 롤에 내장 |
| 적용 방식 | netplan → renderer로 변환 | `.netdev` / `.network` 직접 생성 |
| 배포 시점 | 별도 단계 | `setup-hosts.yml` 실행 시 함께 |
| 파일 관리 | 기존 netplan 설정과 충돌 가능 | prefix로 OSA 생성분 격리 |

**netplan도 결국 백엔드로 systemd-networkd나 NetworkManager를 씁니다.** 어차피 중간 계층이라면, OSA가 이미 지원하는 경로를 쓰는 편이 단계가 하나 줄어듭니다. 무엇보다 직접 만든 롤을 유지보수할 필요가 없습니다.

## 3. 변수 구조

`openstack_hosts` 롤의 기본값을 보면 이렇게 정의돼 있습니다.

```yaml
# Define extra systemd services/networks/mounts
openstack_hosts_systemd_mounts: []
# Systemd networks can be configured only on bare metal hosts
# systemd-networkd role won't run inside containers.
openstack_hosts_systemd_networkd_devices: []
openstack_hosts_systemd_networkd_networks: []
openstack_hosts_systemd_networkd_prefix: openstack-net
openstack_hosts_systemd_services: []
openstack_hosts_systemd_slice: "openstack-hosts"
```

쓰는 변수는 사실상 두 개입니다.

| 변수 | 역할 | 생성 파일 |
|---|---|---|
| `openstack_hosts_systemd_networkd_devices` | 가상 장치 정의 (bond, VLAN, bridge) | `.netdev` |
| `openstack_hosts_systemd_networkd_networks` | 장치 간 연결과 주소 할당 | `.network` |

`openstack_hosts_systemd_networkd_prefix`는 생성되는 파일명 접두어입니다. 기본값이 `openstack-net`이라 `/etc/systemd/network/` 아래에 `openstack-net-*.netdev` 형태로 떨어집니다. **기존 설정과 섞이지 않는 게 이 접두어 덕분입니다.**

주석에 적힌 대로 이 롤은 **베어메탈 호스트에서만 동작합니다.** LXC 컨테이너 안에서는 실행되지 않습니다. 노드 준비 단계 전용이라고 보면 됩니다.

## 4. 그룹별로 나눠서 정의하기

노드 역할에 따라 NIC 구성도 다르고 필요한 네트워크도 다릅니다. 그래서 `/etc/openstack_deploy/group_vars/` 아래에 그룹별 파일을 만듭니다.

```
/etc/openstack_deploy/group_vars/
├── shared-infra_hosts.yml   # HCI 노드 그룹
└── compute_hosts.yml        # 컴퓨트 노드 그룹
```

Ansible의 group_vars 규칙을 그대로 쓰는 것이라, OSA 인벤토리에 정의된 그룹명과 파일명만 맞춰주면 됩니다.

## 5. 예시 환경

아래 설정은 **HCI 구조의 테스트베드**를 기준으로 합니다.

| 노드 | 대수 | 역할 |
|---|---|---|
| `mix01` ~ `mix03` | 3 | 컨트롤러 + 컴퓨트 + Ceph 통합 (HCI) |
| `compute01` | 1 | 컴퓨트 전용 |

`mix`라는 이름은 컨트롤러·컴퓨트·스토리지 역할이 한 노드에 섞여 있다는 뜻입니다. Ceph가 노드 안에 함께 들어가기 때문에, HCI 노드에는 **스토리지 네트워크가 두 개** 필요합니다.

| 브리지 | 용도 | HCI 노드 | 컴퓨트 노드 |
|---|---|---|---|
| `br-mgmt` | OpenStack 관리 네트워크 | ✅ | ✅ |
| `br-vxlan` | 테넌트 오버레이 | ✅ | ✅ |
| `br-ext` | 외부 연결 | ✅ | ✅ |
| `br-stsvc` | **Ceph 서비스(public) 네트워크** — 클라이언트가 OSD·MON에 접근 | ✅ | — |
| `br-stcl` | **Ceph 클러스터 네트워크** — OSD 간 복제·리밸런싱 트래픽 | ✅ | — |

Ceph에서 서비스 네트워크와 클러스터 네트워크를 나누는 이유는, **복제 트래픽이 클라이언트 I/O를 밀어내지 않게 하기 위해서**입니다. 복구나 리밸런싱이 돌면 OSD 간 트래픽이 순간적으로 크게 늘어나는데, 이게 서비스 네트워크와 같은 경로를 타면 VM의 디스크 응답이 함께 느려집니다.

그래서 HCI 노드는 브리지 5개, 컴퓨트 노드는 3개입니다. 그룹을 나눈 이유가 여기에 있습니다.

## 6. HCI 노드 설정

먼저 가상 장치를 정의합니다. bond 3개, VLAN 3개, bridge 5개입니다.

```yaml
# group_vars/shared-infra_hosts.yml
openstack_hosts_systemd_networkd_devices:
  - NetDev: { Name: bond1, Kind: bond }
    Bond: { Mode: active-backup, MIIMonitorSec: "100ms" }
  - NetDev: { Name: bond2, Kind: bond }
    Bond: { Mode: active-backup, MIIMonitorSec: "100ms" }
  - NetDev: { Name: bond3, Kind: bond }
    Bond: { Mode: active-backup, MIIMonitorSec: "100ms" }

  - NetDev: { Name: bond2.21, Kind: vlan }
    VLAN: { Id: 21 }
  - NetDev: { Name: bond2.22, Kind: vlan }
    VLAN: { Id: 22 }
  - NetDev: { Name: bond2.24, Kind: vlan }
    VLAN: { Id: 24 }

  - NetDev: { Name: br-mgmt, Kind: bridge }
  - NetDev: { Name: br-stcl, Kind: bridge }
  - NetDev: { Name: br-ext, Kind: bridge }
  - NetDev: { Name: br-vxlan, Kind: bridge }
  - NetDev: { Name: br-stsvc, Kind: bridge }
```

`NetDev`, `Bond`, `VLAN` 키는 systemd의 `.netdev` 파일 섹션명을 그대로 따릅니다. 즉 **systemd 문서를 그대로 참조할 수 있습니다.** 롤이 별도 추상화를 만들지 않았다는 게 장점입니다.

다음은 연결 관계입니다. 물리 NIC를 bond에 넣고, bond에 VLAN을 태우고, 그 위에 bridge를 얹는 순서입니다.

```yaml
openstack_hosts_systemd_networkd_networks:
  # 물리 NIC → bond
  - interface: eno1
    match: { name: eno1 }
    bond: bond1
  - interface: eno2
    match: { name: eno2 }
    bond: bond2
  - interface: eno3
    match: { name: eno3 }
    bond: bond3

  # bond → VLAN
  - interface: bond2
    match: { name: bond2 }
    vlan:
      - bond2.21
      - bond2.22
      - bond2.24

  # bond / VLAN → bridge
  - interface: bond1
    match: { name: bond1 }
    bridge: br-mgmt
  - interface: bond2.21
    match: { name: bond2.21 }
    bridge: br-stcl
  - interface: bond2.22
    match: { name: bond2.22 }
    bridge: br-ext
  - interface: bond2.24
    match: { name: bond2.24 }
    bridge: br-vxlan
  - interface: bond3
    match: { name: bond3 }
    bridge: br-stsvc
```

마지막으로 bridge에 IP를 붙입니다.

```yaml
  - interface: br-mgmt
    match: { name: br-mgmt }
    address:
      - "{{ node_fixed_ips[inventory_hostname]['mgmt'] }}"

  - interface: br-ext
    match: { name: br-ext }
    address:
      - "{{ node_fixed_ips[inventory_hostname]['ext'] }}"
    config_overrides:
      Network:
        Gateway:
          - "{{ node_fixed_ips[inventory_hostname]['ext_gw'] }}"
```

## 7. 노드별 IP를 한 곳에서 관리하기

위 설정에서 IP는 하드코딩하지 않고 `node_fixed_ips` 변수를 참조했습니다. `inventory_hostname`으로 자기 노드의 값을 꺼내오는 구조입니다.

```yaml
## user_variables.yml
# Fix IP Configuration for each nodes.
node_fixed_ips:
  mix01:
    hostname: "tb-node01"
    mgmt: "10.10.11.111/24"
    vxlan: "10.10.12.111/24"
    ext: "192.168.100.111/24"
    ext_gw: "192.168.100.1"
  mix02:
    hostname: "tb-node02"
    mgmt: "10.10.11.112/24"
    vxlan: "10.10.12.112/24"
    ext: "192.168.100.112/24"
    ext_gw: "192.168.100.1"
  mix03:
    hostname: "tb-node03"
    mgmt: "10.10.11.113/24"
    vxlan: "10.10.12.113/24"
    ext: "192.168.100.113/24"
    ext_gw: "192.168.100.1"
  compute01:
    hostname: "tb-comp01"
    mgmt: "10.10.11.114/24"
    vxlan: "10.10.12.114/24"
    ext: "192.168.100.114/24"
    ext_gw: "192.168.100.1"
```

이 구조의 실익이 큽니다.

- **IP 정보가 한 파일에 모입니다.** 노드가 늘어나면 여기에 항목만 추가합니다.
- **group_vars의 네트워크 구조는 건드리지 않습니다.** 구조와 값이 분리됩니다.
- 사업마다 IP 대역이 달라져도 `user_variables.yml`만 교체하면 됩니다.

`config_overrides`는 롤이 기본 제공하지 않는 systemd 옵션을 끼워넣는 통로입니다. 위 예시에서는 `[Network]` 섹션에 `Gateway`를 추가했습니다. **롤이 감싸지 못한 옵션도 이 경로로 대부분 해결됩니다.**

## 8. 컴퓨트 노드 설정

컴퓨트는 NIC 이름과 필요한 bridge가 다를 뿐 구조는 같습니다.

```yaml
# group_vars/compute_hosts.yml
openstack_hosts_systemd_networkd_devices:
  - NetDev: { Name: bond0, Kind: bond }
    Bond: { Mode: active-backup, MIIMonitorSec: "100ms" }
  - NetDev: { Name: bond0.11, Kind: vlan }
    VLAN: { Id: 11 }
  - NetDev: { Name: bond0.12, Kind: vlan }
    VLAN: { Id: 12 }
  - NetDev: { Name: br-mgmt, Kind: bridge }
  - NetDev: { Name: br-vxlan, Kind: bridge }
  - NetDev: { Name: br-ext, Kind: bridge }

openstack_hosts_systemd_networkd_networks:
  - interface: enp1s0
    match: { name: enp1s0 }
    bond: bond0
  - interface: bond0
    match: { name: bond0 }
    vlan:
      - bond0.11
      - bond0.12
  - interface: bond0.11
    match: { name: bond0.11 }
    bridge: br-mgmt
  - interface: bond0.12
    match: { name: bond0.12 }
    bridge: br-vxlan
```

컴퓨트 전용 노드에는 Ceph가 올라가지 않으므로 `br-stcl`, `br-stsvc`가 필요 없습니다. 브리지 3개로 끝납니다.

## 9. 적용

배포 서버에서 평소대로 실행하면 됩니다.

```bash
openstack-ansible playbooks/setup-hosts.yml
```

`openstack_hosts` 롤이 이 단계에서 실행되면서, 정의해둔 `.netdev` / `.network` 파일이 전체 타깃 노드에 한 번에 적용됩니다. **노드 대수와 무관하게 네트워크 셋업 단계는 1~2분 안에 끝납니다.** bond, VLAN, 브리지가 동시에 잡힙니다.

노드에서 결과를 확인합니다.

```bash
ls /etc/systemd/network/
networkctl status br-mgmt
```

## 10. 걸렸던 부분

**적용 순서에 주의해야 합니다.** bond → VLAN → bridge 순으로 의존 관계가 있어서, 정의가 빠지면 상위 장치가 올라오지 않습니다. systemd-networkd는 조용히 실패하는 편이라 `networkctl` 로 개별 확인이 필요합니다.

**노드 그룹화 방식은 직접 정해야 합니다.** OSA가 이 변수들을 노드 역할별로 나눠 쓰는 표준 형태를 제공하는지 확인하지 못했습니다. 그래서 `group_vars/`에 컨트롤러와 컴퓨트 파일을 따로 두는 방식으로 나눴습니다. 같은 그룹 안에 NIC 구성이 다른 노드가 섞이면 `host_vars`로 내려야 합니다.

## 11. 정리

| 항목 | 수동 구성 (netplan) | systemd-networkd 자동화 |
|---|---|---|
| 적용 방식 | 노드마다 개별 작업 | `setup-hosts.yml` 단계에서 일괄 |
| 네트워크 셋업 소요 | 노드 수에 비례 | 전체 노드 1~2분 |
| 재구축 시 | 처음부터 반복 | 정의 파일 재사용 |
| 오타 위험 | 노드마다 존재 | 정의가 한 곳에 모임 |
| 구성 이력 | 남지 않음 | Git으로 관리 |

배포 자동화를 이야기할 때 보통 OpenStack 설치만 떠올리지만, **노드가 준비되는 지점부터 코드로 관리하면 재현성이 확실히 달라집니다.** 특히 폐쇄망 사업처럼 같은 구성을 여러 번 다시 세워야 하는 환경에서 차이가 큽니다.

---

**참고**

- [OpenStack-Ansible openstack_hosts 롤 문서](https://docs.openstack.org/openstack-ansible-openstack_hosts/latest/)
- [openstack-ansible-openstack_hosts 저장소](https://github.com/openstack/openstack-ansible-openstack_hosts)
