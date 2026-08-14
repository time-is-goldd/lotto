# PHASE4 FINAL AUDIT REPORT

> Phase4(행운 다이어리) 전체를 Phase5 착수 전 최종 감사한 결과다. 코드/Migration/Schema/RLS/API/컴포넌트/문서를 전혀 수정하지 않았다 — 아래 내용은 전부 실제 파일 원문 재확인, 실제 코드 재검토, 실제 Supabase 프로젝트 대상 실측(검증 후 전량 삭제)의 결과다.

---

## 0. Audit 범위

`/my/journal`, `/my/journal/history`, `/my/journal/dreams`, `/my/journal/fortune-history` 4개 페이지, `lib/api/journal.ts`, `lib/types/journal.ts`, `components/journal/*`, 그리고 이들과 `proxy.ts`의 상호작용. Phase5(번호 생성) 이후에 속하는 기능은 감사 대상이 아니다.

### 기준 문서 (전부 원문 재확인)

`docs/PHASE4_ARCHITECTURE_DECISION.md`, `docs/PHASE4_PROXY_IMPLEMENTATION_REPORT.md`, `docs/PHASE4_DIARY_READ_SERVICE_REPORT.md`, `docs/PHASE4_DIARY_PAGES_REPORT.md`, `docs/PHASE4_DIARY_UX_REFINEMENT_REPORT.md`, `docs/PHASE3_FINAL_AUDIT_REPORT.md`, `docs/PHASE3_MAINTENANCE_REPORT.md`, `docs/EXECUTION_PLAN.md`, `docs/ROADMAP.md`, `docs/SITEMAP.md`, `docs/INFORMATION_ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`.

**Phase4 정의 재확인**: [[EXECUTION_PLAN]]의 세분화 Phase 체계(Phase0 설정→Phase1 DB→Phase2 인증→Phase3 UI→Phase4 다이어리 틀)를 이 프로젝트가 실제로 따라왔으므로 이를 기준으로 삼는다. [[ROADMAP]]의 "Phase 4"(커뮤니티)는 완전히 다른 상위 로드맵 체계를 가리키는 **기존에 이미 발견·보고된 문서 충돌**이며(`docs/PHASE4_PRE_IMPLEMENTATION_AUDIT.md` §10-2), 이번 감사에서 다시 확인했으나 새로운 발견은 아니다.

---

## 1. Phase4 기능별 점검 결과

### `/my/journal` (허브)

| 점검 항목 | 결과 |
|---|---|
| 범위 일치 | 조회 전용. 작성/수정/삭제 코드 없음(grep 재확인) |
| 빈 상태 | 3개 섹션(번호/꿈/운세) 각각 독립적으로 `EmptyState` 정상 표시(실측) |
| 실데이터 렌더링 | 실제 Supabase 프로젝트에 시딩한 데이터로 3개 섹션 전부 정상 렌더링 확인(실측) |
| User A/B 격리 | User B가 User A의 번호/꿈/운세 데이터를 전혀 볼 수 없음을 실측 확인 |
| 비로그인 접근 | `200`, 페이지 자체가 가치설명 화면 렌더링(리다이렉트 없음) — Architecture Decision §3이 의도한 사용자 경험과 일치 |
| profile 없음 | `307 → /onboarding`(실측) |
| noindex | `<meta name="robots" content="noindex, nofollow"/>` 존재(Phase4-3에서 추가, 재확인) |
| heading | `<h1>` 1개, 로그인 상태에서 섹션별 `<h2>` 3개(`aria-labelledby`로 각 섹션과 연결) — 계층 위반 없음 |
| 모바일 긴 텍스트 | `line-clamp-2`(미리보기 카드) — Phase4-3에서 실제로 매우 긴 텍스트를 시딩해 실측 확인, 이번 감사에서는 소스 재확인만 함(코드 변경 없음) |

### `/my/journal/history`

