# PHASE3-2 LAYOUT SYSTEM IMPLEMENTATION 보고서

> [[PHASE3_UI_ARCHITECTURE_PLAN]]에 따라 Header/Footer 이전 단계의 공통 Layout 기반(`Container`/`PageShell`/`Main`)을 구현한 결과다. 인증 로직·`proxy.ts`·Migration/DB는 전혀 수정하지 않았고, Header/Footer/Navigation/Auth UI/Button/Card는 만들지 않았다. 페이지 콘텐츠(문구·구조·시각적 결과)는 그대로 유지했다.

---

## 1. 생성/수정 파일

| 파일 | 종류 | 내용 |
|---|---|---|
| `components/layout/Container.tsx` | 신규 | 가로 폭 제한 + 좌우 패딩 |
| `components/layout/Main.tsx` | 신규 | semantic `<main>`, 접근성 id, `flex-1` |
| `components/layout/PageShell.tsx` | 신규 | 페이지 최상위 wrapper(`min-h-screen`, `flex-col`, 배경) |
| `app/layout.tsx` | 수정 | `PageShell`+`Main`을 전역에 한 번만 적용 |
| `app/globals.css` | 수정 | `--max-width-content: 1200px` 토큰 추가([[DESIGN_SYSTEM]] §7) |
| `app/page.tsx` | 수정 | 직접 쓰던 `<main>`을 제거하고 `<Container>`로 교체 |
| `app/login/page.tsx` | 수정 | 상동 |
| `app/onboarding/page.tsx` | 수정 | 상동 |
| `docs/PHASE3_LAYOUT_IMPLEMENTATION_REPORT.md` | 신규 | 본 보고서 |

검증 중 만들었다가 삭제한 것: `app/_tokentest2/`(Tailwind `--max-width-content` 토큰이 실제로 유틸리티를 생성하는지 확인용, Next.js가 라우팅하지 않는 `_` 접두사 폴더), `app/api/e2etest7/route.ts`(카카오 API 없이 세션을 발급하는 검증용 라우트), 테스트 계정 1개 — 전부 확인 후 삭제.

---

## 2. Layout 구조 설명

```
app/layout.tsx (변경 없는 시맨틱 뼈대: <html><body>)
  └─ PageShell            (flex-col, min-h-screen, bg-bg-base)
       └─ Main            (flex-1, flex-col, <main id="main-content">)
            └─ {children} ← 각 page.tsx가 채우는 자리
```

**Header/Footer(Phase3-3)는 어디에 들어가는가**: `PageShell` 안, `Main`과 형제(sibling) 위치다. 지금은 `<PageShell><Main>{children}</Main></PageShell>`이지만, Phase3-3에서는 `<PageShell><Header/><Main>{children}</Main><Footer/></PageShell>`로 한 줄만 바뀐다 — `PageShell`/`Main`의 내부 구조를 다시 손댈 필요가 없다.

**`Container`는 왜 `layout.tsx`가 아니라 각 페이지에 있는가**: 모든 페이지가 "가로로 꽉 찬 배경 위에 폭이 제한된 콘텐츠"를 원하는 것은 아니다(예: 나중에 만들 히어로 이미지가 화면 전체 폭을 차지해야 하는 페이지). `Container`는 페이지가 필요할 때 선택적으로 쓰는 컴포넌트로 남겨뒀다 — `PageShell`/`Main`처럼 강제로 전역 적용하지 않았다.

---

## 3. 컴포넌트 책임

| 컴포넌트 | 책임 | 책임이 아닌 것 |
|---|---|---|
| `PageShell` | 페이지 전체의 배경색, 최소 높이(`min-h-screen`), Header/Main/Footer를 세로로 쌓을 flex 축 제공 | 콘텐츠 정렬, 폭 제한 |
| `Main` | semantic `<main>` 태그, 접근성(`id="main-content"`, 향후 스킵 링크 대상), 남은 높이를 채우는 `flex-1` | 콘텐츠 정렬(페이지마다 다름 — 가운데 정렬할지, 위에서부터 나열할지는 페이지가 결정) |
| `Container` | 가로 폭 제한(`max-w-content`=1200px), 좌우 패딩(24px), 페이지가 원하면 `className`으로 자기만의 flex 정렬을 얹을 수 있는 확장 지점 | 배경색, 세로 높이 관리 |

세 컴포넌트가 서로 다른 축(세로 구조/시맨틱+높이/가로 폭)을 각자 하나씩만 책임지도록 나눠, [[AI_ENGINEERING_CONSTITUTION]] §3 "함수는 하나의 책임만 가진다"를 컴포넌트 단위에도 적용했다. `className` prop 하나 이상의 확장 옵션(예: variant, as 등)은 추가하지 않았다 — 지금 그것을 요구하는 실제 호출부가 없다(과도한 추상화 금지).

---

## 4. Design System 적용 방식

