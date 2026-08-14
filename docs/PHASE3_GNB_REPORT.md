# PHASE3-7 HEADER GLOBAL NAVIGATION 보고서

> Header의 placeholder GNB를 실제 Global Navigation으로 구현한 결과다. 기존 Header 컴포넌트를 확장했고(새 Header 생성 안 함), 인증 로직·`proxy.ts`·OAuth·API·DB·RLS는 전혀 수정하지 않았다.

---

## 0. 착수 전 발견한 문서 불일치 (기존 선례 적용, 재확인만 하고 진행)

`INFORMATION_ARCHITECTURE.md` §1.1(데스크톱 GNB)을 확인한 결과, [[PHASE3_BOTTOM_NAVIGATION_REPORT]] §0-2에서 이미 발견·확정한 것과 **정확히 같은 문제**가 있었다.

- GNB 계획: `[로고] 번호생성 꿈해몽 운세 다이어리 더보기 [로그인/프로필]`
- "더보기"는 `SITEMAP.md`에 대응 URL이 없고 실제로는 §1.3의 3×3 그리드 오버레이다 — Bottom Navigation Task에서 사용자가 이미 "제외" 결정을 확정해준 것과 동일한 사안이다.

새로운 충돌이 아니라 **이미 사용자 확인을 거친 선례를 다시 적용하는 것**이라고 판단해 별도로 다시 묻지 않고, 그 결정을 그대로 GNB에도 적용했다 — **4개 항목**(번호생성/꿈해몽/운세/다이어리)만 구현했다. 이 판단이 부적절하다면 알려달라.

다른 문서 불일치는 발견되지 않았다.

---

## 1. 생성/수정 파일 (이번 Task에서 변경된 것만)

| 파일 | 종류 | 내용 |
|---|---|---|
| `components/navigation/GlobalNav.tsx` | 신규 | GNB 4개 링크 + 활성 상태, Client Component |
| `components/layout/Header.tsx` | 수정 | 빈 `<nav>` placeholder를 `<GlobalNav />`로 교체, `justify-between` 추가(§2) |
| `docs/PHASE3_GNB_REPORT.md` | 신규 | 본 보고서 |

`components/auth/*`(LoginButton/ProfileMenu/LogoutButton)·`components/layout/Footer.tsx`·`components/navigation/BottomNavigation.tsx`·`lib/auth/*`·`proxy.ts`·DB/API는 전혀 수정하지 않았다.

---

## 2. 구현 내용

```tsx
// components/navigation/GlobalNav.tsx — SITEMAP 실제 경로 4개
[번호생성 "/generate"] [꿈해몽 "/dream"] [운세 "/fortune"] [다이어리 "/my/journal"]
```

- **"새 Header를 만들지 않는다"를 지킨 방법**: `Header.tsx` 자체는 여전히 `getCurrentUser()`/`getProfile()`을 호출하는 하나의 `async` Server Component다. 바뀐 것은 그 안에서 렌더링하는 자식 하나(빈 `<nav>` → `<GlobalNav />`)뿐이다.
- **Client Component가 필요했던 이유**: 활성 탭 표시에는 현재 경로가 필요한데, `Header`(Root Layout에서 쓰이는 Server Component)는 요청 경로를 prop으로 받을 방법이 없다(Root Layout이라 route params도 없음). `usePathname()`이 Next.js가 이 문제에 제공하는 유일한 공식 해법이라, [[PHASE3_BOTTOM_NAVIGATION_REPORT]]의 `BottomNavigation`·[[PHASE3_HEADER_FOOTER_REPORT]]의 `LogoutButton`과 똑같은 이유로 `GlobalNav`만 별도 Client Component로 분리했다. `Header` 자신의 인증 로직은 이 분리로 전혀 영향받지 않는다(요구사항 10 그대로 충족).
- **모바일/데스크톱 충돌 방지**: `GlobalNav`는 `hidden md:flex`(768px 미만 숨김), `BottomNavigation`은 이미 `md:hidden`(768px 이상 숨김)이다 — 정확히 반대 지점에서 서로 넘겨받아 두 내비게이션이 동시에 보이는 경우가 구조적으로 없다.
- **`justify-between` 추가 이유**: `GlobalNav`가 모바일에서 `display:none`이 되면 기존에 그 자리를 채우던 `flex-1` 스페이서 효과가 사라져 로고와 인증 영역이 붙어버리는 회귀가 생긴다. `Container`에 `justify-between`을 추가해 `GlobalNav`가 보이든 안 보이든 로고/인증 영역이 항상 양 끝에 위치하도록 했다 — 데스크톱(GNB가 `flex-1`로 이미 여유 공간을 다 차지)에는 영향이 없다.

---

## 3. 디자인 시스템 준수 여부

| 항목 | 적용 |
|---|---|
| 텍스트 크기 | `text-body`(16px) — 기존 토큰 |
| 활성/비활성 색상 | `text-primary`(활성) / `text-text-secondary`(비활성) — [[PHASE3_BOTTOM_NAVIGATION_REPORT]]가 이미 쓴 것과 동일한 페어, 새 색상 없음 |
| 항목 간 간격 | `gap-6`(24px) — Tailwind 기본 spacing, 새 값 없음 |
| focus 표시 | `Button.tsx`/`BottomNavigation.tsx`와 동일한 `focus-visible:outline-2 outline-offset-2 outline-primary` 패턴 재사용 |

새 색상·spacing·radius·shadow를 만들지 않았다 — grep으로 재확인.

---

## 4. 접근성 검증

