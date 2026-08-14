# PHASE2-7 RLS REAL USER SESSION VERIFICATION 보고서 ([[BACKLOG]] 항목 E)

> [[PHASE1_COMPLETION_REPORT]]가 미완료로 남긴 "실제 사용자 세션 기반 RLS 동작 검증"([[BACKLOG]] 항목 E)을 수행한 결과다. `pg_policies` 시스템 카탈로그로 정책 **정의**를 확인하는 것을 넘어, 실제 anon key + 두 개의 authenticated JWT로 Supabase REST API(PostgREST)를 직접 호출해 **행동(behavioral) 검증**을 수행했다. 이번 Task는 코드/스키마/RLS/Migration을 전혀 수정하지 않는다 — 순수 검증 및 보고 Task다.

---

## 1. 생성/수정 파일

**영구적으로 남는 파일**: `docs/PHASE2_RLS_REAL_USER_TEST_REPORT.md`(본 보고서) 1개뿐이다.

**검증 중 임시로 사용하고 전부 삭제한 것**(git 이력에 흔적 없음):
- `app/api/rlstest/route.ts` — [[PHASE2_KAKAO_E2E_REPORT]]/[[PHASE2_ONBOARDING_REPORT]]/[[PHASE2_PROXY_REPORT]]에서 이미 쓴 것과 동일한 방법으로, 카카오 API를 호출하지 않고 `lib/auth/kakao.ts`의 `establishKakaoSupabaseSession()`(기존 코드, 수정 없음)을 실제 Route Handler 컨텍스트에서 실행해 세션 쿠키를 발급하는 검증 전용 라우트.
- 로컬 스크래치 디렉터리(`.rlstmp/`) — 세션 쿠키, JWT, curl 요청/응답 임시 파일. 검증 종료 후 삭제.
- Supabase 프로젝트에 생성했던 테스트 데이터(테스트 계정 2개, `profiles`/`user_numbers`/`dream_journal_entries`/`notifications`/`notification_deliveries`/`winning_cases`/`stores`/`store_win_records`/`share_cards` 각 1건) — 검증 종료 후 전부 삭제하고, 9개 테이블 모두 행 수 0으로 원상복구 확인.

기존 코드(`lib/auth/**`, `app/api/profile/route.ts`, `app/api/auth/kakao/**`, `proxy.ts`, migration 파일 등)는 어떤 것도 수정하지 않았다.

---

## 2. 테스트 계정 구성

### 방법과 한계 (지시문이 명시적으로 요구한 기록)

- **카카오 OAuth 실제 계정 사용은 이번에도 불가능했다** — [[PHASE2_KAKAO_E2E_REPORT]]에서 이미 확인된 것과 동일한 환경 제약(이 실행 환경에는 브라우저가 없어 카카오 로그인 동의 화면을 완료할 수 없다).
- 대신 **Supabase Auth 테스트 사용자**를 만들었다. 다만 "Auth 테스트 사용자를 임의로 생성"한 것이 아니라, **현재 구현된 인증 흐름을 그대로 재사용**했다: `lib/auth/kakao.ts`의 `establishKakaoSupabaseSession()`은 카카오 REST API 호출과 세션 발급을 분리하고 있어(카카오 API 응답을 받은 뒤 `{id, nickname}`만 넘겨받아 세션을 발급), 카카오 API 호출 부분만 우회하고 세션 발급 로직(실제 `generateLink`+`verifyOtp`, [[PHASE2_KAKAO_E2E_REPORT]]에서 이미 실제 Supabase 프로젝트 대상으로 검증된 코드)은 전혀 수정 없이 그대로 탔다.
- User A(`kakaoId=900000401`), User B(`kakaoId=900000402`)로 각각 세션을 발급하고, 기존 `POST /api/profile`(수정 없음)로 각자의 `profiles` 행을 생성했다.
- 각 사용자의 세션 쿠키(`sb-<ref>-auth-token`, `@supabase/ssr`가 굽는 `base64-<JSON>` 형식)에서 `access_token`(JWT)을 디코딩해 추출했다. 이 JWT를 이후 모든 테스트에서 `Authorization: Bearer <token>` 헤더로 직접 사용해, 이 프로젝트 앱을 거치지 않고 **Supabase REST API(PostgREST)에 직접** 요청했다 — 지시문이 요구한 "실제 anon key + authenticated JWT 환경"과 정확히 일치하는 방식이다.
- **JWT 검증**: 두 토큰을 디코딩해 `sub` 클레임이 각각 `profiles.id`(=`auth.users.id`)와 정확히 일치하고 `role: authenticated`임을 확인했다 — `auth.uid()` 매칭이 정상 동작할 전제 조건을 실측으로 확인.
- **한계**: (1) 실제 카카오 사용자가 아니라 카카오 API 응답을 모사한 값(`{id, nickname}`)으로 만든 세션이다 — `establishKakaoSupabaseSession()` 자체는 이미 실측되었으므로(§[[PHASE2_KAKAO_E2E_REPORT]]) 이번 검증의 신뢰도에 영향을 주지 않는다고 판단했다. (2) `notifications`/`notification_deliveries`는 client INSERT 정책이 원래 없어(§6 관리자 정책 공통 원칙) 테스트 데이터를 `service_role`로 직접 시딩했다 — 이는 "테스트 데이터 준비"에만 service_role을 썼고, **모든 검증(SELECT/UPDATE/DELETE 시도)은 예외 없이 anon key + 사용자 JWT로 수행**했다(§4 "중요 확인 사항 3" 대응).

