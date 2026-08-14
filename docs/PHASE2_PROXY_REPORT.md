# PHASE2-6 AUTHENTICATION PROTECTION (proxy.ts + Route Protection) 보고서

> [[AI_ENGINEERING_CONSTITUTION]]·[[EXECUTION_PLAN]]·[[IMPLEMENTATION_PLAN]]·[[PHASE2_AUTH_DECISION]]·[[BACKLOG]]을 재검토한 뒤 `proxy.ts`를 실제로 동작하는 인증 보호 계층으로 구현한 결과다. `middleware.ts`는 새로 만들지 않았다(`proxy.ts`가 Next.js 16의 현행 컨벤션). OAuth·RLS·Migration·Schema·기존 API는 수정하지 않았다.

---

## 0. Decision 문서와의 충돌 검토 (착수 전 확인)

이번 지시문의 항목 6("`getCurrentUser()`와 `profileExists()` 등 이미 만들어진 인증 서비스만 재사용")과 항목 7("service_role은 proxy에서 절대 사용하지 않는다")이 서로 충돌한다.

- `lib/auth/profile.ts`의 `profileExists()`/`getProfile()`은 내부적으로 `lib/supabase/service.ts`(**service_role**)를 사용한다(직접 코드 확인).
- 즉 지시대로 `profileExists()`를 proxy에서 그대로 호출하면 항목 7("proxy에서는 사용자 세션 확인만 수행한다")을 위반한다.
- [[PHASE2_AUTH_DECISION]] 자체도 내부적으로 이 긴장을 안고 있다 — Decision 1은 "`profileExists()`... `proxy.ts`가 이 상태를 감지해 `/onboarding`으로 리다이렉트하면 된다"고 적었지만, Decision 4는 "**절대 금지**: ... `proxy.ts`(미들웨어)에서도 [service_role] 사용 금지 — 세션 갱신/보호경로 체크는 anon 기반 `getUser()`로 충분하며, service_role이 필요한 시나리오가 아니다"라고 명시했다.

이번 지시문이 항목 7을 두 번 반복하며 "proxy에서는 사용자 세션 확인만 수행한다"고 더 강하게 못박았고, [[AI_ENGINEERING_CONSTITUTION]] §11도 "RLS를 우회하는 service_role 클라이언트는 ... 반드시 필요한 최소 범위(관리자 작업, 배치)에만 사용한다"고 해 이 시나리오(요청마다 발생하는 라우팅 판단)를 그 범위에 포함하지 않는다. 이에 따라 **`profileExists()`/`getProfile()`을 proxy에서 호출하지 않기로 결정**했다. 대신:

- `getCurrentUser()`는 그대로 재사용한다(anon 기반, service_role 아님, 충돌 없음).
- profile 존재 여부는 [[PHASE2_AUTH_DECISION]] Decision 3이 유지하기로 확정한 `profiles_select_own` RLS 정책(본인 행 SELECT는 세션만 있으면 anon 클라이언트로도 허용)을 그대로 활용해, **이미 쓰고 있는 anon 클라이언트(`lib/supabase/server.ts`)로 동일한 조회**(`select("id").eq("id", userId).maybeSingle()`)를 수행하는 `proxy.ts` 내부 헬퍼(`hasProfile()`)로 대체했다. 새로운 인증 메커니즘을 추가한 것이 아니라 — 이미 코드베이스에 있는 anon 클라이언트 팩토리와, 이미 있는 RLS 정책을 그대로 다시 쓴 것뿐이며, `getProfile()`이 수행하는 조회와 쿼리 자체는 동일하고 사용하는 Supabase 클라이언트(anon vs service_role)만 다르다.

다른 문서와의 충돌은 발견되지 않았다.

---

## 1. 생성/수정 파일

| 파일 | 종류 | 내용 |
|---|---|---|
| `proxy.ts` | 수정 | 보호 경로 인증 체크, `/onboarding`·`/login` 예외 처리 구현(기존에는 빈 matcher의 껍데기였음) |
| `app/login/page.tsx` | 신규 | 최소 로그인 페이지(카카오 로그인 링크). `proxy.ts`의 `/login` 예외 처리(항목 4)를 실제로 검증하려면 이 경로에 실재하는 페이지가 필요했다 — 기존에 이 프로젝트에는 로그인 페이지가 전혀 없었다(§5 참조). 카카오 로그인 라우트(`/api/auth/kakao/login`, 기존 그대로)로 연결하는 실제 동작 페이지이며, TODO/Mock이 아니다 |
| `docs/PHASE2_PROXY_REPORT.md` | 신규 | 본 보고서 |