| 점검 항목 | 결과 |
|---|---|
| 범위 일치 | `getRecentUserNumbers()` 조회만, 작성 버튼 없음(grep 재확인 — "기록하기"/"작성" 관련 버튼 코드 없음) |
| 빈 상태/실데이터 | 실측 확인(§본문 상단 데이터 검증 참조) |
| 비로그인 접근 | `307 → /login?next=%2Fmy%2Fjournal%2Fhistory`(실측) |
| profile 없음 | `307 → /onboarding`(실측) |
| noindex/heading | 동일하게 확인(`<h1>` 1개) |
| 모바일 | 날짜+뱃지 메타 행에 `flex-wrap` 적용(소스 확인) |

### `/my/journal/dreams`

동일한 패턴으로 전부 확인. `dream_text`에 `whitespace-pre-wrap break-words` 적용(소스 확인, Phase4-3에서 긴 텍스트로 실측 완료). 상세 페이지로 연결하는 링크 없음(grep으로 `/dreams/` 하위 경로 링크 부재 확인) — SITEMAP에 없는 URL을 만들지 않는다는 원칙 준수.

### `/my/journal/fortune-history`

동일한 패턴으로 전부 확인. **`getRecentFortuneResults()` 외에 페이지 자체가 Supabase를 호출하는 코드는 없음**(grep 재확인, 아래 §2에서 상세).

---

## 2. API / Service / 보안 감사

### 코드 재확인 (`lib/api/journal.ts`, `lib/types/journal.ts` — 이번 Task에서 수정하지 않음)

- 4개 함수(`getRecentUserNumbers`/`getRecentDreamJournalEntries`/`getRecentFortuneResults`/`getDiarySummary`) 전부 `getCurrentUser()`로 현재 세션의 `user.id`만 사용 — `userId`를 파라미터로 받는 함수는 없다(재확인).
- `service_role`/`lib/supabase/service` import: `lib/api/journal.ts`, `lib/types/journal.ts`, `app/my/journal/**`, `components/journal/**` 전부 grep으로 재확인 — 0건.
- `fortune_results`의 SELECT RLS(`0008_rls_policies.sql`, `using(true)`)가 소유자 필터링을 하지 않는다는 점을 코드 주석이 명시하고, `.eq("user_id", userId)`가 실제로 남아있음을 재확인했다.

### 실제 Supabase 프로젝트 실측 (이번 Task에서 신규 실행, 검증 후 전량 삭제)

카카오 API만 우회(`establishKakaoSupabaseSession()`)해 User A/B 두 계정을 만들고, User A에게만 `user_numbers`/`dream_journal_entries`/`fortune_results` 각 1건을 service_role로 직접 시딩(read service 경로 아님)한 뒤:

| 검증 | 결과 |
|---|---|
| User A → 자기 데이터 조회 | 4개 페이지 전부에서 실제 값(`7, 14, 21, 28, 35, 42`, 꿈 텍스트, 운세 텍스트) 정상 렌더링 |
| User B → User A 데이터 0건 | 4개 페이지 전부에서 `EmptyState`만 표시, User A 데이터 노출 없음 |
| **`fortune_results` 교차 노출 재검증** | User B가 `/my/journal`과 `/my/journal/fortune-history` 양쪽에서 User A의 운세 결과를 전혀 볼 수 없음을 확인 — RLS가 걸리지 않는 이 테이블에서도 애플리케이션 필터가 실제로 작동 |
| 비로그인 → 안전한 빈 결과 | `/my/journal`은 200(가치설명), 하위 3개는 307 리다이렉트(데이터 자체를 아예 조회하지 않음) |

### 잘못된 옵션/DB 오류 처리

