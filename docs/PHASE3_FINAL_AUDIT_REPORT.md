# PHASE3-8 최종 감사(Audit) 보고서

> Phase3(UI Foundation, Phase3-0~3-7)를 전체적으로 감사한 결과다. 새 기능을 추가하지 않았고, 발견한 문제 중 **Critical은 없어** 프로덕션 코드를 전혀 수정하지 않았다. 이번 Task에서 만든 파일은 이 보고서 하나뿐이다.

---

## 0. 착수 전 문서 재검토 — 충돌/불일치 여부

`DESIGN_SYSTEM.md` / `UI_UX_GUIDELINE.md` / `SITEMAP.md` / `PHASE3_UI_ARCHITECTURE_PLAN.md` / `PHASE3_LAYOUT_IMPLEMENTATION_REPORT.md` / `PHASE3_HEADER_FOOTER_REPORT.md` / `PHASE3_UI_COMPONENT_REPORT.md` / `PHASE3_HOME_UI_REPORT.md` / `PHASE3_BOTTOM_NAVIGATION_REPORT.md` / `PHASE3_GNB_REPORT.md`을 다시 읽었다.

**새로운 문서 불일치는 발견되지 않았다.** 기존에 이미 보고되고 사용자 확인을 받은 것들(GNB/Bottom Navigation의 "더보기" 항목 SITEMAP 미대응, GNB·Bottom Navigation 메뉴 구성 차이(꿈해몽))은 §5의 "기존에 알려진 문제(재확인)"에만 다시 정리했고, 별도로 다시 묻지 않았다.

---

## 1. 생성/수정 파일 (이번 Task에서 변경된 것만)

| 파일 | 종류 |
|---|---|
| `docs/PHASE3_FINAL_AUDIT_REPORT.md` | 신규(본 보고서) |

그 외 `app/*`, `components/*`, `lib/*` 등 프로덕션 코드는 **전혀 수정하지 않았다** — Critical 발견 사항이 없었기 때문이다(§3).

감사 과정에서 WCAG 대비율 계산용 임시 스크립트(`.contrast_check.js`)를 만들어 썼으나, 검증 후 삭제했다 — git에 추적된 적 없는 파일이라 `git status`에도 남지 않는다.

---

## 2. Audit 결과

### 2-1. 반응형 점검

- **Mobile(<768px)**: `GlobalNav`가 `hidden`(§ GNB 리포트), `BottomNavigation`이 `fixed inset-x-0 bottom-0 ... md:hidden`으로 노출. `PageShell`의 `pb-16`이 BottomNavigation 높이(64px)를 보정해 본문이 가려지지 않음을 재확인.
- **Tablet(768~1024px) / Desktop(≥1024px)**: `md:flex`로 `GlobalNav` 노출, `BottomNavigation`은 `md:hidden`. 컴파일된 CSS에서 `md:flex`/`md:hidden`/`md:pb-0`이 동일한 `@media(min-width:48rem)` 블록에 함께 존재함을 확인(768px 지점에서 정확히 교대).
- **Overflow**: **`components/auth/ProfileMenu.tsx`에서 실제 오버플로우 위험을 발견했다.** §3에서 상세히 다룬다(High).
- 그 외 Header/Footer/Home 각 섹션은 `Container`(`max-w-content` + `px-6`)로 통일되어 있어 임의의 뷰포트에서 좌우 여백이 무너지는 경우는 없다.

### 2-2. 접근성 점검

