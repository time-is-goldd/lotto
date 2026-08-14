# PHASE2-8 LOGOUT IMPLEMENTATION & AUTHENTICATION UX FOUNDATION 보고서

> [[PHASE2_COMPLETION_REPORT]]가 발견한 누락 항목(로그아웃 미구현)을 해소하고, Phase3(공통 UI) 착수 전 필요한 최소 인증 UX 기반을 정리한 결과다. Migration/Schema/RLS/`DATABASE_SCHEMA.md`/OAuth Flow/카카오 구현/Profile 생성 방식은 전혀 수정하지 않았다.

---

## 1. 생성/수정 파일

| 파일 | 종류 | 내용 |
|---|---|---|
| `lib/auth/logout.ts` | 신규 | `logout()` — anon 세션 기반 `supabase.auth.signOut()` 래퍼. service_role 미사용 |
| `app/api/auth/logout/route.ts` | 신규 | `POST /api/auth/logout` — `logout()` 호출 후 `{ success: true }` 반환 |
| `lib/auth/index.ts` | 수정 | `export * from "./logout"` 추가 |
| `docs/PHASE2_LOGOUT_IMPLEMENTATION_REPORT.md` | 신규 | 본 보고서 |

`getCurrentUser()`(`lib/auth/session.ts`), `proxy.ts`, `lib/auth/profile.ts`, OAuth 라우트는 검토만 하고 수정하지 않았다(§2 참조 — 충돌 없음, 보완 불필요로 판단).

---

## 2. Logout Architecture

```
클라이언트(향후 Phase3 Header의 "로그아웃" 버튼)
  │  fetch("/api/auth/logout", { method: "POST" })
  ▼
app/api/auth/logout/route.ts (POST)
  │  lib/auth/logout.ts의 logout() 호출
  ▼
lib/auth/logout.ts
  │  lib/supabase/server.ts의 createClient()(anon key + 쿠키, service_role 아님)
  │  supabase.auth.signOut() — GoTrue에 현재 리프레시 토큰 무효화 요청
  ▼
응답에 Set-Cookie: sb-<ref>-auth-token=; Max-Age=0 (세션 쿠키 삭제)
  │
  ▼
{ "success": true } 반환 — 페이지 이동은 호출부(클라이언트)가 수행
```

- **service_role 미사용**: `lib/auth/logout.ts`는 `lib/supabase/server.ts`(anon key)만 import한다. `lib/supabase/service.ts`는 어디서도 참조하지 않는다 — grep으로 재확인.
- **현재 사용자 session 기반**: 별도 `userId` 파라미터를 받지 않는다. 항상 "이 요청의 쿠키에 담긴 세션"만 대상으로 한다 — 다른 사용자를 강제 로그아웃시키는 관리자 기능이 아니다.
- **`supabase.auth.signOut()` 사용**: 직접 쿠키를 지우거나 세션 테이블을 조작하지 않고, Supabase SDK의 표준 로그아웃 API만 사용한다([[AI_ENGINEERING_CONSTITUTION]] §11 "세션 토큰을 로컬스토리지에 직접 다루지 않고 Supabase SDK/쿠키 관리에 위임").
- **기존 패턴과의 일관성**: `app/api/profile/route.ts`/`app/onboarding/OnboardingForm.tsx`와 동일하게, API Route는 JSON만 반환하고 라우팅(리다이렉트/새로고침)은 호출부 책임으로 남긴다 — 상태 변경 요청이라 GET이 아니라 POST로 노출한 것도 기존 원칙([[AI_ENGINEERING_CONSTITUTION]] §11 CSRF)과 동일.

---

## 3. 기존 인증 구조와 연결 방식

| 기존 구성요소 | 로그아웃과의 관계 |
|---|---|
| `lib/supabase/server.ts`(anon 클라이언트) | `logout()`이 그대로 재사용. 새 클라이언트 생성 로직 없음 |
| `lib/auth/session.ts`의 `getCurrentUser()` | 로그아웃 이후 이 함수가 `null`을 반환하는지로 검증(§4). 수정하지 않음 |
| `proxy.ts` | 로그아웃 후 세션 쿠키가 사라지므로, 기존 "비로그인 → `/login?next=`" 분기가 그대로 작동. `proxy.ts`를 수정하지 않아도 로그아웃이 보호 경로 차단에 자연히 반영됨을 확인(§4) |
| `lib/auth/profile.ts`(`getProfile`/`profileExists`) | 로그아웃과 직접적인 상호작용 없음(세션이 없으면 어차피 `getCurrentUser()`가 먼저 `null`을 반환해 이 함수들이 호출될 일이 없음) |

