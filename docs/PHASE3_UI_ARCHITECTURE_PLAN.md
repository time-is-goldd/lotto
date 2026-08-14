# PHASE3 UI ARCHITECTURE & DESIGN SYSTEM PLAN

> Phase3(공통 UI) 착수 전 설계/분석 문서다. **코드/컴포넌트를 생성하지 않는다.** [[EXECUTION_PLAN]]·[[MASTER_PRD]]·[[USER_FLOW]]·[[SITEMAP]]·[[INFORMATION_ARCHITECTURE]]·[[DESIGN_SYSTEM]]·[[UI_UX_GUIDELINE]]·[[FEATURE_SPEC]]·[[ROADMAP]]과 Phase2 산출물([[PHASE2_COMPLETION_REPORT]], [[PHASE2_LOGOUT_IMPLEMENTATION_REPORT]], [[PHASE2_PROXY_REPORT]])을 종합해, Phase3 착수 시점의 컴포넌트 구조·디자인 시스템·구현 순서를 확정한다.

---

## 1. 현재 구조 분석

### 1.1 `app/` 디렉터리 (직접 확인)
```
app/
├── api/
│   ├── auth/kakao/{login,callback}/route.ts
│   ├── auth/logout/route.ts
│   └── profile/route.ts
├── login/page.tsx              ← flat, route group 아님
├── onboarding/{page.tsx, OnboardingForm.tsx}  ← flat, route group 아님
├── layout.tsx / page.tsx / globals.css / favicon.ico
```
**Route Group이 하나도 없다.** [[EXECUTION_PLAN]] 부록 A는 `(marketing)/`·`(auth)/`·`(journal)/`를 계획했지만, 실제 Phase2 구현(`/login`, `/onboarding`)은 둘 다 route group 없이 flat 경로로 만들어졌다 — 계획과 실제 구현이 이미 갈라진 지점이다(§7-1에서 상세).

### 1.2 `components/` 디렉터리 (직접 확인)
```
components/
├── ui/.gitkeep
└── layout/.gitkeep
```
[[EXECUTION_PLAN]] Phase0에서 스캐폴딩된 빈 폴더 2개뿐이다. `journal/`·`lotto/`·`dream/`·`auth/`·`onboarding/`·`seo/`(부록 A 계획)는 아직 생성되지 않았다. **실제 컴포넌트 파일은 0개.**

### 1.3 `features/` 디렉터리
**존재하지 않는다.** [[EXECUTION_PLAN]] 부록 A는 이 이름의 최상위 폴더를 애초에 계획하지 않았다 — `lib/api/`(데이터 접근)·`components/{도메인}/`(UI)로 역할을 나누는 구조를 이미 확정해두었다(§3-1에서 이 Task 지시문의 `features/` 제안과 대조).

### 1.4 `styles/` 디렉터리
**존재하지 않는다.** Tailwind v4를 CSS-first 방식으로 쓰고 있어(§1.5) `app/globals.css` 하나가 전역 스타일 진입점이다. 별도 `styles/` 폴더는 [[EXECUTION_PLAN]] 부록 A에도 계획되어 있지 않다.

### 1.5 Tailwind 설정 (직접 확인)
- `tailwindcss@^4`, `postcss.config.mjs`에 `@tailwindcss/postcss`만 등록. **`tailwind.config.ts` 파일이 없다** — Tailwind v4의 CSS-first 설정(`@theme` 블록을 `globals.css` 안에 직접 씀) 방식을 이미 채택한 상태([[EXECUTION_PLAN]] Phase3 §3 주석이 이미 이 결정을 명시).
- 현재 `@theme inline`에는 `--color-background`/`--color-foreground` 2개 토큰만 존재. [[DESIGN_SYSTEM]]이 정의한 나머지 토큰(primary/accent/success/danger 등)은 **아직 코드로 옮겨지지 않았다.**

### 1.6 Font 설정 (직접 확인)
`next/font` 미사용, 커스텀 웹폰트 없음, `app/layout.tsx`도 폰트를 지정하지 않아 브라우저 기본 산세리프를 그대로 쓰는 상태. [[UI_UX_GUIDELINE]] §2("시스템 기본 산세리프, 장식적 폰트 금지")·[[AI_ENGINEERING_CONSTITUTION]] §10("웹폰트 최소화")과 이미 일치하는 상태다 — **의도적 미설정이 아니라 우연히 원칙과 일치한 상태이므로, Phase3-1에서 명시적으로 시스템 폰트 스택을 CSS 변수로 고정해 "우연"을 "결정"으로 바꿔야 한다.**