- **`<nav>`**: `GlobalNav`가 자신의 `<nav aria-label="주요 메뉴">`를 렌더링한다 — Header가 기존에 갖고 있던 것과 동일한 라벨을 그대로 유지했다(내용만 실제 메뉴로 교체).
- **landmark 중복 방지**: [[PHASE3_BOTTOM_NAVIGATION_REPORT]]에서 이미 겪은 문제(Header "주요 메뉴" vs BottomNavigation)를 그때 "하단 메뉴"로 구분해뒀기 때문에, 이번에 Header의 nav를 실제로 채워도 새로운 중복이 생기지 않는다 — 실제 렌더링 결과로 "주요 메뉴" 1회, "하단 메뉴" 1회만 존재함을 확인했다.
- **`aria-current`**: 활성 링크에 `aria-current="page"`를 부여한다. `/generate`에서 "번호생성" 링크에만 `aria-current="page"` + `text-primary`가 붙는 것을 실제 렌더링 결과로 확인했다.
- **keyboard**: 전부 `<a>`(Link) — `Tab`/`Enter` 기본 동작, 커스텀 핸들러 없음.
- **focus-visible**: §3 참조.

---

## 5. Validation 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 16개 테스트 통과(변경 없음) |
| `npm run build` | 통과. 라우트 목록 변경 없음 |

### 실제 렌더링/컴파일 결과로 확인(`npm run dev` + `curl`)

| 확인 대상 | 결과 |
|---|---|
| `/`, `/login`, `/ui-preview` | 전부 `200`, 영향 없음 |
| `/onboarding`(비로그인) | `307` → `/login?next=%2Fonboarding`, 기존과 동일 |
| GNB 링크 4개 | `/generate`/`/dream`/`/fortune`/`/my/journal` 정확히 렌더링 |
| landmark 중복 | "주요 메뉴" 1회, "하단 메뉴" 1회만 존재 확인 |
| active state | `/generate`에서 "번호생성"에만 `aria-current="page"` 확인, `/`에서 GNB 4개 전부 비활성 확인 |
| 모바일/데스크톱 전환 | 컴파일된 CSS에서 `@media (min-width:48rem){.md\:flex{display:flex} .md\:hidden{display:none} .md\:pb-0{padding-bottom:0}}` 한 블록에 세 규칙이 함께 존재함을 확인 — GNB 등장과 BottomNavigation 소멸이 정확히 같은 지점(768px)에서 일어난다 |
| 인증 UI(요구사항 7) | 실제 Supabase 프로젝트 대상(카카오 API 우회, 검증 후 테스트 계정 삭제)으로 비로그인(LoginButton)·로그인+profile없음("온보딩 계속하기")·로그인+profile있음(ProfileMenu: 마이페이지/로그아웃) 3가지 상태 전부 GNB 추가 후에도 그대로 렌더링됨을 확인 |
| `proxy.ts` | 파일 자체를 열지 않았고, 기존 리다이렉트 동작이 그대로임을 재확인 |

---

## 6. 발견된 문제

### 문서 불일치
- §0에 정리한 1건("더보기" 항목이 GNB에도 SITEMAP URL 없이 존재) — [[PHASE3_BOTTOM_NAVIGATION_REPORT]]에서 이미 사용자 확인을 받은 선례를 그대로 적용해 진행했다. 문서(`INFORMATION_ARCHITECTURE.md`/`DESIGN_SYSTEM.md`) 자체는 수정하지 않았다.

### 설계 리스크
1. **GNB와 Bottom Navigation의 메뉴 구성이 서로 다르다.** GNB는 번호생성/꿈해몽/운세/다이어리, Bottom Navigation은 홈/번호생성/운세/다이어리다 — "꿈해몽"이 데스크톱에만 있고 모바일 하단 탭에는 없다(원래 `INFORMATION_ARCHITECTURE.md` §1.1/§1.2 설계 자체가 이렇게 다르게 정의해뒀던 것이라 이번 Task가 새로 만든 불일치는 아니다). 사용자가 데스크톱→모바일로 전환하면 "꿈해몽"으로 가는 길이 사라진다는 점은 인지하고 있어야 한다.
2. **"더보기" 메뉴가 GNB·Bottom Navigation 양쪽에서 전부 누락된 상태가 지속된다.** 통계/당첨사례/로또명당 등으로 가는 경로가 현재 어떤 내비게이션에도 없다.

### 향후 수정 권장사항 (이번 Task 범위 아님, 수정하지 않고 보고만)
1. "더보기" 그리드 오버레이를 언제 어떻게 만들지 결정 필요([[PHASE3_BOTTOM_NAVIGATION_REPORT]]에서 이미 권고한 것과 동일).
2. GNB/Bottom Navigation 항목 구성 차이(꿈해몽 유무)를 의도된 것으로 문서에 명시할지, 통일할지 결정 필요.
3. `/fortune`·`/dream`·`/my/journal` 실제 페이지 구현 Phase 확인([[PHASE3_UI_ARCHITECTURE_PLAN]] §7-2가 이미 권고).

---

## 7. Phase3 다음 단계 착수 가능 여부

**가능.** Header의 GNB가 SITEMAP 실제 경로 4개로 정확히 연결되고, active state·접근성(landmark 중복 없음 포함)·모바일/데스크톱 전환·기존 인증 UI·`proxy.ts` 전부 실측으로 영향 없음을 확인했다. 데스크톱 내비게이션이 이제 실제로 동작하므로, 다음 단계(각 기능 페이지 구현 Phase, 또는 "더보기" 처리 방향 결정)를 바로 이어갈 수 있다.