`app/onboarding/**`, `app/api/auth/kakao/**`, `app/api/profile/route.ts`, `lib/auth/**`, `lib/supabase/**`는 이번 Task에서 전혀 수정하지 않았다. `/mypage`, `/dream-journal`, `/notifications` 페이지 파일은 만들지 않았다 — 이번 Task는 "보호 경로 지정"만 요구했고, 실제 페이지 콘텐츠를 만드는 것은 각 기능이 구현되는 이후 Phase(다이어리/마이페이지/알림)의 범위다. 지금 그 페이지들을 placeholder로 만드는 것은 금지사항("임시 코드 금지", "Mock 금지")에 해당한다고 판단해 만들지 않았다.

---

## 2. 보호 대상 경로

| 경로 | 규칙 |
|---|---|
| `/onboarding` (하위 경로 포함) | 로그인 필수. 로그인했지만 profile이 **이미 존재**하면 `/`로 리다이렉트(중복 온보딩 방지) |
| `/mypage` (하위 경로 포함) | 로그인 필수 |
| `/dream-journal` (하위 경로 포함) | 로그인 필수 |
| `/notifications` (하위 경로 포함) | 로그인 필수 |
| `/login` | 로그인 안 됨 → 통과(페이지 노출). 로그인 + profile 있음 → `/`. 로그인 + profile 없음 → `/onboarding` |
| 위 목록에 없는 모든 경로(`/`, `/dream`, `/fortune`, `/number-generator`, `/winning`, `/store`, `/share/*` 등) | `proxy.ts`의 `matcher`에 포함되지 않아 미들웨어를 전혀 통과하지 않는다 — 로그인 여부와 무관하게 그대로 동작 |

---

## 3. Redirect Flow

```
요청 도착
  │
  ▼
matcher에 없는 경로? ──예──▶ 통과(공개 페이지, 미들웨어 미실행)
  │ 아니오
  ▼
getCurrentUser() (anon 세션, lib/auth/session.ts 그대로 재사용)
  │
  ├─ /login 요청인 경우
  │     │
  │     ├─ 세션 없음 ──▶ 통과(로그인 페이지 노출)
  │     ├─ 세션 있음 + profile 있음 ──▶ redirect "/"
  │     └─ 세션 있음 + profile 없음 ──▶ redirect "/onboarding"
  │
  └─ 보호 경로(/onboarding, /mypage, /dream-journal, /notifications) 요청인 경우
        │
        ├─ 세션 없음 ──▶ redirect "/login?next=<원래 경로>"
        ├─ 세션 있음 + 경로가 /onboarding + profile 있음 ──▶ redirect "/"
        └─ 그 외(세션 있음, 그리고 /onboarding이면 profile 없음) ──▶ 통과
```

`next` 쿼리 파라미터는 `/login?next=<원래 경로>` 형태로 항상 붙지만, 로그인 완료 후 그 경로로 자동 복귀하는 기능은 구현하지 않았다 — 그러려면 `app/api/auth/kakao/login`/`callback`(OAuth 라우트)이 이 값을 state와 함께 왕복시켜야 하는데, 이번 Task는 OAuth 수정을 금지한다. `app/login/page.tsx`는 `next` 값을 안내 문구에만 반영하고 실제 이동에는 쓰지 않는다(§5).

---

## 4. Validation 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 16개 테스트 통과(기존 그대로, 이번 수정으로 깨진 테스트 없음) |
| `npm run build` | 통과. `ƒ Proxy (Middleware)` 정상 등록 확인, `/login` 라우트 정상 등록 |
| 빌드 산출물에 `SUPABASE_SERVICE_ROLE_KEY` 노출 여부 | `grep` 재확인, 0건 |

### 실제 접근 테스트 (`npm run dev` + `curl`, 실제 Supabase 프로젝트 대상)

로그인 상태를 만들기 위해 카카오 API를 호출하지 않고 `establishKakaoSupabaseSession()`(카카오 API 미사용, [[PHASE2_KAKAO_E2E_REPORT]]에서 검증된 방법과 동일)을 실행하는 임시 검증용 라우트를 사용했다. 검증 후 해당 라우트와 생성된 테스트 계정(auth.users/profiles)은 전량 삭제했다.

**① 비로그인 → 보호 페이지 접근**

| 요청 | 결과 |
|---|---|
| `/onboarding` | `307` → `/login?next=%2Fonboarding` |
| `/mypage` | `307` → `/login?next=%2Fmypage` |
| `/dream-journal` | `307` → `/login?next=%2Fdream-journal` |
| `/notifications` | `307` → `/login?next=%2Fnotifications` |
| `/login` | `200`(그대로 노출) |

**② 로그인 + profile 없음**

| 요청 | 결과 |
|---|---|
| `/onboarding` | `200`(통과 — 폼 노출) |
| `/mypage` | `404`(미들웨어 통과 후 페이지가 아직 없어 Next.js가 404 — 미들웨어 자체는 정상 통과시킴) |
| `/login` | `307` → `/onboarding` |

**③ 로그인 + profile 있음** (위 사용자로 `POST /api/profile` 실행 후 재검증)