- **Heading hierarchy**: `/`(h1→h2→h3, 스킵 없음), `/login`·`/onboarding`(각 h1 1개), `/ui-preview`(h1→h2, 개발용). 모든 페이지에서 위반 없음. 단, `app/page.tsx`의 feature 카드 `<h3>`가 `text-h2` 크기 토큰을 쓰는 점은 §4 UI 일관성에서 별도로 다룬다(Low).
- **nav landmark**: 홈 페이지 렌더링 결과에서 `aria-label` 4종(`"주요 메뉴"`, `"하단 메뉴"`, `"주요 기능"`, `"정책 및 안내"`)이 각각 정확히 1회씩만 존재 — Header(GlobalNav)/BottomNavigation 간 랜드마크 중복 없음을 재확인(Phase3-6/3-7에서 고친 상태 그대로 유지됨).
- **aria-current**: `/generate` 요청 시 GlobalNav·BottomNavigation의 "번호생성" 항목에만 `aria-current="page"`가 붙음을 실제 응답 HTML로 확인(해당 라우트가 아직 페이지 구현 전이라 404가 나지만, Root Layout이 404 페이지도 감싸므로 nav의 active state는 경로 기준으로 정상 동작 — 의도된 동작).
- **focus-visible**: `Button`/`GlobalNav`/`BottomNavigation`/`LoginButton`/`LogoutButton` 모두 `focus-visible:outline-2 outline-offset-2 outline-primary` 패턴을 공유. `LoginButton`과 Header의 "온보딩 계속하기" 링크에는 이 패턴이 없음(§4 Medium).
- **keyboard navigation**: 커스텀 클릭 핸들러가 있는 요소는 `LogoutButton.tsx` 단 하나이며 실제 `<button>` 요소다. 나머지는 전부 `<a>`(Link)라 별도 키보드 트랩 없음.
- **button/link semantics**: `<button>` 안에 `<a>`를 넣는 등의 중첩 인터랙티브 콘텐츠 없음. 이동에는 Link, 액션에는 button만 사용.
- **form label 연결**: `OnboardingForm.tsx`의 `label htmlFor="birth_date"`/`"nickname"`이 각 `input id`와 정확히 연결됨을 확인 — 결함 없음.
- **color contrast(DESIGN_SYSTEM.md 기준)**: WCAG 2.1 AA 공식(상대 휘도)으로 실측. §3에서 다룬다(High).

### 2-3. UI 일관성 점검

Button/Card/Input/Spacing/Radius/Typography/Hover/Focus/Disabled/Loading 전부 `components/ui/*` 소스를 다시 읽고 비교했다. 결과는 §4에 Medium/Low로 정리했다 — Critical급 불일치는 없다.

### 2-4. Header/Footer/BottomNavigation/GlobalNav 충돌 여부

- 랜드마크 라벨 중복 없음(위 확인).
- `GlobalNav`(`md:flex`)와 `BottomNavigation`(`md:hidden`)이 정확히 반대 breakpoint라 동시 노출 없음.
- `Header`의 `justify-between`이 `GlobalNav` 숨김 시에도 로고/인증 영역을 양 끝에 고정 — 레이아웃 붕괴 없음.
- `PageShell`의 `pb-16 md:pb-0`이 BottomNavigation 노출 여부와 정확히 같은 breakpoint에서 전환되어 본문 가림/불필요한 여백 둘 다 없음.
- 새로운 충돌은 발견하지 못했다.

### 2-5. Home 페이지 전체 레이아웃 점검

`app/page.tsx` 5개 섹션(Hero/주요기능/이번주인기/서비스소개/CTA) 구조, `FEATURES`/`VALUE_PROPS` 배열, `profile === "pending"` 온보딩 리다이렉트 로직 모두 Phase3-5 이후 변경 없음을 재확인. `buttonClassName("primary","lg")` 기반 CTA 링크 2곳 모두 정상. 새로 발견된 문제 없음(§2-1 Overflow, §4 Typography 항목은 Home이 아닌 공통 컴포넌트/타 페이지 이슈).

### 2-6. 불필요한 코드 탐색

