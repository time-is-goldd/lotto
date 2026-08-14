# PHASE2-3 KAKAO OAUTH POC — 구현 보고서

> [[PHASE2_AUTH_DECISION]] Decision 2(REST API + Admin API 방식)와 Decision 1(profile 생성은 API Route + service_role, placeholder 데이터 금지)을 실제 코드로 검증한 결과 기록이다. 목적은 "카카오 OAuth → Supabase 인증" 흐름이 현재 아키텍처에서 기술적으로 동작하는지 확인하는 것이며, 회원가입 UI·온보딩 화면·실제 서비스 UX는 만들지 않는다.

---

## 0. 착수 전 확인한 충돌 — `birth_date` 처리 방식

구현 착수 전 [[PHASE2_AUTH_DECISION]]을 재검토하는 과정에서, 이번 Task 지시문의 "profile 없으면 `createProfile()` 호출"이 Decision 1과 정면으로 충돌하는 지점을 발견했다: 카카오 기본 동의항목(닉네임·프로필)만으로는 `profiles.birth_date`(NOT NULL)를 채울 수 없는데, Decision 1은 placeholder 값으로 미완성 행을 만드는 것을 이미 명시적으로 금지했다.

구현을 시작하기 전에 사용자에게 확인했고, **"온보딩 대기 상태로 처리"**(로그인은 성공시키되 `createProfile()`은 호출하지 않고, profile 부재를 "온보딩 필요" 상태로 남긴다)로 결정했다. 이 결정에 따라 아래 §4의 Profile 연동 방식을 구현했다 — 지시문 원문의 "없으면 createProfile() 호출"을 문자 그대로 따르지 않은 유일한 지점이며, 그 이유를 여기 명시적으로 기록한다.

---

## 1. 생성/수정 파일

| 파일 | 종류 | 내용 |
|---|---|---|
| `lib/auth/kakao.ts` | 신규 | 카카오 REST API 연동(authorize URL, 토큰 교환, 사용자 조회) + Supabase 세션 발급 |
| `lib/auth/kakao.test.ts` | 신규 | 순수 함수(`deriveKakaoSyntheticEmail`/`buildKakaoAuthorizeUrl`/`getKakaoRedirectUri`) 단위 테스트 |
| `app/api/auth/kakao/login/route.ts` | 신규 | 카카오 로그인 개시(CSRF state 쿠키 발급) |
| `app/api/auth/kakao/callback/route.ts` | 신규 | Authorization Code → Access Token → 사용자 정보 → Supabase 세션 |
| `lib/auth/index.ts` | 수정 | `export * from "./kakao"` 추가 |
| `docs/PHASE2_KAKAO_POC_REPORT.md` | 신규 | 본 보고서 |

Migration/schema/RLS 변경 없음. 온보딩 화면·이메일 로그인·회원가입 UI 없음. `lib/auth/profile.ts`·`lib/auth/session.ts`·`lib/supabase/*`는 이번 Task에서 수정하지 않았다(그대로 재사용).

---

## 2. OAuth Flow 설명

```
사용자가 /api/auth/kakao/login 접속
  ↓
state(UUID) 생성 → httpOnly 쿠키 저장 → kauth.kakao.com/oauth/authorize로 307 리다이렉트
  ↓ (카카오 로그인 페이지에서 사용자가 동의 — 이 환경에서는 재현 불가, §5 참조)
카카오가 /api/auth/kakao/callback?code=...&state=...로 리다이렉트
  ↓
state 쿠키와 쿼리 state 일치 확인(CSRF 방지) — 즉시 쿠키 삭제(1회용)
  ↓
exchangeKakaoCodeForToken(code) — kauth.kakao.com/oauth/token, KAKAO_REST_API_KEY+CLIENT_SECRET 사용
  ↓
fetchKakaoUserProfile(access_token) — kapi.kakao.com/v2/user/me, 닉네임/카카오 고유 id 획득
  ↓
establishKakaoSupabaseSession(kakaoUser)
  ├─ deriveKakaoSyntheticEmail(kakaoId) — 결정론적 합성 이메일 생성
  ├─ admin.auth.admin.generateLink({ type: "magiclink", email }) — 없으면 생성, 있으면 기존 사용자 반환
  ├─ admin.auth.admin.updateUserById(userId, { app_metadata: { provider: "kakao", kakao_id } })
  └─ (anon 클라이언트) supabase.auth.verifyOtp(...) — 실제 세션 쿠키 발급
  ↓
getProfile(userId) — profile 존재 확인(생성은 하지 않음, §0 참조)
  ↓
/?login=success&profile=pending|ready 로 리다이렉트
```

### Supabase 세션을 발급하는 방법 (기술적 핵심)

