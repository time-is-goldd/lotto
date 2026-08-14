# PHASE3-1 DESIGN TOKEN IMPLEMENTATION 보고서

> [[DESIGN_SYSTEM]]에 정의된 디자인 토큰을 Tailwind CSS v4 `@theme`(CSS-first) 방식으로 `app/globals.css`에 반영한 결과다. `tailwind.config.ts`는 만들지 않았고, 페이지/컴포넌트는 생성하지 않았다.

---

## 0. 문서 경로 확인

지시문이 명시한 `docs/UI_GUIDELINE.md`는 존재하지 않는다 — 실제 파일명은 `docs/UI_UX_GUIDELINE.md`다(디렉터리 조회로 확인). 이 문서를 대신 참조했다.

---

## 1. 생성/수정 파일

| 파일 | 종류 | 내용 |
|---|---|---|
| `app/globals.css` | 수정 | [[DESIGN_SYSTEM]] 토큰 전면 반영(§2). 기존 `--background`/`--foreground`(근거 없는 Phase0 placeholder) 제거 |
| `docs/DESIGN_TOKEN_IMPLEMENTATION_REPORT.md` | 신규 | 본 보고서 |

검증 과정에서 `app/_tokentest/page.tsx`(Next.js `_` 접두사 private 폴더 — 라우팅 대상이 아님, Tailwind 컴파일러가 토큰을 실제로 픽업하는지 확인하기 위한 임시 파일)를 만들었다가 확인 후 삭제했다 — 최종 코드베이스에는 흔적이 없다.

---

## 2. `app/globals.css` 분석 (변경 전 상태)

변경 전에는 `@theme inline` 블록에 `--color-background`/`--color-foreground` 2개 토큰만 있었고, 이 값(`#ffffff`/`#1a1a1a`)은 **[[DESIGN_SYSTEM]] 어디에도 정의되지 않은 임의의 이름**이었다 — Phase0 스캐폴딩 시점에 Next.js 템플릿이 기본 제공한 placeholder였다. `grep`으로 확인한 결과 `bg-background`/`text-foreground` 유틸리티 클래스는 프로젝트 어디서도 사용되지 않았고(`app/globals.css` 자신의 `body{}` 규칙에서만 참조), 실제 3개 페이지(`/`, `/login`, `/onboarding`)는 전부 `bg-white`/`text-neutral-900`처럼 Tailwind 기본 팔레트를 직접 썼다 — [[DESIGN_SYSTEM]] 토큰을 참조하는 코드가 프로젝트에 하나도 없는 상태였다. 이 사실을 확인했기 때문에, 기존 두 토큰을 삭제해도 시각적 영향이 없다고 판단하고 [[DESIGN_SYSTEM]]의 정식 토큰명으로 교체했다(§3).

---

## 3. 적용한 Token 목록

### Color — [[DESIGN_SYSTEM]] §1
| 토큰 | 값 | 대응 카테고리(지시문) |
|---|---|---|
| `--color-primary` | `#1b4dff` | Primary |
| `--color-primary-dark` | `#123399` | Primary(호버/프레스) |
| `--color-accent-gold` | `#ffb800` | Accent |
| `--color-kakao` | `#fee500` | Accent(카카오 전용) |
| `--color-bg-base` | `#ffffff` | Background |
| `--color-bg-subtle` | `#f7f8fa` | Surface |
| `--color-text-primary` | `#1a1a1a` | Text |
| `--color-text-secondary` | `#5b5f66` | Text(보조) |
| `--color-border` | `#e4e6eb` | Border |
| `--color-success` | `#1aa260` | (지시문 카테고리엔 없으나 §1.2에 정의되어 있어 함께 반영) |
| `--color-danger` | `#e0353b` | (상동) |

**"Surface" 카테고리는 별도 `--color-surface` 별칭을 새로 만들지 않고 [[DESIGN_SYSTEM]]의 실제 토큰명(`bg-subtle`)을 그대로 썼다** — 같은 색을 두 이름으로 부르면 [[AI_ENGINEERING_CONSTITUTION]] §3 "중복 코드 작성 금지"에 해당하는 중복 토큰이 된다.

### Typography — [[DESIGN_SYSTEM]] §2
| 토큰 | 값 |
|---|---|
| `--text-display` | `32px` |
| `--text-h1` | `28px` |
| `--text-h2` | `22px` |
| `--text-body-lg` | `18px` |
| `--text-body` | `16px` |
| `--text-caption` | `14px` |
| `--text-button` | `20px` |