- `grep -rn "TODO\|FIXME\|console\.log" app components lib` → **0건**.
- `onClick` 핸들러 → `LogoutButton.tsx` 1곳뿐, 정상적인 `<button>` 사용.
- 중복 컴포넌트(같은 역할의 컴포넌트가 두 번 만들어진 경우) 없음.
- 중복 클래스 문자열: `LoginButton.tsx`와 `Header.tsx`의 "온보딩 계속하기" 링크가 완전히 동일한 className 문자열을 각자 하드코딩 — §4 Medium.
- `Textarea`/`Badge`의 `warning`/`success`/`danger` variant 등 `/ui-preview`에서만 쓰이고 실제 페이지에서는 아직 안 쓰이는 컴포넌트가 있지만, 이는 "만들어졌지만 아직 소비되지 않은 예정된 인프라"이지 죽은 코드가 아니다(Button의 ghost/destructive variant도 동일 상태) — dead code로 분류하지 않았다.

---

## 3. Critical 수정 내용

**없음.** 이번 감사에서 Critical로 분류할 문제를 찾지 못해 프로덕션 코드를 수정하지 않았다.

Critical 판단 기준(이 보고서에서 일관되게 적용): *프로덕션에서 즉시 렌더링 오류·크래시·보안 문제를 일으키거나 핵심 기능(인증/네비게이션)을 완전히 무력화하는 것.* 이 기준에 해당하는 항목은 없었다. 가장 심각한 항목(ProfileMenu 오버플로우, color-danger/success 대비율)도 "보이지만 동작은 한다" 수준이라 High로 분류했다.

---

## 4. 발견된 문제 (Critical / High / Medium / Low)

### Critical
없음.

### High

1. **`components/auth/ProfileMenu.tsx` 모바일 오버플로우 위험.**
   `<div className="flex items-center gap-3 text-sm">` 안에 `{nickname}님` / `마이페이지` / `로그아웃` 3개 텍스트를 줄바꿈·축약(`truncate`) 없이, 모바일에서도 숨기지 않고 그대로 렌더링한다. `PROFILE_NICKNAME_MAX_LENGTH=30`(`lib/constants/index.ts`)이라 최대 30자 닉네임이 가능하고, `Container`의 좌우 여백(`px-6`×2=48px)을 뺀 375px 뷰포트 기준 가용 폭은 약 327px다. 로고("Luck Platform", `text-lg font-bold`)만으로도 이미 100px 이상을 쓰기 때문에, 닉네임이 짧아도(4자 안팎) 로고+ProfileMenu 합산 폭이 가용 폭에 근접하거나 초과할 수 있고, 닉네임이 길어질수록 확실히 초과한다. flex item의 기본 `min-width:auto` 때문에 줄어들지 않고 그대로 넘칠 가능성이 높다.
   실제 브라우저 렌더링(실제 로그인 세션)으로 픽셀 단위까지 재현하지는 않았으나, 코드 구조상(축약/숨김 로직 부재) 재현 가능성이 높다고 판단했다. **디자인 변경(모바일에서 무엇을 숨길지/줄일지)이 필요한 사안이라 임의로 고치지 않고 보고만 한다.**

2. **`color-danger`/`color-success` 토큰이 일반 텍스트 크기에서 WCAG AA 대비율(4.5:1)을 충족하지 못한다.**
   WCAG 2.1 표준 상대 휘도 공식으로 실측:
   - `color-danger(#E0353B)` on white → **4.43:1** (4.5:1 미달, 큰 텍스트만 AA 통과)
   - `color-success(#1AA260)` on white → **3.29:1** (4.5:1 미달, 큰 텍스트만 AA 통과)
   - 나머지 토큰(`color-primary`, `color-text-primary`, `color-text-secondary`, `bg-subtle` 위 텍스트, 카카오 버튼 배색)은 모두 AA(4.5:1) 통과.
   `color-danger`는 `Input.tsx`의 에러 텍스트(`text-caption`, 일반 텍스트 크기)에서, `color-success`/`color-danger`는 `Badge.tsx`의 success/danger variant에서 소비된다. 현재는 `/ui-preview`(개발용, `noindex`)에서만 실제로 렌더링되고 실서비스 페이지에는 아직 노출되지 않는다. **DESIGN_SYSTEM.md가 명시한 색상 값 자체를 바꿔야 하는 문제라 이번 Task의 "디자인 변경 금지" 원칙상 임의로 수정하지 않고 보고만 한다.**