카카오는 Supabase Auth의 기본 프로바이더가 아니라 `admin.createUser()`만으로는 로그인 세션(access/refresh token)이 자동으로 생기지 않는다. [[IMPLEMENTATION_PLAN]] §3이 언급한 "`admin.createUser`/`generateLink`로 세션 발급" 방식을 그대로 구현했다: `admin.generateLink({ type: "magiclink" })`로 매직링크 토큰을 만들고, 그 토큰을 서버가 즉시 `supabase.auth.verifyOtp()`로 직접 소비해 실제 세션을 발급한다. 사용자에게 이메일이 실제로 발송되지는 않는다 — 링크를 클릭시키는 대신 서버가 그 자리에서 토큰을 검증하는 것이라, 사용자 입장에서는 "카카오 로그인 → 즉시 로그인 완료"로 보인다.

### 이메일 없는 카카오 계정을 Supabase auth.users(이메일 기반)에 연결하는 방법

카카오 기본 동의항목은 이메일을 제공하지 않는다(이메일은 비즈니스 심사가 필요한 별도 항목). `deriveKakaoSyntheticEmail(kakaoId)`가 `kakao-{id}@users.noreply.luckplatform.local` 형태의 결정론적 합성 이메일을 만들어 `auth.users`의 식별자로 쓴다 — 실제 수신 목적이 아니라 "같은 카카오 계정 = 같은 Supabase 사용자"를 보장하는 매핑 키로만 쓰인다. 이 설계는 [[PHASE2_AUTH_DECISION]]이 명시적으로 다루지 않았던 세부사항으로, 이번 PoC에서 새로 발견/결정한 구현 디테일이다 — §6에 별도로 기록한다.

---

## 3. 생성된 Route Handler 설명

### `GET /api/auth/kakao/login`
`randomUUID()`로 CSRF `state`를 생성해 `httpOnly`/`sameSite=lax`/10분 만료 쿠키로 저장하고, 카카오 authorize URL로 307 리다이렉트한다. `client_id`(공개값)만 URL에 노출하며 `client_secret`은 이 라우트에서 전혀 쓰지 않는다.

### `GET /api/auth/kakao/callback`
1. 카카오가 `error` 파라미터를 보내면(사용자가 동의 거부 등) 즉시 `/?login=error&reason=kakao_denied`로 리다이렉트.
2. `state` 쿠키가 없거나 쿼리 `state`와 다르면 `/?login=error&reason=invalid_state`.
3. 정상이면 토큰 교환 → 사용자 조회 → Supabase 세션 발급 → profile 존재 확인 순으로 진행하고, 각 단계에서 발생한 에러는 하나의 `catch`로 모아 `server_error`로 리다이렉트한다.
4. 성공 시 `profile` 존재 여부에 따라 `/?login=success&profile=pending`(온보딩 필요) 또는 `/?login=success&profile=ready`(기존 사용자, profile 있음)로 분기한다. 두 경로 모두 별도 페이지를 새로 만들지 않고 기존 `/`(app/page.tsx)로 리다이렉트한다.
5. `state` 쿠키는 성공/실패 모든 경로에서 콜백 진입 즉시 삭제한다(1회용).

---

## 4. Profile 연동 방식

`lib/auth/profile.ts`(Phase2-2에서 이미 구현·검증됨)를 수정 없이 그대로 재사용한다.

- 세션 발급 직후 `getProfile(userId)`만 호출한다 — **`createProfile()`은 이 PoC에서 호출하지 않는다**(§0의 사용자 결정).
- profile이 있으면(재로그인 사용자) `profile=ready`로 리다이렉트 — "이미 있으면 재생성 금지" 요구사항은 애초에 생성 시도를 하지 않으므로 구조적으로 100% 충족된다.
- profile이 없으면(최초 로그인) `profile=pending`으로 리다이렉트 — [[PHASE2_AUTH_DECISION]] Decision 1이 정의한 "정상적인 온보딩 대기 상태"와 정확히 일치한다.
- `createProfile()` 자체가 실제로 동작하는지는 이 PoC의 책임이 아니다 — [[PHASE2_PROFILE_SERVICE_REPORT]]에서 12개 단위 테스트로 이미 검증되었다(idempotent 생성, 화이트리스트, 나이 계산 포함).
- `resolveProfileProvider()`(Phase2-2 구현)가 나중에 profile을 생성할 때 `provider='kakao'`로 판정하도록, `establishKakaoSupabaseSession`이 `admin.updateUserById`로 `app_metadata.provider`를 매 로그인마다 `"kakao"`로 명시적으로 설정한다(멱등적 — 몇 번을 실행해도 같은 값).

---

## 5. Validation 결과

