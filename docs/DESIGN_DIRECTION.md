# DESIGN DIRECTION — 홈·브랜드·오늘의 세 조합 재구성

> claude-code-luck-platform-home-brand-daily-numbers-prompt.md(이하 "이번 프롬프트")가 승인한
> 디자인 방향의 기록이다. 색만 다른 여러 시안을 비교하는 문서가 아니라, 이미 확정된 방향을
> 실제 구현이 왜 이렇게 됐는지 추적할 수 있도록 남긴다. 토큰의 구체적인 값/용도표는
> [[DESIGN_SYSTEM]] §1에 있다 — 이 문서는 "왜 이 값인가"만 다룬다.

## 1. Design Thesis

> 꿈의 여운을 담는 넉넉한 흰 여백 위에, 복권의 설렘은 절제된 딥레드 CTA와 골드 번호 구슬로만
> 표현하는 신뢰 가능한 한국형 행운 서비스.

기존 브랜드 컬러는 신뢰감을 노린 블루(`#1B4DFF`)였다. 이번 재구성은 그 신뢰감의 근거를 색이
아니라 "과장하지 않는 태도"로 옮긴다 — 화면을 지배하는 색을 줄이고(흰색/아이보리 75~80%),
행동을 요구하는 곳(Primary CTA)에만 딥레드를, 실제 꿈에서 나온 숫자에만 골드를 쓴다.

## 2. 사용자가 느껴야 할 감정

| 시점 | 목표 |
|---|---|
| 첫인상 | 간단하다, 바로 검색할 수 있다 |
| 사용 중 | 재미있지만 과장하거나 현혹하지 않는다 |
| 결과 확인 | 내 꿈에서 나온 숫자가 일반 무작위 숫자와 분명히 구분된다 |
| 재방문 | 무제한 장난감이 아니라 오늘 확인하고 기록할 가치가 있다 |

## 3. 시그니처 — 골드 번호 구슬

실제 꿈에서 유래한 숫자만 골드로 표현한다. 색만으로 의미를 전달하지 않고 `꿈 숫자` 라벨과
범례를 항상 함께 둔다([[DESIGN_SYSTEM]] §4.2 오늘의 세 조합 결과 컴포넌트 참조). 골드 원형
장식을 배지·구분선·아이콘 등 다른 곳에 장식적으로 뿌리지 않는다 — 실제 번호가 있는 곳에만
쓴다.

## 4. 파란색 → 딥레드/골드 매핑

기존 색 토큰 이름(`--color-primary`, `--color-primary-dark`, `--color-accent-gold`)은 그대로
유지하고 **값만** 바꿨다. 이 세 토큰을 참조하는 클래스(`bg-primary`, `text-primary`,
`border-primary`, `outline-primary`, `bg-accent-gold` 등)는 이미 Header 활성 상태, Button
Primary/Secondary, BottomNav 활성 탭, 링크, focus ring, 꿈 숫자 강조 전반에서 쓰이고 있었다 —
즉 이번 작업은 새 클래스를 대량으로 갈아끼운 것이 아니라 **토큰 값 3개를 바꿔 전체 브랜드
UI의 파란색을 한 번에 딥레드/골드로 교체**한 것이다([[DESIGN_TOKEN_IMPLEMENTATION_REPORT]]가
이미 세운 "하드코딩 금지, 토큰만 참조" 원칙 덕분에 이 치환이 가능했다).

| 기존 토큰 | 기존 값 | 새 값 | 비고 |
|---|---|---|---|
| `--color-primary` | `#1B4DFF` (블루) | `#B42318` (딥레드) | Button Primary, 링크, focus ring, BottomNav/GlobalNav 활성 탭 |
| `--color-primary-dark` | `#123399` | `#8F1D14` | hover/pressed |
| `--color-accent-gold` | `#FFB800` | `#F4B740` | 꿈 숫자 전용(기존에도 이미 이 용도로만 쓰이고 있었음) |

새로 추가한 토큰(`--color-soft-red`, `--color-soft-gold`, `--color-bg-surface`)과 재조정한
중립 토큰(`--color-text-secondary`, `--color-border`, `--color-bg-base`)은 [[DESIGN_SYSTEM]]
§1.2에 정리했다. `--color-success`/`--color-danger`/`--color-kakao`는 프롬프트 지시(§3.2
"실제 의미가 있는 semantic color를 무차별 문자열 치환하지 않는다")에 따라 값을 바꾸지
않았다.

## 5. Home 정보 구조 — 제거/유지/추가

이번 프롬프트 §4가 지정한 대로 Home을 4구역(Header/Hero/핵심 기능 3개/로그인 혜택+Footer)으로
줄였다. 상세 근거는 각 섹션의 코드 주석과 [[FINAL 보고서]](최종 보고 D절)에 남긴다 — 이 문서는
"무엇을 왜 뺐는가"만 요약한다.

- 제거: 추천 검색어 chip 6개, 동일 위계 큰 CTA 2개, 카드 5개 기능 나열, "왜 Luck Platform인가"
  가치 제안 리스트, footer 직전 CTA 섹션. 기능/라우트 자체는 삭제하지 않고 BottomNav·직접 URL
  접근은 그대로 둔다.
- 유지: 꿈 검색(핵심 성장 흐름의 시작점), 카카오 로그인 `next/reason` 왕복, dream_search_submitted
  이벤트.
- 추가: `행운을 확인하는 세 가지 방법`(구분선 기반 3열/1열 오픈 레이아웃), 로그인 혜택
  benefit band, 신뢰 문구(19세 복권 구매 고지 + 재미/참고용 고지).

## 6. 모션

전역 모션 예산은 [[DESIGN_SYSTEM]] §6에 이미 있던 원칙(200~300ms ease-out, reduced-motion
비활성화)을 유지한다. "오늘의 세 조합" 결과 reveal만 프롬프트 §3.5 기준(총 700ms 안팎, opacity
+ 작은 translate/scale)으로 재조정했다 — `components/generate/generatorSaveLogic.ts`의 셔플/공개
타이밍 상수 참조.