### 1.7 기존 UI 관련 파일
`app/page.tsx`(홈, placeholder 문구만), `app/login/page.tsx`(카카오 로그인 링크 1개, [[PHASE2_PROXY_REPORT]]), `app/onboarding/page.tsx` + `OnboardingForm.tsx`(폼, 순수 Tailwind 유틸리티 클래스만 사용, 재사용 컴포넌트 없음)가 전부다. 세 페이지 모두 [[DESIGN_SYSTEM]] 토큰을 참조하지 않고 `text-neutral-900` 같은 Tailwind 기본 팔레트를 직접 썼다 — Phase3에서 디자인 토큰이 확정되면 이 3개 파일도 토큰 기반으로 교체 대상이다(코드 수정은 이번 Task 범위 밖이므로 §6에 향후 작업으로만 기록).

---

## 2. UI Architecture

### 2.1 Route Group 구조 — 결정

지시문이 제안한 `(public)`/`(auth)`/`(protected)` 3분할과 [[EXECUTION_PLAN]] 부록 A의 기존 계획(`(marketing)`/`(auth)`/`(journal)` + flat 기능 폴더)이 다르다. 아래 원칙으로 절충한다.

| 원칙 | 근거 |
|---|---|
| **이미 만들어진 flat 경로(`/login`, `/onboarding`)는 route group으로 재배치하지 않는다** | route group은 URL에 영향을 주지 않는 순수 조직화 장치라 재배치해도 사용자 경험이 바뀌지 않는다 — 파일만 옮기는 작업은 이번처럼 "코드 구현 금지" Task에서 결정할 수 없고, 향후에도 이익이 적은 churn이다([[AI_ENGINEERING_CONSTITUTION]] §3 "요청받지 않은 불필요한 리팩토링 금지") |
| **공개 기능 페이지(`/generate`, `/dream`, `/fortune`, `/winners`, `/store`)는 `(public)`처럼 감싸지 않고 최상위 flat 폴더로 유지** | [[EXECUTION_PLAN]] 부록 A가 이미 이렇게 계획했고, `proxy.ts`가 어차피 경로 기반으로 공개/보호를 가르므로 폴더를 그룹으로 감싸도 접근 제어에 아무 영향이 없다 — 그룹을 추가하면 대응하는 이점 없이 폴더 깊이만 늘어난다(단순함 우선) |
| **개인화 영역(`/my/*`)만 `(protected)` route group으로 묶는다** | [[SITEMAP]]이 이미 `/my/journal/*`, `/my/notifications`, `/my/profile`을 하나의 트리로 정의했고, 이 페이지들은 공통으로 "로그인 필수 + noindex + 공통 레이아웃(다이어리 서브내비 등)"이 필요하다 — [[EXECUTION_PLAN]] 부록 A의 `(journal)/my/journal/` 그룹 아이디어를 `/my/*` 전체로 넓힌 것이다 |

**확정 구조**:
```
app/
├── login/                      (기존 유지, flat)
├── onboarding/                 (기존 유지, flat)
├── generate/                   (신규, flat — Phase5)
├── dream/                      (신규, flat — Phase7)
├── fortune/                    (신규, flat — §7-2 리스크 참조)
├── winners/, store/            (신규, flat — Should)
├── share/[shareId]/            (신규, flat)
├── (protected)/my/
│   ├── journal/{history,results,calendar,dreams,fortune-history,stats,yearly-report}/
│   ├── notifications/
│   └── profile/
├── api/                        (기존 유지)
└── layout.tsx, page.tsx
```

### 2.2 `proxy.ts` 경로 정합성 — **가장 중요한 발견 (§7-1과 연결)**

[[PHASE2_PROXY_REPORT]]가 구현한 `proxy.ts`의 보호 경로는 `/onboarding`, `/mypage`, `/dream-journal`, `/notifications`다. 그런데 [[SITEMAP]]이 정의한 실제 경로는 `/my/profile`, `/my/journal/dreams`, `/my/notifications`다 — **완전히 다른 경로**다. 이 Task는 Auth 수정을 금지하므로 지금 고치지 않지만, Phase3가 `(protected)/my/*` 구조로 실제 페이지를 만들면 **`proxy.ts`가 그 경로를 전혀 보호하지 못하는 상태**가 된다(로그인 없이 개인정보 페이지에 직접 접근 가능 — 보안 공백). §6 구현 순서에 "Phase3-0" 선행 조치로 명시한다.

