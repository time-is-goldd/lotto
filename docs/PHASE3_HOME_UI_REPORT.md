# PHASE3-5 HOME PAGE MVP UI RECONSTRUCTION 보고서

> [[DESIGN_SYSTEM]]과 Phase3-1~3-4가 만든 공통 컴포넌트로 홈 페이지(`/`)를 재구성한 결과다. 실제 로또 기능(번호생성/꿈해몽/운세)은 구현하지 않았고, 인증 구조·DB·API는 전혀 수정하지 않았다.

---

## 1. 생성/수정 파일

| 파일 | 종류 | 내용 |
|---|---|---|
| `app/page.tsx` | 수정 | 홈 화면 전체를 5개 섹션(Hero/주요기능/이번주인기/서비스소개/CTA)으로 재구성 |
| `components/ui/Button.tsx` | 수정(소폭) | `buttonClassName(variant, size)` 헬퍼를 새로 export(§3 참조) — 기존 `Button` 컴포넌트 동작/props는 변경 없음 |
| `docs/PHASE3_HOME_UI_REPORT.md` | 신규 | 본 보고서 |

`components/layout/*`(Header/Footer 포함)·`components/auth/*`·인증 로직(`lib/auth/*`)·`proxy.ts`·DB/API는 **전혀 수정하지 않았다.**

**`Button.tsx`를 왜 건드렸는가**: `Button`은 항상 `<button>` 엘리먼트라 `<a>`(`Link`) 안에 넣을 수 없다(인터랙티브 콘텐츠 중첩 금지). Hero/CTA처럼 "버튼처럼 보이지만 실제로는 페이지 이동"인 요소가 이 Task에 3곳 필요했는데, 기존 `components/auth/LoginButton.tsx`가 이미 겪었던 것과 같은 문제(Button과 똑같은 스타일 문자열을 손으로 복사)를 반복하지 않기 위해, 이미 있던 스타일 맵을 `buttonClassName()`이라는 이름으로 **내보내기만** 했다 — `Button`의 기존 동작·props·시각적 결과는 1글자도 바뀌지 않았다(§6에서 검증).

---

## 2. Home 구조

```
<> (Home)
├─ <section aria-labelledby="hero-heading">        1. Hero
│    h1 + 설명문 + "번호 생성하기" CTA(→ /generate)
├─ <section aria-labelledby="features-heading">     2. 주요 기능
│    h2 + <nav aria-label="주요 기능"> 안에 4개 <article><Card></Card></article>
│    (번호생성/꿈해몽/행운일기/당첨확인, 전부 h3 + Badge "준비 중")
├─ <section aria-labelledby="popular-heading">      3. 이번 주 인기
│    h2 + <Card><EmptyState/></Card>(placeholder, 실제 데이터 없음을 솔직하게 표시)
├─ <section aria-labelledby="why-heading">          4. 서비스 소개
│    h2 + <ul> 4개 bullet([[MASTER_PRD]] §5 승인된 가치제안 문구 재사용)
└─ <section aria-labelledby="cta-heading">          5. Footer 위 CTA
     h2 + "지금 시작하기" CTA(→ /login)
```

각 섹션은 `Header`/`Footer`가 이미 쓰던 것과 같은 패턴(전체폭 배경 `<section>` + 내부 `<Container>`로 폭 제한)을 그대로 재사용했다 — 새 레이아웃 규칙을 만들지 않았다.

---

## 3. 사용한 공통 컴포넌트

| 컴포넌트 | 사용 위치 | 비고 |
|---|---|---|
| `Container` | 5개 섹션 전부 | Phase3-2 |
| `Card`/`CardHeader`/`CardContent`/`CardFooter` | 주요 기능 4장, 이번 주 인기 1장 | Phase3-4 |
| `Badge` | 주요 기능 카드마다 "준비 중" | Phase3-4 |
| `EmptyState` | 이번 주 인기 섹션 | Phase3-4 |
| `buttonClassName()`(Button 내부 스타일 재사용) | Hero CTA, 하단 CTA | §1 참조 |
| `Spinner` | **쓰지 않음** | §7-1 참조 — 억지로 쓸 이유가 없어 생략했다 |

