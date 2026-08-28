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
        enable: true
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
        - text: 프로젝트 보기
          url: "#projects"
          icon: arrow-down
        - text: 연락하기
          url: "#contact"
          icon: envelope
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
  
  # Filterable Portfolio - Alpine.js powered project filtering
  - block: portfolio
    id: projects
    content:
      title: "주요 프로젝트"
      subtitle: "실제 수행한 인프라 구축 사례"
      count: 0
      filters:
        folders:
          - projects
      buttons:
        - name: All
          tag: '*'
        - name: Full-Stack
          tag: Full-Stack
        - name: Frontend
          tag: Frontend
        - name: Backend
          tag: Backend
      default_button_index: 0
      # Archive link auto-shown if more projects exist than 'count' above
      # archive:
      #   enable: false  # Set to false to explicitly hide
      #   text: "Browse All"  # Customize text
      #   link: "/work/"  # Custom URL
    design:
      columns: 3
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
            - name: RHOSP
              icon: devicon/redhat
            - name: OpenStack-Ansible
              icon: custom/openstack
            - name: Kolla-Ansible
              icon: custom/openstack
        - name: PaaS Platform
          items:
            - name: Kubernetes
              icon: devicon/kubernetes
            - name: RHOCP (OpenShift)
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
  
  # Experience Timeline
  # 커리어 연대기
  - block: markdown
    id: timeline
    content:
      title: 연대기
      text: |-
        <div style="position:relative;left:50%;transform:translateX(-50%);width:92vw;max-width:1100px;">
          <img src="/media/career-timeline.svg" alt="커리어 연대기" style="width:100%;height:auto;display:block;" />
        </div>
    design:
      columns: '1'
      background:
        color:
          light: "#ffffff"
          dark: "#0d0d12"
      spacing:
        padding: ["4rem", "0", "1rem", "0"]

  - block: resume-experience
    id: experience
    content:
      title: 경력
      username: me
      date_format: 2006.01
    design:
      columns: '1'
      is_education_first: false
      background:
        color:
          light: "#ffffff"
          dark: "#0d0d12"
      spacing:
        padding: ["4rem", "0", "4rem", "0"]

  # 자격 및 교육
  - block: markdown
    id: awards
    content:
      title: 자격 및 교육
      text: |-
        **자격증**

        | 항목 | 발급 | 취득 |
        |---|---|---|
        | RHCSA (Red Hat Certified System Administrator) | Red Hat | 2024.03 |
        | 리눅스마스터 2급 | 한국정보통신진흥협회 (KAIT) | 2011.03 |

        **교육 이수**

        | 과정 | 기관 | 수료 |
        |---|---|---|
        | 도커(Docker) 기초 과정 | 에티버스러닝 | 2023.03 |
        | 클라우드 환경구축 및 서비스 운영관리 자동화 | HPE Education Services | 2020.06 |
        | 프라이빗 클라우드 아키텍처 설계 및 구축 2차 | 한국클라우드컴퓨팅연구조합 | 2018.10 |
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
      view: card
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

