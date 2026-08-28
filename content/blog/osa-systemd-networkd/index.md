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
| IP 설정 방식 | netplan으로 bond·VLAN·브리지·IP 전체 수동 구성 | `ip addr`로 임시 IP만 설정 |
| 패키지 설치 | 플레이북 | 플레이북 |
| 시간 설정 | 플레이북 | 플레이북 |
| 네트워크·브리지 | **수동 (netplan)** | **플레이북** |

수동 구간이 "OS 설치 + IP 한 줄"로 줄어듭니다.

## 2. systemd-networkd를 검토한 이유

netplan은 Ubuntu의 표준 네트워크 설정 방식이고, OSA 가이드도 이 방식을 안내합니다. 자동화가 불가능한 것도 아닙니다. Jinja2 템플릿을 만들어 뿌리면 됩니다.

그럼에도 systemd-networkd를 들여다본 이유는 이렇습니다.

| 항목 | netplan | systemd-networkd |
|---|---|---|
| 위치 | OSA 외부, 별도 롤/템플릿 필요 | `openstack_hosts` 롤에 내장 |
| 적용 방식 | netplan → renderer로 변환 | `.netdev` / `.network` 직접 생성 |
| 배포 시점 | 별도 단계 | `setup-hosts.yml` 실행 시 함께 |
| 파일 관리 | 기존 netplan 설정과 충돌 가능 | prefix로 OSA 생성분 격리 |

**Ubuntu Server에서 netplan의 기본 renderer는 systemd-networkd입니다.** netplan YAML을 쓰면 그것이 `.netdev`, `.network` 파일로 변환되어 systemd-networkd가 실제로 처리합니다. 즉 netplan은 그 위에 얹힌 변환 계층입니다.

어차피 최종적으로 systemd-networkd가 동작한다면, OSA가 이미 지원하는 경로로 직접 정의하는 편이 단계가 하나 줄어듭니다. 무엇보다 직접 만든 롤을 유지보수할 필요가 없습니다.

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
| `br-stsvc` | **Ceph 서비스(public) 네트워크** — 클라이언트가 OSD·MON에 접근 | ✅ | ✅ |
| `br-stcl` | **Ceph 클러스터 네트워크** — OSD 간 복제·리밸런싱 트래픽 | ✅ | — |

Ceph에서 서비스 네트워크와 클러스터 네트워크를 나누는 이유는, **복제 트래픽이 클라이언트 I/O를 밀어내지 않게 하기 위해서**입니다. 복구나 리밸런싱이 돌면 OSD 간 트래픽이 순간적으로 크게 늘어나는데, 이게 서비스 네트워크와 같은 경로를 타면 VM의 디스크 응답이 함께 느려집니다.

그래서 HCI 노드는 브리지 5개, 컴퓨트 노드는 4개입니다. **차이는 `br-stcl` 하나뿐인데**, OSD가 없는 노드에는 복제 트래픽이 흐르지 않기 때문입니다. 그룹을 나눈 이유가 여기에 있습니다.

### 논리 네트워크 구성

[![OpenStack 논리 네트워크 구성도](network-topology.svg)](network-topology.svg "클릭하면 원본 크기로 열립니다")

관리 네트워크는 배포 노드가 Ansible로 붙는 경로이자 OpenStack 서비스 간 통신 경로입니다. 배포 노드는 이 망에만 물리면 됩니다.

**Ceph 네트워크 두 개는 성격이 다릅니다.** `br-stsvc`는 컴퓨트 노드의 VM도 볼륨을 붙이려면 타야 하는 경로입니다. 반면 `br-stcl`은 OSD 간 복제·리밸런싱 전용이라 OSD가 올라간 HCI 노드끼리만 오갑니다. compute01이 이 망에 연결되지 않는 이유입니다.

### 물리 인터페이스 구성

논리 네트워크가 물리 NIC 위에 어떻게 쌓이는지가 실제 설정의 핵심입니다.

[![물리 인터페이스 계층 구조](interface-stack.svg)](interface-stack.svg "클릭하면 원본 크기로 열립니다")

**bond1은 관리, bond2는 VLAN으로 나눠 쓰는 서비스 계열, bond3은 Ceph 복제 전용**입니다. 복제 트래픽에 물리 NIC를 통째로 할당한 이유는 앞서 말한 대로 클라이언트 I/O와 경로를 분리하기 위해서입니다.

위 그림은 HCI 노드 기준입니다. 컴퓨트 노드는 `bond2.21`과 `br-stcl`만 빠지고 나머지는 동일합니다.

아래 설정 코드는 이 그림을 그대로 YAML로 옮긴 것입니다.


## 6. 그 앞 단계 — 노드 부트스트랩 플레이북

