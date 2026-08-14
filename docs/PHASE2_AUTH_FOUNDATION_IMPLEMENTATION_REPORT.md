# PHASE2-1 AUTHENTICATION FOUNDATION — 구현 보고서

> [[PHASE2_AUTH_DECISION]]에서 확정한 Architecture(Decision 1~4)를 실제 DB/코드 기반에 반영한 첫 구현 Task의 결과 기록. 이 Task는 인증 기능 자체(카카오 OAuth, 로그인 UI, profile API Route)를 구현하지 않는다 — 그 기반이 되는 RLS 보호 구조와 service_role 클라이언트만 준비한다.

---

## 1. 생성/수정 파일

| 파일 | 종류 | 내용 |
|---|---|---|
| `supabase/migrations/0011_profiles_auth_protection.sql` | 신규 | `profiles_insert_own`/`profiles_update_own` RLS 정책 제거 |
| `lib/supabase/service.ts` | 신규 | service_role 전용 Supabase 클라이언트 |
| `docs/PHASE2_AUTH_FOUNDATION_IMPLEMENTATION_REPORT.md` | 신규 | 본 보고서 |

수정한 기존 파일 없음. 삭제한 파일 없음. 설치한 라이브러리 없음(§3 참조 — `server-only` 패키지는 의도적으로 추가하지 않았다).

---

## 2. `0011` migration 상세

### 제거한 정책
- `profiles_insert_own` (INSERT, `to authenticated`, `auth.uid() = id`)
- `profiles_update_own` (UPDATE, `to authenticated`, `auth.uid() = id`)

### 유지한 정책
- `profiles_select_own` (SELECT, `to authenticated`, `auth.uid() = id`) — 변경 없음, 본인 조회는 계속 클라이언트 세션으로 허용.
- DELETE 정책 — 원래도 존재하지 않았다(§7 A안: 탈퇴는 UPDATE 익명화, 실제 삭제 없음). 이번 migration에서도 추가하지 않았다.

### 최종 보안 구조 (원격 DB에서 직접 조회로 검증)

```sql
-- relrowsecurity
select relrowsecurity from pg_class where relname='profiles' and relnamespace='public'::regnamespace;
→ true

-- 정책 목록
select policyname, cmd, roles from pg_policies where tablename='profiles';
→ profiles_select_own | SELECT | {authenticated}   (유일하게 남은 정책)
```

즉 `profiles`는:
- RLS 활성화 상태 유지(`relrowsecurity = true`)
- **SELECT**: 본인만 클라이언트 세션으로 직접 조회 가능
- **INSERT/UPDATE**: client 대상 정책이 전혀 없음 → `to authenticated`/`to anon` 요청은 구조적으로 전부 차단됨. service_role(RLS 우회)만 쓸 수 있다.
- **DELETE**: 여전히 불허(정책 없음)

기존 migration(`0001`~`0010`, `0013`)은 수정하지 않았고, 컬럼/FK/INDEX 변경도 없다 — `drop policy`만 수행했다.

migration 적용은 `npx supabase db push --include-all`로 원격(linked) DB에 실행했고, `supabase migration list` 결과 `local`/`remote` 모두 `0011`이 일치함을 확인했다.

---

## 3. service_role 구조 설명

`lib/supabase/service.ts`:

