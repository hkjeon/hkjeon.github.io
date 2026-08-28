---
title: "Kolla-Ansible OpenStack 업그레이드 — Epoxy에서 Gazpacho로, Rocky 9에서 10까지"
date: 2026-08-28
summary: "kolla-ansible로 구축한 OpenStack을 2025.1 Epoxy에서 2026.1 Gazpacho로 올리면서 OS도 Rocky Linux 9에서 10으로 함께 전환한 기록입니다. SLURP 릴리스라 Flamingo를 건너뛸 수 있었고, 대신 kolla-ansible 2026.1이 PyPI에 없다는 점부터 inventory 신규 그룹까지 예상 못 한 지점이 여럿 있었습니다."
tags:
  - OpenStack
  - Kolla-Ansible
  - Gazpacho
  - Rocky Linux
  - 업그레이드
authors:
  - me
featured: true
---

OpenStack 업그레이드는 구축보다 부담이 큽니다. 구축은 실패하면 다시 하면 되지만, 업그레이드는 이미 돌아가는 워크로드를 안고 가야 합니다.

이번에는 두 가지를 동시에 올렸습니다. OpenStack을 **2025.1 Epoxy에서 2026.1 Gazpacho로**, OS를 **Rocky Linux 9.7에서 10.2로**. 둘 중 하나만 해도 될 일을 굳이 함께 묶은 이유와, 그 과정에서 막혔던 지점들을 정리했습니다.

## 1. 왜 두 개를 한 번에

Gazpacho는 SLURP 릴리스입니다. SLURP는 6개월마다가 아니라 1년에 한 번만 업그레이드하면 되도록 만든 모델이고, 직전 SLURP인 2025.1 Epoxy를 쓰는 환경은 2026.1 Gazpacho로 바로 올라갈 수 있습니다. 즉 중간의 2025.2 Flamingo를 건너뛸 수 있습니다.

여기에 OS 문제가 겹쳤습니다. Gazpacho의 kolla 컨테이너 이미지 태그는 `2026.1-rocky-10`입니다. Rocky 9 위에서 Rocky 10 기반 이미지를 쓰는 조합을 유지할 이유가 없었고, kolla-ansible 2026.1 자체가 **Python 3.11 이상**을 요구하는데 Rocky 9 기본 Python은 3.9입니다.

| 항목 | Before | After |
|---|---|---|
| OpenStack | Epoxy (2025.1) | Gazpacho (2026.1) |
| kolla-ansible | 18.8.0 (PyPI) | 22.0.1 (git stable/2026.1) |
| OS | Rocky Linux 9.7 | Rocky Linux 10.2 |
| Python (Deploy) | 3.9 | 3.12 |
| Neutron Plugin | OVN | OVN |

결국 **OS를 올리지 않으면 OpenStack도 못 올리는 구조**였습니다. 한 번에 가는 게 불가피했습니다.

## 2. 대상 환경과 순서

컨트롤러 3대, 컴퓨트 2대, 배포 노드 1대짜리 구성입니다.

| 구분 | 호스트 | 대수 |
|---|---|---|
| Deploy | kolla-deploy | 1 |
| Controller | kolla-osc01 ~ 03 | 3 |
| Compute | kolla-comp01 ~ 02 | 2 |

롤링 방식으로 한 노드씩 진행했고, OS는 `dnf distro-sync`를 이용한 in-place 전환입니다. 순서는 **컴퓨트 → 컨트롤러 → 배포 노드** 입니다.

[![업그레이드 순서와 노드별 절차](upgrade-order.svg)](upgrade-order.svg "클릭하면 원본 크기로 열립니다")

배포 노드를 마지막에 둔 이유는 단순합니다. **배포 노드가 살아 있어야 다른 노드에 명령을 내릴 수 있기 때문**입니다. 컴퓨트를 먼저 한 건 장애 시 영향 범위가 가장 작아서입니다.

시작 전 DB 백업은 필수입니다.

```bash
kolla-ansible mariadb_backup -i /root/multinode
```

## 3. OS 업그레이드 공통 절차

Rocky 9 → 10 in-place 전환은 세 단계입니다. 모든 노드에서 동일하게 반복합니다.