**Font weight**: 별도 토큰을 추가하지 않았다 — Tailwind 기본 `--font-weight-bold`(700)/`--font-weight-normal`(400)이 [[DESIGN_SYSTEM]]이 요구하는 Bold/Regular 두 값과 정확히 일치해 `font-bold`/`font-normal` 유틸리티를 그대로 쓰면 된다.
**Line height**: [[DESIGN_SYSTEM]] §2 "행간 1.6배 이상"은 스케일별로 다른 값이 아니라 전역 공통값이라, 커스텀 `--leading-*` 토큰 대신 `body { line-height: 1.6; }`로 한 번에 적용했다.
**Font family**: [[DESIGN_SYSTEM]]은 폰트 패밀리 자체를 지정하지 않는다. [[UI_UX_GUIDELINE]] §2("시스템 기본 산세리프, 장식적 폰트 금지")와 [[DESIGN_SYSTEM]] §2("한글 가독성 확보")를 근거로 `--font-sans`(Tailwind v4 기본 제공 토큰)에 한글 시스템 폰트(`Apple SD Gothic Neo`, `Malgun Gothic`)를 앞에 추가했다 — 새 값을 발명한 것이 아니라 Tailwind 기본 시스템 폰트 스택의 한글 확장이며, 웹폰트(`next/font` 등)는 도입하지 않았다.

### Spacing — [[DESIGN_SYSTEM]] §3
**별도 토큰을 추가하지 않았다.** `4/8/12/16/24/32/48/64` 배수 체계는 Tailwind v4의 기본 spacing scale(`--spacing: 0.25rem` = 4px 기준 배수)과 이미 완전히 일치한다(`p-1`=4px, `p-2`=8px, `p-3`=12px, `p-4`=16px, `p-6`=24px, `p-8`=32px, `p-12`=48px, `p-16`=64px). 커스텀 스케일을 새로 정의하면 오히려 두 체계가 공존해 혼란을 유발한다.

### Radius — [[DESIGN_SYSTEM]] §4.1/§4.3/§4.5
| 토큰 | 값 | 대상 |
|---|---|---|
| `--radius-button` | `12px` | Button(§4.1) |
| `--radius-card` | `16px` | Card(§4.3) |
| `--radius-input` | `8px` | Input(§4.5) |

지시문이 요구한 "Container" radius는 [[DESIGN_SYSTEM]]에 정의되어 있지 않다 — §5 "변경하지 않은 항목" 참조.

### Shadow — [[DESIGN_SYSTEM]] §4.3
| 토큰 | 값 |
|---|---|
| `--shadow-card` | `0 1px 4px rgba(0,0,0,0.06)` |

지시문이 요구한 "Floating element"(모달/드롭다운 등) 그림자는 [[DESIGN_SYSTEM]]에 값이 정의되어 있지 않다 — §5 참조.

---

## 4. Tailwind v4 적용 방식 (실제 컴파일 결과로 검증)

Tailwind v4 `@theme` 블록의 네임스페이스 규칙을 `node_modules/tailwindcss/theme.css`(설치된 패키지 원본)로 직접 확인한 뒤 적용했다 — `--color-*` → 색상 유틸리티, `--text-*`(⚠️ `--font-size-*`가 아님) → 폰트 크기 유틸리티, `--radius-*` → `rounded-*`, `--shadow-*` → `shadow-*`. 추측이 아니라 실제 패키지 소스로 검증했다.

**빌드 산출물로 실측**: `npm run build` 후 컴파일된 CSS를 직접 열어본 결과, 새로 추가한 토큰 대부분이 `:root`에 나타나지 않았다 — Tailwind v4가 **실제로 사용되는 유틸리티 클래스만 컴파일에 포함**하는 JIT 특성 때문이다(현재 어떤 페이지도 `bg-primary`/`text-h1` 등을 쓰지 않으므로 정상). 이것이 버그인지 토큰 정의 실수인지 구분하기 위해, 임시 파일(`app/_tokentest/page.tsx`, Next.js가 라우팅하지 않는 `_` 접두사 폴더)에 `bg-primary text-h1 rounded-card shadow-card border-border bg-bg-subtle text-text-secondary bg-accent-gold text-success text-danger rounded-button rounded-input` 전부를 사용하는 코드를 넣고 다시 빌드했다 — **12개 클래스 전부 정확한 가치(`--color-primary`, `--text-h1` 등)로 정상 생성됨을 확인**했다. 확인 후 즉시 삭제하고 재빌드해 산출물이 원래 상태로 돌아오는 것까지 확인했다.

**결론**: 토큰 정의는 정확하다. 지금 컴파일 결과에 보이지 않는 것은 "아직 아무 컴포넌트도 이 토큰을 쓰지 않기 때문"이며, Phase3-2 이후 실제 컴포넌트가 `className="bg-primary"`처럼 참조하는 순간 자동으로 포함된다 — Tailwind의 정상적인 on-demand 컴파일 방식이다.

---

## 5. 앞으로 컴포넌트에서 사용하는 방법