`lib/api/journal.ts`를 수정할 수 없어 새 라이브 테스트 대신, 기존 36개 단위 테스트(`lib/api/journal.test.ts`, 이번 Task에서 재실행만 함)가 이미 다루는 범위를 재확인했다:
- `limit`이 `0`/`-1`/`1.5`/`101`, `offset`이 `-1`/`1.5`일 때 `JournalValidationError`를 던짐(정수 범위 검증) — 20건 테스트로 커버.
- Supabase가 `error`를 반환하면 그 에러를 그대로 `throw`(빈 배열로 위장하지 않음) — 각 함수별 테스트로 커버.
- 페이지 쪽은 이 에러를 `catch`해 `JournalLoadError`("불러오는 중 문제가 발생했어요")로만 표시 — 실제 에러 메시지, 스택 트레이스, SQL 등 민감 정보를 사용자에게 노출하지 않음을 소스 재확인.

날짜 범위(예: 미래 날짜, 매우 오래된 날짜) 필터는 `lib/api/journal.ts`에 애초에 존재하지 않는다(정렬만 있고 날짜 필터 옵션 자체가 없음) — 검증 대상 자체가 없어 "안전하다/안전하지 않다"를 판정할 항목이 없다.

---

## 3. proxy.ts / Architecture Decision 불일치 분석

### 실제 HTTP 요청으로 4가지 상태 재측정 (이번 Task에서 신규 실측)

| 시나리오 | 결과 |
|---|---|
| A. 비로그인 → `/my/journal` | `200`, 가치설명 화면 렌더링(리다이렉트 없음) |
| B. 비로그인 → `/my/journal/history` | `307 → /login?next=%2Fmy%2Fjournal%2Fhistory` |
| C. 로그인+profile 없음 → `/my/journal` | `307 → /onboarding` |
| D. 로그인+profile 있음 → `/my/journal` 및 하위 3개 전부 | 전부 `200` |

### B의 원인 분석 — proxy가 한 것인가, 페이지가 한 것인가

`proxy.ts` 원문을 다시 읽어 확인했다: `PUBLIC_EXCEPTIONS = ["/my/journal"]`이고 `matchesPath()`는 `pathname === base || pathname.startsWith(base + "/")`다. 이 정의상 `/my/journal/history`는 `matchesPath("/my/journal/history", "/my/journal")`가 `true`가 되어 **`isProtected`가 `false`로 계산된다** — 즉 **proxy.ts는 `/my/journal/history`를 보호하지 않고 그대로 통과시킨다.** 실제로 관찰된 `307` 리다이렉트는 `app/my/journal/history/page.tsx` 자신의 `if (!user) { redirect(...) }`(페이지 레벨 코드, 소스 재확인)가 만든 것이다 — proxy와 페이지 양쪽이 같은 결과를 만들어내기 때문에 HTTP 응답만으로는 구분되지 않지만, 소스 코드 확인으로 원인을 특정했다.

### 판정

**Architecture Decision 문서(§3: "허브만 예외, 하위 경로는 보호 유지")와 실제 `proxy.ts` 구현(하위 경로 전체가 예외)은 일치하지 않는다 — 실제로 동작과 일치하는 것은 "페이지 레벨 로그인 확인"이지 "Architecture Decision 문서가 서술한 proxy.ts의 동작"이 아니다.** 다만 최종 사용자 경험(비로그인은 하위 페이지에 못 들어간다)은 Architecture Decision이 원래 의도한 결과와 동일하다 — 보호가 사라진 것이 아니라 **보호를 수행하는 레이어가 문서와 다를 뿐**이다. 이는 `docs/PHASE4_DIARY_PAGES_REPORT.md` §12에서 이미 발견·보고된 사안이며, 이번 감사는 그 사실을 다시 정밀 측정해 재확인한 것이다 — 새로운 문제가 아니다(Medium으로 재분류, §6).

---

## 4. Phase3 잔여 이슈 재검증 (신규 문제 아님, 재확인만)