### 3.1 릴리스 패키지 교체와 distro-sync

```bash
cd /tmp
REPO_URL="https://dl.rockylinux.org/pub/rocky/10/BaseOS/x86_64/os/Packages/r/"

rpm -Uvh --nodeps \
  ${REPO_URL}rocky-gpg-keys-10.2-1.1.el10.noarch.rpm \
  ${REPO_URL}rocky-release-10.2-1.1.el10.noarch.rpm \
  ${REPO_URL}rocky-repos-10.2-1.1.el10.noarch.rpm

# 새 repo 파일(.rpmnew)을 실제 설정으로 교체
for f in /etc/yum.repos.d/*.repo.rpmnew; do
    [ -f "$f" ] || continue
    base="${f%.rpmnew}"
    [ -f "$base" ] && mv "$base" "${base}.rpmold"
    mv "$f" "$base"
done

dnf -y --disablerepo="*" \
    --enablerepo=baseos --enablerepo=appstream --enablerepo=extras \
    --releasever=10.2 --allowerasing --skip-broken \
    --setopt=deltarpm=false distro-sync

reboot
```

`.rpmnew` 처리를 빼먹으면 안 됩니다. 릴리스 패키지를 교체해도 기존 repo 설정 파일이 그대로 남아 있으면 여전히 el9 저장소를 바라봅니다.

### 3.2 el9 잔여 패키지 정리 (재부팅 후)

`distro-sync` 한 번으로 모든 패키지가 넘어가지는 않습니다. 의존성 때문에 남은 el9 패키지를 반복적으로 걷어냅니다.

```bash
export LANG=en_US.UTF-8
dnf clean all

typeset -i n_retry
while true; do
    let n_retry++
    failed=$(rpm -e $(rpm -qa | grep '.el9\.') 2>&1 | grep 'is needed by' | awk '{print $1}' | head -n1)
    [ -z "$failed" ] && break
    pkg=$(rpm -qf $failed --queryformat "%{NAME}")
    dnf -y update $pkg || rpm -e --nodeps $(rpm -qf $failed)
done

dnf -y update && rpm --rebuilddb
```

의존성 오류에서 필요한 패키지를 뽑아내 업데이트하고, 그래도 안 되면 `--nodeps`로 제거하는 방식을 남는 게 없을 때까지 반복합니다.

### 3.3 Docker 재설치

**배포 노드를 제외한 모든 컨테이너 노드**에서 필요합니다. OS 전환 과정에서 docker-ce가 깨집니다.

```bash
dnf -y remove docker-ce
dnf -y config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker ps
```

전환 확인은 아래로 합니다.

```bash
cat /etc/os-release | grep -E "^VERSION="
# VERSION="10.2 (Red Quartz)"
```

## 4. 컴퓨트 노드

노드 하나씩 정지 → OS 전환 → 재배포 순입니다.

```bash
source /opt/kolla-venv/bin/activate

# 1. 컨테이너 정지
kolla-ansible stop -i /root/multinode --limit kolla-comp01 --yes-i-really-really-mean-it

# 2. 3장의 OS 업그레이드 절차 수행

# 3. 재배포
kolla-ansible bootstrap-servers -i /root/multinode --limit kolla-comp01
kolla-ansible deploy -i /root/multinode --limit kolla-comp01
```

comp02도 동일하게 반복합니다. 이 단계까지는 순조로웠습니다.

## 5. 컨트롤러 노드 — `--limit`을 쓰면 안 되는 지점

컨트롤러는 Galera 클러스터가 걸려 있어 신경 쓸 게 많습니다. 작업 전 반드시 상태를 확인합니다.

```bash
docker exec -it mariadb mysql -u root -p<DB_PASSWORD>
```

```sql
SHOW STATUS LIKE 'wsrep_cluster_size';        -- 3
SHOW STATUS LIKE 'wsrep_local_state_comment'; -- Synced
```

`wsrep_cluster_size`가 3이 아니거나 상태가 `Synced`가 아니면 진행하면 안 됩니다.

정지와 OS 전환은 컴퓨트와 같습니다. 문제는 재배포 단계였습니다.