**"이번 주 인기"에 가짜 데이터를 넣지 않은 이유**: 실제 인기 번호·꿈풀이 데이터가 없는 상태에서 그럴듯한 숫자를 지어내면 사용자가 진짜 통계로 오인할 위험이 있다([[MASTER_PRD]] §6 비목표 "구매내역 자동 추적 오인 유발 금지"와 같은 성격의 문제). 대신 `EmptyState`로 "아직 없다"는 사실을 그대로 보여주는 것을 placeholder로 택했다 — `EmptyState`가 실제로 쓰일 첫 사례가 됐다.

**주요 기능 카드가 실제 SITEMAP 경로를 가리키는 이유**: `href`를 `"#"` 같은 더미 값이 아니라 [[SITEMAP]]이 이미 확정한 실제 경로(`/generate`, `/dream`, `/my/journal`, `/my/journal/results`)로 바로 연결했다 — 이번 Task 원칙 8 "추후 기능 연결이 쉬운 구조"를 문자 그대로 만족시키는 방법이었다. 지금은 대상 페이지가 없어 클릭하면 `404`가 난다 — §7-2에서 상세 설명.

---

## 4. SEO 적용 내용

| 요구사항 | 적용 결과 |
|---|---|
| h1 1개 | Hero의 `{SITE_NAME}` 하나뿐(실제 렌더링 결과로 확인, §6) |
| heading hierarchy | h1(Hero) → h2(섹션 제목 4개) → h3(기능 카드 제목 4개), 건너뛴 레벨 없음 |
| `<section>` | 5개 섹션 전부, `aria-labelledby`로 각자의 `<h2>`/`<h1>`과 연결 |
| `<article>` | 기능 카드 4개(독립적으로 재사용 가능한 콘텐츠 단위) |
| `<nav>` | "주요 기능" 카드 묶음을 `<nav aria-label="주요 기능">`으로 감쌌다 — 다른 페이지로 가는 진입점 모음이라 단순 `<section>`보다 `<nav>`가 더 정확한 시맨틱이라고 판단했다 |
| `aria-label` | Header의 `주요 메뉴`, Footer의 `정책 및 안내`(Phase3-3, 변경 없음)에 이어 홈의 `주요 기능` `<nav>`에도 추가 |

---

## 5. Responsive 전략

375/768/1024/1440px 4개 기준으로 점검했다. 실제 breakpoint 변화가 있는 곳은 "주요 기능" 그리드 하나뿐이다.

| 구간 | 클래스 | 결과 |
|---|---|---|
| 375px(모바일) | `grid-cols-1`(기본값) | 카드 4개가 세로로 1열 |
| 768px(태블릿) | `sm:grid-cols-2`(Tailwind 기본 640px 이상) | 2×2 |
| 1024px/1440px(데스크톱) | `lg:grid-cols-4`(Tailwind 기본 1024px 이상) | 4개가 한 줄 |

나머지 섹션(Hero/이번주인기/서비스소개/CTA)은 전부 1컬럼 텍스트/카드 나열이라 폭에 따라 레이아웃이 바뀔 이유가 없다 — [[PHASE3_LAYOUT_IMPLEMENTATION_REPORT]]가 이미 결론 낸 것과 같은 논리("실제로 폭에 따라 달라져야 하는 콘텐츠에만 breakpoint를 쓴다")를 그대로 따랐다. `Container`(Phase3-2, `max-w-content`=1200px)가 1440px에서도 콘텐츠가 과도하게 넓어지지 않도록 이미 막아준다.

**검증 방법의 한계(기존 Task들과 동일)**: 이 환경에는 실제 브라우저가 없어 4개 폭에서 눈으로 렌더링을 확인하지 못했다. 대신 렌더링된 HTML의 클래스 문자열을 직접 확인해 의도한 breakpoint 클래스(`grid-cols-1`/`sm:grid-cols-2`/`lg:grid-cols-4`)가 정확히 붙어 있는지 검증했다.

---

## 6. Validation 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 16개 테스트 통과(변경 없음) |
| `npm run build` | 통과. 라우트 목록 변경 없음 |

### 실제 렌더링 결과로 확인(`npm run dev` + `curl`)

