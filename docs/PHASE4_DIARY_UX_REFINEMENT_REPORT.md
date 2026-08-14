# PHASE4-3 DIARY UX REFINEMENT REPORT

> Phase4-2가 만든 4개 조회 전용 페이지를 다듬은 결과다. Create/Update/Delete, DB Schema/RLS/Auth/Proxy/`lib/api/journal.ts`/`lib/types/journal.ts`는 전혀 수정하지 않았다.

---

## 1. 생성/수정 파일

| 파일 | 종류 | 내용 |
|---|---|---|
| `components/journal/JournalBackLink.tsx` | 신규 | 하위 3개 페이지가 각자 복사해뒀던 "← 다이어리 홈" 링크를 하나로 통합 |
| `components/journal/JournalLoadError.tsx` | 신규 | "조회 실패" 전용 EmptyState 문구를 하나로 통합(새 컴포넌트가 아니라 EmptyState의 얇은 wrapper) |
| `app/my/journal/page.tsx` | 수정 | 허브를 "요약 카드 + 별도 nav 그리드"에서 "번호/꿈/운세 3개 섹션(각각 미리보기+전체보기)" 구조로 재구성, `metadata` 추가 |
| `app/my/journal/history/page.tsx` | 수정 | 공용 컴포넌트로 교체, `metadata` 추가, 메타 행에 `flex-wrap` 추가 |
| `app/my/journal/dreams/page.tsx` | 수정 | 공용 컴포넌트로 교체, `metadata` 추가, 긴 텍스트 안전장치(`whitespace-pre-wrap break-words`) 추가 |
| `app/my/journal/fortune-history/page.tsx` | 수정 | 공용 컴포넌트로 교체, `metadata` 추가, 긴 텍스트 안전장치 추가, luck_score를 메타 행으로 이동 |

`proxy.ts`, `lib/auth/*`, `lib/api/journal.ts`, `lib/types/journal.ts`, Migration, RLS, `DESIGN_SYSTEM.md`는 전혀 수정하지 않았다(§10에서 grep/`git status`로 재확인).

---

## 2. 페이지별 변경 내용

### `/my/journal` (허브) — 구조 재설계

**변경 전(Phase4-2)**: `getDiarySummary()` 하나만 호출해 "총 N번 기록했어요" 카드 하나 + 3개 목적지로 가는 별도 nav 카드 그리드(제목/설명만 있고 실제 데이터 없음).

**변경 후**: "번호 기록"/"꿈 기록"/"운세 기록" 3개 `<section>`으로 재구성했다. 각 섹션은 `<h2>` + 실제 데이터 미리보기(최대 2건, `getRecentUserNumbers`/`getRecentDreamJournalEntries`/`getRecentFortuneResults`에 이미 있는 `limit` 옵션만 다르게 호출 — 함수 자체는 수정하지 않음) + 데이터 없으면 그 영역만의 `EmptyState` + 실제 하위 페이지로 가는 "전체보기" 링크로 구성된다. "허브 → 상세 목록" 구조가 3개 영역 모두 동일한 패턴으로 명확해졌다(이번 지시문 §2 성공 기준 1, §5).

이전에 썼던 `getDiarySummary()`(count 쿼리 포함)는 새 구조에서 총 개수를 더 이상 보여주지 않아 제거했다 — 불필요한 COUNT 쿼리를 없애고 `getRecentUserNumbers({ limit: 2 })`로 직접 통일했다(read service 자체는 그대로, 호출 방식만 다른 함수로 교체).

### `/my/journal/history`, `/my/journal/dreams`, `/my/journal/fortune-history`