### 2.3 인증 상태와 Layout의 관계

`app/layout.tsx`(Root Layout)는 모든 페이지에 공통 적용되므로, Header가 로그인 상태를 표시하려면 Root Layout이나 그 직계 자식에서 `getCurrentUser()`를 호출해야 한다. 이 호출은 매 페이지 요청마다 Supabase Auth 서버에 재검증을 왕복하므로([[AI_ENGINEERING_CONSTITUTION]] §11 "요청마다 세션 재확인"), **정적 페이지(꿈해몽/가이드 등 SSG 대상)까지 이 왕복 때문에 강제로 동적 렌더링이 되는 것을 방지**해야 한다 — Header 자체를 별도 경계(예: Header만 별도 async 컴포넌트로 분리하고 `<Suspense>`로 감싸거나, 정적 페이지는 Header를 클라이언트에서 별도로 하이드레이션)로 두는 설계가 필요하다. 이번 Task는 이 설계의 "필요성"만 기록하고 구현 방법 확정은 Phase3-3(Header 구현) 착수 시점으로 넘긴다(§7-3 리스크).

---

## 3. Component Strategy

### 3.1 `features/` 대신 기존 `components/{도메인}/` + `lib/api/{도메인}.ts` 유지 — 결정

지시문이 예시로 든 `features/{dream,fortune,number-generator,profile}/` 구조는 **도입하지 않는다.**
- [[EXECUTION_PLAN]] 부록 A가 이미 `components/{ui,layout,journal,lotto,dream,auth,onboarding,seo}/` + `lib/{api,logic}/` 구조를 확정했고, [[AI_ENGINEERING_CONSTITUTION]] §3 "폴더 구조를 임의로 바꾸지 않는다"가 이 확정을 보호한다.
- `features/` 방식(도메인별로 UI+로직+타입을 한 폴더에 몰아넣음)과 기존 방식(UI는 `components/`, 데이터 접근은 `lib/api/`, 순수 로직은 `lib/logic/`로 계층 분리)은 **서로 다른 조직 철학**이라 섞으면 "이 컴포넌트가 어디 있는지 두 가지 규칙으로 찾아야 하는" 혼란이 생긴다 — 1인 유지보수 원칙(단순함 우선)에 반한다.
- `number-generator`라는 이름은 이미 존재하는 `components/lotto/`(EXECUTION_PLAN Phase5 파일 목록의 `NumberGenerator.tsx`/`NumberResultDisplay.tsx`)와 같은 대상을 가리킨다 — 새 이름을 만들지 않고 기존 명명을 그대로 쓴다.

### 3.2 컴포넌트 폴더 확정

| 폴더 | 상태 | 내용 |
|---|---|---|
| `components/ui/` | 기존(빈 폴더) | Button, Modal, Toast, Card, LottoBall, Skeleton, EmptyState, ErrorState, Typography, Input([[DESIGN_SYSTEM]] §4 전체) |
| `components/layout/` | 기존(빈 폴더) | Header, Footer, BottomTabBar, MoreMenuGrid |
| `components/auth/` | 신규(부록 A 계획됨) | LoginButton(기존 계획명 재사용, §5-2), ProfileMenu(신규), LogoutButton(신규) |
| `components/lotto/` | 신규(부록 A 계획됨) | NumberGenerator, NumberResultDisplay(Phase5에서 실제 채움) |
| `components/dream/` | 신규(부록 A 계획됨) | Phase7에서 실제 채움 |
| `components/onboarding/` | 신규(부록 A 계획됨) | OnboardingSlides(최초 방문 슬라이드, [[UI_UX_GUIDELINE]] §13.1) — **기존 `app/onboarding/OnboardingForm.tsx`(profile 생성 폼)와는 다른 것**이니 혼동 주의(이름 충돌 위험, §7-4) |
| `components/journal/` | 신규(부록 A 계획됨) | Phase4에서 실제 채움 |
| `components/fortune/` | **신규 추가**(부록 A에 없던 폴더) | Fortune 입력/결과 UI. 부록 A 작성 시점에는 Fortune 전용 폴더가 빠져 있었다(§7-2) |
| `components/profile/` | **신규 추가**(부록 A에 없던 폴더) | `/my/profile` 페이지용(닉네임 수정 폼 등). Decision 1~3(Profile Service)이 부록 A 작성 이후 확정되어 반영되지 못했던 부분 |
| `components/seo/` | 기존(부록 A 계획됨) | Breadcrumb 등, Phase8에서 채움 |