| 확인 대상 | 결과 |
|---|---|
| h1 개수 | 정확히 1개(`Luck Platform`) |
| heading 순서 | h1 → h2×4 → h3×4, 정상 |
| `<section>`/`<article>`/`<nav>` 개수 | 5 / 4 / 3(Header·Footer의 기존 nav 2개 + 홈의 신규 1개) |
| Hero CTA(`/generate`), 하단 CTA(`/login`) | 둘 다 `buttonClassName("primary","lg")` 클래스로 정확히 렌더링 |
| 기능 카드 4개의 `href` | `/generate`/`/dream`/`/my/journal`/`/my/journal/results` 정확히 일치 |
| Badge "준비 중", EmptyState 문구 | 정상 렌더링 |
| `/login`, `/onboarding`(비로그인 `307`), `/ui-preview` | 전부 기존 그대로 동작, 영향 없음 |

---

## 7. 발견한 문제

1. **`Spinner`를 억지로 쓰지 않았다.** 이 홈 페이지는 클라이언트 데이터 페칭이 전혀 없는 정적 placeholder라 로딩 상태 자체가 존재하지 않는다 — 지시문이 "적절히 활용"이라고 명시했으므로, 실제 필요가 없는 곳에 억지로 끼워 넣지 않는 것이 맞다고 판단했다.
2. **기능 카드 4개, Hero CTA, 하단 CTA 전부 지금 클릭하면 `404`가 난다.** `/generate`/`/dream`/`/my/journal`/`/my/journal/results`가 아직 어떤 Phase에서도 만들어지지 않았다(Phase4~7 예정). "추후 기능 연결이 쉬운 구조"를 문자 그대로 만족시키려고 실제 미래 경로를 미리 연결해뒀지만, 그 결과 지금 당장은 깨진 링크처럼 보인다 — 배포 전(Phase10) 또는 각 기능이 실제로 만들어지기 전까지는 정상이라고 판단하지만, 사용자가 원한다면 임시로 `#`(완전 비활성)로 되돌리는 것도 어렵지 않다.
3. **`components/ui/Button.tsx`를 소폭 수정했다** — "새 UI 컴포넌트 생성은 최소화"는 지켰지만 "기존 컴포넌트 수정"까지 완전히 피하지는 못했다. 다만 기존 `Button`의 props/동작/렌더링 결과는 전혀 바뀌지 않았고(export 추가만), `npm run build` 산출물과 [[PHASE3_UI_COMPONENT_REPORT]]가 이미 검증해둔 `/ui-preview`의 Button 렌더링도 재확인해 회귀가 없음을 확인했다.
4. **`components/auth/LoginButton.tsx`는 여전히 자기만의 스타일 문자열을 중복 보유하고 있다.** 이번에 만든 `buttonClassName()`으로 통일할 수 있었지만, "Header/Footer 수정 최소화" 원칙에 따라 `Header.tsx`/`LoginButton.tsx`는 건드리지 않았다 — 다음 UI 정리 Task에서 통일하는 것을 권장한다.
5. `Header`/`Footer`/인증 로직/`proxy.ts`/DB/API에 대한 영향은 발견되지 않았다 — 실제 요청으로 재확인했다.

---

## 8. Phase3-6 착수 가능 여부 (Bottom Navigation 또는 Home 고도화)

**가능.** 홈 페이지가 Design Token과 공통 컴포넌트만으로 재구성되어 SEO 구조·반응형 grid·기존 인증/레이아웃 어디에도 영향을 주지 않음을 실측으로 확인했다. Bottom Navigation을 추가하면 `PageShell`의 형제 구조(Header/Main/Footer)에 자연스럽게 끼워 넣을 수 있고, Home을 [[INFORMATION_ARCHITECTURE]] §2가 정의한 "회원/비회원 분기 레이아웃"으로 고도화하는 것도 지금 구조(5개 섹션이 독립적인 `<section>`) 위에서 섹션 단위로 조건 분기만 추가하면 되므로 큰 재작업 없이 가능하다. 남은 이슈(§7-2 링크가 아직 404)는 두 후속 작업 모두 막지 않는다.
