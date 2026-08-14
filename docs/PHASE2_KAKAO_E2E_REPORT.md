# PHASE2-4 KAKAO OAUTH E2E 검증 보고서

> [[PHASE2_AUTH_DECISION]]·[[PHASE2_KAKAO_POC_REPORT]]·[[PHASE2_PROFILE_SERVICE_REPORT]]에서 구현된 카카오 OAuth 인증 구조가 실제 환경(실제 Supabase 프로젝트)에서 설계대로 동작하는지 검증하고, 발견된 문제를 최소 수정한 결과 기록이다. 새 기능 구현이 아니며, Architecture/Schema/Migration 변경 없음.

---

## 0. 검증 방법과 환경 제약

이 실행 환경에는 브라우저가 없어 카카오 로그인 동의 화면에서 실제 사용자 동의를 완료할 수 없다([[PHASE2_KAKAO_POC_REPORT]] §5가 이미 기록한 동일한 한계). 이번 Task에서는 이 한계를 다음 방법으로 최대한 좁혔다.

- **①②③(로그인 버튼→카카오 동의 화면→callback 도달) 중 코드로 검증 가능한 부분**: `npm run dev` + `curl`로 `/api/auth/kakao/login`의 리다이렉트/state 쿠키, `/api/auth/kakao/callback`의 CSRF·에러 분기(state 불일치, 카카오 거부)를 실제 HTTP 요청으로 재확인했다. [[PHASE2_KAKAO_POC_REPORT]] §5와 동일한 결과.
- **④~⑨(Supabase 세션 발급 이후 전체)**: `establishKakaoSupabaseSession()`(카카오 REST API를 호출하지 않고 `{id, nickname}`만 받는 함수)를 실제 Route Handler 컨텍스트에서 호출하는 **임시 검증용 라우트**를 만들어, `.env.local`에 설정된 실제 Supabase 프로젝트(`qsvlqoqgkqpuaolkdhhl.supabase.co`)를 대상으로 세션 발급·`auth.users` 생성·재로그인·중복 생성 여부를 실측했다. 검증에 사용한 라우트는 **작업 완료 후 삭제했다** — 최종 코드베이스에는 남아있지 않다(§1 참조).
- 사용자에게 "실제 프로젝트에 합성 테스트 사용자를 만들었다가 검증 후 삭제하는 방식"으로 진행 여부를 사전에 확인받았다.
- **카카오 REST API 자체(토큰 교환/사용자 정보 조회 응답 파싱)는 이번에도 실측하지 못했다** — 유효한 `code`/`access_token`을 얻으려면 사람이 브라우저로 카카오 계정에 로그인해야 하기 때문이다. 이 부분은 §6 "남은 리스크"에 그대로 남는다.

---

## 1. 생성/수정 파일

| 파일 | 종류 | 내용 |
|---|---|---|
| `lib/auth/kakao.ts` | 수정 | `establishKakaoSupabaseSession()`의 버그 3건 수정(§4·§5) |
| `lib/auth/session.ts` | 수정 | `resolveProfileProvider()`가 `app_metadata.provider` 대신 `app_metadata.auth_provider`를 읽도록 수정(§5) |
| `docs/PHASE2_KAKAO_E2E_REPORT.md` | 신규 | 본 보고서 |

검증 과정에서 임시로 만들었던 라우트(`app/api/_debug/kakao-test`, `app/api/e2etest/kakao-test`, `app/api/e2etest2`)와 임시 쿠키/응답 파일은 검증 완료 후 전부 삭제했다 — `git status`에 흔적이 남지 않는다. Migration/schema 변경 없음. 온보딩·이메일 로그인·새 기능 없음.

---

## 2. 실제 로그인 검증 결과 (체크리스트 기준)