---

## 4. Design System

[[DESIGN_SYSTEM]] 문서가 이미 상세하게 존재한다 — Phase3의 역할은 **새로 정의하는 것이 아니라, 이미 정의된 값을 Tailwind v4 `@theme` 토큰으로 옮기는 것**이다.

### 4.1 Color
[[DESIGN_SYSTEM]] §1의 9개 토큰(`color-primary`/`color-primary-dark`/`color-accent-gold`/`color-kakao`/`color-bg-base`/`color-bg-subtle`/`color-text-primary`/`color-text-secondary`/`color-border`/`color-success`/`color-danger`)을 `app/globals.css`의 `@theme inline` 블록에 `--color-*` CSS 변수로 그대로 옮긴다. 현재 존재하는 `--color-background`/`--color-foreground`는 각각 `color-bg-base`/`color-text-primary`로 흡수 통합한다(중복 토큰 방지).

**로또 브랜드 방향 고려**: [[DESIGN_SYSTEM]]이 이미 "신뢰감 있는 블루(`#1B4DFF`)"를 primary로, "행운/당첨 강조 골드(`#FFB800`)"를 accent로 분리해뒀다 — 로또 특유의 "대박/사행성" 톤을 피하고 신뢰(블루) 위에 행운 포인트(골드)만 얹는 절제된 방향이 이미 확정돼 있다. Phase3는 이 방향을 재검토하지 않고 그대로 코드화한다.

### 4.2 Typography
[[DESIGN_SYSTEM]] §2의 7단계(`display`/`h1`/`h2`/`body-lg`/`body`/`caption`/`button`)를 Tailwind v4 `@theme`의 `--font-size-*`/`--font-weight-*`로 옮긴다. 폰트 패밀리는 §1.6에서 확인한 대로 **시스템 폰트 스택**(`-apple-system, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif` 형태)을 `--font-sans` 변수로 고정한다 — `next/font`로 구글 폰트 등을 불러오지 않는다(웹폰트 미사용 결정, [[UI_UX_GUIDELINE]] §2·[[AI_ENGINEERING_CONSTITUTION]] §10과 일치).

### 4.3 Spacing / Radius / Shadow
- Spacing: [[DESIGN_SYSTEM]] §3의 `4/8/12/16/24/32/48/64` 배수 체계는 **Tailwind v4 기본 spacing scale(4px 기준)과 이미 호환**된다 — 커스텀 스케일을 새로 정의할 필요 없이 Tailwind 기본값을 그대로 쓴다(`p-4`=16px 등). 별도 토큰화 작업 불필요.
- Radius: 버튼 12px, 카드 16px, 입력필드 8px([[DESIGN_SYSTEM]] §4) → `--radius-button`/`--radius-card`/`--radius-input` 3개 토큰만 추가하면 충분(Tailwind 기본 `rounded-*` 스케일이 딱 맞지 않는 값들이라 커스텀 필요).
- Shadow: 카드 그림자 1건(`0 1px 4px rgba(0,0,0,0.06)`)뿐이라 `--shadow-card` 토큰 1개로 충분 — 별도 shadow 스케일 체계는 과설계([[AI_ENGINEERING_CONSTITUTION]] §2 단순함 우선).

### 4.4 Button / Input / Card
[[DESIGN_SYSTEM]] §4.1(Button 4종: Primary/Secondary/Kakao/Disabled)·§4.5(Input)·§4.3(Card)를 그대로 `components/ui/Button.tsx`·`Input.tsx`·`Card.tsx`의 스펙으로 채택한다. `components/ui/KakaoButton.tsx`(EXECUTION_PLAN Phase3 계획)는 §4.1의 "Kakao" 변형과 **동일 대상** — 별도 컴포넌트로 만들지 않고 `Button`의 `variant="kakao"`로 흡수할지, 별도 파일로 유지할지는 실제 사용 빈도(로그인 버튼 1곳뿐인지, 공유 버튼에도 재사용되는지)에 따라 Phase3-3~3-4 구현 시점에 결정한다(지금 코드가 없어 판단 근거 부족 — 미확정으로 남김).

