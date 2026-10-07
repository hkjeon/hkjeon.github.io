---
title: "추가 디스크 없이 Swift 구성하기 — 파일을 디스크처럼 쓰는 loop 마운트"
date: 2026-10-07T13:00:00+09:00
summary: "Swift는 노드마다 전용 디스크(sdb·sdc…)를 전제로 합니다. 여유 디스크가 없는 환경에서 fallocate로 만든 파일을 XFS로 포맷하고 loop로 마운트해 디스크처럼 쓰는 방법과, OpenStack-Ansible에서 Swift를 배포하고 Glance 백엔드로 연동한 과정을 정리했습니다."
tags:
  - OpenStack-Ansible
  - OpenStack
  - Swift
  - Glance
  - Storage
authors:
  - me
featured: true
---

OpenStack의 오브젝트 스토리지인 Swift는 **노드마다 전용 디스크**를 붙여 쓰는 것을 전제로 합니다. 컨트롤러에 `sdb`, `sdc`, `sdd` 같은 빈 디스크를 붙이고, 각각 XFS로 포맷해 `/srv/node/sdb`처럼 마운트한 뒤 Swift에 넘겨주는 방식입니다.

그런데 테스트베드나 소규모 환경에는 여유 디스크가 없는 경우가 많습니다. root 디스크 하나뿐인 노드에서도 Swift를 써 볼 수 없을까요?

결론부터 말하면 **됩니다.** 파일 하나를 만들어 파일시스템으로 포맷하고 loop로 마운트하면, Swift는 그 파일을 실제 디스크처럼 사용합니다.

## 0. 읽기 전에

| 항목 | 내용 |
|---|---|
| 핵심 | **root 디스크 하나로** Swift 스토리지 디바이스 구성 (파일 → XFS → loop 마운트) |
| 버전 | OpenStack-Ansible 29.2.1 (Caracal), Ubuntu |
| 환경 | 테스트베드 VM: Deploy 1 · Controller 3 · Compute 1, 베어메탈 배포(컨테이너 미사용) |
| 확인한 것 | Swift 배포, 컨테이너 생성, **Glance 이미지 저장소를 Swift로** 바꾸고 그 이미지로 VM 부팅 |
| 용도 | 테스트 · 검증 · 소규모 환경. 운영 환경은 실제 디스크를 권장 (6장) |

## 1. 아이디어는 롤의 예시에서 시작됐다

OSA의 Swift 롤(`openstack-ansible-os_swift`)은 `defaults/main.yml`에 기본 설정 예시를 주석으로 넣어 두었습니다.

```yaml
# Example basic swift configuration for the cluster
# swift:
#   part_power: 8
#   storage_network: 'br-storage'
#   replication_network: 'br-storage'
#   drives:
#     - name: swift1.img
#     - name: swift2.img
#     - name: swift3.img
#   mount_point: /srv
```

drive 이름이 `sdb`가 아니라 **`swift1.img`** 였습니다. Swift가 보는 것은 "디스크 장치"가 아니라 **`mount_point/name` 경로에 마운트된 파일시스템**이라는 뜻입니다. 그렇다면 그 자리에 디스크 대신 이미지 파일을 마운트해도 되지 않을까 싶었고, `fallocate`로 파일을 만들어 시험해 봤더니 잘 동작했습니다.

> 나중에 보니 OSA의 테스트용 올인원(AIO) 환경도 같은 원리를 씁니다. `bootstrap-host` 롤이 `truncate`로 `swift1.img` ~ `swift3.img` 파일을 만들고 XFS로 포맷한 뒤 `/srv/swiftN.img`에 loop로 마운트합니다.

## 2. 원리

```
[ root 디스크 ]
   └─ /srv/swift1.img/swift1.img   ← fallocate로 만든 50G 파일
          │  mkfs.xfs
          ▼
      XFS 파일시스템이 들어 있는 파일
          │  mount -o loop
          ▼
   /srv/swift1.img  (마운트 지점)   ← Swift가 "디스크"로 사용
```

| 실제 디스크 방식 | 파일(loop) 방식 |
|---|---|
| `/dev/sdb` → XFS → `/srv/node/sdb` | `swift1.img` 파일 → XFS → `/srv/swift1.img` |
| drives: `sdb` / mount_point: `/srv/node` | drives: `swift1.img` / mount_point: `/srv` |

Swift 입장에서는 둘 다 **"`mount_point/name`에 마운트된 XFS"**라서 차이가 없습니다.

## 3. 디바이스 준비 (Swift 노드마다)

### 3-1. 파일 생성과 포맷, 마운트

```bash
mkdir -p /srv/swift1.img
fallocate -l 50G /srv/swift1.img/swift1.img     # 파일 이름은 자유
mkfs.xfs /srv/swift1.img/swift1.img
mount -o loop /srv/swift1.img/swift1.img /srv/swift1.img
```

마운트 지점과 같은 경로 안에 파일을 두는 구성입니다. 마운트하면 파일은 가려지지만 loop 장치가 이미 열려 있어서 문제없이 동작합니다. 헷갈린다면 파일을 다른 경로(예: `/openstack/swift1.img`)에 두고 마운트 지점만 `/srv/swift1.img`로 해도 됩니다.

### 3-2. 재부팅 후에도 유지 (fstab)