| # | 항목 | 결과 | 방법 |
|---|---|---|---|
| ① | 로그인 버튼 클릭 → 카카오 동의 화면 이동 | **확인** | `curl`로 `/api/auth/kakao/login` 호출 → `307` + `https://kauth.kakao.com/oauth/authorize?client_id=...&redirect_uri=...`로 정상 리다이렉트, `client_id`가 실제 `KAKAO_REST_API_KEY`와 일치 |
| ② | CSRF(state) | **확인** | state 쿠키 없음/불일치 → `invalid_state`로 즉시 리다이렉트. 카카오 `error` 파라미터(동의 거부) → `kakao_denied`로 즉시 리다이렉트 |
| ③ | redirect_uri / callback URL | **확인** | `getKakaoRedirectUri()`가 `NEXT_PUBLIC_SITE_URL`(`http://localhost:3000`) 기준으로 정확히 생성, authorize URL의 `redirect_uri`와 일치 |
| — | token 교환 / 사용자정보 조회 | **미확인(환경 제약)** | 실제 카카오 `code`가 필요해 브라우저 없이는 도달 불가. [[PHASE2_KAKAO_POC_REPORT]]가 이미 확인한 "가짜 code로 카카오 서버가 401 반환"까지는 재확인 가능하나, 성공 응답 파싱 자체는 이번에도 미검증 |
| ④ | Supabase Auth User 생성 여부 | **확인(버그 발견 후 수정, 실제 프로젝트 실측)** | 합성 카카오 사용자로 `establishKakaoSupabaseSession()` 호출 → `auth.users`에 `kakao-{id}@users.noreply.luckplatform.local` 사용자 실제 생성 확인(Admin API로 직접 조회) |
| ⑤ | Session Cookie 정상 생성 | **확인** | 실제 콜백 라우트와 동일한 형태(`cookies()` 기반 세션 설정 + `NextResponse.redirect()` 반환)를 재현해 `Set-Cookie: sb-...-auth-token=...`이 리다이렉트 응답에 정상적으로 실림을 확인. 이 쿠키로 `GET /api/profile`을 호출해 세션이 실제로 유지됨(401이 아니라 404/200)도 확인 |
| ⑥ | `app_metadata.provider == "kakao"` | **버그 발견 → 설계 변경으로 수정**(§4-3, §5) | 최초 구현은 항상 `"email"`로 남아 요구사항을 충족하지 못했다. `app_metadata.auth_provider`로 대체해 `"kakao"`가 안정적으로 저장/조회됨을 확인 |
| ⑦ | profile 조회 | **확인** | 세션 발급 직후 `getProfile()` → `null`(정상, [[PHASE2_AUTH_DECISION]] Decision 1의 "온보딩 대기" 상태) |
| ⑧ | profile 없으면 온보딩 대기 처리 | **확인** | 콜백 라우트는 이미 `/?login=success&profile=pending`으로 분기하도록 구현되어 있었다(변경 없음) — `GET /api/profile`도 `404 PROFILE_NOT_FOUND`로 일관되게 응답 |
| ⑨ | 재로그인 → 동일 `auth.users` 재사용, 중복 생성 없음 | **확인(버그 수정 후 실제 프로젝트 실측)** | 동일 카카오 id로 `establishKakaoSupabaseSession()`을 3회 이상 반복 호출해도 항상 같은 `userId` 반환. Admin API `listUsers()`로 해당 합성 이메일 사용자 수가 정확히 1임을 확인 |
| — | `POST /api/profile` 중복 생성 방지 | **확인(부가 검증)** | 세션 발급 후 `POST /api/profile`로 최초 생성(`201`, `provider: "kakao"` 정상 저장) → 동일 세션으로 재요청 시 `409 PROFILE_ALREADY_EXISTS` |
| — | 로그아웃 후 재로그인 | **부분 확인** | 별도 로그아웃 라우트가 없어(이번 Task 범위 밖, 새 기능 추가 금지) 실제 `signOut()` 흐름은 재현하지 않았다. 대신 "세션 쿠키 없이 동일 카카오 계정으로 다시 로그인"을 반복해 동일 사용자로 재수렴함을 확인했고, 이는 로그아웃 여부와 무관하게 성립하는 더 강한 조건이다 |

---

## 3. 브라우저 검증 캡처

이 환경에는 브라우저 자동화 도구가 없어 스크린샷은 남길 수 없다. 대신 §2의 모든 항목을 실제 HTTP 요청/응답(`curl`)과 실제 Supabase Admin API 조회 결과로 실측했다 — 캡처 대신 실제 서버·DB 레벨의 원시 증거(HTTP 상태 코드, `Set-Cookie` 헤더, `auth.users` 조회 결과)를 근거로 남긴다.

**사람이 반드시 한 번 확인해야 하는 부분(변경 불가능한 환경 제약)**: 실제 카카오 계정으로 브라우저에서 `http://localhost:3000/api/auth/kakao/login`에 접속해 동의 화면을 완료하고 `/?login=success&profile=pending`으로 돌아오는지 확인. 이번 Task로 그 이후 모든 단계(세션 발급~프로필 처리)가 실제 인프라 대상으로 검증되었으므로, 남은 미확인 구간은 "카카오 서버가 우리 code를 accept하는지"뿐이다.

---

## 4. 발견된 문제

이번 검증 중 발견된 문제는 모두 코드 레벨 버그이며, 이전 PoC([[PHASE2_KAKAO_POC_REPORT]])가 "브라우저 없이는 도달 불가"로 표시했던 구간(§5 "검증하지 못한 부분")에 정확히 숨어 있었다 — 정적 검증(`lint`/`type-check`/`test`/`build`)은 전부 통과했음에도 실제 Supabase 프로젝트에 대해 실행하기 전까지 드러나지 않았다.