---

## 5. Page Map

MASTER_PRD/USER_FLOW/SITEMAP/ROADMAP(MoSCoW) 기준으로 정리한다. 지시문이 예시로 든 페이지명을 [[SITEMAP]]의 실제 확정 경로에 매핑했다.

### 5.1 Public

| 페이지 | 경로 | 목적 | 핵심 CTA | MoSCoW |
|---|---|---|---|---|
| 홈 | `/` | Luck Platform 허브, 3초 내 핵심 기능 도달 | "번호 생성하기"(비회원)/"다이어리 보기"(회원) | Must |
| 꿈해몽 | `/dream`, `/dream/[keyword]` | SEO 유입, 꿈풀이+추천번호 | "행운번호 보기" → `/dream/[keyword]/numbers` | Should |
| 번호 생성 | `/generate` | 핵심 도구, 1클릭 번호 생성 | "번호 생성하기"(비회원 즉시 가능) | Must |
| 운세 | `/fortune` | 생년월일 기반 AI 운세 | "운세 보기" → 결과+추천번호 | Should(§7-2 리스크) |
| 당첨 확인(공개) | `/winners`, `/winners/round/[round]` | **주의: 개인 매칭 결과가 아니라 "당첨사례" 콘텐츠**(§5-3) | "당첨사례 더보기" | Should |
| 명당 | `/store`, `/store/region/[region]`, `/store/[storeId]` | 판매점 SEO 콘텐츠 | "내 주변 명당 찾기" | Could |
| 공유 페이지 | `/share/[shareId]` | 바이럴 랜딩(카카오톡 인앱 브라우저) | "나도 만들어보기" → `/generate` 또는 `/fortune` | Must(공유 자체) |

### 5.2 Private (`(protected)/my/*`, 전부 noindex)

| 페이지 | 경로 | 목적 | 핵심 CTA |
|---|---|---|---|
| 마이페이지 | `/my/profile` | 프로필 조회/수정(`PUT /api/profile` 재사용) | "닉네임 수정" |
| 꿈 다이어리(개인 기록) | `/my/journal/dreams` | 개인 꿈 기록 CRUD([[PHASE2_RLS_REAL_USER_TEST_REPORT]]에서 RLS 검증 완료) | "꿈 기록하기" |
| 알림 | `/my/notifications` | 알림 목록/읽음 처리 | "전체 읽음 처리" |
| (참고) 히스토리/당첨확인/캘린더 등 | `/my/journal/{history,results,calendar,...}` | 지시문에 명시 안 됐지만 [[SITEMAP]]상 같은 `(protected)/my/*` 그룹 — Phase4~6에서 순차 구현 | — |

### 5.3 "당첨 확인" 용어 충돌 — 명확화 필요

이 지시문은 "당첨 확인"을 **Public** 목록에 넣었지만, [[SITEMAP]]/[[INFORMATION_ARCHITECTURE]]가 확정한 "당첨확인"(`/my/journal/results`, 내 번호가 당첨됐는지)은 **완전히 Private**다(로그인 필수, noindex, 본인 `user_numbers`만 대조). Public 성격의 "당첨"은 `/winners`(실제 당첨 사례, 공개 콘텐츠)를 가리키는 것으로 해석했다. 이 둘을 같은 이름으로 부르면 [[CRITICAL_REVIEW]] U-01이 이미 한 차례 지적한 혼동이 재발한다 — Phase3 화면/메뉴 라벨에서 "당첨확인"(개인, 다이어리 내부)과 "당첨사례"(공개, `/winners`)라는 서로 다른 단어를 계속 유지해야 한다.

### 5.4 Auth

| 페이지 | 경로 | 목적 | 핵심 CTA |
|---|---|---|---|
| 로그인 | `/login` | 카카오 로그인 진입(기존 구현 존재, [[PHASE2_PROXY_REPORT]]) | "카카오로 로그인" |
| 온보딩 | `/onboarding` | `birth_date` 수집(기존 구현 존재, [[PHASE2_ONBOARDING_REPORT]]) | "시작하기" |