```bash
kolla-ansible bootstrap-servers -i /root/multinode --limit kolla-osc03

# 여기서 --limit을 쓰면 안 된다
kolla-ansible deploy -i /root/multinode
```

**`deploy`는 `--limit` 없이 전체 대상으로 실행해야 합니다.** 컴퓨트에서 하던 대로 `--limit kolla-osc03`을 붙이면 Keystone Fernet key bootstrap에서 실패합니다. Fernet key는 컨트롤러 전체가 동일한 키셋을 공유해야 하는데, 한 노드만 대상으로 돌리면 나머지와 동기화가 깨지기 때문입니다.

MariaDB가 올라오지 않으면 복구를 먼저 돌립니다.

```bash
kolla-ansible mariadb_recovery -i /root/multinode
```

osc03 → osc01 → osc02 순으로 한 대씩 반복합니다.

## 6. 배포 노드와 kolla-ansible 2026.1 설치

배포 노드는 Docker 재설치가 필요 없습니다. 대신 kolla-ansible을 새로 깔아야 합니다.

**kolla-ansible 2026.1은 PyPI에 없습니다.** `pip install kolla-ansible==22.0.1` 이 통하지 않아서 처음에 당황했습니다. git에서 직접 받아야 합니다.

```bash
dnf -y install python3.12 python3.12-devel git

# 기존 venv 제거 후 Python 3.12로 재생성
python3.12 -m venv /opt/kolla-venv
source /opt/kolla-venv/bin/activate
pip install --upgrade pip

cd /opt
git clone -b stable/2026.1 https://opendev.org/openstack/kolla-ansible.git
pip install -e /opt/kolla-ansible

pip install ansible-core
kolla-ansible install-deps

kolla-ansible --version   # 22.x.x
ansible --version
```

Python 3.12로 venv를 새로 만드는 게 핵심입니다. 기존 3.9 venv를 그대로 쓰면 설치 자체가 안 됩니다.

## 7. inventory 신규 그룹 추가

Gazpacho에서 서비스가 세분화되면서 **inventory에 신규 그룹이 추가됐습니다.** 이걸 모르고 `upgrade`를 돌리면 `groups['neutron-rpc-server']` 같은 오류로 중간에 멈춥니다.

```bash
cat >> /root/multinode << 'EOF'

[neutron-rpc-server:children]
network

[neutron-periodic-worker:children]
network

[neutron-ovn-maintenance-worker:children]
network

[neutron-ovn-vpn-agent:children]
network

[nova-metadata:children]
compute

[ovn-sb-db-relay:children]
network

[kolla_toolbox:children]
control
network
compute
storage
monitoring
EOF
```

Neutron 계열이 많은 게 눈에 띕니다. RPC 서버와 주기 작업 워커가 분리됐고, OVN 유지보수 워커와 SB DB relay가 별도 그룹으로 빠졌습니다. 규모가 큰 환경에서 Neutron 부하를 나누기 위한 변화로 보입니다.

`globals.yml`도 손봐야 합니다.

| 항목 | Before | After | 비고 |
|---|---|---|---|
| `openstack_release` | `"2025.1"` | `"2026.1"` | 필수 |
| `neutron_external_interface` | 미설정 | `"bond2"` | 미설정 시 undefined 오류 |

## 8. upgrade 실행

순서가 중요합니다. **이미지를 먼저 받아둬야 합니다.**

```bash
source /opt/kolla-venv/bin/activate
kolla-ansible pull -i /root/multinode
```

`pull`을 건너뛰고 바로 `upgrade`를 돌리면 `check_image()`에서 NoneType 오류가 납니다. 이미지가 없는 상태를 친절하게 알려주지 않아서 원인 파악에 시간이 걸립니다.

그리고 `kolla_toolbox`는 수동으로 갱신해야 했습니다. 구버전 toolbox가 남아 있으면 `ansible-runner not found` 오류가 발생합니다.

```bash
# 모든 컨테이너 노드에서
docker pull quay.io/openstack.kolla/kolla-toolbox:2026.1-rocky-10
docker rm -f kolla_toolbox
```

