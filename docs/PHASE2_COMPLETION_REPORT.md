# PHASE2 AUTHENTICATION — 최종 완료 감사 보고서

> [[EXECUTION_PLAN]] Phase 2(Authentication)의 종료 시점 상태를 기록하는 **완료 보고 문서**다. [[PHASE1_COMPLETION_REPORT]]와 동일한 성격 — 설계 산출물([[PHASE2_AUTH_ARCHITECTURE_AUDIT]]·[[PHASE2_AUTH_DECISION]])이나 개별 구현 보고서(9개)를 대체하지 않고, "문서에 흩어진 Phase2 전체 상태를 한 곳에 모아 실제 구현과 대조"하는 최종 감사·동기화 문서다. 이번 Task는 **문서 정리만** 수행한다 — 코드/Schema/Migration/RLS는 전혀 수정하지 않았다.

Phase2는 아래 9개 Task를 거쳐 진행되었다: [[PHASE2_AUTH_ARCHITECTURE_AUDIT]](분석) → [[PHASE2_AUTH_DECISION]](결정) → [[PHASE2_AUTH_FOUNDATION_IMPLEMENTATION_REPORT]](Phase2-1, RLS 기반) → [[PHASE2_PROFILE_SERVICE_REPORT]](Phase2-2, Profile Service) → [[PHASE2_KAKAO_POC_REPORT]](Phase2-3, 카카오 PoC) → [[PHASE2_KAKAO_E2E_REPORT]](Phase2-4, 실제 환경 검증+버그 수정) → [[PHASE2_ONBOARDING_REPORT]](Phase2-5, 온보딩) → [[PHASE2_PROXY_REPORT]](Phase2-6, 보호 계층) → [[PHASE2_RLS_REAL_USER_TEST_REPORT]](Phase2-7, RLS 실사용자 테스트).

---

## 1. Authentication Architecture 최종 구조

### Kakao OAuth 방식
[[PHASE2_AUTH_DECISION]] Decision 2(REST API + Admin API 방식) 그대로 구현됨. OIDC 커스텀 프로바이더 경로는 채택하지 않았다.

```
사용자 "카카오로 로그인" 클릭
  → GET /api/auth/kakao/login (state 발급, httpOnly 쿠키, 카카오 authorize URL로 307)
  → 카카오 동의 화면 (실제 카카오 서버, 이 프로젝트 밖)
  → GET /api/auth/kakao/callback?code=...&state=...
      1. state 쿠키/쿼리 일치 확인(CSRF), 즉시 쿠키 삭제
      2. exchangeKakaoCodeForToken(code) — 카카오 REST API로 access_token 교환
      3. fetchKakaoUserProfile(access_token) — 카카오 고유 id·닉네임 조회
      4. establishKakaoSupabaseSession(kakaoUser) — 아래 "Supabase Auth 연동 방식" 참조
      5. getProfile(userId) 결과에 따라 /?login=success&profile=pending|ready 로 리다이렉트
```
(`lib/auth/kakao.ts`, `app/api/auth/kakao/login/route.ts`, `app/api/auth/kakao/callback/route.ts`)

### Supabase Auth 연동 방식 / session 발급 방식
카카오는 Supabase Auth 기본 프로바이더가 아니므로, `establishKakaoSupabaseSession()`이 다음을 수행한다:
1. `deriveKakaoSyntheticEmail(kakaoId)` — `kakao-{id}@users.noreply.luckplatform.local` 형태의 결정론적 합성 이메일 생성(같은 카카오 계정=같은 이메일=같은 `auth.users` 재사용).
2. `admin.auth.admin.generateLink({ type: "magiclink", email })` — service_role로 사용자를 조회/생성하고 검증용 토큰 발급.
3. `admin.auth.admin.updateUserById(..., { app_metadata: { auth_provider: "kakao", kakao_id } })` — **`app_metadata.provider`가 아니라 커스텀 키 `auth_provider`**([[PHASE2_KAKAO_E2E_REPORT]]에서 발견한 버그의 수정 결과, §4 참조).
4. `supabase.auth.verifyOtp({ type: "email", token_hash })` — **`type: "magiclink"`가 아니라 `"email"`**([[PHASE2_KAKAO_E2E_REPORT]] 버그 수정), `email` 필드는 `token_hash`와 함께 보내지 않음. anon 클라이언트(`lib/supabase/server.ts`)로 실행해 실제 세션 쿠키(`sb-<ref>-auth-token`)를 굽는다.

