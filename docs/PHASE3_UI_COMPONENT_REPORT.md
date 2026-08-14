# PHASE3-4 SHARED UI COMPONENT SYSTEM 보고서

> [[DESIGN_SYSTEM]]을 기반으로 프로젝트 전역에서 재사용할 공통 UI 컴포넌트(`components/ui/*`)를 구현한 결과다. 목적은 "재사용 가능한 UI 기반 구축"이며, 홈 리디자인·Bottom Navigation·실제 기능 페이지·Auth/Layout/DB/API 수정은 이번 Task에 포함하지 않았다.

---

## 1. 생성/수정 파일

| 파일 | 종류 | 내용 |
|---|---|---|
| `components/ui/Button.tsx` | 신규 | variant 4종 × size 3종, disabled/loading/icon 확장 |
| `components/ui/Card.tsx` | 신규 | `Card`/`CardHeader`/`CardContent`/`CardFooter`(독립 named export) |
| `components/ui/Input.tsx` | 신규 | label 연결, error, disabled |
| `components/ui/Textarea.tsx` | 신규 | Input과 동일 규칙 확장 |
| `components/ui/Label.tsx` | 신규 | `<label>` 최소 wrapper |
| `components/ui/Badge.tsx` | 신규 | variant 4종(default/success/warning/danger) |
| `components/ui/Spinner.tsx` | 신규 | SVG 로딩 스피너 |
| `components/ui/EmptyState.tsx` | 신규 | 선택 구현(§7) |
| `app/ui-preview/page.tsx` | 신규 | 개발용 Showcase 페이지(`robots: noindex, nofollow`) |
| `docs/PHASE3_UI_COMPONENT_REPORT.md` | 신규 | 본 보고서 |

`Divider`는 만들지 않았다 — 지시문이 "선택(필요하다고 판단될 경우만)"으로 남겨둔 두 항목(Divider/EmptyState) 중, 현재 어떤 페이지·컴포넌트도 구분선을 필요로 하지 않아 판단 근거가 없었다. `EmptyState`는 [[EXECUTION_PLAN]] Phase3 원안에 이미 계획되어 있었고 [[USER_FLOW]] §4가 "빈 상태" 화면을 여러 곳에서 요구해 지금 만들 근거가 있다고 판단했다.

기존 `Header`/`Footer`/`components/layout/*`/인증 로직/`proxy.ts`/DB는 **전혀 수정하지 않았다.**

---

## 2. 컴포넌트 목록

| 컴포넌트 | 위치 | Server/Client |
|---|---|---|
| `Button` | `components/ui/Button.tsx` | Server(훅 없음) |
| `Card`, `CardHeader`, `CardContent`, `CardFooter` | `components/ui/Card.tsx` | Server |
| `Input` | `components/ui/Input.tsx` | Server |
| `Textarea` | `components/ui/Textarea.tsx` | Server |
| `Label` | `components/ui/Label.tsx` | Server |
| `Badge` | `components/ui/Badge.tsx` | Server |
| `Spinner` | `components/ui/Spinner.tsx` | Server |
| `EmptyState` | `components/ui/EmptyState.tsx` | Server |

8개 전부 `"use client"`가 없다 — 훅(`useState`/`useId` 등)을 하나도 쓰지 않아 Server/Client 컴포넌트 트리 어디에서든 그대로 쓸 수 있다. (참고: `app/onboarding/OnboardingForm.tsx`처럼 이미 `"use client"`인 폼에서 이 컴포넌트들을 써도 문제없다 — 이번 Task에서 실제로 그 폼을 이 컴포넌트로 교체하지는 않았다, §7 참조.)

---

## 3. Props 설계

### Button
```ts
variant?: "primary" | "secondary" | "ghost" | "destructive"; // 기본 primary
size?: "sm" | "md" | "lg";                                    // 기본 md
loading?: boolean;
iconLeft?: ReactNode;
iconRight?: ReactNode;
// + 표준 <button> 속성 전부(ButtonHTMLAttributes 확장 — onClick, type, disabled 등)
```
`disabled`를 별도 상태로 두지 않고 표준 `disabled` 속성을 그대로 확장했다 — `loading`이면 내부적으로 `disabled`도 함께 true로 처리한다(둘 다 "누를 수 없음"이라는 같은 결과이므로 별도 시각 상태를 만들지 않았다).

### Card 계열
`Card`/`CardHeader`/`CardContent`/`CardFooter` 전부 `HTMLAttributes<HTMLDivElement>`를 그대로 확장한다 — 별도 커스텀 prop이 없다. 셋을 조합해도 되고 `Card` 하나만 써도 된다(§6).