- 각자 복사해뒀던 "← 다이어리 홈" 링크와 "조회 실패" EmptyState를 `components/journal/`의 공용 컴포넌트로 교체했다(§3).
- `metadata`(제목 + `noindex, nofollow`)를 추가했다(§9).
- 날짜/뱃지가 나란히 있는 메타 행에 `flex-wrap`을 추가해 좁은 화면에서 겹치지 않고 줄바꿈되게 했다.
- 본문 텍스트(`dream_text`/`overall_fortune`)에 `whitespace-pre-wrap break-words`를 추가했다 — 긴 문장이나 공백 없는 긴 문자열이 가로로 넘치지 않도록 한다. **line-clamp는 이 페이지들에는 적용하지 않았다** — 상세 페이지가 없는 상태(SITEMAP에도 없음)에서 자르면 사용자가 전체 내용을 볼 방법이 없어지기 때문이다(§7).

---

## 3. 공통 컴포넌트 변경 내용

기존 `components/ui/*`(Card/Badge/EmptyState/Button)는 전혀 수정하지 않고 계속 재사용했다. 3개 이상의 페이지에서 완전히 동일하게 반복되던 마크업 2가지만 `components/journal/`(EXECUTION_PLAN이 원래 계획했던 폴더, 이번에 처음 실제로 생성)로 추출했다:

1. **`JournalBackLink`** — history/dreams/fortune-history 3곳에서 100% 동일했던 링크.
2. **`JournalLoadError`** — 이제 허브(섹션 3개)까지 포함해 총 6곳에서 동일했던 에러 문구.

**추출하지 않은 것**: "데이터 있음/없음/실패" 3분기 렌더링 로직 자체는 페이지마다 실제 표시할 콘텐츠(번호 목록 vs 꿈 텍스트 vs 운세 텍스트)가 완전히 달라 억지로 하나의 컴포넌트로 묶으면 제네릭 렌더 prop이 필요해져 오히려 복잡해진다고 판단해 그대로 두었다(이번 지시문 §9 "단순히 몇 줄 줄이기 위한 과도한 추상화는 하지 마라"). 허브 안에서 3번 반복되는 "안전하게 조회하고 에러를 구분하는" 로직은 페이지 파일 내부의 비-export 헬퍼 함수(`loadPreview`)로만 정리했다 — 파일 간 공유가 필요 없어 별도 컴포넌트/유틸 파일로 승격하지 않았다.

---

## 4. 실제 데이터 표시 방식

모든 데이터는 `lib/api/journal.ts`의 기존 함수(`getRecentUserNumbers`/`getRecentDreamJournalEntries`/`getRecentFortuneResults`)를 통해서만 가져온다 — 함수 자체나 반환 타입은 전혀 바꾸지 않았고, 호출 시 `{ limit: 2 }` 같은 이미 존재하는 옵션만 다르게 넘겼다. 가짜/목업 데이터, 새로운 통계 계산, DB에 없는 필드를 추측해 표시한 곳은 없다.

---

## 5. EmptyState 처리

| 상황 | 문구 | 위치 |
|---|---|---|
| 정상 + 데이터 없음(허브 섹션별) | "아직 생성한 번호가 없어요" / "아직 기록한 꿈이 없어요" / "아직 운세 기록이 없어요" | `EmptyState` 직접 사용 |
| 정상 + 데이터 없음(전체 목록 페이지) | 위와 동일 문구 재사용(일관성 유지) | `EmptyState` 직접 사용 |
| 조회 실패(모든 페이지·모든 섹션 공통) | "불러오는 중 문제가 발생했어요" / "일시적으로 연결이 어려워요. 잠시 후 다시 시도해주세요." | `JournalLoadError`(신규 공용 컴포넌트) |

"빈 상태"와 "조회 실패"는 항상 다른 문구를 쓰도록 강제되어 있다(공용 컴포넌트로 분리했기 때문에 실수로 섞어 쓸 여지가 구조적으로 줄었다).

---

## 6. Error/Loading 처리