토큰은 CSS 변수가 아니라 **Tailwind 유틸리티 클래스**로 소비한다(직접 `var(--color-primary)`를 쓸 필요 없음).

```tsx
// Primary 버튼
<button className="bg-primary text-white rounded-button">확인</button>

// Card
<div className="bg-bg-subtle rounded-card shadow-card p-4">...</div>

// Heading
<h1 className="text-h1 font-bold text-text-primary">제목</h1>

// 보조 텍스트
<p className="text-caption text-text-secondary">안내문</p>

// 성공/실패 상태
<span className="text-success">당첨</span>
<span className="text-danger">미당첨</span>

// 카카오 브랜드 버튼(색상 고정 준수)
<button className="bg-kakao text-[#191919]">카카오로 로그인</button>
```

Spacing/폰트굵기는 Tailwind 기본값을 그대로 쓴다: `p-4`(16px), `gap-6`(24px), `font-bold`(700), `font-normal`(400).

---

## 6. Design System 일치 여부

| 항목 | 일치 여부 |
|---|---|
| Color(Primary/Background/Surface/Text/Border/Accent + Success/Danger) | 전부 일치 — [[DESIGN_SYSTEM]] §1 값 그대로 |
| Typography(Heading/Body/Caption/Font weight/Line height) | 일치 — 값 그대로 반영, weight/line-height는 Tailwind 기본값 재사용으로 대체(§3) |
| Spacing | 일치 — Tailwind 기본 scale이 이미 동일해 별도 토큰 불필요 |
| Radius(Button/Card/Input) | 일치. "Container" radius는 문서에 없어 반영 안 함(§5) |
| Shadow(Card) | 일치. "Floating element" 그림자는 문서에 없어 반영 안 함(§5) |

---

## 7. 변경하지 않은 항목 (Design System 값을 임의로 만들지 않음)

1. **"Container" radius** — [[DESIGN_SYSTEM]] §4가 Button(12px)/Card(16px)/Input(8px)만 정의하고 별도 "Container" radius를 정의하지 않았다. 임의 값을 지어내지 않았다 — 필요해지면 [[DESIGN_SYSTEM]]에 먼저 값을 추가하는 것이 순서다.
2. **"Floating element" shadow**(모달/드롭다운/토스트 등) — [[DESIGN_SYSTEM]] §4.3은 Card 그림자 1건만 정의한다. Modal/Toast 섹션(§4.4)에도 그림자 값이 없다. 위와 동일한 이유로 반영하지 않았다.
3. **다크모드 대응** — [[DESIGN_SYSTEM]] §8이 명시적으로 "초기 버전 미지원"이라 다크모드 변수 오버라이드(`prefers-color-scheme`, `data-theme` 등)를 추가하지 않았다.
4. **버튼/카드/인풋 등 실제 컴포넌트 코드** — 이번 Task 범위 밖(Header/Footer/Layout/Button/Card/Auth UI 생성 금지). 토큰만 준비했다.
5. **기존 3개 페이지(`/`, `/login`, `/onboarding`)의 클래스 교체** — 여전히 `bg-white`/`text-neutral-900` 등 Tailwind 기본 팔레트를 그대로 쓴다. 새 토큰으로 바꾸는 작업은 "페이지 디자인 변경 금지"에 해당해 하지 않았다 — Phase3-2 이후 공통 컴포넌트가 준비되면 그때 교체 대상이다.

---

## 8. Validation 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 16개 테스트 통과(변경 없음) |
| `npm run build` | 통과, 라우트 목록 변경 없음 |
| 기존 페이지(`/`, `/login`, `/onboarding`) 스타일 깨짐 여부 | 실제 `npm run dev` + `curl`로 3개 페이지 전부 정상 응답 및 콘텐츠 렌더링 확인(`/onboarding`은 비로그인 시 `307` 리다이렉트가 정상 동작 — 스타일 문제 아님) |
| Tailwind class 정상 생성 여부 | §4에서 12개 토큰 기반 클래스 전부 실제 컴파일 확인 |

---

## 9. Phase3-2 Layout 착수 가능 여부

**가능.** [[DESIGN_SYSTEM]]의 Color/Typography/Radius/Shadow 토큰이 Tailwind v4 유틸리티로 실사용 가능한 상태로 준비되었고, 실제 컴파일 검증까지 마쳤다. Spacing/Font-weight는 Tailwind 기본값 재사용으로 이미 충족되어 추가 작업이 필요 없다. 남은 갭(Container radius, Floating element shadow)은 [[DESIGN_SYSTEM]] 문서 보완이 먼저 필요한 사안이며 Phase3-2(Common Layout)의 Button/Card 작업을 막지 않는다 — 두 컴포넌트 모두 이미 정의된 토큰(Button radius, Card radius+shadow)만으로 시작 가능하다.
