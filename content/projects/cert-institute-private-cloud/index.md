---
title: 국가 시험인증기관 프라이빗 클라우드 구축
summary: 시험·인증 기관의 업무시스템 11종을 수용할 OpenStack 프라이빗 클라우드를 폐쇄망 환경에서 설계·구축한 사례. 용도별 8개 망 분리와 FC SAN·NAS 이중 스토리지 연동, Kubernetes 플랫폼용 VM 인프라 제공까지 수행
tags:
  - OpenStack
  - Architecture
  - Kubernetes
date: '2025-11-01T00:00:00Z'
---

{{% pf %}}

{{< kpis >}}
12대|베어메탈 (Controller 3 · Compute 7)
8개|용도별 분리 망
11종|업무시스템 이관 (서비스 IP 유지)
2,688|vCPU · 메모리 7TB
{{< /kpis >}}

## 프로젝트 개요

| 항목 | 내용 |
|---|---|
| 발주처 | 국가 시험인증기관 |
| 기간 | 2025.04 ~ 2025.11 (설계 2025.05~ · 현장 구축 완료 2025.09 → VM 생성 · 이관 지원 · 성능측정 → 전환 · 시범 운영 2025.10 → 안정화 ~2025.11) |
| 사업 | 물리 서버에 흩어진 기관 업무시스템을 **폐쇄망 OpenStack 프라이빗 클라우드(IaaS + PaaS)**로 통합 |
| 규모 | 2 Rack · 베어메탈 12대 (Controller 3 / Compute 7 / 배포 1 / CMP 1) · SAN·NAS 각 50TB |
| 기술 | OpenStack Caracal (2024.1) · OVN · Ubuntu 22.04 · FC SAN Multipath · Kubernetes 1.30 |

## 구축 형태

| 구분 | 구성 |
|---|---|
| 배포 | **폐쇄망 · 베어메탈 설치** — Deploy VM에 APT·PyPI·Git 미러, 운영용 OS 패키지 저장소 별도 구성 |
| 네트워크 | **8개 망 분리** — Provider VLAN 4종(서비스 · 컨테이너 · 모니터링 · DMZ), NAS 2종, 백업, FC SAN |
| Compute | **4-Bond** (25G LACP ×3 + 백업 1G) + FC 32G ×2, 본딩 포트를 NIC 슬롯별로 분산 |
| 스토리지 | **FC SAN 50TB**(Cinder · Glance) + **NAS 50TB**(NFS) — 인프라용 / VM용 경로 분리 |
| 고가용성 | Controller · Galera 3중화, HAProxy + Keepalived, 방화벽 · ToR · SAN 스위치 이중화 |
| PaaS | OpenStack VM 위 **Kubernetes 2개 클러스터**(Common / Dev) — VM · 네트워크는 본인 제공, 클러스터는 K8s팀 구축 |

## 구성도

[![클라우드 네트워크 구성 — 백본 연동부터 노드별 망 연결까지](network-topology.svg)](network-topology.svg "클릭하면 원본 크기로 열립니다")

![Compute 노드 인터페이스 구성](compute-bonding.svg)

| 망 | 대역 | 용도 |
|---|---|---|
| IPMI | `10.0.0.0/24` | OOB 관리 (서비스망과 완전 분리) |
| External API | `172.16.1.0/24` | Horizon, CMP · 스토리지 API |
| Internal API | `10.0.2.0/24` | OpenStack 서비스 간 통신 |
| Tenant | `10.0.3.0/24` | 인스턴스 오버레이 (Geneve) |
| Provider (서비스) | `172.17.x.0/24` ×4 | 업무 · 컨테이너 · 모니터링 · DMZ VLAN |
| Provider (NAS) | `172.18.x.0/24` ×2 | 클러스터용 / VM용 NAS |
| Provider (백업) | `192.168.0.0/24` | VM 백업 전용 |
| SAN | FC 32G | Cinder 볼륨 전용 |

## 담당 역할 및 수행 내용

<div class="pf-role">

**역할** 클라우드 아키텍처 설계 · 구축 · 업무시스템 이관 · 운영 전환 (설계부터 인수인계까지 전 단계 수행)

</div>

| 단계 | 수행 내용 |
|---|---|
| 설계 | 아키텍처정의서 작성 — 망 · VLAN · IP/NAT · 포트맵 설계, 자원 산정 (CPU 4:1 · 메모리 1:1 · 노드당 32GB 예약) |
| 폐쇄망 배포 | APT · PyPI · Git 미러 컨테이너 구성, 운영 기간용 OS 패키지 저장소 VM 구축 |
| OpenStack | Controller 3중화 · Galera · HAProxy/Keepalived, OVN, FC SAN Multipath · NAS 연동, 볼륨 기반 Flavor(Disk=0) |
| K8s 인프라 제공 | K8s팀 요청 기반 VM 대상 정리, IP 설계 · 할당, 인스턴스 생성 · 제공 (클러스터 구축은 K8s팀 수행) |
| 이관 | 업무시스템 11종 **서비스 IP 유지 이관**, NAT 매핑 대조 검증, 프로젝트 3개 · VM 53대 Quota 구성 |
| 구축 이후 지원 | 업무 VM 생성, 데이터 마이그레이션 이슈 대응, 성능측정 |
| 운영 전환 | 운영자 매뉴얼 · 교육, 시스템 전환 · 시범 운영, 인수인계, 시스템구축결과서 작성 |

## 기타

- 구축 후 기관 백본 스위치 교체 시, 포트맵 문서 갱신만으로 변경 범위를 파악해 대응
- DB는 NAS로 Full 백업 · 7일 보관 — 논리적 장애(삭제 · 마이그레이션 실패) 대비

{{% /pf %}}