1. **`verifyOtp()`에 `token_hash`와 `email`을 동시에 전달 → 항상 실패**
   - 증상: `establishKakaoSupabaseSession()`이 매번 `AuthApiError: Only the token_hash and type should be provided (400 validation_failed)`로 실패.
   - 원인: Supabase GoTrue의 `/verify` 엔드포인트는 `token_hash` 기반 검증과 `email+token` 기반 검증을 상호 배타적으로 취급한다. 기존 코드는 `{ type, token_hash, email }`을 한 번에 보냈다.
   - TypeScript가 못 잡은 이유: `verifyOtp`의 파라미터 타입은 `VerifyEmailOtpParams | VerifyTokenHashParams` 유니온인데, `email`은 전자에 존재하고 `token_hash`는 후자에 존재해 "유니온의 어느 한쪽에는 존재하는 속성"이라 TypeScript의 excess-property 체크를 통과한다 — 정적 타입체크로는 원천적으로 잡을 수 없는 조합이었다.

2. **`verifyOtp({ type: "magiclink" })`는 신규 사용자에서만 실패(재로그인은 통과)**
   - 증상: 문제 1을 고친 뒤에도, **브랜드 뉴 카카오 사용자의 최초 로그인**에서만 `AuthApiError: Email link is invalid or has expired (403 otp_expired)`가 발생했다. 이미 존재하는 사용자의 재로그인은 문제없이 통과해, 겉보기엔 "가끔 실패하는 문제"처럼 보였다.
   - 원인: `@supabase/auth-js`의 `verifyOtp` 문서는 "`signup`과 `magiclink` 타입은 deprecated"라고 명시하며, 이메일 기반 검증에 권장되는 값은 `email`/`recovery`/`invite`/`email_change`뿐이다. 신규 사용자 생성을 동반하는 `generateLink({ type: "magiclink" })` 직후의 검증에서는 deprecated 값 `"magiclink"`가 내부적으로 올바르게 매칭되지 않아 "만료됨"으로 오인되는 것으로 보인다. 만약 이 버그를 놓쳤다면 **모든 신규 카카오 사용자의 최초 로그인이 실패**하고 기존 사용자만 로그인이 되는, 신규 가입자 100% 실패라는 심각한 결과로 이어졌을 것이다.

3. **`app_metadata.provider`는 GoTrue가 자동 재계산하는 예약 필드라 덮어쓸 수 없음**
   - 증상: `admin.updateUserById(userId, { app_metadata: { provider: "kakao", ... } })`를 호출해도, 이후 세션 JWT와 DB의 `app_metadata.provider`가 항상 `"email"`로 남았다(단, 같은 호출에 포함된 `kakao_id` 같은 커스텀 키는 정상적으로 저장됨).
   - 원인: GoTrue는 `app_metadata.provider`/`app_metadata.providers`를 해당 사용자의 `auth.identities` 테이블 내용으로부터 자동 재계산하는 시스템 예약 필드로 취급한다. 우리 구조에서는 이메일(매직링크) identity로 사용자를 만들기 때문에 이 필드가 항상 `"email"`로 고정된다.
   - 영향: `lib/auth/session.ts`의 `resolveProfileProvider()`는 정확히 이 필드를 읽어 `profiles.provider`를 결정하는데, 항상 `"email"`을 읽게 되어 **모든 카카오 로그인 사용자의 profile이 `provider: "email"`로 잘못 생성**되는 데이터 무결성 문제였다. `npm test`의 단위 테스트는 이 함수를 실제 Supabase 응답 없이 목(mock) 없이 호출한 적이 없어 잡아내지 못했다.

---

## 5. 수정 내용 (모두 `lib/auth/kakao.ts` / `lib/auth/session.ts` 국소 수정, 아키텍처·스키마 변경 없음)

1. `verifyOtp()` 호출에서 `email` 필드를 제거하고 `{ type, token_hash }`만 전달.
2. `verifyOtp()`의 `type`을 `"magiclink"` → `"email"`로 변경.
3. `admin.updateUserById()`가 설정하는 커스텀 필드명을 `app_metadata.provider` → `app_metadata.auth_provider`로 변경(예약 필드와 충돌하지 않는 이름). `lib/auth/session.ts`의 `resolveProfileProvider()`도 동일하게 `app_metadata.auth_provider`를 읽도록 수정. 여전히 `app_metadata`이므로 service_role만 쓸 수 있고 클라이언트 세션(`user_metadata`)으로는 위조할 수 없다 — [[PHASE2_AUTH_DECISION]] Decision 3·4가 요구하는 보안 불변식은 그대로 유지된다.