- **Loading**: `loading.tsx`를 도입하지 않았다. 이 4개 페이지는 전부 Server Component이고 데이터 조회가 페이지 렌더링 자체에 포함돼 있어(스트리밍 경계를 나눌 만큼 느린 개별 하위 컴포넌트가 없음), Next.js App Router의 `loading.tsx`는 라우트 전환 시 페이지 전체가 아직 안 끝났을 때 보여주는 것이라 지금 구조에서는 "빈 화면 대신 즉시 뭔가 보여준다"는 이점보다 파일 4개(또는 그 이상)를 늘리는 비용이 크다고 판단했다 — Spinner 컴포넌트가 이미 있지만 지금은 그것을 넣을 자리(개별 비동기 섹션의 부분 로딩)가 없다. 향후 허브의 3개 섹션을 `<Suspense>`로 각각 분리 스트리밍하게 되면 그때 `Spinner`를 재사용하는 것이 적절하다 — 지금은 과설계로 판단해 넣지 않았다.
- **Error**: `error.tsx`(Next.js Error Boundary)도 도입하지 않았다. 이 4개 페이지가 실제로 던지는 에러 대상은 `lib/api/journal.ts`의 조회 함수들뿐인데, 전부 페이지 자체의 `try/catch`로 이미 잡아 `JournalLoadError`로 표시하고 있다 — `error.tsx`가 잡아야 할 "처리되지 않은 예외"가 이 4개 페이지에는 사실상 남아있지 않다(로그인/온보딩 리다이렉트는 Next.js가 내부적으로 특수 처리하는 예외라 일반 `error.tsx`가 다룰 대상이 아니다). 새 전역 에러 시스템을 만들지 말라는 지시와도 맞다.

---

## 7. Responsive 검증

- `Container`(`max-w-content px-6`)를 4개 페이지 전부 그대로 사용 — 1440px에서도 본문이 과도하게 넓어지지 않는다(기존 정책 그대로).
- 375px: 메타 행(`날짜 + 뱃지`)에 `flex-wrap` 추가로 겹침/overflow 방지. 본문 텍스트는 `whitespace-pre-wrap break-words`로 공백 없는 긴 문자열도 가로로 새지 않는다 — **실제로 반복 문자열로 만든 매우 긴 꿈/운세 텍스트를 시딩해 실측**했고, 정상적으로 세로로만 길어지는 것을 확인했다(§11).
- 허브의 미리보기 카드는 `line-clamp-2`로 실제 렌더링 높이가 일정하게 유지됨을 확인했다.
- `PageShell`/`BottomNavigation`/`GlobalNav`는 전혀 수정하지 않았고, `pb-16 md:pb-0` 등 기존 정책이 그대로 적용된 상태로 새 페이지들을 감싼다.

---

## 8. Accessibility 검증

- 4개 페이지 전부 `<h1>` 정확히 1개 유지(재확인).
- 허브에 **새로 `<h2>` 3개**(번호 기록/꿈 기록/운세 기록)를 추가했다 — `h1 → h2` 계층이 올바르고, 각 `<h2>`는 `aria-labelledby`로 해당 `<section>`과 연결된다(`<section aria-labelledby="numbers-heading">` 등). 스크린리더가 "번호 기록 섹션"처럼 영역을 구분해 인식할 수 있다.
- nav landmark 중복 재확인: 허브는 더 이상 `<nav aria-label="다이어리 메뉴">`를 쓰지 않는다(§2에서 그 역할을 섹션별 "전체보기" 링크로 대체했으므로 별도 nav 랜드마크가 필요 없어짐) — `Header`의 "주요 메뉴", `BottomNavigation`의 "하단 메뉴"와 겹칠 여지 자체가 사라졌다.
- 모든 링크는 `<a>`(Next `Link`)이고, 실제 동작이 없는 요소에 `<button>`을 쓰지 않았다.
- `focus-visible` 패턴을 모든 커스텀 링크(백링크, 전체보기 링크)에 일관 적용했다.
- 장식용 체크마크(`✓`)는 `aria-hidden="true"` 유지.
- `aria-label`은 남용하지 않았다(허브에 새로 추가한 것 없음 — 오히려 1개 줄었다).

---

## 9. SEO/metadata 검증