두 페이지 모두 **이미 구현되어 있다** — Phase3의 역할은 새로 만드는 것이 아니라 디자인 토큰/공통 컴포넌트가 확정된 뒤 스타일만 교체하는 것이다(§6).

---

## 6. Implementation Order (Phase3 세부 순서)

```
Phase3-0 (신규, 이번 감사에서 도출) — proxy.ts 경로 정합성 패치
  ↳ /mypage·/dream-journal·/notifications → /my/profile·/my/journal/dreams·/my/notifications
  ↳ Auth Task로 분리 필요(§2.2). Phase3 UI 착수 "전" 또는 "착수와 동시"에 반드시 처리 —
     늦어지면 (protected)/my/* 페이지가 보호 없이 배포되는 구간이 생긴다.

Phase3-1 Design Tokens
  ↳ [[DESIGN_SYSTEM]] §1~4 값을 app/globals.css @theme로 이식(§4). 시스템 폰트 스택 고정.

Phase3-2 Common Layout 뼈대
  ↳ Typography → Button → Card → LottoBall → Input (components/ui/, §3.2)
  ↳ Toast → Modal → LoadingSpinner → Skeleton → EmptyState → ErrorState

Phase3-3 Header/Footer
  ↳ Header: §2.3의 렌더링 경계 설계 확정 + §5(인증 UI 연결) 3상태 분기 구현
  ↳ Footer: 정적 콘텐츠

Phase3-4 Auth UI 컴포넌트
  ↳ components/auth/LoginButton.tsx(기존 계획명), ProfileMenu.tsx, LogoutButton.tsx(§5)
  ↳ KakaoButton 통합 여부 확정(§4.4)

Phase3-5 BottomTabBar / MoreMenuGrid
  ↳ [[INFORMATION_ARCHITECTURE]] §1.2 5탭 구조, §6 모바일 전략과 함께 구현

Phase3-6 온보딩 슬라이드(OnboardingSlides)
  ↳ 최초 방문 판별 로직 포함([[UI_UX_GUIDELINE]] §13.1) — 기존 app/onboarding/(profile 생성 폼)과
     이름 혼동 주의(§3.2, §7-4)

Phase3-7 홈 페이지(`/`) 재구성
  ↳ [[INFORMATION_ARCHITECTURE]] §2 비회원/회원 분기 레이아웃 적용

Phase3-8 반응형/접근성 최종 점검
  ↳ [[UI_UX_GUIDELINE]] §11 체크리스트, [[AI_ENGINEERING_CONSTITUTION]] §9 테스트 규칙(Lighthouse 등)
```

기존 [[EXECUTION_PLAN]] Phase3 §5 순서(토큰→Typography/Button/Card/LottoBall→Toast/Modal→EmptyState/ErrorState→Header/Footer/BottomTabBar/MoreMenuGrid→온보딩슬라이드→반응형)를 그대로 승계했다 — 이 문서가 새로 정한 것은 **Phase3-0(proxy 정합성)** 추가와 **Phase3-4(Auth UI)를 별도 단계로 명시적으로 분리**한 것 두 가지뿐이다(기존 계획은 Header 단계에 뭉쳐 있었음).

---

## 7. 예상 리스크

### 7-1. `proxy.ts` 보호 경로와 [[SITEMAP]] 실제 경로 불일치 (Critical)
§2.2에서 상세 설명. [[PHASE2_PROXY_REPORT]] §5가 이미 "다음 Phase에서 처리할 사항"으로 남겨둔 항목이 이번 감사에서 구체적인 실제 경로 대조로 확인되었다. **Phase3 착수 시 가장 먼저 처리해야 하는 항목**(별도 Auth Task로 분리, 이번 Task는 Auth 수정 금지라 실행하지 않음).

### 7-2. Fortune(운세) 기능이 [[EXECUTION_PLAN]] Phase0~10 어디에도 명시적으로 할당되지 않음 (High)
[[ROADMAP]]은 "AI 운세 번호(간소화 버전)"를 **Should**로 분류하고, [[INFORMATION_ARCHITECTURE]]는 운세를 하단 탭바 5개 중 하나(홈/번호생성/**운세**/다이어리/더보기)로 지정했을 만큼 핵심 기능이다. 그런데 [[EXECUTION_PLAN]] Phase0~10 어느 Phase에도 `/fortune` 페이지·`fortune_results` 생성 로직을 구현하는 단계가 없다(Phase4가 `/my/journal/fortune-history`의 **골격**만 언급, 실제 `/fortune` 입력/생성 페이지는 어디에도 없음). `fortune_results` 테이블/RLS는 이미 Phase1에서 만들어져 있어(§6 정책표) DB는 준비됐지만 이를 채울 화면 Phase가 로드맵에서 빠져 있다. **Phase3~5 사이 어딘가에 "Phase X-운세" 구현 단계를 신설하는 사용자 승인이 필요** — 이번 문서는 발견만 하고 로드맵을 수정하지 않는다.