| 이슈 | Phase4에서 실제로 문제가 되었는가 |
|---|---|
| `color-danger`/`color-success` 대비 문제 | **되지 않았다** — Phase4 4개 페이지·`components/journal/*` 어디에서도 이 두 토큰을 사용하지 않음(grep 재확인). 잠재적 결함은 여전히 존재하지만 Phase4에서 노출되지 않았다 |
| `destructive` variant hover 미정의 | 관련 없음 — Phase4는 destructive 버튼을 쓰지 않는다 |
| GNB/BottomNavigation 메뉴 구성 차이(꿈해몽) | 관련 없음 — 다이어리 탭 자체는 양쪽에 동일하게 존재, Phase4가 수정한 적 없음 |
| Fortune 기능 Phase 미배정 | 여전히 미배정 상태(`docs/PHASE4_ARCHITECTURE_DECISION.md` §7 "Phase4와 분리"로만 분류) — Phase4의 `fortune-history`(이력 조회)는 이 미배정과 무관하게 정상 동작 |
| DESIGN_SYSTEM 5탭 vs 실제 4탭 | 관련 없음, Phase3 범위 |
| "더보기" 메뉴 미정의 | 관련 없음, Phase3 범위 |
| Header의 세션 조회로 인한 정적 페이지 동적화 | Phase4의 4개 페이지는 애초에 로그인 여부를 페이지 자신이 확인해야 해서 원래도 동적 렌더링 대상이다 — Header의 이슈가 Phase4에 추가 영향을 주지 않는다 |

---

## 5. 접근성/반응형 감사

**명시**: 실제 브라우저 렌더링 캡처는 이 환경에서 수행할 수 없다. 아래는 전부 (a) 실제 응답 HTML의 태그/클래스 직접 확인, (b) 소스 코드의 CSS 클래스/구조 확인 중 하나를 근거로 한다 — "시각적으로 확인했다"는 주장은 하지 않는다.

| 항목 | 근거 | 결과 |
|---|---|---|
| BottomNavigation에 콘텐츠 가려짐 | 소스 확인(`PageShell`의 `pb-16 md:pb-0`, Phase4에서 미수정) | `BottomNavigation`은 `fixed` 포지션(`components/navigation/BottomNavigation.tsx`, 미수정)이라 `pb-16`이 없으면 실제로 마지막 콘텐츠를 가린다 — Phase4 페이지들은 `PageShell` 안에 그대로 렌더링되므로 이 보정이 여전히 필요하고 실제로 유지되고 있다 |
| Header/GNB ↔ BottomNavigation breakpoint 충돌 | 소스 확인 | `GlobalNav`(`md:flex`)/`BottomNavigation`(`md:hidden`)은 Phase4에서 전혀 수정하지 않았고 정확히 반대 breakpoint를 유지한다 — Phase4 페이지 추가로 인한 충돌 가능성 없음(둘 다 Phase4 페이지 콘텐츠와 무관하게 Root Layout에서 렌더링됨) |
| focus-visible | 응답 HTML 확인 | 4개 페이지의 커스텀 링크(백링크, 전체보기 링크) 전부 `focus-visible:outline-2 outline-offset-2 outline-primary` 클래스 보유 확인 |
| `aria-current` | 관련 없음 | Phase4 페이지 내부에는 "현재 위치" 표시가 필요한 반복 네비게이션이 없다(허브의 "전체보기"는 단방향 이동 링크). `aria-current`는 `GlobalNav`/`BottomNavigation`의 기존 구현(미수정)에만 해당 |
| nav landmark 중복 | 응답 HTML 확인 | 허브가 Phase4-3에서 `<nav aria-label="다이어리 메뉴">`를 제거했으므로(섹션+링크 구조로 대체), `Header`의 "주요 메뉴"·`BottomNavigation`의 "하단 메뉴"와 겹칠 landmark가 애초에 존재하지 않는다 — 재확인 결과 중복 없음 |
| EmptyState 접근성 | 소스 확인(`components/ui/EmptyState.tsx`, 미수정) | 순수 텍스트(`<p>`) 기반이라 스크린리더가 그대로 읽는다 — 별도 `aria-live` 등은 없으나 페이지 최초 렌더링에 포함되는 정적 콘텐츠라 필요하지 않다 |
| 긴 텍스트 wrapping | 응답 HTML/소스 확인, Phase4-3에서 실측 완료 | `whitespace-pre-wrap break-words`(전체 목록 페이지), `line-clamp-2`(허브 미리보기) |
| 색상 대비 | grep 확인(§4) | Phase4는 실패 토큰(`color-danger`/`success`)을 쓰지 않아 이 감사 범위에서는 대비 문제가 재현되지 않는다 |
| heading hierarchy | 응답 HTML 확인 | 4개 페이지 전부 `<h1>` 정확히 1개, 허브는 로그인 시 `<h2>` 3개 추가(계층 위반 없음) |
| 키보드 접근성 | 소스 확인 | 모든 인터랙션이 `<a>`(Link)이고 커스텀 `onClick`/`onKeyDown` 핸들러가 없다 — 브라우저 기본 Tab/Enter 동작에 의존, 별도 키보드 트랩 없음 |

