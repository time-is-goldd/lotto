# Phase10-4E — Dream Situation Admin CRUD 구현 보고서

## 1. 기존 Admin 구조

`/admin/dreams`(목록) → `/admin/dreams/new`(생성) / `/admin/dreams/[id]/edit`(수정)의 3-라우트 구조. `app/admin/layout.tsx`가 `/admin/*` 전체의 유일한 서버 측 인증 게이트(`getCurrentUser()` → 비로그인 시 `/login` 리다이렉트, `isAdmin()` → 비관리자 시 404). `lib/api/admin/dreams.ts`가 `service_role`로 create/update/delete를 수행하고, Route Handler(`app/api/admin/dreams/route.ts`, `[id]/route.ts`)가 401→403→400 순서로 인증/인가/검증을 처리한다. `DreamForm.tsx`/`DeleteDreamButton.tsx`가 클라이언트 UI를 맡고, `components/admin/dreamFormValidation.ts`가 순수 함수로 클라이언트 검증을 분리해 담당한다. 이 모든 기존 패턴을 그대로 재사용했다 — 새 admin 아키텍처를 만들지 않았다.

## 2. 선택한 Admin UX

지시문 §2 권고대로 별도 최상위 Situation 관리 영역을 만들지 않고, `/admin/dreams/[id]/edit`(Parent Dream 수정 화면) 하단에 "세부 꿈 상황 N개" 섹션을 통합했다. 각 상황은 제목/keyword/행운 숫자 개수/표시 순서를 보여주는 컴팩트한 행으로 나열되고, 수정/삭제 버튼과 "세부 상황 추가" 버튼이 함께 있다. Situation은 끝까지 Parent Dream의 하위 개념으로 유지된다.

## 3. Routes

기존 `app/admin/dreams/[id]/edit`가 이미 URL 세그먼트 이름을 `id`로 확정해 둔 상태라, Next.js App Router 제약(같은 경로 위치에서 서로 다른 동적 세그먼트 이름을 허용하지 않음)에 따라 하위 라우트도 반드시 `id`를 재사용해야 했다 — `dreamId`로 새로 짓지 않았다.

- `/admin/dreams/[id]/situations/new` — 생성
- `/admin/dreams/[id]/situations/[situationId]/edit` — 수정
- API: `POST /api/admin/dreams/[id]/situations`, `PUT`/`DELETE /api/admin/dreams/[id]/situations/[situationId]`

`/admin/situations` 같은 별도 최상위 관리 영역은 만들지 않았다(지시문 §3).

## 4. Service

`lib/api/admin/dreamSituations.ts`(신규) — `createAdminDreamSituation`/`updateAdminDreamSituation`/`deleteAdminDreamSituation`/`getDreamSituationCounts`(관리자 목록 화면의 cascade 경고용 집계) + `parseAdminDreamSituationInput`(create/update 공용 검증). `lib/api/admin/dreams.ts`와 완전히 동일한 책임 분리(service_role은 이 파일에서만, 호출부가 관리자 인증을 이미 통과시켰다고 전제)를 따랐다. 조회(목록/단건 by id)는 새 admin 함수를 만들지 않고 기존 공개 서비스 `lib/api/dreamSituations.ts`의 `getDreamSituations`/`getDreamSituationById`(Phase10-4D, 무수정 — `getDreamSituationById`만 이번에 추가)를 그대로 재사용했다 — `getDreamById()`가 이미 이 원칙을 쓰고 있었다.

## 5. API

인증 순서(401→403→400→실행)와 에러 응답 형태(`{ error: { code, message } }`)를 `app/api/admin/dreams/route.ts`/`[id]/route.ts`와 완전히 동일하게 재사용했다. `CONFLICT`(409)만 새로 추가됐다 — `dream_situations`는 `(dream_id, keyword)` UNIQUE 제약이 실제로 존재해(0018, 부모 `dreams.keyword`에는 UNIQUE 제약이 없어 이 코드가 이제껏 없었음) 중복이 DB 레벨에서 거부될 수 있기 때문이다.