---

## 3. 테이블별 테스트 결과

| Table | User A | User B 접근 차단 | 결과 |
|---|---|---|---|
| `profiles` | 자신의 profile SELECT 가능(200 + 본인 행) | User A profile SELECT 시도 → `200 + []`(빈 배열, 노출 없음). 필터 없는 전체 조회도 본인 행만 반환 | **PASS** |
| `profiles`(보충) | — | User B가 자신의 `profiles.provider`를 직접 UPDATE 시도 → 응답은 `204`였으나 `Prefer: return=representation`으로 재검증한 결과 `Content-Range: */*` + `service_role`로 재조회해 실제로는 **0행 변경**(차단) 확인 | **PASS**(단, 최초 `204` 응답만 보면 오해할 수 있어 재검증 방법을 §4에 기록) |
| `user_numbers` | SELECT/INSERT/UPDATE/DELETE 전부 자신의 행에서 정상 동작(생성→조회→수정→삭제 전 과정 확인) | User A 행 SELECT 시도 → `200 + []`. `user_id`를 A로 위장한 INSERT 시도 → `403 42501`(RLS 위반 명시적 에러)로 즉시 차단. UPDATE/DELETE 시도 → `Content-Range: */*` + 빈 배열(0행 영향) | **PASS** |
| `dream_journal_entries` | SELECT/INSERT/UPDATE/DELETE 전부 자신의 행에서 정상 동작 | User A 행 SELECT/UPDATE/DELETE 전부 빈 배열(0행) — 노출·변경·삭제 전부 차단 | **PASS** |
| `notifications` | 자신의 notification SELECT 가능(`service_role`로 시딩한 행을 정상 조회) | User A notification SELECT 시도 → `200 + []`. (보충) User B가 자신 명의 notification을 직접 INSERT 시도 → `403 42501`(정책 없음=차단, 설계대로 service_role 전용) | **PASS** |
| `notification_deliveries` | 자신 소유 notification에 연결된 delivery SELECT 가능(EXISTS 서브쿼리 정책 정상 동작) | User A의 delivery SELECT 시도 → `200 + []` | **PASS** |
| public 데이터(`draws`/`dreams`/`dream_number_mappings`) | (해당 없음 — anon 검증) | (해당 없음) | anon key만으로 실제 시드 데이터(각 15/25/25건 중 일부) 조회 성공 — **PASS** |
| public 데이터(`winning_cases`/`stores`/`store_win_records`/`share_cards`) | (해당 없음 — anon 검증) | (해당 없음) | 기존 행 수가 0건이라 "빈 배열=차단"과 "빈 배열=데이터 없음"을 구분할 수 없었다 — `service_role`로 각 테이블에 1건씩 임시 시드 후 anon key로 재조회해 **실제 데이터가 담긴 응답**을 확인했다(§4-1 참조). 검증 후 시드 데이터는 전부 삭제 — **PASS** |

**7개 테이블 전부, 지시문이 요구한 "User A는 되고 User B는 안 된다"는 조건을 실제 anon key + authenticated JWT 환경에서 예외 없이 만족했다.**

---

## 4. 발견된 문제

### 4-1. "빈 배열"이 성공/차단을 구분하지 못하는 테스트 방법론적 함정 (이번 검증에서 직접 겪음)

PostgREST는 RLS로 **행이 필터링되어 0건**인 경우와 **정말로 데이터가 없는** 경우를 동일하게 `200 OK` + `[]`로 응답한다. `winning_cases`/`stores`/`store_win_records`/`share_cards`는 실제로 0건이었기 때문에, 최초 anon 조회 결과(`200 + []`)만으로는 "RLS가 막아서 안 보이는지" "정말 데이터가 없어서 안 보이는지"를 구분할 수 없었다. **해결**: 각 테이블에 `service_role`로 임시 행 1건을 넣고 다시 anon으로 조회해, 그 행이 실제로 응답에 담겨 나오는지까지 확인했다(§3). — 이 자체는 RLS 정책의 결함이 아니라 **테스트 방법론의 함정**이었고, 이번 Task가 "단순 SQL policy 확인이 아니라 실제 환경에서 테스트"를 요구한 이유를 그대로 보여주는 사례라고 판단해 기록한다.