**충돌 없음.** §2에서 설명한 대로 `logout()`은 기존 anon 클라이언트/쿠키 체계만 사용하고, `proxy.ts`/`getCurrentUser()`/`profile` 조회 로직 중 어떤 것도 수정할 필요가 없었다 — 로그아웃이 "세션 쿠키를 지운다"는 한 가지 사실만 추가하면 나머지 보호 로직은 이미 그 사실에 맞춰 동작하도록 설계돼 있었다([[PHASE2_PROXY_REPORT]]).

---

## 4. Validation 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 16개 테스트 통과(기존 그대로) |
| `npm run build` | 통과. `/api/auth/logout`이 동적 라우트로 정상 등록 |
| 빌드 산출물에 `SUPABASE_SERVICE_ROLE_KEY` 노출 여부 | `grep` 재확인, 0건 |

### 실제 검증 (`npm run dev` + `curl`, 실제 Supabase 프로젝트 대상)

카카오 API를 호출하지 않고 `establishKakaoSupabaseSession()`(기존 코드, [[PHASE2_KAKAO_E2E_REPORT]]에서 이미 검증된 방법)으로 세션을 발급하는 임시 검증용 라우트를 사용했다. 검증 후 라우트와 테스트 계정은 전량 삭제.

**① 로그인 상태에서 logout 호출**

| 확인 | 결과 |
|---|---|
| 로그아웃 전 보호 페이지(`/onboarding`) 접근 | `200`(정상 통과) |
| `POST /api/auth/logout` 응답 | `200 { "success": true }`, `Set-Cookie: sb-...-auth-token=; Max-Age=0` |
| 로그아웃 후 같은 쿠키로 `/onboarding` 접근 | `307` → `/login?next=%2Fonboarding`(차단) |
| 로그아웃 후 같은 쿠키로 `GET /api/profile` | `401 UNAUTHORIZED` |
| (심층 검증) 로그아웃 전 추출한 **원본 refresh_token**으로 새 access_token 발급 시도 | `400 refresh_token_not_found` — 세션이 서버 측에서 실제로 폐기됨을 확인(단순 쿠키 삭제가 아니라 진짜 로그아웃) |

**② 로그아웃 상태에서 보호 페이지 접근**

| 경로 | 결과 |
|---|---|
| `/onboarding` | `307` → `/login?next=%2Fonboarding` |
| `/mypage` | `307` → `/login?next=%2Fmypage` |
| `/dream-journal` | `307` → `/login?next=%2Fdream-journal` |
| `/notifications` | `307` → `/login?next=%2Fnotifications` |
| `/login` | `200`(정상 노출) |

**③ 공개 페이지 접근 가능**: `/`(`200`) — 로그아웃 상태에서도 정상 접근.

---

## 5. 발견된 문제

1. **로그아웃이 "쿠키 삭제"와 "세션 폐기"를 둘 다 정확히 수행하는지 별도 확인이 필요했다.** `supabase.auth.signOut()`을 호출한 뒤 남은 쿠키만 보면 성공처럼 보이지만, 실제로 서버가 그 세션(refresh token)을 폐기했는지는 별도로 검증해야 확신할 수 있다. **로그아웃 직전에 원본 `access_token`/`refresh_token`을 추출해 직접 Supabase Auth API에 대조한 결과**: `access_token`(단기 JWT)은 자체 만료시각(발급 시점 기준 1시간)까지는 서명이 유효해 stateless하게 계속 통과하지만(`profiles` REST 조회가 로그아웃 후에도 여전히 `200`), `refresh_token`은 즉시 폐기되어(`refresh_token_not_found`) 새 access_token을 다시 발급받을 수 없다. **이것은 버그가 아니라 JWT 기반 인증의 표준 동작**이다 — 이 앱은 원본 JWT를 쿠키(httpOnly, 서버만 접근)에만 담아두고 클라이언트 JS나 로그에 노출하지 않으므로 실사용 환경에서는 문제가 되지 않지만, "로그아웃 = 즉시 완전 무효화"로 오해하지 않도록 명시적으로 기록한다.
2. **그 외 발견된 문제 없음.** `getCurrentUser()`/`profile` 조회 방식/`proxy.ts` 중 로그아웃 추가로 인한 충돌이나 보완이 필요한 지점은 없었다(§3).