### profile 생성 방식
[[PHASE2_AUTH_DECISION]] Decision 1(API Route + service_role, 트리거 없음) 그대로 구현됨.
- `lib/auth/profile.ts`: `getProfile`/`createProfile`/`updateProfile`/`profileExists`, 전부 `lib/supabase/service.ts`(service_role) 사용.
- `app/api/profile/route.ts`: `GET`(조회)/`POST`(최초 생성, `provider`는 세션 `app_metadata.auth_provider`에서 서버가 판정)/`PUT`(수정, 화이트리스트 필드만).
- 카카오 콜백은 `createProfile()`을 자동 호출하지 않는다 — profile 없음은 "온보딩 대기"라는 정상 상태로 취급([[PHASE2_KAKAO_POC_REPORT]] §0에서 사용자 승인).

### onboarding flow
[[PHASE2_ONBOARDING_REPORT]] 구현. `app/onboarding/page.tsx`(Server Component, 로그인 확인 + profile 존재 확인) + `app/onboarding/OnboardingForm.tsx`(Client Component, `birth_date` 필수/`nickname` 카카오 닉네임 기본값 + 필수). 제출은 기존 `POST /api/profile` 재사용. `app/page.tsx`가 `?profile=pending` 쿼리를 감지해 `/onboarding`으로 연결.

### proxy 보호 구조
[[PHASE2_PROXY_REPORT]] 구현. `proxy.ts`가 `getCurrentUser()`(anon 세션)로 로그인 여부만 확인하고, profile 존재 확인은 **anon 클라이언트로 직접 `profiles` 조회**(service_role인 `profileExists()`를 쓰지 않음 — §4 참조)로 수행. 보호 경로: `/onboarding`, `/mypage`, `/dream-journal`, `/notifications`(비로그인 → `/login?next=`) + `/login` 자체(로그인+profile있음 → `/`, 로그인+profile없음 → `/onboarding`).

### RLS 보호 구조
[[DATABASE_SCHEMA]] §6 정책표 그대로. `0008`(13개 테이블 RLS 일괄 적용) → `0009`(`share_cards` 자체 RLS) → `0011`(`profiles_insert_own`/`profiles_update_own` 제거, Decision 3 반영). [[PHASE2_RLS_REAL_USER_TEST_REPORT]]에서 실제 두 개의 authenticated JWT로 `profiles`/`user_numbers`/`dream_journal_entries`/`notifications`/`notification_deliveries`/공개 테이블 7종 전체를 실측 완료.

---

## 2. 구현 완료 목록

- [x] Kakao OAuth ([[PHASE2_KAKAO_POC_REPORT]], [[PHASE2_KAKAO_E2E_REPORT]] — 실제 Supabase 프로젝트 대상 세션 발급까지 실측. 단, 실제 카카오 브라우저 동의 왕복 자체는 환경 제약으로 미검증, §5 참조)
- [x] Supabase session 발급 ([[PHASE2_KAKAO_E2E_REPORT]] — `establishKakaoSupabaseSession()`, 실제 프로젝트 대상 세션 쿠키 발급/재사용/중복방지 실측)
- [x] profile service ([[PHASE2_PROFILE_SERVICE_REPORT]] — `lib/auth/profile.ts`, 12개 단위 테스트)
- [x] profile API ([[PHASE2_PROFILE_SERVICE_REPORT]] — `GET`/`POST`/`PUT /api/profile`)
- [x] onboarding ([[PHASE2_ONBOARDING_REPORT]] — 실제 접근 제어·제출 흐름 실측)
- [x] proxy route protection ([[PHASE2_PROXY_REPORT]] — 4개 보호 경로 + `/login` 예외 실측)
- [x] RLS 실제 사용자 테스트 ([[PHASE2_RLS_REAL_USER_TEST_REPORT]] — 7개 테이블, 실제 anon key + 2개 authenticated JWT)

---

## 3. Decision 대비 구현 일치 여부