```
/srv/swift1.img/swift1.img  /srv/swift1.img  xfs  loop,defaults  0  0
```

```bash
df -h | grep swift
/dev/loop6   50G  ...  /srv/swift1.img
```

### 3-3. 소유권

Swift가 쓸 수 있도록 마운트 지점의 소유자를 `swift`로 바꿉니다. `swift` 계정은 **Swift가 배포된 뒤에 생기므로**, 이 단계는 배포 후에 진행합니다.

```bash
chown -R swift:swift /srv/swift1.img
```

### 참고: 실제 디스크가 있을 때

```bash
mkfs.xfs -f -i size=1024 -L sdb /dev/sdb
mkdir -p /srv/node/sdb
echo "LABEL=sdb /srv/node/sdb xfs noatime,nodiratime,logbufs=8,auto 0 0" >> /etc/fstab
mount /srv/node/sdb
```

## 4. OpenStack-Ansible 설정

### 4-1. openstack_user_config.yml

Swift 프록시와 스토리지 역할을 컨트롤러 3대에 둡니다.

```yaml
swift-proxy_hosts: *infrastructure_hosts
swift_hosts: *infrastructure_hosts
```

### 4-2. user_variables.yml — Swift

```yaml
swift:
  part_power: 8
  storage_network: 'br-storage'      # 별도 스토리지망이 없으면 br-mgmt도 가능 (시험 시 사용)
  replication_network: 'br-storage'
  drives:
    - name: swift1.img               # mount_point 아래의 디렉터리 이름
  mount_point: /srv
  storage_policies:
    - policy:
        name: default
        index: 0
        default: True
```

| 변수 | 의미 |
|---|---|
| `part_power` | ring의 파티션 수 = 2^part_power. 테스트는 8이면 충분 |
| `storage_network` / `replication_network` | 스토리지 · 복제 트래픽이 쓰는 브리지 |
| `drives` + `mount_point` | Swift가 사용할 경로 = `/srv/swift1.img` |
| `storage_policies` | 기본 정책 하나 |

### 4-3. user_variables.yml — Glance 백엔드를 Swift로

```yaml
glance_default_store: swift
glance_swift_store_auth_address: '{{ keystone_service_internalurl }}'
glance_swift_store_container: glance_images
glance_swift_store_endpoint_type: internalURL
glance_swift_store_key: '{{ glance_service_password }}'
glance_swift_store_region: RegionOne
glance_swift_store_user: 'service:glance'
```

이미지가 로컬 파일이 아니라 Swift의 `glance_images` 컨테이너에 저장됩니다. 컨트롤러 3대가 같은 이미지를 공유하게 되므로, Glance 이미지 공유 문제도 함께 해결됩니다.

## 5. 배포와 검증

일반적인 OSA 배포 순서(setup-hosts → setup-infrastructure → setup-openstack)대로 배포하면 Swift와 Glance 설정이 함께 반영됩니다. 배포 후 3-3의 소유권 변경을 진행합니다.

| 확인 | 결과 |
|---|---|
| `openstack container list --long` | 컨테이너 생성 · 객체 업로드 정상 |
| `openstack image create ...` | 이미지가 `active`로 등록 (Swift에 저장) |
| `openstack server create ...` | 해당 이미지로 VM 부팅 → `ACTIVE` |

## 6. 실제 디스크와 비교, 그리고 주의할 점

| | 실제 디스크 | 파일(loop) |
|---|---|---|
| 추가 하드웨어 | 필요 | **불필요** |
| 성능 | 디스크 성능 그대로 | root 디스크를 OS와 나눠 씀 + loop 계층 |
| 장애 격리 | 디스크 단위로 분리 | root 디스크가 죽으면 OS와 데이터가 함께 영향 |
| 용량 | 디스크 크기만큼 | root 디스크 여유 공간 안에서 |
| 적합한 용도 | 운영 | 테스트 · 검증 · PoC · 소규모 |

**파일을 만들 때: truncate vs fallocate**

| | truncate (OSA AIO) | fallocate (이 글) |
|---|---|---|
| 공간 할당 | 공간을 미리 잡지 않음(sparse). 쓸 때 할당 | **공간을 미리 확보** |
| 장점 | 빠르고 디스크를 아낌 | 나중에 root 디스크가 차서 쓰기가 실패할 위험이 없음 |
| 적합 | CI · 일회성 테스트 | 한동안 실제로 써 볼 환경 |

> Swift는 기본적으로 데이터를 3벌 복제합니다. 노드가 3대라면 노드마다 파일 하나씩만 있어도 복제 구성이 됩니다. 단, 파일 크기만큼 각 노드의 root 디스크가 줄어든다는 점을 계산해 두세요.

## 7. 관련 기여

이후 Epoxy 버전에서 Swift를 배포하다가 **Swift 서비스가 권한 오류(`os.setgid()` PermissionError)로 시작되지 않는 문제**를 만났습니다. 원인을 분석해 업스트림에 보고했고, 수정 코드를 직접 제출해 공식 반영되었습니다.

| 항목 | 링크 |
|---|---|
| 문제 보고 | [Launchpad Q824067](https://answers.launchpad.net/openstack-ansible/+question/824067) |
| 수정 | [Gerrit 984906 (os_swift)](https://review.opendev.org/c/openstack/openstack-ansible-os_swift/+/984906) |