### 정적 검증 (전부 통과)
- `npm run lint` — 통과
- `npm run type-check` — 통과
- `npm test` — **16개 테스트 통과**(신규 `kakao.test.ts` 4개 포함, 기존 12개 유지)
- `npm run build` — 통과. `/api/auth/kakao/login`, `/api/auth/kakao/callback`이 각각 동적(`ƒ`) 라우트로 정상 등록됨을 확인
- 빌드 산출물(`.next/static`)에 `SUPABASE_SERVICE_ROLE_KEY`/service_role 관련 코드가 없음을 grep으로 재확인(Phase2-1과 동일한 방식)

### 실제 서버 기동 후 라이브 검증 (`npm run dev` + `curl`)

정적 검증만으로는 부족하다고 판단해, 개발 서버를 직접 띄우고 실제 HTTP 요청으로 각 분기를 확인했다(작업 종료 후 서버는 종료함).

| 검증 항목 | 방법 | 결과 |
|---|---|---|
| `/api/auth/kakao/login` 리다이렉트 | `curl` | `307` + `Location: https://kauth.kakao.com/oauth/authorize?client_id=...&redirect_uri=...&response_type=code&state=...` 정상 생성, `httpOnly` state 쿠키 정상 발급 |
| `state` 쿠키/쿼리 둘 다 없음 | `curl` (쿠키 없이 callback 호출) | `/?login=error&reason=invalid_state`로 정상 리다이렉트 |
| 카카오가 `error` 파라미터 반환(동의 거부 등 시뮬레이션) | `curl "...?error=access_denied"` | `/?login=error&reason=kakao_denied`로 정상 리다이렉트 |
| `state` 불일치(쿠키와 쿼리 다름) | `curl` | `/?login=error&reason=invalid_state`로 정상 리다이렉트 |
| `state` 일치 + **가짜** `code`로 실제 카카오 토큰 엔드포인트 호출 | `curl` 쿠키잔 사용해 `/login`→`/callback` 왕복 재현 | 카카오 서버가 실제로 **`401`**을 반환(가짜 code 거부) → `try/catch`가 정상적으로 잡아 `/?login=error&reason=server_error`로 리다이렉트. 서버 로그에는 `"카카오 토큰 교환 실패 (status: 401)"`만 남고 **access_token/secret 등 민감정보는 전혀 로깅되지 않음**을 직접 확인 |
| 모든 케이스에서 `state` 쿠키 삭제 | `curl` 응답 헤더 확인 | 성공/실패 관계없이 `Set-Cookie: kakao_oauth_state=; Expires=...1970` 확인 |

`401` 응답은 오히려 유의미한 신호다 — 카카오 서버가 우리 앱의 `KAKAO_REST_API_KEY`/`KAKAO_CLIENT_SECRET`을 인식하고 정상적으로 "이 code는 유효하지 않다"고 응답했다는 뜻으로, **자격증명 자체는 유효하게 카카오 서버까지 도달함**을 실측으로 확인했다.

### 검증하지 못한 부분 (환경 제약)

이 실행 환경에는 브라우저가 없어 카카오 로그인 페이지에서 실제 사용자 동의를 완료할 수 없다 — 진짜 `authorization code`는 사람이 브라우저로 카카오 계정에 로그인하고 동의해야만 발급되므로, 아래 항목은 코드 검토와 타입체크로만 검증했고 실제 네트워크 호출로는 확인하지 못했다:
- `fetchKakaoUserProfile()`(실제 access_token으로 사용자 정보 조회)
- `establishKakaoSupabaseSession()`(실제 `generateLink`/`updateUserById`/`verifyOtp` 호출)
- profile 생성/조회가 실제 세션과 함께 동작하는지
- 재로그인 시 동일 사용자로 매핑되는지(실계정 기준)

---

## 6. 발견된 문제

