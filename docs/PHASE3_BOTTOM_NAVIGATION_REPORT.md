# PHASE3-6 BOTTOM NAVIGATION 보고서

> 모바일 중심 Bottom Navigation을 구현한 결과다. Header/Footer/Home UI/인증/`proxy.ts`는 전혀 수정하지 않았다(단, `PageShell.tsx`에 최소 레이아웃 보정 1줄 추가 — §2).

---

## 0. 착수 전 발견한 문서 불일치 (사용자 확인 완료)

지시대로 구현 전에 보고했고, 사용자 확인을 받은 뒤 진행했다.

1. **파일명 불일치**: 지시문의 `docs/PHASE2_PROXY_ROUTE_FIX_REPORT.md`는 존재하지 않는다. 실제 파일은 `docs/PHASE3_PROXY_ROUTE_FIX_REPORT.md`(Phase3-0)다 — 내용상 이 문서를 검토했다.
2. **"더보기" 탭 충돌(★차단 요인이었음)**: `DESIGN_SYSTEM.md` §4.6은 하단 탭바를 "5개 항목"으로 명시하고, 그 5개 구성(홈/번호생성/운세/다이어리/더보기)은 `INFORMATION_ARCHITECTURE.md` §1.2(이번 Task 검토 목록엔 없었음)에 정의돼 있다. 그런데 "더보기"는 `SITEMAP.md`에 대응 URL이 없고 실제로는 §1.3의 3×3 그리드 오버레이라, "SITEMAP 기준으로만 메뉴 구성"·"새 경로 추가 금지" 원칙과 정면으로 부딧혔다. **사용자에게 보고 후 "4탭만 구현(홈/번호생성/운세/다이어리)"으로 확정받아 진행했다.**
3. **아이콘 라이브러리 부재**: `package.json` 확인 결과 아이콘 라이브러리가 설치된 적이 없다. `DESIGN_SYSTEM.md` §5의 아이콘 체계는 실제 구현된 적이 없다 — 기존 유일한 전례(유니코드 기호 + `aria-hidden`)와 같은 방식으로, 새 라이브러리 없이 인라인 SVG를 직접 그려 처리했다(§2).
4. **`/fortune`이 어느 Phase에도 배정되어 있지 않음**: `PHASE3_UI_ARCHITECTURE_PLAN.md` §7-2가 이미 지적한 기존 이슈의 재확인. 차단 요인은 아니라고 판단했다(`/generate`/`/my/journal`도 아직 없지만 이미 홈 화면이 같은 방식으로 연결해뒀다).

---

## 1. 생성/수정 파일 (git 기준, 이번 Task에서 변경된 것만)

| 파일 | 종류 | 내용 |
|---|---|---|
| `components/navigation/BottomNavigation.tsx` | 신규 | 4탭 Bottom Navigation, Client Component |
| `components/layout/PageShell.tsx` | 수정(1줄) | `pb-16 md:pb-0` 추가 — BottomNavigation이 Footer를 가리지 않도록 하는 최소 보정 |
| `app/layout.tsx` | 수정 | `BottomNavigation`을 `PageShell` 안 `Footer` 다음에 추가 |
| `docs/PHASE3_BOTTOM_NAVIGATION_REPORT.md` | 신규 | 본 보고서 |

`Header.tsx`/`Footer.tsx`/`Container.tsx`/`Main.tsx`/`components/auth/*`/`components/ui/*`/`lib/auth/*`/`proxy.ts`/DB/API는 전혀 수정하지 않았다. 개발용 임시 검증 파일(`.check_css.js`, `.dev_globals.css` 등 CSS 컴파일 결과 직접 확인용)은 검증 후 전부 삭제했다.

---

## 2. 구현 내용

```tsx
// 4개 탭, 전부 docs/SITEMAP.md 실제 경로
[홈 "/"] [번호생성 "/generate"] [운세 "/fortune"] [다이어리 "/my/journal"]
```