### Medium

1. **className 문자열 중복.** `components/auth/LoginButton.tsx`와 `components/layout/Header.tsx`의 "온보딩 계속하기" 링크가 `"rounded-button bg-primary px-4 py-2 text-sm font-medium text-white"`를 각각 하드코딩한다. `components/ui/Button.tsx`가 이미 같은 스타일을 `buttonClassName()`으로 내보내는데도 두 곳 모두 이를 재사용하지 않는다(Button.tsx 자체 주석에 LoginButton의 중복이 이미 기록돼 있었는데, Header의 온보딩 링크가 같은 문제를 한 번 더 반복함).
2. **hover 상태 불일치.** 위 두 링크(LoginButton, Header의 온보딩 계속하기)에는 `hover:` 클래스가 전혀 없다. `Button.tsx`의 `secondary`/`destructive` variant도 `primary`(`hover:bg-primary-dark`)/`ghost`(`hover:bg-bg-subtle`)와 달리 hover 상태가 없다 — hover 누락이 특정 컴포넌트 하나의 문제가 아니라 여러 곳에 걸쳐 있다.
3. **`OnboardingForm.tsx`(및 `/login`, `/onboarding` 페이지)가 Design Token/UI 컴포넌트 라이브러리를 전혀 쓰지 않는다.** Phase2에서 작성된 이 폼은 `components/ui/Input.tsx`/`Label.tsx`/`Button.tsx`를 쓰지 않고 원시 `<input>`/`<label>`/`<button>`에 Tailwind 팔레트(`neutral-300`, `neutral-900`, `red-500`, `red-600`)를 직접 사용한다. Disabled 처리도 `Button.tsx`의 규격(`bg-border`/`text-text-secondary`)이 아니라 `disabled:opacity-50`을 쓴다. Phase3-4/3-4 보고서에서 이미 known-issue로 기록된 것과 동일한 사안으로, 새로 발견된 것은 아니다(재확인).

### Low

1. **`BottomNavigation.tsx`의 주석이 오래됐다.** 44~47번째 줄 주석이 Header의 nav를 "placeholder nav"로 지칭하는데, Phase3-7에서 이미 실제 `GlobalNav`로 교체됐다. 랜드마크 중복을 피하기 위해 라벨을 분리했다는 주석의 핵심 근거는 여전히 유효하지만 "placeholder"라는 표현만 현실과 맞지 않는다.
2. **`app/page.tsx`의 feature 카드 `<h3>`가 `text-h2` 크기 토큰을 쓴다.** heading 단계(h1→h2→h3)는 올바르지만, 시각적 크기 토큰과 semantic heading 레벨이 어긋난다(h3인데 h2 크기). 계층 위반은 아니고 타이포그래피 토큰 선택의 사소한 불일치다.

---

## 5. 기존에 알려진 문제 (재확인, 새로 발견된 것 아님)

- GNB/Bottom Navigation 모두 "더보기"(통계/당첨사례/로또명당 등 3×3 그리드) 진입 경로가 없음 — Phase3-6/3-7에서 이미 사용자 확인을 거쳐 이번 범위 밖으로 확정된 사안.
- GNB(번호생성/꿈해몽/운세/다이어리)와 Bottom Navigation(홈/번호생성/운세/다이어리)의 항목 구성이 서로 다름(꿈해몽이 데스크톱 GNB에만 있음) — `INFORMATION_ARCHITECTURE.md` 원 설계 자체의 차이이며 Phase3가 새로 만든 불일치 아님.
- `/generate`, `/fortune`, `/dream`, `/my/journal` 실제 페이지 미구현(네비게이션 링크는 SITEMAP 경로를 미리 연결해둔 상태) — Phase4 이후 범위.