1. **합성 이메일 전략은 [[PHASE2_AUTH_DECISION]]이 명시적으로 결정한 사항이 아니다**: Decision 2는 "REST API + Admin API 방식"만 확정했을 뿐, "이메일 없는 카카오 계정을 auth.users에 어떻게 연결하는가"는 구체적으로 다루지 않았다. `kakao-{id}@users.noreply.luckplatform.local` 패턴은 이 PoC에서 새로 도입한 구현 디테일이며, 이 도메인이 실제로 존재하지 않아도 기능상 문제는 없지만(발송 목적이 아니므로) 향후 Supabase가 이메일 형식을 더 엄격히 검증하거나, 실제 이메일 수집 정책이 바뀌면 재검토가 필요하다.
2. **§0의 `birth_date` 충돌**: 이미 위에서 설명했고 사용자 확인을 거쳐 해결했다. 다음 온보딩 Task가 시작되기 전에 [[PHASE2_AUTH_DECISION]]에 이 흐름(로그인 성공 → profile 없음 → `/onboarding`)이 명시적으로 남아있는지 재확인 권장.
3. **실제 브라우저 기반 검증 미완료**: §5에서 설명한 대로, 이 환경에서는 완결된 end-to-end 테스트가 불가능하다. 사람이 실제 카카오 계정으로 브라우저에서 `/api/auth/kakao/login`에 접속해 로그인을 완료하는 수동 검증이 여전히 필요하다.
4. **`generateLink`가 실제로 "재로그인 시 기존 사용자 반환"으로 동작하는지 실측 못함**: 코드 설계상(결정론적 합성 이메일 + Supabase의 `magiclink` 타입이 이미 존재하는 이메일에 대해 기존 사용자를 반환하는 문서화된 동작) 안전하다고 판단했지만, 실제 Supabase 프로젝트에서 이 동작을 두 번 연속 호출로 확인하지는 못했다(위와 같은 이유로 유효한 카카오 사용자 정보 없이는 이 함수에 도달할 수 없음).

---

## 7. PoC 성공 여부

지시문의 체크리스트 기준으로 정직하게 표시한다.

| 항목 | 상태 |
|---|---|
| 카카오 로그인 성공 | **부분 확인** — 리다이렉트/자격증명 도달까지 실측(§5), 실제 동의 완료는 미확인 |
| Callback 정상 실행 | **확인** — 모든 분기(성공 경로 직전까지, 거부, state 불일치, 토큰교환 실패)를 실제 HTTP 요청으로 확인 |
| 사용자 정보 조회 성공 | **미확인** — 유효한 access_token 필요, 코드 검토만 완료 |
| Supabase 사용자 확인 | **미확인** — 위와 동일한 이유 |
| Profile 자동 생성 | **의도적으로 구현하지 않음** — §0 사용자 결정에 따라 "온보딩 대기" 처리로 대체. `createProfile()` 자체의 동작은 Phase2-2에서 이미 단위 테스트로 검증됨 |
| 재로그인 시 중복 생성 없음 | **설계상 보장, 실측 안 됨** — 결정론적 이메일 + `generateLink` get-or-create 동작 + `createProfile`의 unique violation 처리 3중 방어. 실계정 재로그인으로는 미확인 |
| Session 정상 유지 | **미확인** — 세션이 발급되는 지점(`establishKakaoSupabaseSession`)까지 도달하지 못함 |

**종합: 조건부 성공(Conditional PoC).** 코드/타입/빌드 레벨의 정적 검증과, 브라우저 없이 도달 가능한 모든 분기(state 검증, 에러 처리, 실제 카카오 서버와의 자격증명 통신)는 완전히 검증했다. 아키텍처 자체("REST API + Admin API로 세션을 발급할 수 있다")가 코드로 구현 가능함은 확인했지만, 실제 카카오 계정으로 브라우저를 통해 전체 흐름이 끝까지 도는지는 이 환경의 구조적 한계로 검증하지 못했다 — **사람이 브라우저로 한 번 수동 확인하는 것을 다음 단계의 필수 조건으로 남긴다.**

---

## 8. 다음 Task 추천

1. **수동 브라우저 검증(최우선, 코드 작업 아님)**: 실제로 `http://localhost:3000/api/auth/kakao/login`에 접속해 카카오 계정으로 로그인 → `/?login=success&profile=pending`으로 돌아오는지, Supabase 대시보드에서 `auth.users`에 `kakao-{id}@users.noreply...` 이메일의 사용자가 생성됐는지 직접 확인. 이 확인 없이는 이번 PoC가 "성공"이라고 최종 결론 내릴 수 없다.
2. **이메일 로그인 연결** — [[PHASE2_AUTH_FOUNDATION_IMPLEMENTATION_REPORT]]가 이미 권장한 순서. 더 단순한 경로로 세션/쿠키 흐름을 한 번 더 검증.
3. **온보딩 화면(`birth_date` 입력)** — `profile=pending`으로 돌아온 사용자가 실제로 도달할 화면. `POST /api/profile`(이미 구현됨)을 호출하는 첫 실제 클라이언트가 된다.
4. **`proxy.ts` 보호 로직** — `profileExists()`(이미 구현됨, [[PHASE2_PROFILE_SERVICE_REPORT]] §5)를 실제로 소비하는 첫 지점. `/my/*` 등 보호 경로 접근 시 "로그인했지만 profile 없음"을 감지해 온보딩으로 보낸다.
5. **[[BACKLOG]] 항목 E(RLS 실사용자 테스트)** — 항목 1의 수동 검증으로 실제 로그인 계정이 처음 생기는 시점부터 가능해진다.