- **위치**: `components/navigation/`(신규 폴더) — `components/layout/`(Header/Footer/Container/Main/PageShell)와 성격이 달라(내비게이션 전용 컴포넌트) 별도 폴더로 분리했다. `components/auth/`가 인증 UI를 위해 별도 폴더로 분리된 전례([[PHASE3_HEADER_FOOTER_REPORT]])와 같은 판단 기준이다.
- **Client Component인 이유**: 현재 경로에 따라 활성 탭을 표시해야 하는데, `app/layout.tsx`(Root Layout)는 Server Component라 요청 경로를 알 방법이 없다. Next.js가 이 문제를 위해 제공하는 유일한 공식 해법이 `usePathname()`이라, 다른 대안 없이 이 컴포넌트만 Client Component로 뒀다.
- **아이콘**: 새 라이브러리 없이 인라인 SVG 4개(홈/주사위 5눈/별/펼쳐진 책)를 직접 그렸다 — `DESIGN_SYSTEM.md` §5의 아이콘 매핑(번호생성=주사위·볼, 운세=별, 다이어리=노트)을 그대로 따랐다. 모든 아이콘에 `aria-hidden="true"`를 붙이고 텍스트 라벨을 항상 동반한다(`UI_UX_GUIDELINE.md` §6 "아이콘 단독 사용 금지").
- **Layout 보정**: `PageShell.tsx`에 `pb-16 md:pb-0` 1줄만 추가했다 — BottomNavigation이 `fixed` + 높이 64px이라 모바일에서 Footer 콘텐츠 마지막 줄을 가릴 수 있는데, `md:` 시점(768px)에서 BottomNavigation이 사라지는 것과 정확히 같은 지점에서 `md:pb-0`으로 상쇄돼 데스크톱 레이아웃은 1px도 바뀌지 않는다.

---

## 3. 디자인 시스템 준수 여부

| 항목 | 적용 |
|---|---|
| 높이 | `h-16`(64px) — `DESIGN_SYSTEM.md` §4.6 그대로 |
| 활성/비활성 색상 | `text-primary`(활성) / `text-text-secondary`(비활성) — §4.6 그대로, 새 색상 없음 |
| 배경/구분선 | `bg-bg-base` + `border-t border-border` — 기존 토큰 재사용 |
| 아이콘 크기 | `h-8 w-8`(32px) — §5 "32px(탭바)" 그대로 |
| 텍스트 | `text-caption`(14px) — 기존 타이포 토큰 |
| Spacing/Radius | 새로 만든 것 없음. `gap-1`(4px)·가로 4등분(`grid-cols-4`)만 사용, 전부 Tailwind 기본 spacing scale(Phase3-1에서 이미 "커스텀 스케일 불필요"로 결론난 것과 동일) |

새 색상·radius·spacing 토큰을 만들지 않았다 — grep으로 재확인.

**문서와의 의도적 차이(§0-2)**: 항목 수가 `DESIGN_SYSTEM.md` §4.6의 "5개 항목"이 아니라 4개다. `grid-cols-4`(균등 4분할)로 구현해 "균등 분할" 요구는 만족시켰지만 항목 수 자체는 사용자 확인을 거쳐 의도적으로 문서와 다르게 갔다 — §6에 향후 처리 방향을 남긴다.

---

## 4. 접근성 검증

- **semantic**: `<nav>` 하나, 그 안에 `<ul>`/`<li>`/`<a>`(Link) — `<div onClick>` 없음.
- **aria-label 중복 발견 및 수정**: 처음 구현에서 Header의 placeholder `<nav aria-label="주요 메뉴">`와 BottomNavigation이 같은 라벨을 써서, 실제 렌더링 결과를 확인하는 과정에서 스크린리더 랜드마크가 "주요 메뉴"로 두 번 뜨는 것을 발견했다 — `"하단 메뉴"`로 구분해 수정했다(Header는 건드리지 않음).
- **aria-current**: 활성 탭에 `aria-current="page"`를 부여한다. 실제 렌더링된 HTML로 홈(`/`)에서는 홈 탭에만, `/login`에서는 4개 탭 어디에도 `aria-current`가 없음을 확인했다(§5).
- **keyboard**: 전부 `<a>`(Link)라 `Tab`/`Enter`로 기본 동작한다 — 커스텀 키보드 핸들러 없음.
- **focus-visible**: `Button.tsx`가 이미 쓰던 것과 동일한 패턴(`focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`)을 그대로 재사용했다.
- **touch target**: 각 탭은 `h-16`(64px) 높이 × 그리드 4분할 폭 전체 — `UI_UX_GUIDELINE.md` §3 "최소 44×44px" 기준을 여유 있게 충족한다.

---

## 5. Validation 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 16개 테스트 통과(변경 없음) |
| `npm run build` | 통과. 라우트 목록 변경 없음(BottomNavigation은 페이지가 아니라 공통 컴포넌트) |

### 실제 렌더링/컴파일 결과로 확인