| Decision | 실제 구현 | 상태 |
|---|---|---|
| **Decision 1** — profile 생성 방식(API Route + service_role, 트리거 없음) | `lib/auth/profile.ts`/`app/api/profile/route.ts`가 service_role로 생성. 트리거 미사용. "profile 없음=온보딩 대기" 원칙을 카카오 콜백([[PHASE2_KAKAO_POC_REPORT]])과 온보딩 페이지([[PHASE2_ONBOARDING_REPORT]]) 양쪽에서 그대로 구현 | **일치** |
| **Decision 2** — Kakao 통합 방식(REST API + Admin API, OIDC 미채택) | `lib/auth/kakao.ts`가 카카오 REST API(`kauth.kakao.com`, `kapi.kakao.com`)로 직접 토큰교환/사용자조회 후 `admin.generateLink`+`verifyOtp`로 세션 발급. OIDC 코드 없음 | **일치** (단, `verifyOtp`의 정확한 `type`/파라미터 조합은 Decision 문서가 다루지 않은 구현 세부사항이었고 실측 중 버그로 발견·수정됨 — §4) |
| **Decision 3** — 민감 컬럼 보호(UPDATE 정책 제거 + service_role 화이트리스트) | `0011` migration이 `profiles_insert_own`/`profiles_update_own` 제거. `parseProfileCreateInput`/`parseProfileUpdateInput`이 `nickname`/`gender`/`birth_time`/`marketing_opt_in`/`privacy_public_default`만 화이트리스트. `age_verified`는 항상 서버 재계산. [[PHASE2_RLS_REAL_USER_TEST_REPORT]]에서 client 직접 UPDATE가 실제로 0행 처리됨을 실측 확인 | **일치** (단, `nickname` NOT NULL과 이후 Task 지시문의 "선택 입력" 요청이 충돌한 사례가 있었음 — §4) |
| **Decision 4** — service_role 사용 위치(Route Handler/Server Action/서버 전용 lib만, proxy.ts 절대 금지) | `lib/supabase/service.ts`는 `lib/auth/kakao.ts`·`lib/auth/profile.ts`·`app/api/profile/route.ts`에서만 사용. `proxy.ts`는 service_role을 전혀 사용하지 않고 anon 클라이언트로 대체 구현 | **일치** (단, [[PHASE2_AUTH_DECISION]] 내부에 Decision 1 서술과 Decision 4 서술이 서로 다른 것을 암시하는 지점이 있었고, 구현 시점에 Decision 4를 우선 적용해 해소함 — §4) |

---

## 4. Phase2에서 발견된 문제 정리