---

## 6. Phase3 UI 개발 시 사용할 Auth Interface

Phase3(공통 UI, 특히 `Header`)가 그대로 가져다 쓸 수 있도록, 지금 존재하는 함수와 호출 방법을 정리한다. **새 헬퍼 함수는 추가하지 않았다** — 이유는 아래 표 다음 문단 참조.

| 필요한 정보/동작 | 사용할 기존 함수 | 위치 | 실행 컨텍스트 |
|---|---|---|---|
| 로그인 상태 확인 | `getCurrentUser()` → `User \| null` | `lib/auth/session.ts` | Server Component/Route Handler(anon, service_role 아님) |
| profile 존재 여부 확인 | `getProfile(user.id)` → `Profile \| null` (또는 `profileExists(user.id)` → `boolean`) | `lib/auth/profile.ts` | **Server Component/Route Handler 전용**(service_role 사용 — Client Component에서 import 금지) |
| 로그아웃 호출 | `fetch("/api/auth/logout", { method: "POST" })` (Client Component에서) 또는 `logout()` 직접 호출(Server Action인 경우) | `app/api/auth/logout/route.ts` / `lib/auth/logout.ts` | 둘 다 가능 — Client Component는 반드시 API Route(`fetch`)를 거쳐야 함(service_role 경로가 아니라 안전하지만, `lib/auth/logout.ts` 자체는 서버 전용 `lib/supabase/server.ts`를 쓰므로 Client Component에서 직접 import 불가) |

**권장 사용 패턴** (Header가 Server Component로 구현될 경우):
```ts
const user = await getCurrentUser();
const profile = user ? await getProfile(user.id) : null;
// user === null            → 로그인 버튼 노출
// user && profile === null → "온보딩 미완료" 상태 표시(또는 /onboarding 링크)
// user && profile          → 로그아웃 버튼 + 닉네임 노출
```

### `getCurrentAuthState()`/`isAuthenticated()`/`getCurrentProfile()` 신설 여부 — **만들지 않음**

세 후보를 검토했다:
- `isAuthenticated()`는 `(await getCurrentUser()) !== null`의 단순 래퍼다. 호출부가 아직 하나도 없고, `User` 객체 자체(닉네임 등 표시에 필요)를 어차피 함께 써야 하는 경우가 많아 `boolean`만 반환하는 별도 함수가 실익이 적다.
- `getCurrentProfile()`은 `getCurrentUser()` + `getProfile()`을 합친 조합 함수인데, 두 함수가 이미 각자 명확한 책임(세션 확인 / DB 조회)을 갖고 있어 합치면 오히려 "이 함수가 service_role을 쓰는지"가 이름만으로 드러나지 않게 된다(`getProfile`은 이름에서 DB 접근이 드러나지만 `getCurrentProfile`은 그렇지 않음) — [[AI_ENGINEERING_CONSTITUTION]] §3 "함수는 하나의 책임만 가진다"와 어긋난다.
- `getCurrentAuthState()`(`{ user, profile }` 통합 조회)는 셋 중 가장 실익이 있어 보였다 — Header가 두 조회를 항상 함께 쓸 가능성이 높기 때문이다. 그럼에도 만들지 않은 이유: 이번 Task는 Header를 만들지 않으므로 **호출부가 아직 존재하지 않는 함수**이고, [[AI_ENGINEERING_CONSTITUTION]] §3 "사용하지 않는 코드 방치 금지"·이번 지시문 자체의 "불필요한 abstraction은 만들지 않는다"에 따라 지금 만들면 죽은 코드가 된다. [[PHASE2_AUTH_FOUNDATION_IMPLEMENTATION_REPORT]] §5-1이 동일한 판단(`lib/auth/` 폴더를 빈 파일로 미리 만들지 않음)을 이미 내린 전례와 일치한다.

**결론**: Phase3에서 `Header` 구현에 착수하는 시점에, 위 "권장 사용 패턴"을 실제 컴포넌트 코드에 2회 이상 반복해서 쓰게 되면(예: `Header`와 `BottomTabBar`가 둘 다 필요로 하는 경우) 그때 `getCurrentAuthState()`로 추출하는 것을 권장한다 — 지금은 그 반복이 실존하지 않아 추상화의 근거가 없다.