| 확인 대상 | 방법 | 결과 |
|---|---|---|
| 모바일에서만 노출 | 컴파일된 CSS에서 `@media (min-width: 48rem){.md\:hidden{display:none}}` 규칙 확인 | 정상 — 768px 이상에서 숨겨짐 |
| Footer 안 가림 | 컴파일된 CSS에서 `@media (min-width: 48rem){...md\:pb-0...}` 확인 + `pb-16` 단독 존재 확인 | 정상 — 데스크톱에서 상쇄됨 |
| active state(`/`) | 렌더링된 HTML에서 홈 탭에만 `aria-current="page"` + `text-primary` 확인 | 정상 |
| active state(`/login`) | 4개 탭 어디에도 `aria-current` 없음 확인 | 정상(오탐 없음) |
| `aria-label` 중복 여부 | 수정 전 2회 → 수정 후 "주요 메뉴" 1회 + "하단 메뉴" 1회 | 정상 |
| `/`, `/login`, `/onboarding`(비로그인 `307`), `/ui-preview` | 전부 재확인 | 영향 없음 |
| `proxy.ts` | 파일 자체를 열지도 않았고, `/onboarding` 리다이렉트가 기존과 동일하게 동작함을 재확인 | 영향 없음 |

**검증 중 겪은 도구 오류(정직한 기록)**: Tailwind가 breakpoint 클래스(`md:hidden` 등)를 실제로 생성하는지 컴파일된 CSS로 확인하는 과정에서, `node -e` 인라인 문자열의 다단계 쉘 이스케이핑 문제로 한 차례 "생성되지 않음"이라는 **잘못된** 결과를 얻었다. 임시 `.js` 파일로 다시 검증해 실제로는 정상 생성되어 있음을 확인했다 — 구현의 문제가 아니라 검증 스크립트 작성 중 발생한 오류였다는 것을 명확히 기록한다.

---

## 6. 발견된 문제

### 문서 불일치
- §0에 정리한 4건(파일명 오표기, "더보기" 탭 SITEMAP 미정의, 아이콘 라이브러리 부재, `/fortune` Phase 미배정) — 전부 사용자에게 사전 보고했고, 이 Task 범위에서 문서 자체를 수정하지 않았다.

### 설계 리스크
1. **하단 탭 4개가 `DESIGN_SYSTEM.md` §4.6의 "5개 항목" 명세와 다르다.** 지금은 사용자 확인을 받은 의도적 축소지만, `DESIGN_SYSTEM.md`/`INFORMATION_ARCHITECTURE.md`를 갱신하지 않으면 다음에 이 코드를 보는 사람(또는 AI)이 "문서와 다르다"는 것을 다시 발견하게 된다.
2. **Header의 placeholder `<nav>`(Phase3-3)와 이번 BottomNavigation이 아이콘 없는 형태로 공존한다** — 데스크톱에서는 BottomNavigation이 숨겨지므로 Header의 GNB가 유일한 내비게이션이 되는데, Header의 `<nav>`는 여전히 빈 placeholder다. 데스크톱 사용자는 지금 상태로는 GNB로 이동할 방법이 없다(모바일만 BottomNavigation으로 이동 가능) — 이번 Task 범위(Header 수정 금지) 밖이라 손대지 않았지만, Header의 실제 메뉴 구현이 이어지지 않으면 "데스크톱에서 이동할 방법이 없는" 상태가 계속된다.

### 향후 수정 권장사항 (이번 Task 범위 아님, 수정하지 않고 보고만)
1. "더보기" 탭(통계/당첨사례/로또명당 등 그리드 오버레이)을 언제 어떻게 만들지 별도 Task로 결정 필요.
2. `DESIGN_SYSTEM.md` §4.6 "5개 항목"과 실제 구현(4개)의 불일치를 문서에 반영할지 결정 필요.
3. Header의 GNB(데스크톱 내비게이션)를 실제로 채우는 Task가 필요 — 지금은 데스크톱에서 내비게이션 수단이 전혀 없다.
4. `/fortune` 구현 Phase 배정([[PHASE3_UI_ARCHITECTURE_PLAN]] §7-2가 이미 권고).

---

## 7. Phase3 다음 단계 착수 가능 여부

**가능.** Bottom Navigation이 실제 SITEMAP 경로 4개로 정확히 연결되고, active state·접근성·반응형 숨김·Footer 비가림을 전부 실측으로 확인했다. Header/Footer/Home UI/인증/`proxy.ts`에 회귀가 없음도 재확인했다. 다음 단계(Header GNB 실제 메뉴 구현, "더보기" 처리 방향, 또는 Phase4 다이어리 착수)는 모두 이번 결과 위에서 바로 시작할 수 있다 — 단, §6의 두 문서 불일치(5탭 vs 4탭, 더보기 처리)는 다음 단계 착수 전에 사용자가 최종 정리해두는 것을 권장한다.
