# SITEMAP — URL 구조 설계 (Luck Platform 개정판)

> v2.0. [[MASTER_PRD]] §0의 Luck Platform 구조(Lotto/Lucky Journal/Dream/Fortune/Statistics/Community/Winners/Shop/Membership/Partners)를 URL 트리에 반영한다. [[CRITICAL_REVIEW]] U-01(당첨사례/당첨확인 명칭 충돌)을 해결하기 위해 "당첨확인"을 Lucky Journal로 통합했다.

---

## 1. 전체 URL 트리 (Luck Platform 구조)

```
/ (홈 — Luck Platform 허브)
│
├── /generate                          [Lotto] 번호 생성
│   ├── /generate/auto                 완전 자동 생성 (MVP)
│   ├── /generate/custom               고정/제외 번호 지정 생성 (Should)
│   └── /generate/history              (→ /my/journal/history 로 통합, 리다이렉트)
│
├── /my/journal                        [Lucky Journal] 행운 다이어리 — 플랫폼 중심 허브
│   ├── /my/journal/history            번호 생성/저장 히스토리
│   ├── /my/journal/results            당첨 확인 결과 (구 "/my/results", §당첨확인 통합)
│   ├── /my/journal/calendar           행운 캘린더
│   ├── /my/journal/dreams             내 꿈 기록(개인 일기)
│   ├── /my/journal/fortune-history    운세 조회 이력
│   ├── /my/journal/stats              월간/연간 통계
│   └── /my/journal/yearly-report      연말 Luck Report
│
├── /dream                             [Dream] 꿈해몽 허브
│   ├── /dream/[keyword]               개별 꿈 해몽
│   ├── /dream/[keyword]/numbers       해당 꿈의 추천 번호
│   └── /dream/category/[category]     꿈 카테고리
│
├── /fortune                           [Fortune] AI 운세 입력
│   ├── /fortune/result                운세 결과 (세션/공유용 ID)
│   └── /fortune/[shareId]             공유된 운세 결과 열람
│
├── /statistics                        [Statistics] 로또 통계 허브
│   ├── /statistics/frequency          번호별 출현 빈도
│   ├── /statistics/combination        번호 조합 통계
│   └── /statistics/round/[round]      회차별 통계
│
├── /community                         [Community] 행운 커뮤니티 (Phase 4)
│   ├── /community/[category]          카테고리별 목록
│   └── /community/post/[postId]       게시글 상세
├── /battle                            [Community] 이번주 배틀 (Phase 4)
│   ├── /battle/[battleId]             배틀 상세/참여
│   ├── /battle/friend/[challengeId]   친구와 배틀 (신규, [[FEATURE_SPEC]] 친구초대 참조)
│   └── /battle/history                지난 배틀 결과
├── /hall-of-fame                      [Community] 명예의 전당 (Phase 4)
│   ├── /hall-of-fame/weekly
│   ├── /hall-of-fame/monthly
│   ├── /hall-of-fame/all-time
│   └── /hall-of-fame/friends          친구 랭킹 (신규)
│
├── /winners                           [Winners] 실제 당첨 사례
│   └── /winners/round/[round]
├── /store                             [Winners] 로또 명당 (판매점, 신규 — [[CRITICAL_REVIEW]] S-01)
│   ├── /store/region/[region]         지역별 판매점 목록
│   └── /store/[storeId]               개별 판매점 상세 (1등 배출 이력)
│
├── /tools                             [SEO 신규] 계산기형 콘텐츠 ([[CRITICAL_REVIEW]] S-02)
│   └── /tools/tax-calculator          당첨금 세금/실수령액 계산기
│
├── /shop                              [Shop] 행운 상품 (Phase 5)
│   ├── /shop/[productId]
│   └── /shop/cart
│
├── /membership                        [Membership] 프리미엄 멤버십 (Phase 7, 신규)
│   └── /membership/benefits           혜택 안내
│
├── /partners                          [Partners] 제휴/입점 안내 (Phase 6, 신규)
│   └── /partners/apply                입점 신청
│
├── /invite                            [Growth 신규] 친구 초대
│   └── /invite/[inviteCode]           초대 링크 랜딩
│
├── /guide, /faq                       가이드/FAQ (기존과 동일)
├── /my/numbers → /my/journal/history 로 통합·리다이렉트
├── /my/results → /my/journal/results 로 통합·리다이렉트
├── /my/notifications, /my/profile     알림설정/프로필 (기존과 동일)
│
├── /login, /signup, /share/[shareId]  기존과 동일
├── /notice, /about, /terms, /privacy  기존과 동일
│
└── /admin                             관리자 (비공개, robots 차단)
```

---

## 2. 변경 요약 (v1.0 → v2.0)

| 변경 | 내용 |
|---|---|
| 신규 최상위 허브 | `/my/journal` — 기존 `/my/numbers`, `/my/results`, `/my/fortune-history`를 모두 이 아래로 통합 |
| 명칭 충돌 해소 | "당첨확인" 기능은 이제 `/my/journal/results`로만 존재하며, 공개 콘텐츠인 `/winners`(당첨사례)와 URL·내비게이션 상 완전히 분리 |
| 신규 SEO 페이지 | `/store/*` (로또 명당), `/tools/tax-calculator` (세금계산기) |
| 신규 Growth 페이지 | `/invite/*` (친구초대), `/battle/friend/*` (친구배틀), `/hall-of-fame/friends` (친구랭킹) |
| 신규 확장 페이지 | `/membership/*`, `/partners/*` |
| 리다이렉트 규칙 | 구 URL(`/my/numbers`, `/my/results`, `/generate/history`)은 301 리다이렉트로 신규 다이어리 경로에 연결 — 이미 색인된 URL의 SEO 자산 보존 |

## 3. URL 설계 원칙 — 유지

기존 원칙(의미 기반 URL, 3단계 이내 깊이, `/my/*` 회원전용 구분, 한글 슬러그 허용, 숫자/영문 슬러그 회차 표기)을 그대로 유지한다.

## 4. 페이지 우선순위 등급 (SEO 크롤 예산 배분, 개정)

| 등급 | 페이지 | 사유 |
|---|---|---|
| P0 (최우선) | `/`, `/generate`, `/dream/*`, `/fortune`, `/winners/*`, `/store/*` | 검색 유입 핵심 (로또명당 신규 추가) |
| P1 | `/statistics/*`, `/tools/*`, `/battle`, `/hall-of-fame/*`, `/community/*` | 체류·재방문 핵심 |
| P2 | `/guide/*`, `/faq/*`, `/about`, `/membership`, `/partners` | 신뢰도/롱테일/확장 보조 |
| P3 (noindex) | `/my/*`(journal 포함), `/login`, `/admin/*`, `/share/[shareId]`, `/invite/[inviteCode]` | 개인화·비공개 페이지 |

> `/my/journal/*`는 전체가 `noindex, nofollow` 처리한다 — 개인 기록 데이터이므로 검색 노출 대상이 아니다.

## 5. XML Sitemap 그룹 (개정)

기존 `sitemap-core.xml` / `sitemap-dream.xml` / `sitemap-winners.xml` / `sitemap-community.xml` / `sitemap-index.xml`에 아래를 추가한다.
- `sitemap-store.xml` — 판매점 페이지 (신규, [[SEO_STRATEGY]])
- `sitemap-tools.xml` — 계산기 등 툴 페이지 (신규)

## 6. 내비게이션과의 관계

이 URL 구조가 실제 GNB/하단 탭/사이드 메뉴에 어떻게 매핑되는지는 [[INFORMATION_ARCHITECTURE]] 개정판에서 다룬다.