```ts
export function createClient() {
  if (typeof window !== "undefined") {
    throw new Error("lib/supabase/service.ts는 서버 전용입니다. Client Component에서 호출할 수 없습니다.");
  }

  return createSupabaseClient(getEnv("NEXT_PUBLIC_SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- **위치/명명**: 기존 `lib/supabase/client.ts`(anon, 브라우저)·`server.ts`(anon, 쿠키 기반 세션) 옆에 두고 동일하게 `createClient`를 export — 기존 패턴과 일관성 유지([[PHASE2_AUTH_DECISION]] Decision 4).
- **구현체**: `@supabase/ssr`이 아니라 `@supabase/supabase-js`의 순수 `createClient`를 사용했다. service_role은 세션리스라 쿠키 어댑터가 불필요하기 때문(Decision 4 결정 이유 그대로 반영). `autoRefreshToken`/`persistSession`을 껐다 — service_role 키 자체가 세션이므로 토큰 갱신/영속화 로직이 불필요하고, 서버리스 함수(Route Handler)마다 새로 생성되는 단발성 클라이언트이기 때문이다.
- **환경변수**: `SUPABASE_SERVICE_ROLE_KEY`(`NEXT_PUBLIC_` 접두사 없음, `.env.local`에 이미 존재 확인됨)를 기존 `getEnv()` 헬퍼로 읽는다 — 새 환경변수 로딩 로직을 만들지 않았다.
- **server-only 가드**: `typeof window !== "undefined"` 체크로 브라우저 실행 시 즉시 예외를 던진다. **`server-only` npm 패키지는 설치하지 않았다** — [[AI_ENGINEERING_CONSTITUTION]] §3 "사용하지 않는 라이브러리 설치 금지"(라이브러리 추가는 "왜 직접 구현하지 않고 필요한가"를 먼저 답해야 함) 기준으로, 한 줄짜리 런타임 가드로 동일한 목적을 달성할 수 있어 신규 의존성 추가가 정당화되지 않는다고 판단했다. 이 판단은 [[PHASE2_AUTH_DECISION]] §4 체크리스트의 "server-only 패키지 도입 여부를 구현 Task 착수 시 별도로 정식 결정"에 대한 답이다 — **도입하지 않음으로 결정.**
- **사용 가능 영역 강제**: 코드 가드는 "브라우저에서 실행되면 실패"만 보장한다. "Client Component에서 import 자체를 원천 금지"까지는 정적 분석(ESLint 규칙 등) 없이는 강제할 수 없는데, 이번 Task는 신규 ESLint 규칙 도입도 범위 밖이라 추가하지 않았다 — §5 "발견된 문제"에 리스크로 기록.
- **현재 사용처**: 없음. 아직 어떤 Route Handler/Server Action도 이 파일을 import하지 않는다(profile API Route는 다음 Task 범위). 따라서 클라이언트 번들 포함 여부를 지금 실제로 검증할 방법이 없다 — `npm run build` 결과 어떤 라우트에서도 참조되지 않아 트리쇼킹으로 아예 번들에 포함되지 않았다. 실제 import가 생기는 다음 Task에서 재검증이 필요하다.

---

## 4. 현재 Authentication Architecture 상태

| 구성요소 | 상태 |
|---|---|
| `lib/supabase/client.ts` / `server.ts` | 기존 그대로(anon key), 변경 없음 |
| `lib/supabase/service.ts` | **신규 완료** — 아직 사용처 없음 |
| `profiles` RLS | **Decision 3 반영 완료** — SELECT만 client 허용, INSERT/UPDATE는 service_role 전용 |
| `lib/auth/` | **미생성** — §5 참조 |
| `app/api/profile/route.ts` | 미생성(다음 Task 범위, 이번 Task 절대 금지 항목) |
| 카카오 OAuth 라우트 | 미생성(다음 Task 범위) |
| `proxy.ts` | 기존 그대로(`matcher: []` 빈 껍데기), 변경 없음 — §5 참조 |

현재 `profiles`는 "RLS로 보호는 되어 있지만 그 어떤 경로로도(client도, 아직 service_role 호출자도 없어서) 쓸 수 없는" 과도기 상태다. 이는 의도된 상태다 — 이 Task의 목표가 "쓰기 경로를 원천 차단해두고, 그 유일한 통로(service_role)만 준비"하는 것이었기 때문이다.

---

## 5. 발견된 문제

1. **`lib/auth/` 폴더는 생성하지 않았다.** 지시문 예시(`kakao.ts`/`profile.ts`/`index.ts`)를 그대로 만들면 전부 빈 파일이 되는데, [[AI_ENGINEERING_CONSTITUTION]] §3 "사용하지 않는 코드 방치 금지"·§5 하드 게이트("혼자 유지보수 가능한가")와 지시문 자체의 "빈 파일 남발 금지, 실제 사용할 코드가 아니면 생성하지 않는다" 조항이 서로를 강화한다. 예상 구조는 이 보고서 §6에 텍스트로만 기록하고, 실제 파일은 해당 코드가 필요한 다음 Task에서 만든다.
2. **`proxy.ts` 점검 결과: 문제 없음.** Next.js 16의 `proxy.ts`(구 `middleware.ts`) 컨벤션이 이미 정확히 적용되어 있고(`export function proxy`, 파일명 일치), `matcher: []`로 어떤 요청도 가로채지 않는 상태가 현재 시점에는 안전하다(보호할 인증 로직 자체가 아직 없음). `npm run build` 결과에도 `ƒ Proxy (Middleware)`로 정상 인식됨을 확인했다. 이 파일을 채우는 작업(세션 갱신, `/my/*`·`/admin/*` 보호, `withdrawn` 상태 차단)은 [[PHASE2_AUTH_ARCHITECTURE_AUDIT]] §5가 이미 Phase2-8 단계로 계획해둔 항목과 동일하다 — **새로 발견된 문제가 아니므로 [[BACKLOG]]에 신규 항목을 추가하지 않았다.**
3. **service_role의 "Client Component import 금지"는 런타임 가드로만 강제된다(정적 차단 아님).** 위 §3에서 설명한 대로, ESLint 규칙 같은 정적 강제 장치는 이번 Task 범위 밖이라 추가하지 않았다. 실제 import가 생기는 다음 Task(profile API Route 구현)에서 이 파일이 올바른 경로(Route Handler)에서만 참조되는지 코드 리뷰로 확인하는 것이 현재의 유일한 안전망이다.
4. **`profiles` INSERT/UPDATE가 현재 완전히 막혀 있다.** service_role 호출자가 아직 없으므로, 지금 시점에 카카오/이메일 회원가입을 시도하면 `profiles` 행을 만들 방법이 없다(의도된 과도기 상태, §4 참조). 다음 Task에서 `app/api/profile/route.ts`가 만들어지기 전까지는 회원가입 플로우가 기능적으로 완성되지 않는다 — 새로운 리스크는 아니고 원래 계획된 순서다.

---

## 6. Phase2 다음 Task 추천 순서

[[PHASE2_AUTH_ARCHITECTURE_AUDIT]] §5의 순서를 그대로 따르되, 이번 Task로 Phase2-1이 완료되었으므로 이어지는 순서를 명시한다.

1. **`lib/auth/getCurrentUser.ts`, `app/api/profile/route.ts`(POST — 최초 생성)** — [[PHASE2_AUTH_DECISION]] Decision 1 구현. 이 시점에 `lib/supabase/service.ts`의 첫 실사용처가 생기므로, 클라이언트 번들 미포함 여부를 실제로(빌드 산출물 검사로) 재검증할 것.
2. **카카오×Supabase Auth 통합(REST API + Admin API, Decision 2) PoC** — `app/(auth)/auth/kakao/route.ts`, `lib/auth/kakao.ts`. 이 Task에서 비로소 `lib/auth/` 폴더가 실제 코드와 함께 생성된다.
3. **이메일 로그인 먼저 연결(배관 검증)** — 세션/쿠키 흐름을 더 단순한 경로로 먼저 확인([[EXECUTION_PLAN]] 권장 순서 유지).
4. **`app/api/profile/route.ts`(PATCH — 갱신)** — Decision 3 화이트리스트(`lib/constants/profile.ts` 등) 구현.
5. **19세 미만 이용제한 체크(클라이언트+서버)** — `age_verified` 서버 재계산 로직.
6. **`proxy.ts` 보호 로직** — 이제서야 채울 시점(matcher, 세션 갱신, `withdrawn` 차단, "profiles 없음→/onboarding" 리다이렉트).
7. **로그아웃 구현.**
8. **[[BACKLOG]] 항목 E(RLS 실사용자 테스트)** — 카카오/이메일 로그인이 실제로 동작하는 시점부터 가능해짐.

---

## 7. Ready 여부

**Phase2-1(기반 구조) 완료.** `profiles`는 DB 레벨에서 클라이언트 직접 쓰기가 차단된 상태로 안전하게 대기 중이고, service_role 클라이언트도 준비되었다. 다음 Task(§6-1, profile 생성 API + `getCurrentUser`)를 시작하기 위한 선행 조건이 모두 충족되었다 — **Ready.**

단, §5-3(정적 import 강제 부재)은 다음 Task에서 `lib/supabase/service.ts`의 첫 실사용처가 생길 때 반드시 "Route Handler에서만 import했는지" 코드 리뷰 항목으로 명시적으로 확인해야 한다.