```bash
# 배포 노드에서 재생성
kolla-ansible deploy -i /root/multinode --tags common
```

여기까지 오면 본 작업입니다.

```bash
kolla-ansible upgrade -i /root/multinode
```

## 9. 막혔던 지점 정리

실제로 부딪힌 오류들입니다. 대부분 **버전 간 변경사항을 미리 알지 못해서** 생긴 것들입니다.

| 오류 | 원인 | 조치 |
|---|---|---|
| `check_image()` NoneType | 2026.1 이미지 미pull | `kolla-ansible pull` 선행 |
| `groups['neutron-rpc-server']` 없음 | inventory 신규 그룹 누락 | 7장 그룹 추가 |
| `groups['nova-metadata']` 없음 | 동일 | 7장 그룹 추가 |
| `groups['ovn-sb-db-relay']` 없음 | 동일 | 7장 그룹 추가 |
| `ansible-runner not found` | kolla_toolbox 구버전 | 8장 수동 갱신 |
| `neutron_external_interface` undefined | 변수 미정의 | globals.yml에 추가 |
| MariaDB cluster stopped | Galera 중단 | `mariadb_recovery` 후 재시도 |
| Keystone Fernet bootstrap 오류 | `deploy`에 `--limit` 사용 | `--limit` 없이 전체 실행 |

**inventory 그룹 누락이 가장 성가셨습니다.** 오류가 한 번에 다 나오지 않고 하나 고치면 다음 게 나오는 식이라, 세 번 반복해서 멈췄습니다. 릴리스 노트에서 신규 그룹 목록을 먼저 확인했다면 한 번에 끝났을 일입니다.

## 10. 완료 확인

```bash
# 모든 컨테이너가 2026.1-rocky-10 태그인지
docker ps --format "table {{.Names}}\t{{.Image}}" | grep 2026

source /etc/kolla/admin-openrc.sh
openstack endpoint list
openstack compute service list
openstack network agent list
openstack volume service list
```

| 확인 항목 | 방법 |
|---|---|
| 모든 노드 Rocky 10.2 | `cat /etc/os-release` |
| kolla-ansible 22.x | `kolla-ansible --version` |
| 컨테이너 2026.1-rocky-10 | `docker ps \| grep 2026` |
| Galera 정상 (size=3) | `SHOW STATUS LIKE 'wsrep_cluster_size'` |
| Keystone endpoint | `openstack endpoint list` |
| Nova compute 서비스 | `openstack compute service list` |
| Neutron agent | `openstack network agent list` |
| Cinder 서비스 | `openstack volume service list` |
| Horizon 접속 | 브라우저 확인 |

## 11. 정리

| 항목 | 내용 |
|---|---|
| 방식 | 롤링 업그레이드 + OS in-place 전환 |
| 순서 | 컴퓨트 → 컨트롤러 → 배포 노드 |
| 건너뛴 릴리스 | 2025.2 Flamingo (SLURP) |
| 예상 못 한 지점 | PyPI 미제공, inventory 신규 그룹, kolla_toolbox 수동 갱신 |

돌아보면 **OpenStack 업그레이드 자체보다 OS 전환과 도구 체인 준비에 시간이 더 들었습니다.** kolla-ansible 설치가 git clone으로 바뀐 것, Python 최소 버전이 올라간 것, inventory 구조가 바뀐 것 모두 `upgrade` 명령을 실행하기 전에 끝내야 하는 일이었습니다.

SLURP 덕에 릴리스 하나를 건너뛴 건 분명한 이득이었습니다. 다만 건너뛴 만큼 **두 릴리스치의 변경사항이 한꺼번에 몰려온다**는 점은 감안해야 합니다. 릴리스 노트를 두 개 읽는 게 결국 가장 빠른 길입니다.

---

**참고**

- [kolla-ansible 2026.1 문서](https://docs.openstack.org/kolla-ansible/2026.1/)
- [kolla-ansible 운영 가이드](https://docs.openstack.org/kolla-ansible/2026.1/user/operating-kolla.html)
- [Rocky Linux 10 마이그레이션](https://docs.openstack.org/kolla-ansible/2025.1/user/rocky-linux-10.html)