### 7-3. Header의 세션 조회가 정적 페이지의 동적 렌더링 강제 여부 (Medium)
§2.3에서 설명. `getCurrentUser()`가 매 요청 Supabase Auth 서버 왕복을 하므로, 이를 Root Layout에서 무분별하게 호출하면 SSG/ISR 대상 페이지(꿈해몽 등, [[SEO_STRATEGY]] 요구사항)까지 강제로 동적 렌더링될 위험이 있다. Phase3-3(Header 구현) 착수 시 React `<Suspense>` 경계 또는 클라이언트 사이드 세션 하이드레이션 방식을 구체적으로 결정해야 한다 — 지금은 방향만 인지하고 넘어간다.

### 7-4. 컴포넌트 이름 충돌 위험 — "Onboarding" (Low)
`app/onboarding/`(기존, profile 생성 폼)과 `components/onboarding/OnboardingSlides.tsx`(신규 계획, 최초 방문 소개 슬라이드)는 완전히 다른 기능인데 이름이 겹친다. Phase3-6 착수 시 혼동 방지를 위해 "OnboardingSlides"라는 이름을 유지하고 절대 "Onboarding"만으로 줄여 쓰지 않도록 코드 리뷰 시 주의가 필요하다.

### 7-5. `AgeVerificationModal.tsx` 계획의 실효성 재검토 필요 (Low)
[[EXECUTION_PLAN]] Phase2 §3이 계획했던 `components/auth/AgeVerificationModal.tsx`가 실제 Phase2 구현([[PHASE2_ONBOARDING_REPORT]])에는 없다 — `age_verified`는 온보딩 폼의 `birth_date` 입력을 서버가 계산해 조용히 채우는 방식으로 대체되었고, 별도 "만 19세 이상입니다" 체크박스/모달 UI는 만들어지지 않았다. [[FEATURE_SPEC]] §9.3이 요구하는 "실제 확인 단계"를 생년월일 입력 자체로 충족했다고 볼지, 별도 명시적 동의 모달이 여전히 필요한지는 **법적 요건 해석이 필요한 사용자 결정 사안**이다 — Phase3-4(Auth UI) 착수 전에 확정 권장.

### 7-6. Kakao 인앱 브라우저 대응이 아직 실측되지 않음 (Medium)
[[MASTER_PRD]]/[[USER_FLOW]]가 "카카오톡 인앱 브라우저 대응 필수"를 반복 명시하지만, 이 프로젝트에는 아직 실제 카카오톡 인앱 브라우저에서의 렌더링 검증 기록이 없다(Phase2까지는 API 레벨 검증만 수행). `/share/[shareId]` 페이지가 실제로 인앱 브라우저에서 정상 동작하는지는 Phase3 완료 후 실기기 테스트가 필요하다 — 이번 Task 범위 밖이나 리스크로 기록.

---

## 부록: 이번 Task에서 참조했으나 수정하지 않은 문서
[[EXECUTION_PLAN]], [[IMPLEMENTATION_PLAN]], [[MASTER_PRD]], [[USER_FLOW]], [[DESIGN_SYSTEM]], [[SITEMAP]], [[INFORMATION_ARCHITECTURE]], [[UI_UX_GUIDELINE]], [[FEATURE_SPEC]], [[ROADMAP]], [[AI_ENGINEERING_CONSTITUTION]], [[BACKLOG]], [[PHASE2_COMPLETION_REPORT]], [[PHASE2_LOGOUT_IMPLEMENTATION_REPORT]], [[PHASE2_PROXY_REPORT]]. §7의 발견사항 중 문서 수정이 필요한 것(§7-1 proxy 경로, §7-2 Fortune Phase 신설)은 **별도 승인 후 별도 Task**에서 처리한다.