## 6. Create

`title`/`keyword`/`body`/`keyMeaning`(선택)/`numbers`(0~6개, 선택)/`displayOrder`를 입력받는다. 부모 `dream_id`는 **요청 본문에서 전혀 읽지 않는다** — 항상 URL의 `id` 세그먼트에서만 가져와 `createAdminDreamSituation(dreamId, input)`에 전달한다(지시문 §4 "client에서 넘긴 dream_id를 무조건 신뢰하지 않는다"를 "애초에 그 필드를 신뢰의 대상으로 삼지 않는다"로 구현). 존재하지 않는 부모 `dreamId`로 생성을 시도하면 FK 위반(`23503`)이 발생하고, 기존 `lib/api/admin/dreams.ts`의 `AdminDreamNotFoundError`를 그대로 재사용해 404로 응답한다.

## 7. Edit

전체 필드를 다시 제출하는 단일 폼 구조(부모 `DreamForm`과 동일한 패턴)라 `parseAdminDreamSituationCreateInput`과 `parseAdminDreamSituationUpdateInput`은 같은 함수다. 수정 성공 시 실제 공개 페이지(`/dream/[parent]/[situation]`)에 즉시 반영됨을 실측으로 확인했다(§15 참조) — 별도 캐시 무효화 로직이 필요하지 않다(공개 페이지가 Next.js 캐시 없이 매 요청 조회하는 기존 구조를 그대로 따른다).

## 8. Delete

브라우저 기본 `confirm()`으로 1차 확인(`DeleteDreamSituationButton.tsx`, 기존 `DeleteDreamButton.tsx`와 동일한 패턴) 후 `DELETE`. 실제 삭제는 서버의 `isAdmin()` 재검증을 통과해야 하며, `dream_situations`는 자식 행이 없어(0018) 별도로 정리할 관련 테이블이 없다. 삭제 후 공개 상세 URL 404, 부모 목록에서 제거, sitemap에서 제거를 전부 실측으로 확인했다(§15).

## 9. Lucky Numbers Editor

`3, 17` 형태의 단일 텍스트 입력(지시문 §7 예시 형식 그대로 채택 — 6칸 고정 입력 그리드는 "0~6개, 항상 6개로 강제하지 않는다"는 원칙과 UI적으로 충돌해 채택하지 않았다). 쉼표/공백(연속 포함) 어느 조합으로 구분해도 파싱된다. 빈 입력은 0개(NULL)로 저장된다. 검증은 `lib/logic/matchNumbers.ts`에 새로 추가한 `assertValidPartialNumberSet`(0~6개, 1~45 범위, 중복 금지 — 정확히 6개를 강제하는 기존 `assertValidNumberSet`과 의도적으로 분리, DB의 `is_valid_lotto_numbers`/`is_valid_partial_lotto_numbers` 분리와 동일한 이유)로 클라이언트/서버 양쪽에서 동일하게 수행한다. 저장 전 오름차순으로 normalize한다.

## 10. Keyword validation

같은 부모 안에서 keyword UNIQUE는 실제 DB 제약(`dream_situations_dream_id_keyword_key`, 0018)이 최종적으로 보장한다. 애플리케이션은 이를 사전 차단하지 않고(별도 조회 없이) INSERT/UPDATE를 그대로 시도한 뒤, Postgres가 반환하는 `23505` 에러 코드를 감지해 `DuplicateSituationKeywordError`로 변환한다 — `lib/api/admin/draws.ts`의 `DuplicateRoundError` 처리와 동일한 패턴이다. API는 이를 `409 CONFLICT`로 응답하며, raw Postgres 메시지("duplicate key value violates unique constraint...")는 클라이언트에 전혀 노출하지 않고 항상 "이미 사용 중인 keyword입니다: {keyword}"로 대체한다. 실제 HTTP로 중복 keyword 생성을 시도해 정확히 이 흐름을 확인했다(§15).

## 11. Display Order