---

## 6. 코드 품질 감사

| 항목 | 결과 |
|---|---|
| TODO/FIXME/console.log | 0건(grep 재확인) |
| 죽은 코드 | 없음 — `components/journal/JournalBackLink`(3개 페이지 사용)·`JournalLoadError`(6곳 사용) 둘 다 실제 재사용 중, `loadPreview`(허브 내부 비-export 헬퍼)도 3회 사용 중 |
| 과도한 abstraction | 발견되지 않음 — "3분기 렌더링" 로직은 페이지마다 콘텐츠가 달라 의도적으로 통합하지 않은 상태를 재확인(Phase4-3 판단 유지) |
| Server/Client Component 경계 | 4개 페이지 + `components/journal/*` 전부 `"use client"` 없음(grep 재확인) — 순수 Server Component, 불필요한 클라이언트 경계 없음 |
| import 방향 | `components/journal/*`가 `app/*`을 참조하는 역방향 import 없음(grep 재확인) |
| service_role 오용 흔적 | 없음(§2에서 grep 재확인) |

---

## 7. Validation 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 36개 테스트 통과(전부 재실행, 변경 없음) |
| `npm run build` | 통과 |
| 실제 route 목록 | `/`, `/_not-found`, `/api/auth/kakao/{login,callback}`, `/api/auth/logout`, `/api/profile`, `/login`, `/my/journal`, `/my/journal/dreams`, `/my/journal/fortune-history`, `/my/journal/history`, `/onboarding`, `/ui-preview` — Phase4 작업으로 인한 예상치 못한 라우트 없음 |
| 회귀(`/`, `/login`, `/onboarding`, `/my/profile`, `/my/notifications`) | 전부 기존과 동일한 응답(`200` 또는 `307 → /login?next=...`) 확인 |
| `git status`/`git diff` | 이번 Task는 신규 파일(`docs/PHASE4_FINAL_AUDIT_REPORT.md`) 하나만 추가했다. `proxy.ts`/`lib/auth/*`/`lib/api/journal.ts`/`lib/types/journal.ts`/`components/*`/Migration/`DESIGN_SYSTEM.md`는 전혀 수정하지 않았다(Edit/Write 호출 없음으로 확인) |

---

## 8. Critical / High / Medium / Low

### Critical
없음.

### High
없음.