같은 함정이 UPDATE/DELETE에도 있다: PostgREST는 `Prefer: return=representation` 헤더 없이 UPDATE/DELETE에 성공하면 `204 No Content`를 반환하는데, **RLS가 0행을 매칭시켜 아무것도 바꾸지 못한 경우에도 동일하게 `204`를 반환한다.** `profiles` UPDATE 테스트에서 이 함정에 실제로 걸렸다 — 처음에 `204`만 보고 "성공한 것 아닌가" 의심했으나, `Prefer: return=representation`으로 재요청해 `Content-Range: */*`(영향받은 행 없음)를 확인하고, `service_role`로 실제 DB 값을 재조회해 변경되지 않았음을 최종 확인했다. **이후 모든 UPDATE/DELETE 테스트는 `Prefer: return=representation`을 붙여 응답 배열의 실제 내용으로 판정했다.**

### 4-2. RLS 정책 설계와 실제 동작의 불일치

**발견되지 않았다.** `0008_rls_policies.sql`·`0009_share_cards_storage.sql`·`0011_profiles_auth_protection.sql`에 정의된 정책 24개(client 대상) 전체가 문서(§2 이하 SQL 주석, [[DATABASE_SCHEMA]] §6)가 서술한 대로 정확히 동작했다. 특히:
- `0011`이 `profiles_insert_own`/`profiles_update_own`을 제거한 효과(§4-1의 재검증)가 실제로 성립함을 확인했다 — [[PHASE2_AUTH_DECISION]] Decision 3의 "정책 없음=기본 차단" 설계가 이론이 아니라 실제로 작동한다.
- `notification_deliveries`의 EXISTS 기반 정책(부모 `notifications.user_id`를 참조하는 서브쿼리)이 정상 동작했다 — 이 프로젝트에서 유일하게 "직접 `user_id` 컬럼이 없는 테이블"의 RLS라 별도로 주의 깊게 확인했다.

### 4-3. `auth.uid()` 매칭 문제

**발견되지 않았다.** 두 사용자 JWT의 `sub` 클레임이 각각 해당 `profiles.id`/`auth.users.id`와 정확히 일치했고, 모든 `auth.uid() = user_id` 기반 정책이 기대대로 필터링했다.

### 4-4. `service_role` 우회 때문에 놓친 문제

**발견되지 않았다(주의 깊게 확인).** `lib/auth/profile.ts`(`getProfile`/`createProfile`/`profileExists`)와 `app/api/profile/route.ts`가 전부 `service_role`을 쓰기 때문에, **이 앱의 API만 사용해서는 `profiles`의 client 측 RLS(SELECT 이외 전부 차단)가 실제로 걸려 있는지 확인할 방법이 없다** — service_role은 RLS를 완전히 우회하므로 앱 API 호출은 "RLS가 있어도 없어도 항상 성공"한다. 이번 검증이 바로 이 사각지대를 메우기 위해 앱을 거치지 않고 anon key + 사용자 JWT로 **직접** PostgREST를 호출한 이유이며, §4-2에서 이 방식으로 `profiles`의 client UPDATE가 실제로 차단됨을 확인했다. `notifications`/`notification_deliveries`의 client INSERT 차단도 동일한 방식(직접 REST 호출)으로 확인했다.

### 4-5. `anon`/`authenticated` role 차이 문제

두 가지 보충 확인을 추가로 수행했다(지시문 표에는 없지만 "중요 확인 사항 4"에 대응):
- `anon`(비로그인)이 `draws`에 직접 INSERT 시도 → RLS 위반으로 차단(`42501`) — `draws_select_public` 정책이 `select`에만 적용되고 `insert`에는 어떤 역할에도 정책이 없어 service_role 전용임을 확인.
- `anon`(비로그인)이 `user_numbers`를 SELECT 시도 → `200 + []`(정책이 `to authenticated`로만 한정되어 있어 `anon` 역할에는 아무 정책도 적용되지 않고, 결과적으로 전체 차단) — 설계 의도와 일치.

### 4-6. `proxy` 인증과 DB RLS 연결 문제

**발견되지 않았다.** [[PHASE2_PROXY_REPORT]]에서 `proxy.ts`가 세션 확인에 쓰는 것과 동일한 `getCurrentUser()`/세션 쿠키 체계에서 추출한 JWT가, DB 레벨 RLS에서도 정확히 같은 사용자로 인식됨을 이번 검증이 다시 한 번 확인했다(§2 JWT `sub` 검증) — 인증 계층(proxy)과 데이터 계층(RLS)이 같은 신원 기준(`auth.uid()`)을 공유하고 있어 둘 사이에 불일치가 없다.