systemd-networkd 설정은 `setup-hosts.yml`이 돌아야 적용됩니다. 그런데 폐쇄망에서는 그 전에 노드가 갖춰야 할 것들이 있습니다. 외부 저장소를 못 쓰니 apt 소스를 내부 미러로 바꿔야 하고, `bridge-utils`나 `vlan` 같은 패키지도 미리 깔려 있어야 합니다.

이 부분을 별도 플레이북으로 묶었습니다.

```yaml
---
- name: Initial bootstrap before openstack-ansible setup-hosts.yml
  hosts: all
  become: true
  gather_facts: true

  vars_files:
    - /etc/openstack_deploy/user_variables.yml

  vars:
    bootstrap_timezone: "Asia/Seoul"

    # 오프라인 저장소 (deb822 형식)
    apt_deb822_source_content: |
      Types: deb
      URIs: http://{{ deploy_repo_ip }}/repo/epoxy/main/
      Suites: ./
      Trusted: yes

    bootstrap_packages:
      - bridge-utils
      - debootstrap
      - ifenslave
      - openssh-server
      - tcpdump
      - vlan
      - python3
      - traceroute
      - chrony
```

주요 태스크는 이렇습니다.

| 단계 | 내용 |
|---|---|
| SSH | root 로그인 허용, 배포 노드 공개키 배포 |
| 시간 | `timedatectl`로 타임존 설정, chrony 설치 |
| 호스트명 | `node_fixed_ips`의 `hostname` 값으로 설정 |
| apt | 기본 Ubuntu 소스 비활성화 → 내부 미러로 교체 |
| 패키지 | bond·VLAN·bridge에 필요한 패키지 설치 |
| pip | 내부 PyPI 미러 지정 |
| 재시작 | 커널 업데이트 반영을 위한 재부팅 |

호스트명 설정에서 앞서 만든 `node_fixed_ips`를 그대로 재사용합니다.

```yaml
    - name: Set hostname
      ansible.builtin.hostname:
        name: "{{ node_fixed_ips.get(inventory_hostname, {}).get('hostname', inventory_hostname) }}"
```

**IP와 호스트명이 한 파일에 모여 있으니, 부트스트랩과 네트워크 설정이 같은 값을 바라봅니다.** 노드를 추가할 때 `user_variables.yml`에 항목 하나만 넣으면 양쪽이 함께 따라옵니다.

패키지 설치 항목 중 `bridge-utils`, `ifenslave`, `vlan`은 그 자체로 이 글의 주제와 직결됩니다. **이게 빠지면 뒤에서 정의한 bond와 VLAN이 올라오지 않습니다.**

재부팅은 실수로 돌리면 곤란하므로 2단계 확인을 넣었습니다.

```yaml
  post_tasks:
    - name: Confirm reboot Check Step 1
      ansible.builtin.pause:
        prompt: "Reboot target host(s) now? Type 'yes' to continue"
      register: reboot_confirm_1
      run_once: true

    - name: Confirm reboot Check Step 2
      ansible.builtin.pause:
        prompt: "Final confirmation. Type 'yes' again to reboot"
      register: reboot_confirm_2
      run_once: true
      when: reboot_confirm_1.user_input | lower == 'yes'
```

실행은 OSA의 동적 인벤토리를 그대로 씁니다.

```bash
# 전체 노드
ansible-playbook -i /opt/openstack-ansible/inventory/dynamic_inventory.py \
  initial-setup.yml -u ubuntu --ask-pass --ask-become-pass

# 특정 노드만
ansible-playbook -i /opt/openstack-ansible/inventory/dynamic_inventory.py \
  initial-setup.yml -u ubuntu -l compute01 --ask-pass --ask-become-pass
```

이 시점에 노드에 있는 건 **OS와 `ip addr`로 붙인 임시 IP 하나뿐**입니다. 배포 노드에서 SSH만 닿으면 나머지는 플레이북이 채웁니다.

정리하면 전체 흐름은 이렇게 됩니다.

[![노드 준비부터 OpenStack 배포까지의 흐름](deploy-flow.svg)](deploy-flow.svg "클릭하면 원본 크기로 열립니다")

**손으로 하는 건 OS 설치와 임시 IP 부여, 이 둘뿐입니다.** 나머지 세 단계는 배포 노드에서 플레이북으로 진행됩니다.

## 7. HCI 노드 설정

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

## 8. 노드별 IP를 한 곳에서 관리하기

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

## 9. 컴퓨트 노드 설정

컴퓨트 전용 노드는 **HCI 노드에서 Ceph 클러스터망만 빠진 구조**입니다. OSD가 올라가지 않으니 복제 트래픽이 없고, 따라서 `br-stcl`과 그에 쓰이던 `bond2.21`이 필요 없습니다.