drag-and-drop 라이브러리를 추가하지 않고 단순 숫자 입력(0 이상의 정수)으로 구현했다(지시문 §10). 정렬은 기존 공개 서비스(`lib/api/dreamSituations.ts`의 `getDreamSituations`)가 이미 쓰는 `display_order ASC` 그대로를 관리자 목록 화면에서도 재사용한다 — 별도 정렬 로직을 새로 만들지 않았다.

## 12. Parent ownership

`updateAdminDreamSituation(dreamId, situationId, input)`/`deleteAdminDreamSituation(dreamId, situationId)` 둘 다 `.eq("id", situationId).eq("dream_id", dreamId)`를 WHERE 조건에 함께 걸어 UPDATE/DELETE를 실행한다. `situationId`가 실재하지만 `dream_id`가 다르면 이 쿼리는 0행에 적용되고(에러 없음), "존재하지 않음"과 동일한 `AdminDreamSituationNotFoundError`(404)로 처리된다 — "다른 Parent 소속"과 "아예 존재하지 않음"을 응답에서 구분하지 않아, 다른 Dream 밑에 어떤 situationId가 존재하는지 자체를 노출하지 않는다. 실제 격리된 테스트 부모 Dream 2개(A/B)로 A 소속 situation을 B의 URL로 수정/삭제 시도해 둘 다 정확히 404(실제로 변경/삭제되지 않음)임을 확인했다(§15).

## 13. RLS/security

`dream_situations`의 RLS는 전혀 건드리지 않았다 — `dream_situations_select_public`(anon/authenticated SELECT 전용, 0018)이 그대로 유지되고, INSERT/UPDATE/DELETE 정책은 여전히 없어(암묵적 `service_role` 전용) 이번 Task로 새 정책을 추가하지 않았다. Admin mutation은 전부 Route Handler(`getCurrentUser()`→`isAdmin()`)와 `service_role` 조합으로만 처리된다. XSS: 새 파일 어디에도 `dangerouslySetInnerHTML`을 추가하지 않았다 — 관리자가 입력한 title/body/keyMeaning은 순수 React 텍스트 렌더링으로만 공개 페이지에 나타난다. `</script><script>alert(1)</script>` 등을 실제로 title/body/keyMeaning에 넣어 생성한 뒤 공개 페이지 HTML을 직접 확인한 결과, 본문 영역은 전부 HTML 이스케이프(`&lt;/script&gt;`)됐고 기존 BreadcrumbList JSON-LD의 `<` 이스케이프도 그대로 유지됨을 확인했다(§15).

## 14. Parent delete cascade UX

`dream_situations.dream_id`가 `dreams(id)`를 `ON DELETE CASCADE`로 참조하므로(0018) 부모 삭제 시 세부 상황도 실제로 함께 사라진다. `DeleteDreamButton`이 `situationCount`(신규 prop, `getDreamSituationCounts()`로 관리자 목록 화면에서 조회)를 받아 0보다 클 때만 confirm 메시지에 "이 꿈의 세부 상황 N개도 함께 삭제됩니다."를 덧붙이도록 했다 — 실제 cascade가 존재할 때만 표시한다는 지시문 §17 조건을 그대로 만족한다.

## 15. Public regression

실제 dev 서버 + 격리된 테스트 부모 Dream(`__test_situation_admin_a__`, id 30 / `__test_situation_admin_b__`, id 31) + 실제 Supabase Auth 세션(`establishKakaoSupabaseSession()` 재사용, 실제 카카오 OAuth 없이 진짜 세션 발급)으로 검증했다.

| 시나리오 | 결과 |
|---|---|
| 비로그인 POST | `401` |
| 일반 사용자(admins 행 없음) POST | `403` |
| 관리자 POST(생성) | `201`, 즉시 부모 목록/상세 페이지 `200`에 반영 |
| keyword 포함 PUT(수정) | `200`, 이전 URL `404` / 새 URL `200`(내용 실제 변경 확인) |
| 다른 부모(B) URL로 A 소속 situation PUT/DELETE | 둘 다 `404`(소유권 검증, 실제 변경/삭제 안 됨) |
| 중복 keyword POST | `409 CONFLICT`, raw Postgres 메시지 미노출 |
| numbers 7개 POST | `400 VALIDATION_ERROR` |
| numbers 0개(미입력) POST | `201`, `numbers: null` 저장 |
| XSS 페이로드(title/body/keyMeaning) POST | `201` 저장은 되지만 공개 페이지에서 전부 이스케이프 렌더링 |
| 관리자 DELETE | `204`, 이후 공개 상세 `404`, 부모 목록에서 제거, sitemap에서 제거 |