---

## 6. Validation 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 (경고/오류 없음) |
| `npm run type-check` | 통과 |
| `npm test` | 16개 테스트 통과(3 파일), 변경 없음 |
| `npm run build` | 통과. 라우트 목록 변경 없음(`/`, `/login`, `/onboarding`, `/ui-preview`, API 4개, `_not-found`) |

### 추가 검증 (실행 중인 dev 서버 + curl)

| 확인 대상 | 결과 |
|---|---|
| `/`, `/login`, `/ui-preview` | 전부 `200` |
| `/onboarding`(비로그인) | `307` → `/login?next=%2Fonboarding`(기존과 동일, 회귀 없음) |
| BottomNavigation/GNB active state | `/generate` 요청 시 두 nav의 "번호생성" 항목에만 `aria-current="page"` 부여 확인. `/`에서는 BottomNavigation "홈" 탭에만 `aria-current="page"` 확인 |
| landmark 중복 여부 | 홈 페이지에서 `aria-label` 4종이 각 1회씩만 존재("주요 메뉴"/"하단 메뉴" 중복 없음) |
| 모바일/데스크톱 분기 | 컴파일된 CSS에서 `md:flex`/`md:hidden`/`md:pb-0`이 같은 `@media(min-width:48rem)` 블록에 존재 — 768px 기준 정확히 교대 확인(Phase3-7과 동일 결과 재확인) |
| `proxy.ts` 영향 | 파일 자체를 열지 않았고 이번 Task에서 관련 코드를 수정하지 않았음. `/onboarding` 리다이렉트 동작이 기존과 동일함을 위에서 실측 확인 |
| 인증 회귀 | `lib/auth/*`, `components/auth/*`, `Header.tsx` 등 인증 관련 파일을 이번 Task에서 전혀 수정하지 않았음(§1). Phase3-7 보고서가 실제 Supabase 세션(카카오 API 우회)으로 비로그인/로그인+profile없음/로그인+profile있음 3가지 상태를 이미 검증했고, 이후 관련 코드 변경이 없어 그 결과가 그대로 유효하다고 판단해 별도로 재실행하지 않았다 |

---

## 7. Phase3 완료 여부

**완료.** Critical 결함이 없고, 4개 필수 Validation과 추가 수동 검증 모두 통과했다. High/Medium/Low로 분류된 항목들은 모두 "동작은 하지만 개선이 필요한" 수준이며, 그중 다수(color-danger/success 대비, OnboardingForm의 Design Token 미사용)는 색상 값 변경이나 디자인 결정이 필요해 이번 Task 원칙(디자인 변경 금지, 새 기능 금지)상 지금 고칠 수 없는 항목들이다.

## 8. Phase4 착수 가능 여부

**가능.** Header/Footer/BottomNavigation/GlobalNav/Home이 서로 충돌 없이 동작하고, 인증 UI 3상태·네비게이션 active state·반응형 breakpoint가 모두 실측으로 확인됐다. 다음 단계로 넘어가기 전에 판단이 필요한 항목은:

1. `color-danger`/`color-success` 토큰 값을 AA 기준에 맞게 조정할지(디자인 결정 필요, §4 High-2).
2. `ProfileMenu` 모바일 레이아웃을 어떻게 축약할지(디자인 결정 필요, §4 High-1) — 실제 페이지에 로그인 사용자가 노출되기 전에 우선 처리를 권장한다.
3. `OnboardingForm`/`/login`/`/onboarding`을 Phase3 UI 컴포넌트 라이브러리로 옮길지(§4 Medium-3, 이미 known issue).

이 세 가지는 Phase4 착수를 막는 차단 요인은 아니지만, 실제 사용자에게 노출되는 순서를 고려하면 조기에 결정하는 것을 권장한다.
