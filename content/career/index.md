---
title: '경력기술서'
summary: '17년간 수행한 프로젝트 전체 이력 — 대표 프로젝트와 경력 구간별 수행 내역'
date: 2026-09-21
type: landing

sections:
  - block: portfolio
    id: featured
    content:
      title: "대표 프로젝트"
      subtitle: "상세 사례 카드 — 클릭하면 구성과 수행 내용을 볼 수 있습니다"
      count: 0
      filters:
        folders:
          - projects
    design:
      columns: 3
      spacing:
        padding: ["4rem", "0", "2rem", "0"]

  - block: markdown
    id: career-summary
    content:
      title: "경력 요약"
      text: |
        | 기간 | 소속 | 구분 | 주요 업무 |
        |---|---|---|---|
        | 2024.11 ~ 현재 | N사 → I사 | IaaS 솔루션 · 플랫폼 | OpenStack-Ansible 기반 IaaS 솔루션 개발, 공공 프라이빗 클라우드 구축, 2026.07 합병 후 Kolla-Ansible 기반 IaaS 플랫폼 서비스 |
        | 2020.04 ~ 2024.10 | E사 → O사 | S사(통신사) 5G 가상화 · 컨테이너 | RHOSP13/16 가상화 플랫폼, RHOCP 4 컨테이너 플랫폼 구축·운영, 구축 파트장 |
        | 2016.09 ~ 2020.03 | E사 → A사 → E사 → A사 | 프라이빗 클라우드 · NFV | 공공·기업 OpenStack, Ceph, NFV/SDN 구축 및 유지보수 |
        | 2009.03 ~ 2016.06 | T사 → E사 | 통신 시험장비 | LTE/IMS 시험장비·시뮬레이터 공급, 망 구축, 호처리 검증 |

        ★ 표시는 상단 대표 프로젝트 카드로 상세 내용이 정리된 사례입니다. 회사·발주처는 첫 글자로 표기하고, 공공·보안 분야 발주처는 업종으로만 표기합니다.
    design:
      spacing:
        padding: ["2rem", "0", "1rem", "0"]

  - block: markdown
    id: career-iaas
    content:
      title: "2024.11 ~ 현재 · IaaS 솔루션 · 플랫폼"
      text: |
        | 기간 | 소속 | 프로젝트 | 역할 · 주요 기술 |
        |---|---|---|---|
        | 2026.07 ~ 현재 | I사 | IaaS 플랫폼 서비스 구축·운영 (합병 후) | Kolla-Ansible 기반 OpenStack, 셀프서비스 포털 배포, 기존 납품 OSA 클라우드 기술지원·유지보수 |
        | 2025 | N사 | ★ [국가 시험인증기관 프라이빗 클라우드 구축](/projects/cert-institute-private-cloud/) | 설계·구축 |
        | 2025 | N사 | 국가 보안기술 연구기관 N2SF Test-Bed 클라우드 구축 | OpenStack 구축 |
        | 2025.05 | N사 | ★ [공공 인프라 공기업 업무망 OpenStack 재구축 및 VM 이관](/projects/public-dcn-multicluster/) | 재구축, VM 이관 |
        | 2024.11 ~ 2026.07 | N사 | 공공 인프라 공기업 정보인프라 도입·증설 및 유지보수 | OpenStack 3개 클러스터 유지보수 |
        | 2024.11 ~ 2026.07 | N사 | OSA 기반 IaaS 솔루션 배포 패키지 개발 | Caracal·Epoxy, 폐쇄망 오프라인 설치, systemd-networkd 자동화, Cinder Multi-Backend, 업스트림 기여 |

  - block: markdown
    id: career-telco
    content:
      title: "2020.04 ~ 2024.10 · 통신사 5G 가상화 · 컨테이너"
      text: |
        | 기간 | 소속 | 프로젝트 | 역할 · 주요 기술 |
        |---|---|---|---|
        | 2024.01 ~ 2024.10 | O사 | ★ [S사(통신사) 메시징 시스템 VMware → OpenStack 전환](/projects/vmware-to-openstack-migration/) | 파트장, RHOSP16 |
        | 2024.07 ~ 2024.09 | O사 | ★ [S사(통신사) NFV 플랫폼 DCN Multi-Stack 전환](/projects/telco-nfv-dcn-multistack/) | 설계·구축, RHOSP 16.2, OVS-DPDK |
        | 2023.08 ~ 2024.10 | E사 | S사(통신사) 5G AMF 컨테이너 플랫폼 구축·기술지원 | RHOCP |
        | 2023.01 ~ 2024.10 | E사 | S사(통신사) 가입자 DB(CSDB) 컨테이너 플랫폼 구축·기술지원 | RHOCP |
        | 2022.09 ~ 2024.10 | E사 | S사(통신사) IMS(cMSS) 컨테이너 플랫폼 설계·구축 | RHOCP 4.10 |
        | 2022.04 ~ 2022.07 | E사 | L사(통신사) Test-Bed 컨테이너 플랫폼 구축 | RHOCP 4.10, Local Repo, CSN 노드 |
        | 2021.12 ~ 2022.07 | E사 | S사(통신사) 5G SA Core CNF 플랫폼 구축 | RHOCP 4.9, Local Repo, CSN 노드 |
        | 2021.08 ~ 2024.10 | E사 | S사(통신사) 5G 게이트웨이 라인업 간소화 재구축 | S/PGW → SPGW, OpenStack |
        | 2020.04 ~ 2024.10 | E사 | ★ [S사(통신사) 대규모 5G NSA 가상화 플랫폼 구축 및 운영](/projects/s-company-rhosp/) | RHOSP13 (DCN), DPDK, SR-IOV, PCI-PT, 200대+ 노드 점검 자동화 |

  - block: markdown
    id: career-nfv
    content:
      title: "2016.09 ~ 2020.03 · 프라이빗 클라우드 · NFV"
      text: |
        | 기간 | 소속 | 프로젝트 | 역할 · 주요 기술 |
        |---|---|---|---|
        | 2019.11 ~ 2020.02 | A사 | 에너지 공기업 클라우드PC 고도화 | OpenStack, Ceph, Octavia, GPU |
        | 2019.11 ~ 2019.12 | A사 | D사(클라우드 서비스 기업) 프라이빗 클라우드 구축 | OpenStack (DPDK), Ceph, 네트워크 |
        | 2019.09 ~ 2019.11 | A사 | I사(IT 서비스 기업) 클라우드 시범망 구축 | NFV, SDN, OpenStack, Ceph |
        | 2019.07 ~ 2019.08 | A사 | 지방자치단체 SDDC 구축 | OpenStack 구축·기술지원 |
        | 2019.03 ~ 2019.06 | A사 | 공공기관 통합정보시스템 구축 | SDN |
        | 2019.01 ~ 2019.02 | A사 | 철도 공공기관 클라우드 구축 | OpenStack 구축·기술지원 |
        | 2018.12 ~ 2019.03 | A사 | 광역자치단체 지능형 초연결망 유지보수 | NFV, SDN, OpenStack, Ceph |
        | 2018.12 ~ 2019.03 | A사 | 교통 공기업 SDDC 유지보수 | NFV, SDN, OpenStack |
        | 2018.10 ~ 2018.12 | E사 | S사(통신사) 운영지원 시스템 기술지원 | Helion OpenStack |
        | 2018.10 ~ 2018.11 | E사 | S사(글로벌 제조사) 해외 통신사 NB-IoT 대규모 Trial | Helion OpenStack 구축·기술지원 |
        | 2017.10 ~ 2017.12 | A사 | 광역자치단체 NFV 구축 | NFV 구축·기술지원 |
        | 2016.09 ~ 2017.01 | E사 | L사(통신사) C-SGN 구축 | NFV DVT·CVT (QA) |

  - block: markdown
    id: career-test
    content:
      title: "2009.03 ~ 2016.06 · 통신 시험장비"
      text: |
        | 기간 | 소속 | 프로젝트 | 역할 · 주요 기술 |
        |---|---|---|---|
        | 2015.12 ~ 2016.06 | E사 | K사(통신사) 재난안전망 시범사업 | 호처리 검증 (QA) |
        | 2013.01 ~ 2015.06 | T사 | 해외 통신 시험기관 시험망 구축 (5건) | IMS·MBMS, LTE-A·TD-SCDMA, Roaming GW·TD-LTE, PicoCell, PS-LTE — 장비 납품·구축·호처리 검증 |
        | 2010.10 ~ 2012.10 | T사 | LTE UE·EPC 시뮬레이터/에뮬레이터 공급 (통신사·장비사 5건) | 장비 공급, 운영, 호처리 검증 |
        | 2009.04 ~ 2010.10 | T사 | 통신 시험 시뮬레이터 유지보수 (MGTS, Catapult) | 기술지원, 호처리 검증 |
---