- `PageShell`의 배경은 `bg-bg-base`(Phase3-1 토큰, [[DESIGN_TOKEN_IMPLEMENTATION_REPORT]])를 그대로 사용한다.
- `Container`의 `max-w-content`(1200px)는 [[DESIGN_SYSTEM]] §7 "데스크톱 최대 콘텐츠 폭 1200px 중앙 정렬"을 새 토큰으로 추가해 참조한다 — Phase3-1이 아직 다루지 않았던 레이아웃 폭 토큰을 이번에 보완했다. Header/Footer(Phase3-3)도 같은 폭에 맞춰 정렬해야 하므로 매직넘버로 각 컴포넌트에 흩어두지 않고 `app/globals.css`의 `@theme`에 추가했다.
- `Container`의 좌우 패딩(24px, `px-6`)은 [[DESIGN_SYSTEM]] §3이 제시한 "16px 기본"이 아니라 **기존 3개 페이지가 이미 쓰고 있던 값**을 그대로 표준화했다 — 페이지 디자인을 바꾸지 않는다는 이번 Task의 원칙을 [[DESIGN_SYSTEM]]의 추상적 기본값보다 우선했다(§6에서 상세 설명).

---

## 5. Route 구조 검토 — Public/Protected Layout 분리, 지금은 불필요

[[PHASE3_UI_ARCHITECTURE_PLAN]] §2.1이 결정한 대로 공개 페이지는 flat 구조, `/my/*`만 `(protected)` route group으로 묶는 계획을 그대로 유지했다 — 이번 Task에서 폴더 구조를 바꾸지 않았다.

**Public Layout/Protected Layout을 별도 `layout.tsx`로 분리할지 분석**: 지금 단계에서는 **불필요하다고 판단**했다.
- Next.js App Router는 하위 폴더에 `layout.tsx`를 두면 자동으로 중첩 적용된다 — 예를 들어 `app/(protected)/layout.tsx`를 만들면 `/my/*` 전체에 자동 적용된다. 즉 "분리가 필요해지는 시점"은 **"공개 페이지와 `/my/*`가 시각적으로 달라야 할 구체적 요구가 생기는 시점"**이며, 지금은 그런 요구가 없다(공개 페이지에도 `/my/*`에도 아직 Header/Footer조차 없다).
- `/my/*` 페이지 자체가 아직 하나도 만들어지지 않았다([[PHASE3_PROXY_ROUTE_FIX_REPORT]]에서 보호 경로만 확정, 실제 페이지는 Phase4 이후). 콘텐츠 없이 레이아웃만 미리 분기해두는 것은 [[AI_ENGINEERING_CONSTITUTION]] §5 하드 게이트("기존 컴포넌트로 해결 가능한가")에 반한다 — 지금은 루트 `app/layout.tsx`의 `PageShell`+`Main` 하나로 공개/보호 페이지 모두 충분히 커버된다.
- Phase3-3(Header/Footer) 완료 후, 만약 "로그인 사용자에게만 다른 헤더(예: 알림 뱃지)를 보여줘야 한다"는 요구가 생기면, 그 시점에 `(protected)/layout.tsx`를 신설해 헤더 variant를 분기하는 것이 적절한 타이밍이다 — 지금 미리 만들지 않는다.

---

## 6. 기존 페이지 영향 분석

세 페이지(`/`, `/login`, `/onboarding`) 모두 기존에는 각자 `<main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 [text-center|py-12]">`을 개별적으로 반복하고 있었다. 이번 변경으로 이 반복이 제거되고, 페이지는 자신만의 정렬 방식(`className`)만 `<Container>`에 넘긴다.

**시각적 결과가 동일함을 어떻게 확인했는가**:
- `bg-white` → `bg-bg-base`: Phase3-1에서 두 값이 동일한 `#ffffff`임을 이미 확인했다([[DESIGN_TOKEN_IMPLEMENTATION_REPORT]]).
- `min-h-screen`/`flex-col`/`items-center`/`justify-center`/`text-center`/`py-12`: 전부 페이지가 `Container`에 그대로 전달하거나(`text-center`, `py-12`), `PageShell`/`Main`이 대신 담당한다(`min-h-screen`, `flex-col`).
- **가장 주의가 필요했던 지점**: `/onboarding`의 내부 `<div className="w-full max-w-sm">`(폼 너비 제한)가 기존에는 `<main>`의 직계 flex 자식으로서 `items-center`의 혜택을 직접 받았는데, 새 구조에서는 `Container`가 그 사이에 한 겹 끼어든다. **`Container`에 페이지가 넘긴 `className`(`flex flex-1 flex-col items-center justify-center py-12`)이 적용되면 `Container` 자신이 flex 컨테이너가 되므로, `max-w-sm` div는 여전히 `Container`의 직계 자식으로 남아 `items-center`의 혜택을 그대로 받는다** — 실제 렌더링 HTML(`curl`)로 `<div class="mx-auto w-full max-w-content px-6 flex flex-1 flex-col items-center justify-center py-12"><div class="w-full max-w-sm">`구조를 직접 확인해 이 추론이 맞았음을 검증했다.
- **패딩 값 관련 정직한 고지**: `Container`의 좌우 패딩을 `px-6`(24px)로 고정해 기존 값을 그대로 보존했다(§4) — [[DESIGN_SYSTEM]] §3의 "16px 기본"을 적용하면 모바일에서 8px만큼 좁아지는 실질적 변화가 생기므로, "페이지 디자인 변경 금지"를 엄격히 지키기 위해 기존 값을 우선했다. 이 선택에 따라 breakpoint별로 패딩이 달라지는 반응형 동작은 이번 Task에 포함하지 않았다(§7).

