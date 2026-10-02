---
# Leave the homepage title empty to use the site title
title: ''
summary: ''
date: 2026-01-05
type: landing

sections:
  # Developer Hero - Gradient background with name, role, social, and CTAs
  - block: dev-hero
    id: hero
    content:
      username: me
      greeting: "안녕하세요,"
      show_status: false
      show_scroll_indicator: true
      typewriter:
        enable: false
        prefix: "제가 다뤄온 것은"
        strings:
          - "OpenStack 기반 프라이빗 클라우드"
          - "CPU Pinning까지 적용한 통신사급 VNF 인프라"
          - "노드 네트워크까지 자동화한 배포 체계"
          - "장애 없는 인프라를 위한 설계와 검증"
        type_speed: 70
        delete_speed: 40
        pause_time: 2500
      cta_buttons:
        - text: 경력기술서 보기
          url: "/career/"
          icon: document-text
        - text: 대표 프로젝트
          url: "#projects"
          icon: arrow-down
    design:
      style: centered
      avatar_shape: circle
      animations: true
      background:
        color:
          light: "#fafafa"
          dark: "#0a0a0f"
      spacing:
        padding: ["6rem", "0", "4rem", "0"]
  
  # 핵심 수치 — 5초 요약
  - block: markdown
    id: highlights
    content:
      text: |
        <div class="pf"><div class="pf-kpis hl-kpis">
        <div class="pf-kpi"><b>17년</b><span>통신 · 공공 IT 인프라 경력</span></div>
        <div class="pf-kpi"><b>30+</b><span>수행 프로젝트</span></div>
        <div class="pf-kpi"><b>280대</b><span>운영해 본 최대 Compute 규모</span></div>
        <div class="pf-kpi"><b><a href="https://review.opendev.org/c/openstack/openstack-ansible-os_swift/+/984906" target="_blank" rel="noopener">공식 반영</a></b><span>OpenStack 업스트림 코드 머지</span></div>
        </div></div>
    design:
      spacing:
        padding: ["0", "0", "2rem", "0"]

  # Filterable Portfolio - Alpine.js powered project filtering
  - block: portfolio
    id: projects
    content:
      title: "대표 프로젝트"
      subtitle: "설계 · 확장 · 제품화 — 핵심 사례 3가지"
      count: 0
      filters:
        folders:
          - projects
      buttons:
        - name: 대표
          tag: Featured
      default_button_index: 0
      archive:
        enable: true
        text: "전체 프로젝트 보기 →"
        link: "/projects/"
    design:
      columns: 3
      background:
        color:
          light: "#ffffff"
          dark: "#0d0d12"
      spacing:
        padding: ["4rem", "0", "4rem", "0"]
  
  # Experience Timeline
  - block: resume-experience
    id: experience
    content:
      title: 경력 한눈에
      text: "회사별 상세 이력과 전체 프로젝트는 **[경력기술서](/career/)**에서 볼 수 있습니다."
      username: me
      date_format: "2006.01"
    design:
      columns: '1'
      is_education_first: false
      background:
        color:
          light: "#ffffff"
          dark: "#0d0d12"
      spacing:
        padding: ["4rem", "0", "4rem", "0"]

  # Visual Tech Stack - Icons organized by category
  - block: tech-stack
    id: skills
    content:
      title: "기술 스택"
      subtitle: "구축·운영해 온 기술"
      categories:
        - name: IaaS Platform
          items:
            - name: OpenStack
              icon: custom/openstack
            - name: RHOSP 13 / 16
              icon: devicon/redhat
            - name: OpenStack-Ansible
              icon: custom/openstack
            - name: Kolla-Ansible
              icon: custom/openstack
            - name: VMware → OpenStack Migration
              icon: arrow-path
        - name: PaaS Platform
          items:
            - name: Kubernetes
              icon: devicon/kubernetes
            - name: RHOCP 4.9 / 4.10
              icon: custom/openshift
            - name: Docker
              icon: devicon/docker
        - name: OS & Automation
          items:
            - name: Linux (RHEL / Ubuntu)
              icon: devicon/linux
            - name: Ansible
              icon: devicon/ansible
            - name: Bash
              icon: devicon/bash
        - name: Storage
          items:
            - name: Ceph
              icon: custom/ceph
            - name: Dell PowerStore
              icon: circle-stack
            - name: NetApp
              icon: circle-stack
            - name: Pure Storage
              icon: circle-stack
            - name: iSCSI / NFS / SAN
              icon: server-stack
        - name: NFV & Performance
          items:
            - name: NFV / VNF
              icon: cpu-chip
            - name: OVS-DPDK
              icon: bolt
            - name: SR-IOV
              icon: arrows-right-left
            - name: NUMA Topology
              icon: squares-2x2
            - name: HugePages
              icon: rectangle-stack
            - name: CPU Pinning
              icon: adjustments-horizontal
    design:
      style: grid
      show_levels: false
      background:
        color:
          light: "#f5f5f5"
          dark: "#08080c"
      spacing:
        padding: ["4rem", "0", "4rem", "0"]
  
  # 자격 및 교육
  - block: resume-awards
    id: awards
    content:
      title: 자격 및 교육
      username: me
      date_format: "2006.01"
    design:
      columns: '1'
      background:
        color:
          light: "#fafafa"
          dark: "#0a0a0f"
      spacing:
        padding: ["3rem", "0", "4rem", "0"]

  # Recent Blog Posts
  - block: collection
    id: blog
    content:
      title: 최근 글
      subtitle: '구축·운영 과정에서 정리한 기술 기록'
      text: ''
      filters:
        folders:
          - blog
        exclude_featured: false
      count: 3
      order: desc
    design:
      view: article-grid
      columns: 3
      background:
        color:
          light: "#f5f5f5"
          dark: "#08080c"
      spacing:
        padding: ["4rem", "0", "4rem", "0"]
  
  # Contact Section
  - block: contact-info
    id: contact
    content:
      title: 연락처
      subtitle: "인프라에 관한 이야기라면 언제든 환영합니다"
      text: |-
        OpenStack 기반 프라이빗 클라우드 구축과 운영에 관한 문의,
        기술 논의, 협업 제안 모두 편하게 연락 주세요.
      email: nosmile0412@hanmail.net
      autolink: true
    design:
      columns: '1'
      background:
        color:
          light: "#ffffff"
          dark: "#0d0d12"
      spacing:
        padding: ["4rem", "0", "4rem", "0"]
  
---