| 요청 | 결과 |
|---|---|
| `/onboarding` | `307` → `/`(재접근 차단) |
| `/login` | `307` → `/`(재접근 차단) |
| `/mypage` | `404`(통과는 확인, 페이지 미구현이라 404는 정상) |
| `/notifications` | `404`(상동) |
| `/dream-journal` | `404`(상동) |

**④ 공개 페이지 확인(비로그인)**: `/`(`200`), `/dream`·`/fortune`·`/number-generator`·`/winning`·`/store`·`/share/abc123`(전부 `404`, 아직 페이지가 없어서 나는 404이며 `/login`으로 리다이렉트되지 않음을 확인 — matcher가 이 경로들에 전혀 적용되지 않는다는 뜻).

---

## 5. 발견한 문제

### 현재 해결한 문제
1. **`getCurrentUser()`가 실제로 Middleware(`proxy.ts`) 안에서 동작하는지가 사전에 불확실했다** — `lib/supabase/server.ts`는 `next/headers`의 `cookies()`를 쓰는데, 이는 전통적으로 Route Handler/Server Component 전용 API로 알려져 있어 Middleware에서 호출하면 실패할 가능성이 있었다. 실제로 `npm run dev` + `curl`로 실행해본 결과 **에러 없이 정상 동작**했다(비로그인 시 clean `307`, 로그인 시 올바른 사용자 식별 — 둘 다 예외 없이 정확한 응답). 가정에 의존하지 않고 실행으로 확인했다.
2. **항목 6(`profileExists()` 재사용)과 항목 7(service_role 금지)의 충돌**을 §0에서 해소했다 — anon 클라이언트로 동일 조회를 수행.
3. **`/login` 페이지가 아예 없어 항목 4를 검증할 방법이 없었던 문제** — 최소 실동작 페이지를 추가해 해소(§1).

### 해결하지 않은 문제
1. **로그인 완료 후 `next` 파라미터로 원래 페이지에 복귀하는 기능 없음** — OAuth 콜백 라우트 수정이 필요해 이번 Task 금지사항에 해당한다. 지금은 로그인 후 항상 `/`(profile 없으면 `/onboarding`)로만 이동한다.
2. **`lib/supabase/server.ts`의 `setAll()` 쿠키 쓰기(세션 토큰 자동 갱신)가 Middleware에서 실제로 성공하는지는 확인하지 못했다** — 이번 검증은 모두 만료되지 않은 세션으로 진행되어 "읽기"만 실측되었고, 리프레시 토큰 갱신이 필요한 만료 직전 세션 시나리오는 재현하지 않았다. `lib/supabase/server.ts`의 기존 주석("세션 갱신은 middleware가 담당하므로 무시해도 안전하다")이 실제로 이 `proxy.ts`에서 성립하는지는 별도로 실측이 필요하다.
3. **`/mypage`, `/dream-journal`, `/notifications` 실제 페이지가 아직 없다** — 이번 Task 범위 밖(각 기능 구현 Phase에서 다룸)이라 만들지 않았고, 지금은 로그인만 하면 404를 만난다. 프록시 동작 자체는 정상이다.

### 다음 Phase에서 처리할 사항
1. `/login` 완료 후 `next` 경로로 복귀하는 기능 — OAuth 콜백 수정이 필요하므로 별도 승인 Task로 진행.
2. `/mypage`(Phase9 관리자/마이페이지)·`/dream-journal`(Phase4 다이어리, [[EXECUTION_PLAN]]상 실제 경로는 `/(journal)/my/journal/dreams`로 계획되어 있었다 — 이번 Task 지시문이 다른 경로명(`/dream-journal`)을 명시해 그대로 따랐으며, 두 경로명이 다르다는 점을 문서 정합성 점검 대상으로 남긴다)·`/notifications` 실제 페이지 구현.
3. [[BACKLOG]] 항목 E(RLS 실사용자 테스트) — 이제 보호 경로까지 갖춘 완전한 인증 흐름이 생겼으므로 착수 조건이 더 명확해졌다.

---

## 6. Phase2-6 Ready 여부

**Ready.** 비로그인/로그인+profile 없음/로그인+profile 있음 3가지 상태를 실제 Supabase 프로젝트를 대상으로 전부 실행 검증했고, 4개 보호 경로·`/login` 예외·공개 경로 비간섭까지 모두 기대한 대로 동작했다. `service_role`은 `proxy.ts`에서 전혀 사용하지 않으며(§0에서 명시적으로 회피), OAuth·RLS·Migration·Schema·기존 API는 손대지 않았다. 4개 정적 validation 전부 통과. 유일한 설계상 타협은 §0의 `profileExists()` 미재사용(대신 동등한 anon 조회로 대체)이며, 그 이유를 이 문서에 명시적으로 남겼다.