---

## 7. Responsive 기준 적용

[[DESIGN_SYSTEM]] §7 기준을 Tailwind v4 **기본 breakpoint**에 그대로 대응시켰다 — 커스텀 breakpoint를 새로 정의하지 않았다(이미 [[PHASE3_UI_ARCHITECTURE_PLAN]] §4.3이 이렇게 결론냈다).

| DESIGN_SYSTEM 기준 | Tailwind 대응 |
|---|---|
| 모바일 360~430px, 1컬럼 | 기본값(prefix 없음) |
| 태블릿 768px~, 2컬럼 전환 | `md:`(Tailwind 기본 `--breakpoint-md: 48rem` = 768px, 정확히 일치) |
| 데스크톱 최대 1200px 중앙 정렬 | `Container`의 `max-w-content`(1200px) + `mx-auto` |

**이번 Task에서 실제로 breakpoint 접두사(`md:`/`lg:`)를 쓰지 않은 이유**: `Container`/`Main`/`PageShell`은 아직 "폭에 따라 다르게 배치해야 하는 콘텐츠"(예: 2컬럼 그리드)를 갖고 있지 않다 — 지금 있는 3개 페이지는 전부 1컬럼 중앙 정렬 텍스트뿐이라 375/768/1440px 어디서도 레이아웃이 달라질 이유가 없다. breakpoint 접두사는 실제로 폭에 따라 달라져야 하는 콘텐츠(그리드, 카드 목록 등)가 생기는 Phase3-3 이후 컴포넌트에서 쓰일 대상이며, 지금 미리 붙이는 것은 근거 없는 클래스가 된다.

**검증 방법의 한계(정직한 고지)**: 이 환경에는 실제 브라우저가 없어 375/768/1440px에서 눈으로 렌더링을 확인할 수 없었다. 대신 (1) 렌더링된 HTML의 클래스 문자열을 `curl`로 직접 확인해 의도한 구조와 정확히 일치하는지 검증했고, (2) CSS box model(flex 축, `items-center`, `max-width`+`mx-auto`의 상호작용)을 규칙대로 직접 추론해 문서화했다(§6). 위 breakpoint 표는 코드에 반응형 클래스가 없으므로 애초에 세 폭에서 "다르게 깨질" 여지가 구조적으로 없다는 점도 이 결론을 보강한다.

---

## 8. Validation 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 16개 테스트 통과(변경 없음) |
| `npm run build` | 통과. 라우트 목록 변경 없음 |
| `/` 접근 | `200` |
| `/login` 접근 | `200` |
| `/onboarding` 비로그인 접근 | `307` → `/login?next=%2Fonboarding`(기존과 동일, `proxy.ts` 영향 없음 확인) |
| `/onboarding` 로그인(profile 없음) 접근 | `200`, 렌더링된 HTML 구조 직접 확인(§6) |
| Tailwind `max-w-content` 유틸리티 생성 여부 | 임시 검증 파일로 실제 컴파일 결과에서 확인(Phase3-1과 동일 방법) |

---

## 9. 발견된 문제

1. **패딩 값(16px vs 24px) 불일치** — [[DESIGN_SYSTEM]] §3의 "16px 기본"과 기존 3개 페이지의 실제 값(24px)이 다르다는 것을 이번에 처음 확인했다. "디자인 변경 금지" 원칙에 따라 기존 값(24px)을 표준화했지만, 이는 [[DESIGN_SYSTEM]] 문서와 코드가 여전히 다르다는 뜻이다 — Phase3-3 이후 Header/Footer가 자체 패딩을 결정할 때 이 불일치를 참고해야 한다. 문서를 고칠지 코드를 고칠지는 사용자 결정이 필요한 사안으로 남긴다.
2. **실제 브라우저 시각 검증 불가** — §7에서 설명한 환경 제약. 코드/HTML 구조 검증으로 대체했다.
3. 그 외 `proxy.ts`/인증 로직/Migration에 대한 영향은 발견되지 않았다(전혀 수정하지 않았고, 실제 요청으로 동작 변화가 없음을 확인).

---

## 10. Phase3-3 Header/Footer 착수 가능 여부

**가능.** `PageShell`이 이미 Header/Footer가 `Main`과 형제로 들어올 구조를 준비해뒀고(§2), `Container`가 Header/Footer 내부 콘텐츠 폭을 페이지 콘텐츠와 동일하게 맞출 수 있는 `max-w-content` 토큰도 준비되었다. `Main`의 `id="main-content"`는 Header가 추가할 스킵 링크의 대상으로 이미 존재한다. 남은 이슈(§9-1 패딩 값 불일치)는 Header/Footer 착수를 막지 않는다 — Header/Footer 구현 시점에 참고만 하면 된다.