### Input / Textarea
```ts
label?: string;
error?: string;
// + 표준 <input>/<textarea> 속성 전부
```
`id`는 표준 HTML 속성 그대로 받는다 — `label`을 넘기면서 `id`를 함께 넘겨야 `<label htmlFor>` 연결과 `aria-describedby`가 실제로 동작한다(자동 id 생성을 하지 않은 이유는 §4).

### Badge
```ts
variant?: "default" | "success" | "warning" | "danger"; // 기본 default
```

### Spinner
```ts
className?: string;
label?: string; // 기본 "로딩 중", aria-label로 사용
```

### EmptyState
```ts
title: string;
description?: string;
action?: ReactNode;
```

**설계 원칙**: 모든 컴포넌트가 표준 HTML 속성을 `extends`로 그대로 확장하고, 커스텀 prop은 꼭 필요한 것(variant/size/loading/label/error)만 추가했다 — compound component(Context 기반 부모-자식 강제 연결), `asChild`, 렌더 prop 같은 패턴은 하나도 쓰지 않았다(이번 Task 원칙 "과도한 추상화 금지").

---

## 4. Design Token 적용 방식

전부 [[DESIGN_TOKEN_IMPLEMENTATION_REPORT]](Phase3-1)가 만든 토큰만 썼다 — 새 하드코딩 색상은 없다.

| 용도 | 토큰 |
|---|---|
| Button primary | `bg-primary`, `hover:bg-primary-dark`, `text-white` |
| Button secondary | `border-primary`, `text-primary` |
| Button 공통 disabled | `bg-border`, `text-text-secondary`([[DESIGN_SYSTEM]] §4.1 Disabled 규격 그대로) |
| radius | `rounded-button`(12px)/`rounded-card`(16px)/`rounded-input`(8px) |
| shadow | `shadow-card` |
| 타이포 | `text-h1`/`text-h2`/`text-body`/`text-caption`/`text-button` |
| 배경/표면 | `bg-bg-base`/`bg-bg-subtle` |

**문서에 없어서 이미 있는 토큰으로 대체 구성한 것(발견된 문제와 직결, §7)**:
- Button `ghost`/`destructive` — [[DESIGN_SYSTEM]] §4.1은 Primary/Secondary/Kakao/Disabled만 정의한다. `ghost`는 `text-text-primary`+`hover:bg-bg-subtle`(이미 있는 조합), `destructive`는 이미 정의된 `color-danger`를 재사용했다.
- Badge `warning` — success/danger 색만 정의되어 있어 `color-accent-gold`(행운/강조색)를 재사용했다.
- Input 높이(52px) — Tailwind 기본 spacing scale(`h-13` = 13×4px = 52px)로 정확히 표현 가능해 별도 토큰이나 임의값(`h-[52px]`) 없이 처리했다.
- Button lg 높이(56px) — 동일하게 `h-14`(14×4px=56px)로 기본 스케일과 정확히 일치해 별도 처리 불필요.

임의 hex 값이나 Tailwind 기본 팔레트(`neutral-*`, `blue-*` 등)는 이 8개 컴포넌트 어디에도 쓰지 않았다 — grep으로 재확인.

---

## 5. 접근성 고려 사항

- **semantic HTML**: `<button>`(Button), `<label>`(Label), `<input>`/`<textarea>`(Input/Textarea) — `<div onClick>` 류의 비시맨틱 클릭 핸들러 없음.
- **ARIA**: `Input`/`Textarea`는 `error`가 있으면 `aria-invalid="true"` + `aria-describedby`로 에러 메시지 `<p>`와 연결한다. `Button`은 `loading`일 때 `aria-busy`를 켠다. `Spinner`는 `role="status"` + `aria-label`(기본 "로딩 중")로 스크린리더에 로딩 상태를 알린다.
- **focus**: `Button`에 `focus-visible:outline` 계열을 명시적으로 넣었다 — 브라우저 기본 포커스 링을 지우지 않았고(별도 `outline-none` 없음), 오히려 `focus-visible`로 마우스 클릭 시에는 안 보이고 키보드 포커스 시에만 보이는 것을 명확히 했다.
- **keyboard**: `Button`(`<button>`)과 `Link` 기반 내비게이션은 `Tab`/`Enter`/`Space`가 브라우저 기본 동작으로 전부 지원된다 — 커스텀 키보드 이벤트 핸들러를 추가하지 않았다(필요가 없어서다).
- **prefers-reduced-motion**: `Spinner`에 `motion-reduce:animate-none`을 명시적으로 붙였다 — Tailwind가 이걸 자동으로 처리해주는지 `node_modules/tailwindcss` 소스를 직접 grep해 확인했는데(§6), **자동 처리되지 않아서** 직접 추가했다.

