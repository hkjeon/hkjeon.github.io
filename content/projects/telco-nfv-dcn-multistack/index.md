---
title: S사(통신사) NFV 플랫폼 DCN Multi-Stack 전환 (RHOSP13 → RHOSP16.2)
summary: 하나의 Stack으로 Compute 수백 대를 관리하던 RHOSP13 DCN 구조를, Zone마다 독립 Stack을 두는 RHOSP16.2 Multi-Stack으로 재설계한 사례. OVS-DPDK 기반 NFV Compute 튜닝과 사내 TB 사전 검증까지 수행
tags:
  - OpenStack
  - NFV
  - Architecture
date: '2024-09-01T00:00:00Z'
---

{{% pf %}}

{{< kpis >}}
Single → Multi|Stack 구조 전환
3 Stack|Central 1 + Zone 2
16대|Compute 전환 (Zone당 8대)
OVS-DPDK|NFV Compute 튜닝
{{< /kpis >}}

## 프로젝트 개요

| 항목 | 내용 |
|---|---|
| 발주처 | S사(통신사) |
| 기간 | 2024.07 ~ 2024.09 |
| 사업 | RHOSP13 EOS 대응 — **Single Stack DCN을 RHOSP16.2 Multi-Stack으로 재설계**, 고객 TestBed 선도입 |
| 규모 | Central Stack (Controller 3, VM) + Compute Zone Stack 2개 (각 8대) |
| 기술 | RHOSP 16.2 · RHEL 8.4 · TripleO Multi-Stack DCN · ML2/OVN · OVS-DPDK · CPU Pinning · 1G HugePages |

## 구축 형태

| 구분 | 구성 |
|---|---|
| 구조 | Undercloud 1개가 Stack 3개 관리, **Stack 경계 = AZ 경계** — 변경 영향 범위를 Zone 단위로 축소 |
| Role | Central 1 + Zone별 Compute 2 (Zone 전용 네트워크 · 서브넷), Central ↔ Zone L3 라우팅 |
| Central | Controller 3대를 **KVM 호스트 위 VM**으로 구성, 오프라인 저장소 · 컨테이너 레지스트리 동일 호스트 |
| Compute | OVS-DPDK, CPU 용도별 분리(호스트 · PMD · VM), 1G HugePages 132개, 로컬 인스턴스 디스크 |
| 배포 | Central → Zone A → Zone B **Stack별 순차 배포** |

## 구성도

[![Single Stack과 Multi-Stack 구조 비교](multistack-architecture.svg)](multistack-architecture.svg "클릭하면 원본 크기로 열립니다")

[![Central KVM 호스트 인터페이스 구성](kvm-host-network.svg)](kvm-host-network.svg "클릭하면 원본 크기로 열립니다")

## 담당 역할 및 수행 내용

<div class="pf-role">

**역할** Multi-Stack 설계 · 구축 · 시험 VNF 검증 · 구축 작업절차서 작성 (벤더 가이드 없이 직접 설계 · 검증)

</div>

| 단계 | 수행 내용 |
|---|---|
| 설계 | Zone 경계 기준 Stack 분리, Role 3개 · Zone별 네트워크 설계, Central VM 구성 · KVM 호스트 bond(서로 다른 슬롯 NIC) 설계 |
| NFV 튜닝 | CPU 파티셔닝(isolcpus · tuned), NUMA별 PMD 배치, HugePages · DPDK 소켓 메모리, emulator 스레드 공유 코어 분리 |
| 자동화 | firstboot 템플릿으로 Compute 로컬 디스크(LVM · xfs) 자동 구성 |
| 사전 검증 | **사내 TB에서 고객과 동일한 템플릿**(Role 이름까지)으로 DPDK VM 생성까지 선검증 |
| 현장 구축 | 기존 VNF 정리 → KVM 호스트 · 저장소 · Controller VM 구성 → Compute RHEL 8.4 재설치 → Stack 순차 배포, **IP만 변경해 무이슈 적용** |
| 시험 · 산출물 | 시험 VNF 검증(생성 · 삭제, Pinning, HugePages, DPDK 메모리, 외부 통신), 구축 작업절차서 고객 인수 |

<details>
<summary>NFV Compute CPU 분리 · Flavor 설정 상세</summary>

| 용도 | 논리 CPU (72개 중) | 파라미터 |
|---|---|---|
| 호스트 · DPDK lcore · Emulator | 4개 (소켓별 첫 코어 + HT) | `OvsDpdkCoreList`, `NovaComputeCpuSharedSet` |
| OVS PMD | 4개 (NUMA별 1코어 + HT) | `OvsPmdCoreList` |
| VM vCPU | 64개 | `NovaVcpuPinSet`, `isolcpus` |

| Flavor 속성 | 의도 |
|---|---|
| `hw:numa_nodes=1` | VM을 NUMA 노드 하나에 고정 |
| `hw:cpu_policy=dedicated` · `sockets/cores/threads` | vCPU 고정 · 물리 토폴로지(HT)와 일치 |
| `hw:mem_page_size=large` | 1G HugePages (vhost-user 전제) |
| `hw:emulator_threads_policy=share` | emulator 스레드를 호스트 공유 코어로 분리 |

</details>

## 기타

- 결과: 변경 영향 범위 클러스터 전체 → 해당 Zone Stack, 이후 Zone 전환의 기준 모델
- `NovaVcpuPinSet`(RHOSP13 방식) 유지 — 차기 업그레이드 전 `NovaComputeCpuDedicatedSet` 전환 항목으로 관리

{{% /pf %}}