## 16. Sitemap

삭제 전/후 `curl /sitemap.xml`로 테스트 situation URL의 존재/제거를 직접 확인했다(§15 표). 새 admin 라우트(`/admin/dreams/[id]/situations/*`, `/api/admin/dreams/[id]/situations/*`)는 `app/sitemap.ts`를 전혀 수정하지 않았으므로 sitemap에 포함되지 않는다 — 최종 sitemap URL 총계가 작업 전후 동일하게 **141건**임을 확인했다(지시문 §26).

## 17. Real DB test

임시 `app/api/jtest/route.ts`(GET, `?role=admin|user`)를 만들어 `establishKakaoSupabaseSession()`(`lib/auth/kakao.ts`, 무수정)으로 진짜 Supabase Auth 세션 2개(관리자용/일반 사용자용)를 발급했다 — 실제 카카오 OAuth는 전혀 거치지 않는다. 발급된 세션 쿠키를 `curl -c/-b`로 그대로 재사용해 `POST/PUT/DELETE /api/admin/dreams/[id]/situations*`를 실제 HTTP로 호출했다. 실행 중 한글 텍스트를 curl `-d` 인자에 인라인으로 넣었다가 인코딩이 깨진 사례가 1건 있었다(Windows Git Bash의 알려진 문제, 이전 Phase들이 이미 기록한 것과 동일) — 즉시 해당 테스트 행을 삭제하고 파일 기반(`--data-binary @file.json`) 방식으로 재실행해 정상 확인했다.

## 18. Cleanup

생성했던 모든 테스트 데이터를 실제 API/REST로 삭제하고 최종 0건을 재확인했다:

- 테스트 situation 5건(id 165, 167, 168, 169 + 정상 삭제 확인용 1건) — 전부 관리자 API `DELETE`로 삭제, 마지막 잔여 확인 쿼리 `0건`.
- 테스트 부모 Dream 2건(id 30, 31) — `service_role` DELETE. cascade로 남은 situation이 있었는지 재조회한 결과 `0건`.
- `admins` 테스트 행 1건 — `service_role` DELETE, 재조회 `0건`.
- 테스트 Auth 계정 2건(관리자용/일반 사용자용) — `auth.admin.deleteUser()`로 삭제.
- 임시 `app/api/jtest/route.ts` — 파일 삭제 완료(흔적 없음).

## 19. Existing content integrity

작업 전/후 비교:

| 항목 | 작업 전 | 작업 후 |
|---|---|---|
| Parent Dreams | 25 | **25**(불변) |
| Situations | 101 | **101**(불변) |
| 돼지꿈 Situations | 12 | **12**(불변) |
| sitemap 총 URL | 141 | **141**(불변) |

새 migration으로 seed를 다시 넣거나 데이터를 복제하지 않았다(지시문 §15) — 기존 101개 행을 그대로 관리 가능함을 이번 Task의 admin CRUD로 직접 실증했다.

## 20. Tests/build

- 신규 단위 테스트: `lib/api/admin/dreamSituations.test.ts`(27개, mocked service_role — parse/create/update/delete/중복 keyword/FK 위반/소유권), `components/admin/dreamSituationFormValidation.test.ts`(25개, 클라이언트 검증), `lib/logic/matchNumbers.test.ts`에 `assertValidPartialNumberSet` 케이스 추가(9개). 합계 61개 추가.
- 전체 테스트: **463 passed**(기존 402 + 신규 61).
- `next lint`: 통과(unused-vars 경고 1건은 `DreamSituationForm.tsx`에 `maxLength` 속성을 추가해 실제로 활용하는 방식으로 해결).
- `tsc --noEmit`: 통과.
- `next build`: 성공, 라우트 4개 추가(`/admin/dreams/[id]/situations/new`, `/admin/dreams/[id]/situations/[situationId]/edit`, `/api/admin/dreams/[id]/situations`, `/api/admin/dreams/[id]/situations/[situationId]`) — 총 51개(기존 47 + 4).
- migration sync: `0001~0019` local=remote 그대로(이번 Task는 migration을 추가하지 않았다).