| # | 문제 | 원인 | 해결 여부 | 향후 관리 필요 여부 |
|---|---|---|---|---|
| 1 | `app_metadata.provider`가 항상 `"email"`로 남아 카카오 로그인 사용자의 `profiles.provider`가 잘못 저장될 뻔함 | `app_metadata.provider`/`providers`는 Supabase GoTrue가 `auth.identities`로부터 자동 재계산하는 예약 필드라, `admin.updateUserById`로 덮어써도 유지되지 않음(magiclink 검증 경로가 email identity를 만들기 때문) | **해결** — 예약 필드와 충돌하지 않는 커스텀 키 `app_metadata.auth_provider`로 대체([[PHASE2_KAKAO_E2E_REPORT]] §4-6) | 낮음 — 이미 실측 검증됨. 향후 다른 커스텀 OAuth 프로바이더를 추가할 때 동일 함정을 다시 만나지 않도록 이 사례를 참고할 것 |
| 2 | `verifyOtp({ type: "magiclink" })`가 **신규 가입자의 최초 로그인에서만** `403 otp_expired`로 실패(재로그인은 우연히 통과) | `@supabase/auth-js`가 `signup`/`magiclink` 타입을 verifyOtp에서 deprecated로 취급 — 신규 사용자 생성을 동반하는 검증 경로에서 이 값이 올바르게 매칭되지 않음. 정적 타입체크로는 잡히지 않는(유니온 타입 excess-property 체크 특성) 런타임 전용 버그 | **해결** — `type: "email"`로 수정 + `token_hash`와 `email` 동시 전달 제거([[PHASE2_KAKAO_E2E_REPORT]] §4) | 낮음 — 실제 Supabase 프로젝트 대상으로 신규/재로그인 양쪽 재검증 완료. 발견 못 했다면 신규 가입자 100% 로그인 실패라는 심각한 결함이었음 |
| 3 | `nickname` 필수/선택 문서 충돌 | [[DATABASE_SCHEMA]]/`0001_profiles.sql`(`nickname NOT NULL`)과 `lib/auth/profile.ts`(항상 필수 검증)가 이미 확정되어 있는데, Phase2-5 지시문은 `nickname`을 "선택"으로 서술 | **해결(우회)** — Schema/서비스 코드를 바꾸지 않고, 온보딩 폼에서 카카오 닉네임을 기본값으로 미리 채워 "사용자가 보통 아무것도 새로 입력하지 않아도 되는" 방식으로 절충([[PHASE2_ONBOARDING_REPORT]] §0) | **있음** — 진짜로 "선택"으로 만들려면 `0001`을 건드리지 않는 신규 migration + `parseProfileCreateInput` 수정이 필요, 별도 승인 Task 필요([[PHASE2_ONBOARDING_REPORT]] §6-4) |
| 4 | `proxy.ts`에서 `profileExists()` 재사용 지시와 "service_role 절대 금지" 지시가 서로 충돌 | `lib/auth/profile.ts`의 `profileExists()`/`getProfile()`은 내부적으로 service_role을 사용 — [[PHASE2_AUTH_DECISION]] 자체도 Decision 1(`profileExists()`를 proxy가 쓰라고 서술)과 Decision 4("proxy에서 service_role 절대 금지")가 서로 다른 방향을 가리키고 있었음 | **해결** — Decision 4(더 강한 보안 원칙)를 우선해 `profileExists()`를 호출하지 않고, `profiles_select_own` RLS가 유지되어 있음을 활용해 이미 쓰는 anon 클라이언트로 동등한 조회를 수행([[PHASE2_PROXY_REPORT]] §0) | 낮음 — 실제 Middleware 컨텍스트에서 `next/headers` 기반 anon 클라이언트가 정상 동작함을 실측 확인 완료 |
| 5 | RLS 테스트 방법론 문제(PostgREST의 `200+[]`/`204`가 "성공"과 "RLS 차단"을 구분하지 못함) | PostgREST는 RLS로 행이 필터링되어 0건인 경우와 실제로 데이터가 없는 경우를 동일하게 응답하고, `Prefer: return=representation` 없이는 UPDATE/DELETE의 0행 변경도 성공과 동일하게 `204`를 반환 | **해결** — `profiles` UPDATE 테스트에서 실제로 이 함정에 걸렸다가 `Prefer` 헤더 + service_role 재조회로 재검증. 데이터가 0건이던 4개 공개 테이블은 임시 픽스처를 심어 재확인([[PHASE2_RLS_REAL_USER_TEST_REPORT]] §4-1) | 낮음 — RLS 정책 자체의 결함이 아니라 검증 절차상의 교훈. 향후 같은 종류의 RLS 검증(예: Phase4 이후 신규 테이블)에서 이 방법을 재사용할 것 |

---

## 5. 남은 BACKLOG 정리 (Phase2 관련만)