### Medium (기존 이슈 재확인, 신규 아님)
- **M1. Architecture Decision 문서와 실제 `proxy.ts` 구현의 불일치**(§3). 사용자 경험/보안 결과는 동일하지만, 문서를 신뢰해 향후 작업하는 사람이 "하위 경로는 proxy가 보호한다"고 오인할 위험이 있다. `docs/PHASE4_DIARY_PAGES_REPORT.md` §12에서 이미 보고됨 — 이번 감사가 A/B/C/D 실측으로 다시 정밀 확인했다.
- **M2. `color-danger`/`color-success` WCAG AA 미달**(`docs/PHASE3_MAINTENANCE_REPORT.md` §5). Phase4에서는 미사용이라 노출되지 않았으나, 토큰 자체는 여전히 결함 상태 — Phase5~7이 이 색을 사용하는 UI(당첨/미당첨 표시 등)를 만들 때 다시 마주치게 된다.
- **M3. Fortune(`/fortune`) 기능 Phase 미배정**(`docs/PHASE4_ARCHITECTURE_DECISION.md` §7). `/my/journal/fortune-history`는 정상 동작하지만, 그 데이터를 만드는 `/fortune` 자체는 여전히 갈 곳이 없다.

### Low (기존 이슈 재확인)
- GNB/BottomNavigation 메뉴 구성 차이(꿈해몽), "더보기" 메뉴 미구현 — Phase4와 무관, 재확인만 함.

**신규로 발견된 문제는 없다.**

---

## 9. Phase4 완료 판정

### **CONDITIONAL PASS**

Critical/High가 전혀 없고, 4개 페이지의 핵심 기능(조회 전용 범위 준수, 빈 상태/실데이터 렌더링, User A/B 데이터 격리, 인증 상태별 접근 정책, noindex, heading hierarchy)이 전부 실제 Supabase 프로젝트 대상 실측 또는 소스 재확인으로 검증되었다. `PASS`가 아니라 `CONDITIONAL PASS`로 판정하는 이유는, 기술적 결함이 아니라 **사용자가 결정해야 할 문서/디자인 이슈 3건(M1~M3)이 여전히 미해결로 남아있기 때문**이다 — 이 3건 중 어느 것도 Phase5(번호 생성) 착수를 기술적으로 막지는 않는다.

---

## 10. Phase5 착수 가능 여부

**가능하다.** 근거:
- Phase5(번호 생성)는 `/generate` 페이지·`user_numbers` INSERT·`lib/logic/generateNumbers.ts`를 새로 만드는 작업으로, `/my/journal/history`가 그 결과를 "조회"만 하면 되는 소비자 역할이다 — 이번 감사로 그 조회 경로(`getRecentUserNumbers()` 및 History 페이지)가 실데이터 기준으로 이미 정상 동작함을 확인했으므로, Phase5가 `user_numbers`에 실제로 행을 INSERT하기 시작하면 별도 조치 없이 다이어리에 그대로 나타난다.
- M1(proxy/문서 불일치)·M3(Fortune 미배정)는 `/my/journal/*`나 `/generate`의 라우팅 구조와 무관한 사안이라 Phase5 작업 범위와 겹치지 않는다.
- M2(색상 대비)는 Phase5가 번호 결과를 표시할 때 `color-danger`/`success`를 새로 쓰지 않는 한(현재 계획상 당첨 여부 표시는 Phase6) Phase5에서 재현되지 않는다.

---

## 11. Phase5 착수 전에 사용자가 결정해야 할 사항

1. **(M1)** Architecture Decision 문서를 실제 구현(하위 경로 전체가 proxy 예외)에 맞춰 정정할지, 아니면 `proxy.ts`를 문서 의도(허브만 예외)에 맞춰 수정하고 페이지 레벨 중복 검사를 제거할지 — 둘 중 하나로 정리할지, 아니면 "이중 방어"로 현행 유지할지.
2. **(M2)** `color-danger`/`color-success` 토큰 값을 조정할지, 아니면 계속 "큰 텍스트에만 danger 허용, success는 텍스트 색상으로 미사용" 정책으로 우회할지 — Phase6(당첨확인)가 이 결정을 필요로 하게 된다.
3. **(M3)** Fortune(`/fortune`) 기능을 어느 Phase에 배정할지 — 배정하지 않으면 GNB/BottomNavigation의 "운세" 메뉴가 계속 404로 남는다.

이 3가지는 Phase5 착수를 막지 않지만, 방치할수록 나중에 되돌아와야 할 결정들이다.