## 21. 발견된 문제

실증 검증 중 curl `-d` 인자에 한글을 인라인으로 넣었다가 인코딩이 깨진 사례가 1건 있었다(§17) — 코드/스키마 결함이 아니라 Windows Git Bash 테스트 도구의 알려진 한계이며, 즉시 파일 기반 방식으로 재검증해 실제 기능에는 문제가 없음을 확인했다. 그 외 발견된 결함은 없다.

## 22. 남은 Launch Blocker

없음.

## 23. 다음 작업 추천

Situation 목록이 25개 부모에 걸쳐 101건까지 늘어난 지금, 관리자 목록 화면(`/admin/dreams/[id]/edit`)에서 상황이 많은 부모(예: 돼지꿈 12건)를 한 화면에 전부 펼쳐 보여주는 현재 방식이 향후 상황 수가 더 늘어나면(§15 기준 목표 80~120건대에서는 아직 괜찮지만) 스크롤이 길어질 수 있다 — 상황이 특히 많은 부모부터 접기/펼치기 UI를 검토해볼 만하다(이번 Task 범위 밖, 후속 후보로만 기록).

---

## TASK REPORT — Dream Situation Admin

- **Admin Route**: `/admin/dreams/[id]/situations/new`, `/admin/dreams/[id]/situations/[situationId]/edit` (별도 최상위 `/admin/situations` 없음)
- **Parent Integration**: `/admin/dreams/[id]/edit`에 "세부 꿈 상황 N개" 섹션 통합
- **Create**: PASS(201, 부모 dream_id는 URL에서만 취득, 요청 본문 필드 무시)
- **Edit**: PASS(200, keyword 변경 시 구 URL 404 / 신 URL 200 실측 확인)
- **Delete**: PASS(204, 공개 상세 404 / 목록 제거 / sitemap 제거 실측 확인)
- **Lucky Numbers 0-6**: PASS(0개 NULL 저장, 7개 400 거부, 실측 확인)
- **Display Order**: PASS(숫자 입력, 0 이상 정수, ASC 정렬)
- **Duplicate Keyword**: PASS(409 CONFLICT, raw Postgres 메시지 미노출)
- **Ownership Check**: PASS(다른 Parent URL로 수정/삭제 시도 → 404, 실제 변경 없음)
- **Public Read**: PASS(무수정, anon/authenticated SELECT 유지)
- **Public Mutation**: PASS(무수정, 여전히 client 대상 정책 없음 — service_role 전용)
- **Admin Mutation**: PASS(비로그인 401 / 비관리자 403 / 관리자 201·200·204, 전부 실측)
- **Existing 101 Situations Preserved**: PASS(작업 전후 101건 동일)
- **Pig Dream 12 Preserved**: PASS(작업 전후 12건 동일)
- **Migration**: 0개 추가(기존 스키마로 충분)
- **Tests**: 463 passed(기존 402 + 신규 61)
- **Build**: 성공(라우트 47 → 51)
- **Real DB**: PASS(격리된 테스트 부모 Dream 2개 + 실제 Auth 세션 2개로 전체 CRUD/소유권/중복/XSS 실측)
- **Cleanup**: PASS(테스트 situation/부모 Dream/admins 행/Auth 계정/임시 라우트 전부 삭제, 잔여 0건 재확인)
- **Admin Situation CRUD**: **PASS**
- **Remaining Launch Blockers**: 없음
- **다음 작업**: 상황이 많은 부모 Dream을 위한 목록 접기/펼치기 UI 검토
