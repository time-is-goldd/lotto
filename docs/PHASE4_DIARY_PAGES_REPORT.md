# PHASE4-2 DIARY PAGES SKELETON REPORT

> 조회 전용 다이어리 페이지 4개를 구현한 결과다. 작성/수정/삭제, 번호생성, 운세생성, 통계, 새 REST API, 인증/RLS/proxy.ts 변경은 전혀 포함하지 않는다.

---

## 1. 생성/수정 파일

| 파일 | 종류 |
|---|---|
| `app/my/journal/page.tsx` | 신규 — 다이어리 허브 |
| `app/my/journal/history/page.tsx` | 신규 — 번호 기록 목록 |
| `app/my/journal/dreams/page.tsx` | 신규 — 꿈 기록 목록 |
| `app/my/journal/fortune-history/page.tsx` | 신규 — 운세 기록 목록 |

`proxy.ts`, `lib/auth/*`, `lib/api/journal.ts`, `lib/types/journal.ts`, Migration, RLS, `DESIGN_SYSTEM.md`, `components/*`는 전혀 수정하지 않았다(§9에서 재확인).

### 경로 표기 관련 사전 확인

지시문 본문은 4번째 페이지를 "`/my/journal/fortunes`"로 표기했으나, `docs/SITEMAP.md` §1에는 이 이름의 경로가 없고 대신 `/my/journal/fortune-history`(운세 조회 이력)가 정의되어 있다. 문서와 실제 코드(SITEMAP)가 우선이라는 이번 세션의 일관된 원칙에 따라 임의로 새 경로명을 만들지 않고 `/my/journal/fortune-history`로 구현했다.

`/my/journal/results`(당첨확인)와 `/my/journal/calendar`는 [[EXECUTION_PLAN]] Phase4 전체 범위에는 포함되지만, 이번 지시문 §1이 명시한 4개 경로에 없어 구현하지 않았다 — 임의로 페이지를 늘리지 말라는 지시를 그대로 따랐다.

---

## 2. 각 페이지의 역할

- **`/my/journal`**: 다이어리 허브. 로그인 상태에 따라 가치설명 화면 또는 요약 카드 + 하위 3개 페이지로 가는 메뉴를 보여준다.
- **`/my/journal/history`**: `user_numbers` 전체 목록(최근순, `lib/api/journal.ts`의 기본 정렬/limit 계약 그대로 사용).
- **`/my/journal/dreams`**: `dream_journal_entries` 목록(entry_date 최신순). 작성 기능 없음을 뱃지로 명시.
- **`/my/journal/fortune-history`**: `fortune_results` 목록(생성순). 운세 생성 기능 없음을 뱃지로 명시.

---

## 3. 비로그인 / profile pending / profile ready 상태 처리

### `/my/journal` (허브) — Option B 그대로 구현

- **비로그인**: `docs/PHASE4_ARCHITECTURE_DECISION.md` §3에서 확정한 대로, 로그인 페이지로 보내지 않고 가치설명 화면(`JournalValueProp`)을 직접 렌더링한다. "로그인하면 번호·운세·꿈 기록이 모두 여기 쌓여요"([[INFORMATION_ARCHITECTURE]] §1.2 원문 그대로 재사용) + 실제로 되는 것만 나열(자동 분석/통계/알림/추천 등 미구현 기능은 언급하지 않음) + `/login?next=%2Fmy%2Fjournal` CTA.
- **로그인 + profile 없음**: `redirect("/onboarding")` — `Header.tsx`가 이미 쓰는 `getCurrentUser()`→`getProfile()` 패턴을 그대로 재사용했을 뿐 새 인증 로직이 아니다.
- **로그인 + profile 있음**: `getDiarySummary()` 조회 → 데이터 있으면 요약 카드, 없으면 `EmptyState`.

### `/my/journal/history`, `/my/journal/dreams`, `/my/journal/fortune-history` — 페이지 자체 보호로 보완

**중요한 발견(§12에 상세 기록)**: `docs/PHASE4_ARCHITECTURE_DECISION.md`는 "허브(`/my/journal`)만 proxy 예외, 하위 경로는 기존 보호 유지"라고 결정했지만, 실제 `proxy.ts`(`docs/PHASE4_PROXY_IMPLEMENTATION_REPORT.md`에서 구현)의 `matchesPath()`는 접두사 매칭이라 `/my/journal/history` 등 **하위 경로 전체가 이미 proxy 예외로 통과되고 있음을 실측으로 재확인했다.** 이번 Task는 `proxy.ts` 수정이 금지되어 있어 그 파일을 고치지 않고, 대신 이 3개 페이지 각각이 `getCurrentUser()`로 직접 로그인 여부를 확인해 비로그인 시 `redirect(\`/login?next=...\`)`로 보낸다 — **proxy.ts가 원래 하려던 것과 정확히 같은 동작을 페이지 레벨에서 복원한 것**이며 새로운 인증 메커니즘이 아니다. profile 없음 상태는 허브와 동일하게 `/onboarding`으로 보낸다.

