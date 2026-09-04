---
title: OpenStack-Ansible 업스트림 기여 — os_swift 롤 버그 수정
summary: 구축 현장에서 발견한 os_swift 롤의 문제를 커뮤니티에 보고하고, 직접 패치를 작성해 upstream에 반영한 사례
tags:
  - Open Source
  - OpenStack
date: '2026-05-01T00:00:00Z'
---

## 개요

| 항목 | 내용 |
|---|---|
| 대상 | `openstack/openstack-ansible-os_swift` |
| 성격 | 오픈소스 커뮤니티 기여 |
| 역할 | 문제 분석, 커뮤니티 질의, 패치 작성 및 리뷰 대응 |
| 결과 | Gerrit 리뷰 등록 및 core reviewer 협업 |

## 배경

구축 과정에서 OpenStack-Ansible의 `os_swift` 롤이 의도대로 동작하지 않는 상황을 만났습니다. 우회할 수도 있었지만, **다른 사용자도 같은 문제를 겪을 지점**이라 판단해 커뮤니티에 알리기로 했습니다.

## 진행 과정

**1. 문제 확인과 질의**

Launchpad Answers에 증상과 재현 조건을 정리해 올렸습니다. 단순히 "안 된다"가 아니라 어느 태스크에서 어떤 조건일 때 발생하는지를 함께 적었습니다.

**2. 패치 작성**

원인을 확인한 뒤 직접 수정 패치를 만들어 Gerrit에 올렸습니다. OpenStack의 기여 절차(CLA, Gerrit 워크플로, 커밋 메시지 규칙)를 따라 진행했습니다.

**3. 리뷰 대응**

core reviewer의 피드백을 받아 수정하며 리뷰를 이어갔습니다. 코드 자체보다 **왜 이 방식이어야 하는지 설명하는 과정**이 더 중요했습니다.

## 링크

- [Gerrit 리뷰 #984906](https://review.opendev.org/c/openstack/openstack-ansible-os_swift/+/984906)
- [Launchpad 질의 #824067](https://answers.launchpad.net/openstack-ansible/+question/824067)

## 남은 것

수정한 코드 한 줄보다, **문제를 발견했을 때 우회하지 않고 원류를 고치는 방식**을 경험한 것이 컸습니다.

구축 현장에서는 시간에 쫓겨 워크어라운드로 넘어가기 쉽습니다. 그렇게 쌓인 우회 방법은 다음 사업에서 또 반복됩니다. 업스트림에 반영하면 그 다음부터는 아무도 그 문제를 만나지 않습니다.

오픈소스를 **가져다 쓰는 것과 함께 만드는 것의 차이**를 알게 된 계기이기도 합니다.