반대로 `br-stsvc`는 그대로 필요합니다. **컴퓨트에서 뜨는 VM이 Ceph 볼륨을 붙이려면 OSD·MON에 접근해야 하기 때문입니다.**

```yaml
# group_vars/compute_hosts.yml
openstack_hosts_systemd_networkd_devices:
  - NetDev: { Name: bond1, Kind: bond }
    Bond: { Mode: active-backup, MIIMonitorSec: "100ms" }
  - NetDev: { Name: bond2, Kind: bond }
    Bond: { Mode: active-backup, MIIMonitorSec: "100ms" }
  - NetDev: { Name: bond3, Kind: bond }
    Bond: { Mode: active-backup, MIIMonitorSec: "100ms" }

  - NetDev: { Name: bond2.22, Kind: vlan }
    VLAN: { Id: 22 }
  - NetDev: { Name: bond2.24, Kind: vlan }
    VLAN: { Id: 24 }

  - NetDev: { Name: br-mgmt, Kind: bridge }
  - NetDev: { Name: br-ext, Kind: bridge }
  - NetDev: { Name: br-vxlan, Kind: bridge }
  - NetDev: { Name: br-stsvc, Kind: bridge }

openstack_hosts_systemd_networkd_networks:
  - interface: eno1
    match: { name: eno1 }
    bond: bond1
  - interface: eno2
    match: { name: eno2 }
    bond: bond2
  - interface: eno3
    match: { name: eno3 }
    bond: bond3

  - interface: bond2
    match: { name: bond2 }
    vlan:
      - bond2.22
      - bond2.24

  - interface: bond1
    match: { name: bond1 }
    bridge: br-mgmt
  - interface: bond2.22
    match: { name: bond2.22 }
    bridge: br-ext
  - interface: bond2.24
    match: { name: bond2.24 }
    bridge: br-vxlan
  - interface: bond3
    match: { name: bond3 }
    bridge: br-stsvc

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

HCI 설정과 나란히 놓고 보면 차이가 명확합니다.

| 항목 | HCI 노드 | 컴퓨트 노드 |
|---|---|---|
| bond | 3개 | 3개 |
| VLAN | `bond2.21`, `bond2.22`, `bond2.24` | `bond2.22`, `bond2.24` |
| 브리지 | 5개 | 4개 (`br-stcl` 제외) |
| Ceph 역할 | MON + OSD | 클라이언트 |

**차이가 VLAN 하나와 브리지 하나뿐입니다.** 구조를 통일해두면 노드 역할이 바뀌어도 정의를 크게 손대지 않아도 됩니다. 컴퓨트로 쓰던 노드에 OSD를 얹어 HCI로 전환한다면 `bond2.21`과 `br-stcl`만 추가하면 됩니다.

## 10. 적용

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

## 11. 걸렸던 부분

**적용 순서에 주의해야 합니다.** bond → VLAN → bridge 순으로 의존 관계가 있어서, 정의가 빠지면 상위 장치가 올라오지 않습니다. systemd-networkd는 조용히 실패하는 편이라 `networkctl` 로 개별 확인이 필요합니다.

**노드 그룹화 방식은 직접 정해야 합니다.** OSA가 이 변수들을 노드 역할별로 나눠 쓰는 표준 형태를 제공하는지 확인하지 못했습니다. 그래서 `group_vars/`에 컨트롤러와 컴퓨트 파일을 따로 두는 방식으로 나눴습니다. 같은 그룹 안에 NIC 구성이 다른 노드가 섞이면 `host_vars`로 내려야 합니다.

## 12. 정리

| 항목 | 수동 구성 (netplan) | systemd-networkd 자동화 |
|---|---|---|
| 적용 방식 | 노드마다 개별 작업 | `setup-hosts.yml` 단계에서 일괄 |
| 네트워크 셋업 소요 | 노드 수에 비례 | 전체 노드 1~2분 |
| 재구축 시 | 처음부터 반복 | 정의 파일 재사용 |
| 오타 위험 | 노드마다 존재 | 정의가 한 곳에 모임 |

배포 자동화를 이야기할 때 보통 OpenStack 설치만 떠올리지만, **노드가 준비되는 지점부터 코드로 관리하면 재현성이 확실히 달라집니다.** 특히 폐쇄망 사업처럼 같은 구성을 여러 번 다시 세워야 하는 환경에서 차이가 큽니다.

---

**참고**

- [OpenStack-Ansible openstack_hosts 롤 문서](https://docs.openstack.org/openstack-ansible-openstack_hosts/latest/)
- [openstack-ansible-openstack_hosts 저장소](https://github.com/openstack/openstack-ansible-openstack_hosts)