`next` 파라미터는 `docs/PHASE2_COMPLETION_REPORT]] §5에 이미 기록된 대로 OAuth 콜백이 이 값을 왕복시키지 않아 실제로는 로그인 후 항상 `/`(또는 `/onboarding`)로 이동한다 — 이번 Task에서도 이 동작을 확인만 했고 OAuth 콜백은 수정하지 않았다. 그럼에도 `next` 파라미터 자체는 기존 `proxy.ts` 관례와 동일하게 계속 붙여 향후 이 문제가 해결되면 자동으로 혜택을 보도록 했다.

---

## 4. 실제 사용한 Read Service

전부 `lib/api/journal.ts`(Phase4-1 산출물)만 사용했다 — 페이지에서 Supabase를 직접 호출한 곳은 없다(§9에서 grep으로 재확인).

| 페이지 | 사용 함수 |
|---|---|
| `/my/journal` | `getDiarySummary()` |
| `/my/journal/history` | `getRecentUserNumbers()`(기본 옵션, `onlyChecked` 사용 안 함 — 이 페이지는 히스토리 전체를 보여주는 용도) |
| `/my/journal/dreams` | `getRecentDreamJournalEntries()` |
| `/my/journal/fortune-history` | `getRecentFortuneResults()` |

pagination은 `lib/api/journal.ts`의 기본 `limit`(20)을 그대로 사용했다 — 이번 Task에서 새 pagination UI(더보기 버튼, 페이지 번호 등)를 만들지 않았다.

---

## 5. EmptyState 처리 방식

기존 `components/ui/EmptyState.tsx`를 4개 페이지 전부에서 재사용했다(새 EmptyState류 컴포넌트를 만들지 않음). 페이지마다 "정상 조회 + 데이터 없음"과 "조회 실패"를 서로 다른 문구로 명확히 구분한다.

| 상태 | 문구(공통 패턴) |
|---|---|
| 정상 + 데이터 없음 | "아직 생성한 번호가 없어요" / "아직 기록한 꿈이 없어요" / "아직 운세 기록이 없어요" 등 |
| 조회 실패 | "불러오는 중 문제가 발생했어요" + "일시적으로 연결이 어려워요. 잠시 후 다시 시도해주세요."([[UI_UX_GUIDELINE]] §8 "기술 용어 노출 금지, 일상어 사용" 원칙 그대로 적용) |

가짜/목업 데이터는 어디에도 넣지 않았다. 빈 상태의 action(예: "번호 생성하러 가기" 버튼)은 `/generate` 등 아직 구현되지 않은 경로로 연결될 위험이 있어(이번 지시문 §12 "존재하지 않는 경로를 새로 링크하지 마라") 의도적으로 넣지 않았다 — EmptyState는 title/description만 사용한다.

---

## 6. 실제 DB 데이터 렌더링 검증

실제 Supabase 프로젝트에서(카카오 API만 우회, `establishKakaoSupabaseSession()`) User A 계정에 `user_numbers`/`dream_journal_entries`/`fortune_results` 각 1건을 service_role로 직접 시딩(테스트 데이터 생성 목적일 뿐 read service 경로 아님)한 뒤, User A 세션으로 4개 페이지를 모두 호출해 실제 값(번호 `3, 11, 22, 30, 38, 45`, 꿈 텍스트, 운세 본문·행운지수 `72`, 요약 카운트 `1`)이 정확히 렌더링됨을 확인했다. 검증 완료 후 테스트 데이터/계정 전량 삭제했다(§9).

---

## 7. 반응형 검증

- `Container`(`max-w-content px-6`)를 4개 페이지 전부에서 그대로 사용 — 페이지별 커스텀 폭 제한을 만들지 않았다.
- 다이어리 허브의 하위 메뉴 그리드는 `grid grid-cols-1 gap-4 sm:grid-cols-3`(모바일 1열 → 640px 이상 3열) — 실제 렌더링 HTML에서 이 클래스 문자열이 그대로 존재함을 확인했다.
- `PageShell`/`Header`/`Footer`/`BottomNavigation`/`GlobalNav`는 전혀 수정하지 않았고, 새 페이지들도 `app/layout.tsx`가 감싸는 동일한 구조를 그대로 통과한다 — `BottomNavigation`의 `md:hidden`, `GlobalNav`의 `md:flex`가 새 페이지에서도 동일하게 렌더링됨을 실제 응답 HTML로 확인했다.
- 375px 카드형 목록(히스토리/꿈/운세): 날짜+뱃지 메타 행은 `flex items-center justify-between gap-2`로 좁은 화면에서도 자동 줄바꿈되도록 했고, 본문 텍스트(꿈 내용/운세 본문)는 고정 너비 요소가 없어 자연스럽게 줄바꿈된다 — 실제 브라우저 렌더링 캡처는 이 환경에서 수행할 수 없어, 코드 구조(고정폭 요소 없음, `Card`의 `p-4`만 사용)와 컴파일된 클래스 존재 확인으로 대체했다(Phase3 감사들과 동일한 한계).

---

## 8. 접근성 검증

- 4개 페이지 전부 `<h1>` 정확히 1개(실측: `grep -c '<h1'` = 1). 계층 위반 없음(h1 아래 별도 heading을 남발하지 않고 `Card` 내부 메타 정보는 `<div>`로만 표현 — `components/ui/Card.tsx`의 `CardHeader`가 실제로는 `<div>`라 헤딩 태그를 오염시키지 않음을 재확인).
- 다이어리 허브의 하위 메뉴는 `<nav aria-label="다이어리 메뉴">`로 감쌌다 — 기존 `Header`(`aria-label="주요 메뉴"`)/`BottomNavigation`(`"하단 메뉴"`)/Home(`"주요 기능"`)과 겹치지 않는 새 라벨을 골라 랜드마크 중복을 피했다.
- 모든 커스텀 `<Link>`에 `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`를 적용해 기존 `Button`/`GlobalNav`/`BottomNavigation`과 동일한 포커스 표시 패턴을 유지했다.
- 장식용 체크마크(`✓`)에는 `aria-hidden="true"`를 적용했다(Home 페이지의 기존 패턴과 동일).
- `aria-label`은 위 1곳(다이어리 메뉴 nav)에만 사용했다 — 남용하지 않았다.
- 인라인 SVG 아이콘을 새로 추가하지 않았다(이 4개 페이지는 아이콘이 필요한 디자인이 아니었음).

---

## 9. 보안 검증

| 항목 | 결과 |
|---|---|
| `app/my/journal/**`에 `service_role`/`lib/supabase/service` import | 없음(grep 재확인) |
| `app/my/journal/**`에서 Supabase 직접 호출(`lib/supabase/server`, `lib/supabase/client`, `createClient`) | 없음(grep 재확인) — 전부 `lib/api/journal.ts` 경유 |
| `user_id`를 URL/query/client input으로 받아 조회 | 없음 — grep 매치는 주석 1건뿐(실제 코드 아님) |
| `fortune_results`가 user-scoped service를 통해서만 조회되는지 | `getRecentFortuneResults()`만 호출, 페이지 자체는 필터링 로직을 갖지 않음 — 실제 User A/User B 격리를 실측으로 재확인(아래) |
| `proxy.ts` 이번 Task에서 수정 여부 | 수정하지 않음(Edit/Write 호출 없음, 이번 세션 전체가 미커밋 상태라 `git diff`에는 이전 Phase 변경분까지 함께 표시되므로 파일별 직접 대조로 확인) |
| `/my/profile`, `/my/notifications` 기존 보호 정책 유지 | 비로그인 상태로 재확인, 둘 다 여전히 `307 → /login?next=...` |

**실제 Supabase 실측(User A/User B 격리)**: User A에게만 `user_numbers`/`dream_journal_entries`/`fortune_results` 각 1건을 시딩한 뒤, 별도 계정 User B(로그인+profile 있음)로 동일한 4개 페이지를 호출한 결과 **전부 EmptyState만 표시되고 User A의 데이터는 어디에도 노출되지 않았다** — 특히 `fortune_results`(RLS가 `using(true)`로 전체 공개라 `lib/api/journal.ts`의 명시적 `user_id` 필터가 유일한 방어선인 테이블)에서도 격리가 정상 동작함을 확인했다.

---

## 10. 기존 페이지 회귀 검증

| 경로 | 결과 |
|---|---|
| `/` | `200` |
| `/login` | `200` |
| `/ui-preview` | `200` |
| `/onboarding`(비로그인) | `307 → /login?next=%2Fonboarding` |
| `/my/profile`(비로그인) | `307 → /login?next=%2Fmy%2Fprofile`(회귀 없음) |
| `/my/notifications`(비로그인) | `307 → /login?next=%2Fmy%2Fnotifications`(회귀 없음) |

---

## 11. Validation 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 36개 테스트 통과(변경 없음 — 이번 Task는 페이지만 추가해 `lib/api/journal.test.ts`를 건드리지 않았다) |
| `npm run build` | 통과. 라우트 4개 신규 추가 확인(`/my/journal`, `/my/journal/history`, `/my/journal/dreams`, `/my/journal/fortune-history`), 나머지 라우트 변경 없음 |
| heading hierarchy | 4개 페이지 전부 `<h1>` 정확히 1개 |
| `git status`(범위 확인) | 이번 Task의 실제 변경분은 `app/my/journal/**`(신규 4개 파일)뿐임을 확인. `proxy.ts`/`lib/auth/*`/`lib/api/journal.ts`/`lib/types/journal.ts`/Migration/`DESIGN_SYSTEM.md`는 전혀 손대지 않았다 |

---

## 12. 발견된 문제

**`docs/PHASE4_ARCHITECTURE_DECISION.md`의 Option B 서술과 실제 `proxy.ts` 구현이 불일치한다.** 결정 문서는 "`/my/journal`(허브, 정확히 이 경로만)"만 예외로 두고 하위 경로는 보호를 유지한다고 명시했지만, `docs/PHASE4_PROXY_IMPLEMENTATION_REPORT.md`가 실제로 구현한 `matchesPath()`(정확히 일치 **또는** 하위 경로 전체)를 그대로 `PUBLIC_EXCEPTIONS`에도 재사용해, 실제로는 `/my/journal/*` 전체가 예외 처리되고 있다(그 보고서 자신의 Test Matrix에도 `/my/journal/history`가 비로그인 상태에서 리다이렉트 없이 통과함이 이미 기록되어 있었으나, 그 시점에는 "의도된 것"으로 해석되어 문제로 지적되지 않았다). 이번 Task에서 재확인 중 이 불일치를 다시 발견했다.

이번 Task는 `proxy.ts` 수정이 금지되어 있어 그 파일을 고치지 않았고, 대신 영향을 받는 3개 페이지(`history`/`dreams`/`fortune-history`)에 페이지 레벨 로그인 확인을 추가해 **결과적으로 사용자에게는 원래 의도한 보호가 그대로 유지된다**(실측으로 확인). 다만 `proxy.ts`와 3개 페이지 양쪽에 보호 로직이 사실상 중복 존재하는 상태이므로, 다음 중 하나를 향후 결정하는 것을 권장한다: (a) `PHASE4_ARCHITECTURE_DECISION.md`를 실제 구현(하위 경로 전체 예외)에 맞춰 정정, (b) `proxy.ts`를 원래 문서 의도(허브만 예외)에 맞춰 수정하고 페이지 레벨 중복 검사를 제거. 이번 Task는 둘 다 결정하지 않고 사실만 보고한다.

그 외 새로 발견된 코드 결함은 없다.

---

## 13. 이번 Task에서 의도적으로 구현하지 않은 기능

- 다이어리 작성/수정/삭제(번호 저장, 꿈 기록 작성, 운세 생성) — Phase5~7 범위
- `/my/journal/results`(당첨확인), `/my/journal/calendar`(캘린더) — 이번 지시문 §1 범위 밖
- 통계/연말 리포트 — `docs/PHASE4_ARCHITECTURE_DECISION.md` §5-1에서 이미 Phase4 범위 밖으로 확정
- 새 REST API Route(`app/api/journal/*`) — `lib/api/journal.ts`를 Server Component가 직접 호출하는 기존 계약을 그대로 따름
- pagination UI(더보기/페이지 번호) — read service의 기본 limit만 사용
- `LottoBall` 등 새 UI 컴포넌트 — 번호는 텍스트로만 표시(골격 단계에서는 충분하다고 판단)
- `proxy.ts` 수정 — §12에서 발견한 불일치를 포함해 이번 Task 범위에서 전혀 손대지 않음

---

## 14. Phase4-3 착수 가능 여부

**Ready, 단 §12의 문서/구현 불일치를 먼저 확인 권장.** 조회 전용 다이어리 4개 페이지가 실제 DB 데이터·빈 상태·조회 실패·비로그인·profile 미완성 5가지 상태 모두에서 실측 검증되었고, User A/B 데이터 격리(특히 RLS가 걸리지 않는 `fortune_results`)도 실제 Supabase 프로젝트로 확인했다. Phase4-3(기능 확장)을 시작하기 전에, §12에서 발견한 Architecture Decision과 실제 proxy.ts 구현의 불일치를 문서 정정 또는 코드 정정 중 하나로 해소할지 사용자 결정을 권장한다 — 이번 Task 자체의 완료를 막는 사안은 아니다.