수정 후 동일한 실제 Supabase 프로젝트를 대상으로 신규 사용자 3명·재로그인 2회·profile 생성/중복 방지를 모두 재검증했고(§2), 전부 통과했다. 검증에 사용한 모든 합성 테스트 사용자(`auth.users`)와 profile 행은 검증 완료 즉시 삭제했다 — 실제 프로젝트에 테스트 데이터가 남아있지 않음을 `listUsers()` 재조회로 확인했다.

---

## 6. 남은 리스크

1. **카카오 REST API 응답 자체(토큰 교환 성공 응답, 사용자 정보 조회 응답 파싱)는 여전히 미검증**이다. `exchangeKakaoCodeForToken()`/`fetchKakaoUserProfile()`는 코드 검토로만 확인했다. 사람이 브라우저로 실제 카카오 계정 로그인을 1회 완주하는 것이 이 리스크를 제거하는 유일한 방법이다(§3).
2. **"로그아웃 후 재로그인"의 진짜 `signOut()` 경로는 이번에도 검증하지 못했다** — 로그아웃 라우트가 아직 없다(이번 Task 범위 밖). 세션 없이 재로그인하는 것으로 대체 검증했으나, 실제 `signOut()`이 리프레시 토큰을 서버에서 무효화하는지는 별도 확인이 필요하다.
3. **합성 이메일 전략(`kakao-{id}@users.noreply.luckplatform.local`)은 여전히 [[PHASE2_AUTH_DECISION]]이 명시적으로 승인한 사항이 아니다** — [[PHASE2_KAKAO_POC_REPORT]] §6이 이미 기록한 리스크가 그대로 유지된다.
4. **`generateLink`/Admin API 호출은 Supabase의 인증 관련 요청 빈도 제한(rate limit) 대상일 가능성이 있다.** 이번 검증 중 짧은 시간에 여러 번 반복 호출했을 때는 문제가 없었지만, 실제 서비스 트래픽 규모(동시 다발적 신규 가입)에서 이 제한에 부딪히는지는 별도로 관찰이 필요하다 — 이번 Task 범위(코드 최소 수정) 밖의 운영 이슈다.
5. `docs/BACKLOG.md` 항목 E(RLS 실사용자 테스트)는 이제 실제로 로그인 가능한 계정이 생겼으므로 착수 가능해졌다 — 다음 단계로 권장.

---

## 7. Validation

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 16개 테스트 통과(기존 그대로, 이번 수정으로 깨진 테스트 없음) |
| `npm run build` | 통과. `/api/auth/kakao/login`, `/api/auth/kakao/callback`, `/api/profile`만 동적 라우트로 등록됨(검증용 임시 라우트는 삭제되어 빌드 산출물에 없음) |
| 빌드 산출물에 `SUPABASE_SERVICE_ROLE_KEY` 노출 여부 | `grep`으로 재확인, 0건 |
| 실제 Supabase 프로젝트 대상 라이브 검증 | §2 표 참조 — 최초/재로그인/profile 생성/중복방지/세션유지 전부 실측 통과, 테스트 데이터는 검증 후 전량 삭제 확인 |

---

## 8. Ready 여부

**조건부 Ready.** 이번 Task의 핵심 발견은 "실제 Supabase 프로젝트에 대해 실행하기 전까지는 드러나지 않는 버그 3건"이었고, 전부 수정 및 재검증을 완료했다 — 특히 문제 2(신규 사용자 최초 로그인 100% 실패)와 문제 3(모든 카카오 사용자의 profile.provider가 잘못 저장됨)는 발견하지 못했다면 실서비스 오픈 직후 드러날 심각한 결함이었다. 이 세 버그를 수정한 뒤에는 로그인 세션 발급, `auth.users` 생성, `app_metadata` 저장, 세션 유지, 재로그인 시 동일 사용자 재사용, 중복 생성 방지까지 실제 인프라 대상으로 확인되었다.

유일하게 남은 미확인 구간은 "카카오 서버와의 실제 왕복"(브라우저로 동의 화면을 완료하는 것)이며, 이는 이 실행 환경의 구조적 한계로 코드를 아무리 검토해도 없앨 수 없는 리스크다. **다음 단계로, 사람이 브라우저에서 실제 카카오 계정으로 `/api/auth/kakao/login` → 동의 → `/?login=success&profile=pending` 도달까지 1회 수동 확인하는 것을 최종 승인 조건으로 남긴다.** 그 확인이 끝나면 온보딩 화면(§[[PHASE2_KAKAO_POC_REPORT]] 다음 Task 추천 3번) 착수가 가능하다.