기존 프로젝트의 유일한 선례(`app/ui-preview/page.tsx`)가 쓰는 정확히 같은 패턴(`export const metadata: Metadata = { title, robots: { index: false, follow: false } }`)을 4개 페이지 전부에 추가했다. 근거는 `docs/SITEMAP.md` §4 "`/my/journal/*`는 전체가 noindex, nofollow 처리한다"다. 비로그인 방문자에게 보이는 허브의 가치설명 화면도 같은 URL·같은 메타데이터를 그대로 쓴다 — SITEMAP이 URL 기준으로 규칙을 정의했지 로그인 여부로 나누지 않았기 때문에, 로그인 상태에 따라 metadata를 다르게 주는 로직(`generateMetadata` 동적 분기)은 만들지 않았다. keyword stuffing이나 존재하지 않는 콘텐츠 언급 없이 페이지 제목만 넣었다. 실제 렌더링된 HTML에서 `<meta name="robots" content="noindex, nofollow"/>`와 각 페이지 고유 `<title>`을 실측 확인했다(§11).

---

## 10. 보안 검증

| 항목 | 결과 |
|---|---|
| `service_role`/`lib/supabase/service` import (`app/my/journal/**`, `components/journal/**`) | 없음(grep 재확인) |
| Supabase 직접 호출(`supabase/server`, `supabase/client`, `.from(`) | 없음 — 전부 `lib/api/journal.ts` 경유 |
| `user_id`를 URL/query/client input으로 받아 조회 | 없음(grep 매치는 주석 1건뿐) |
| `proxy.ts`/`lib/auth/*`/`lib/api/journal.ts`/`lib/types/journal.ts` 수정 여부 | 전혀 수정하지 않음(Edit/Write 호출 없음, `git status`로 재확인) |

---

## 11. User A/B 실제 데이터 격리 검증

실제 Supabase 프로젝트에서(카카오 API만 우회, 검증 후 계정·데이터 전량 삭제) 확인했다.

1. **User A**(profile 있음, 실제 데이터 있음: `user_numbers`/`dream_journal_entries`/`fortune_results` 각 1건, 꿈/운세 텍스트는 의도적으로 매우 길게 생성해 overflow까지 함께 검증) → 허브 3개 섹션·3개 하위 페이지 전부 실제 값 정상 렌더링. `line-clamp-2`(허브)와 `whitespace-pre-wrap break-words`(하위 페이지)가 실제 긴 텍스트에서 의도대로 동작함을 확인.
2. **User B**(다른 계정, profile 있음, 데이터 없음) → 허브 3개 섹션·3개 하위 페이지 전부 `EmptyState`만 표시, User A의 데이터가 어디에도 노출되지 않음.
3. **비로그인** → `/my/journal`은 가치설명 화면, `history`/`dreams`/`fortune-history`는 `/login?next=...`로 리다이렉트(회귀 없음, Phase4-2와 동일).
4. **profile 없음** → 4개 페이지 전부 `/onboarding`으로 리다이렉트(회귀 없음).
5. **`fortune_results` 교차 노출 재검증** — 이 테이블은 RLS가 `using(true)`로 전체 공개라 애플리케이션 필터가 유일한 방어선인데, User B 요청에서 User A의 운세 결과가 전혀 노출되지 않음을 재확인했다(`/my/journal`과 `/my/journal/fortune-history` 양쪽에서).
6. `<meta name="robots" content="noindex, nofollow"/>`와 `<title>번호 기록</title>` 등 페이지별 제목을 실제 응답 HTML에서 확인.

---

## 12. 기존 페이지 Regression

| 경로 | 결과 |
|---|---|
| `/` | `200` |
| `/login` | `200` |
| `/ui-preview` | `200` |
| `/onboarding`(비로그인) | `307 → /login?next=%2Fonboarding` |
| `/my/profile`(비로그인) | `307 → /login?next=%2Fmy%2Fprofile`(회귀 없음) |
| `/my/notifications`(비로그인) | `307 → /login?next=%2Fmy%2Fnotifications`(회귀 없음) |

`proxy.ts`/`Header`/`Footer`/`BottomNavigation`/`GlobalNav`는 이번 Task에서 전혀 수정하지 않았고, 위 회귀 확인으로 영향 없음을 재검증했다.