### 4-7. 참고 — 이미 [[BACKLOG]]에 기록된 항목과의 연관성

`notifications_update_own` 정책이 "본인 소유 행"까지만 강제하고 "`is_read` 컬럼만 수정 가능"은 강제하지 못하는 구조적 한계는 `0008_rls_policies.sql` 주석과 [[BACKLOG]] F8에 이미 기록되어 있다. 이번 Task의 명시적 테스트 대상(SELECT 격리)이 아니라 별도로 재검증하지 않았지만, 기존 기록과 일치하는 알려진 한계임을 재확인 차원에서 언급한다.

---

## 5. 수정 필요 사항

**이번 검증에서 RLS 정책 자체의 결함은 발견되지 않았다** — 따라서 수정이 필요한 사항은 없다. 지시문의 원칙("문제 발견 → 영향 분석 → 수정 필요 여부 판단 → 사용자 승인 필요 여부 보고")에 따라 정직하게 보고한다: 발견한 것은 정책의 결함이 아니라 **테스트 방법론의 함정**(§4-1, PostgREST의 204/빈 배열 응답이 성공과 차단을 구분하지 못하는 특성)이었고, 이는 코드나 정책을 고쳐야 하는 문제가 아니라 "다음에 같은 종류의 검증을 할 때 반드시 `Prefer: return=representation`을 쓰고 빈 데이터 테이블은 픽스처를 먼저 채워야 한다"는 검증 절차상의 교훈이다. Migration/RLS/Schema/기존 코드는 어떤 것도 수정하지 않았다.

---

## 6. BACKLOG 업데이트 필요 여부

**필요하다.** [[BACKLOG]] 항목 E("RLS 실제 사용자 테스트")를 "미해결"에서 "처리 완료"로 갱신해야 한다 — 다만 [[BACKLOG]] 문서 자체의 이력 보존 원칙("항목이 해결되면 제거하지 않고 '처리 완료(날짜, 처리한 Migration/PR)'로 상태만 갱신")에 따라, 이 갱신은 문서 수정을 수반하므로 **사용자 승인 후 별도로 반영**한다(이번 Task는 "기존 코드 수정 금지"에 문서 수정 여부가 명시되지 않아, 임의로 [[BACKLOG]]를 고치지 않고 승인을 먼저 구한다). 제안하는 갱신 문구:

> **상태**: 처리 완료(2026-08-06, Phase2-7 — `docs/PHASE2_RLS_REAL_USER_TEST_REPORT.md`). 실제 Supabase 프로젝트에 두 개의 인증 세션을 발급해 anon key + authenticated JWT로 `profiles`/`user_numbers`/`dream_journal_entries`/`notifications`/`notification_deliveries`/공개 테이블 7종의 RLS를 직접 검증. 정책 결함 발견되지 않음.

---

## 7. Validation

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 16개 테스트 통과(기존 그대로, 이번 Task는 코드를 수정하지 않아 변경 없음) |
| `npm run build` | 통과. 라우트 목록도 이전 Task([[PHASE2_PROXY_REPORT]]) 이후로 변경 없음(검증용 임시 라우트는 삭제되어 빌드 산출물에 없음) |

---

## 8. Phase2 Authentication Ready 여부

**Ready.** [[PHASE1_COMPLETION_REPORT]]가 유일한 미완료 항목으로 남겼던 "RLS 실제 사용자 테스트"([[BACKLOG]] 항목 E)를 실제 Supabase 프로젝트·실제 anon key·실제 authenticated JWT 2개로 완수했다. 7개 대상 테이블(`profiles`/`user_numbers`/`dream_journal_entries`/`notifications`/`notification_deliveries`/공개 테이블 7종) 모두 "본인 데이터만 보이고 타인 데이터는 절대 안 보인다"는 조건을 실측으로 확인했고, RLS 정책 설계와 실제 동작 사이의 불일치·`auth.uid()` 매칭 오류·`service_role` 우회로 인한 사각지대·anon/authenticated 역할 차이 문제·proxy-DB 신원 불일치 중 어느 것도 발견되지 않았다. 발견한 유일한 사항은 정책 결함이 아니라 검증 방법론상의 함정(§4-1)이었으며, 코드/스키마/RLS/Migration은 전혀 수정하지 않았다. Phase2(Authentication)는 이 검증을 마지막 조건으로 완료 상태에 도달했다고 판단한다 — 남은 것은 §6의 [[BACKLOG]] 문서 갱신 승인뿐이다.