---

## 6. Validation 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 16개 테스트 통과(변경 없음) |
| `npm run build` | 통과. `/ui-preview` 라우트 정상 등록 |

### 실제 컴파일 결과로 검증(Phase3-1/3-2와 동일 방법)

이번에도 몇 가지 Tailwind 메커니즘을 "될 것"이라고 짐작하지 않고 실제 컴파일 결과로 확인했다.

| 확인 대상 | 방법 | 결과 |
|---|---|---|
| `h-13`(52px, Input 높이) | `npm run dev` 후 `/ui-preview` 렌더링 → 컴파일된 CSS에서 `.h-13{height:...}` 직접 확인 | 정상 생성 |
| `bg-success/10`/`bg-accent-gold/20`/`bg-danger/10`(Badge 투명도) | 동일 | 정상 생성 — `color-mix(in oklab, ...)` 최신 브라우저용 규칙과 정적 hex fallback을 Tailwind가 동시에 생성함을 확인 |
| `motion-reduce:animate-none` | `node_modules/tailwindcss` 소스에 `prefers-reduced-motion` 자동 처리가 있는지 먼저 grep(없음 확인) → 직접 추가 후 컴파일 결과에서 `@media (prefers-reduced-motion:reduce){.motion-reduce\:animate-none{animation:none}}` 확인 | 정상 생성 |
| `Input`의 `error` 상태 | `/ui-preview`에서 실제 렌더링된 HTML의 `aria-invalid="true"`, `aria-describedby`, 에러 문구 직접 확인 | 정상 |
| `Card` 3분할 구조 | 렌더링된 HTML에서 Header/Content/Footer가 의도한 대로 중첩됐는지 확인 | 정상 |
| `/ui-preview`의 `robots` 메타 | 렌더링된 HTML에서 `<meta name="robots" content="noindex, nofollow"/>` 확인 | 정상 |
| 기존 페이지(`/`, `/login`, `/onboarding`) 영향 여부 | 실제 요청으로 재확인 | `200`/`200`/`307`(비로그인 시), 변경 없음 |

---

## 7. 발견된 문제

1. **[[DESIGN_SYSTEM]] §4.1(Button)에 `ghost`/`destructive` variant가 없다.** 지시문은 이 두 variant를 요구하지만 문서에는 근거가 없다 — 이미 정의된 토큰(`bg-bg-subtle` 호버, `color-danger`)만 재사용해 구성했지만, 이것이 "디자인 시스템이 승인한 스타일"인지는 사용자 확인이 필요하다. [[DESIGN_SYSTEM]] 문서 자체를 갱신할지는 별도 승인 사안으로 남긴다.
2. **[[DESIGN_SYSTEM]]에 Badge `warning` 색상이 없다.** `color-accent-gold` 재사용으로 대체했다 — 위와 동일한 성격의 문서 갱신 필요 사안.
3. **`Divider` 미구현** — 판단 근거(실제 필요 사례)가 없어 만들지 않았다. 필요해지는 시점에 만드는 것을 권장한다.
4. **기존 `OnboardingForm.tsx`가 이번 컴포넌트로 교체되지 않았다** — 이번 Task는 "재사용 가능한 UI 기반 구축"이 목적이고, 기존 폼을 이 컴포넌트로 마이그레이션하는 것은 "실제 기능 페이지 구현"에 준하는 변경이라 범위 밖으로 판단했다. `OnboardingForm`은 여전히 자체 스타일(`border-neutral-300` 등, Design Token 미적용)을 쓴다 — 다음 UI 정리 Task에서 교체 대상.
5. `Header`/`Footer`/`proxy.ts`/인증 로직에 대한 영향은 발견되지 않았다 — 전혀 수정하지 않았고 실제 요청으로 재확인했다.

---

## 8. Phase3-5(Home UI 재구성) 착수 가능 여부

**가능.** `Button`/`Card`/`Input`/`Textarea`/`Label`/`Badge`/`Spinner`/`EmptyState` 8개 컴포넌트가 Design Token만으로 구현되어 실제 컴파일 검증까지 마쳤고, `/ui-preview`에서 전체 variant/state를 한눈에 확인할 수 있다. `Header`/`Footer`/Layout/인증 어디에도 영향이 없어 Phase3-5가 홈 화면을 재구성할 때 이 컴포넌트들을 그대로 조합해 쓸 수 있다. 다만 §7-1/§7-2(문서에 없는 variant/색상)는 Phase3-5 착수 전에 [[DESIGN_SYSTEM]] 문서 갱신 여부를 확정해두는 것을 권장한다 — 지금 상태로도 기능적으로는 문제없이 쓸 수 있다.