---

## 13. lint/type-check/test/build 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 36개 테스트 통과(변경 없음 — 이번 Task는 `lib/api/journal.ts`를 건드리지 않아 그 테스트도 그대로) |
| `npm run build` | 통과. 라우트 목록 Phase4-2와 동일(4개 유지, 신규/삭제 없음) |
| `git status`(범위 확인) | 이번 Task의 실제 변경분은 `app/my/journal/**`(수정 4개) + `components/journal/**`(신규 2개)뿐임을 확인. `proxy.ts`/`lib/auth/*`/`lib/api/journal.ts`/`lib/types/journal.ts`/Migration/`DESIGN_SYSTEM.md`는 전혀 손대지 않았다 |

---

## 14. 발견된 문제

새로 발견된 결함은 없다. `docs/PHASE4_DIARY_PAGES_REPORT.md` §12가 이미 기록한 "Architecture Decision(허브만 예외) vs 실제 proxy.ts 구현(하위 경로 전체 예외)" 불일치는 이번 Task 지시(§4)에 따라 다시 손대지 않았고, 페이지 레벨 로그인 확인으로 계속 보완된 상태를 유지한다 — 재확인만 했다.

---

## 15. 의도적으로 구현하지 않은 기능

- 다이어리 작성/수정/삭제 — Phase5~7 범위
- `loading.tsx`/`error.tsx` 도입 — §6에서 근거 설명(현재 구조에서는 이점보다 파일 증가 비용이 큼)
- 개별 기록 상세 페이지 — SITEMAP에 URL 자체가 없음
- 허브 미리보기 이상의 목록/필터/정렬 UI — read service의 기존 계약만 사용
- `/my/journal/results`(당첨확인), `/my/journal/calendar` — Phase4-2와 동일하게 이번 지시문 범위 밖
- proxy.ts 수정 또는 Architecture Decision 문서 정정 — §4 지시에 따라 이번 Task에서 다루지 않음
- 로그인 상태별 동적 metadata(`generateMetadata`) — SITEMAP 규칙이 URL 기준이라 불필요

---

## 16. Phase4 다음 단계 추천

**Phase4-4 — Diary Audit(Phase3-8과 동일 형식의 최종 점검)를 권장한다.**

근거: Phase4-1(Read Service)·Phase4-2(Pages Skeleton)·Phase4-3(UX Refinement)를 거치며 다이어리 조회 경험이 실 데이터·빈 상태·에러·인증 4상태·User A/B 격리까지 실측 검증된 완결 단위에 도달했다. Phase3가 "UI Foundation" 전체를 다지고 나서 Phase3-8로 한 번 종합 점검을 했던 것과 동일한 패턴으로, Phase4도 다음 두 가지가 아직 정리되지 않은 채로 남아 있다:

1. `docs/PHASE4_DIARY_PAGES_REPORT.md`/`docs/PHASE4_DIARY_UX_REFINEMENT_REPORT.md`가 반복해서 재확인만 하고 넘어간 **proxy.ts Architecture Decision 불일치**(§14) — 실사용에는 지장이 없지만 문서와 코드 중 하나는 정정하는 결정이 필요하다.
2. Fortune(`/fortune`) 기능의 Phase 배정(`docs/PHASE4_ARCHITECTURE_DECISION.md` §7에서 "Phase4와 분리"로만 분류, 아직 어디에도 배정 안 됨)과 색상 대비 문제(`color-danger`/`color-success`, 이번 Task에서는 두 색 모두 사용하지 않아 우회했지만 근본 해결은 아님)가 여전히 남아있다.

Phase4-4는 새 기능을 만들지 않고 이 두 가지를 포함해 Phase4 전체(1~3)를 종합 점검·정리하는 것을 권장한다. 그 다음에야 Phase5(번호 생성, 이 다이어리에 실제로 데이터를 채우는 첫 기능)로 안전하게 넘어갈 수 있다.