| 항목 | 내용 | 근거 문서 |
|---|---|---|
| `next` 파라미터로 로그인 후 원래 페이지 복귀 미구현 | `proxy.ts`가 `/login?next=<경로>`를 붙이지만, OAuth 콜백이 이 값을 왕복시키지 않아 로그인 후 항상 `/`(또는 `/onboarding`)로만 이동한다. OAuth 콜백 수정이 필요해 [[PHASE2_PROXY_REPORT]] Task 범위 밖으로 남김 | [[PHASE2_PROXY_REPORT]] §5 |
| 실제 카카오 브라우저 E2E 테스트 미완료 | 이 실행 환경에 브라우저가 없어 실제 카카오 계정으로 동의 화면을 완료하는 전체 왕복은 한 번도 실측하지 못했다. 세션 발급 이후 전체 로직은 카카오 API를 우회해 실측했지만, "카카오 서버가 실제 code를 accept하는지" 자체는 사람이 브라우저로 1회 수동 확인해야 한다 | [[PHASE2_KAKAO_E2E_REPORT]] §3, §6 |
| 이메일 로그인 fallback 미구현 | [[DATABASE_SCHEMA]] §2/[[EXECUTION_PLAN]] Phase2가 "카카오 장애 시 폴백"으로 계획한 이메일/비밀번호 로그인이 아직 구현되지 않았다. 카카오 로그인만으로 Phase2를 완료했다 | [[PHASE2_AUTH_ARCHITECTURE_AUDIT]] §1.1, [[EXECUTION_PLAN]] Phase2 §5 |
| `notifications`/`notification_deliveries` 컬럼 단위 제약 한계 (기존 [[BACKLOG]] F8) | `notifications_update_own` RLS가 "본인 소유 행"까지만 강제하고 "`is_read`만 수정 가능"은 정책 레벨에서 강제하지 못함(OLD/NEW 컬럼 비교는 트리거 전용). Phase2 범위에서 재검증하지 않았고 기존 기록 그대로 유효 | [[BACKLOG]] F8, `0008_rls_policies.sql` 주석 |
| `/mypage`·`/dream-journal`·`/notifications` 실제 페이지 미구현 | `proxy.ts`가 경로를 보호하지만 실제 콘텐츠 페이지는 아직 없다(각각 Phase9/Phase4/Phase6 이후 범위) | [[PHASE2_PROXY_REPORT]] §5 |
| 전용 로그인 페이지 최소 구현 상태 | `app/login/page.tsx`는 카카오 로그인 링크만 있는 최소 페이지 — [[EXECUTION_PLAN]] Phase3(공통 UI)에서 `LoginButton`/`Header`와 함께 정식 디자인이 입혀질 예정 | [[PHASE2_PROXY_REPORT]] §1 |
| `lib/supabase/service.ts`의 "Client Component import 금지"가 런타임 가드로만 강제됨 | ESLint 규칙 등 정적 강제 장치가 없어 코드 리뷰에만 의존 | [[PHASE2_AUTH_FOUNDATION_IMPLEMENTATION_REPORT]] §5-3 |

---

## 6. Validation

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 16개 테스트 통과(변경 없음) |
| `npm run build` | 통과 |

이번 Task는 코드를 변경하지 않았으므로 위 결과는 [[PHASE2_RLS_REAL_USER_TEST_REPORT]] 시점과 동일하다 — 문서 작업만으로 빌드/테스트에 영향이 없음을 재확인한 것이다.

---

## 7. Phase2 Ready 여부

**Ready.** [[EXECUTION_PLAN]] Phase2가 목표한 "카카오로 로그인/로그아웃이 되는 앱"(로그아웃 제외 — 아래 참조) 중 로그인·세션 유지·profile 생성·온보딩·경로 보호·RLS 실사용자 검증까지 전부 실제 Supabase 프로젝트를 대상으로 실측 완료했다. Decision 1~4 전부 실제 구현과 일치하며, 발견된 5개 문제 중 4개는 완전히 해결했고 1개(`nickname` 필수/선택 불일치)는 근본 해결에는 별도 승인이 필요한 우회 조치로 남아있다(§4-3, 위험도 낮음 — 실사용에 지장 없음).

**로그아웃은 이번 Phase2 범위에서 구현되지 않았다** — [[EXECUTION_PLAN]] Phase2 §5 8단계 중 하나였으나, 실제 진행된 9개 Task([[PHASE2_AUTH_FOUNDATION_IMPLEMENTATION_REPORT]]~[[PHASE2_RLS_REAL_USER_TEST_REPORT]]) 어디에도 로그아웃 라우트가 포함되지 않았다. Phase3 착수 전 반드시 짚어야 할 항목으로 남긴다(§5에 없던 항목이라 별도로 강조).

**갱신(2026-08-06, Phase2-8 — [[PHASE2_LOGOUT_IMPLEMENTATION_REPORT]])**: 위 로그아웃 누락 항목을 해소했다. `lib/auth/logout.ts`(`supabase.auth.signOut()`, service_role 미사용) + `POST /api/auth/logout`을 신규 구현하고, 실제 Supabase 프로젝트 대상으로 "로그아웃 후 세션 쿠키 삭제·refresh token 서버 측 폐기·보호 경로 재차단"까지 실측 확인했다. Phase2는 이 갱신을 포함해 최종적으로 완료 상태다.
