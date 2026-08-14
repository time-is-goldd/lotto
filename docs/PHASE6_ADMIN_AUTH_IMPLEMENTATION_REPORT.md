# Phase6-4-1 관리자 권한 기반 구현 보고서

> `docs/PHASE6_ADMIN_AUTH_DECISION.md`의 결정(Option C — 별도 `admins` 테이블)을 실제로 구현했다. HTTP Route(`/api/admin/draws`)는 이번 Task에서도 여전히 연결하지 않는다 — 이번 Task의 산출물은 "관리자 권한 기반"(DB + RLS + `isAdmin()`)까지다.

## 1. 구현 범위

BLOCKER 3가지를 전부 해결했다:
1. `admins` DB 구조 및 RLS — `supabase/migrations/0012_admin_access.sql`로 구현, 실제 원격 Supabase 프로젝트에 적용 완료.
2. 최초 관리자 등록 절차 — 문서화만 함(§8). 이번 Task에서 실제 운영 관리자 계정을 생성하지 않았다.
3. `lib/auth/isAdmin.ts` 부재 — 구현 완료.

`admin_audit_logs`는 이번 Task에서 만들지 않기로 결정했다(§5). `app/api/admin/draws/route.ts`, `proxy.ts` 수정, `/admin` UI는 이번 Task 범위에 없다.

---

## 2. 생성/수정 파일

**영구적으로 생성/수정한 파일**:
- `supabase/migrations/0012_admin_access.sql`(신규) — `admins` 테이블 + RLS. **실제 원격 Supabase 프로젝트에 적용 완료**(§6).
- `lib/auth/isAdmin.ts`(신규) — 관리자 판정 함수.
- `lib/auth/isAdmin.test.ts`(신규) — 단위 테스트 4건.
- `lib/auth/index.ts`(수정) — `export * from "./isAdmin";` 1줄 추가(기존 배럴 export 컨벤션).
- `lib/types/database.ts`(수정) — `npx supabase gen types typescript --linked`로 재생성. `admins` 테이블과 `admin_role` enum 타입만 추가됐고, 기존 타입은 `diff`로 한 글자도 바뀌지 않았음을 직접 확인했다(§6).
- `docs/PHASE6_ADMIN_AUTH_IMPLEMENTATION_REPORT.md`(본 보고서).

**검증 중 임시로 사용하고 전부 삭제한 것**(git 이력에 흔적 없음):
- `lib/auth/isAdmin.integration.test.ts` — 실제 Supabase에 대해 mock 없이 실행한 통합 테스트. 실행 후 삭제.
- Supabase 프로젝트에 생성했던 테스트 계정 2개(일반 사용자 User A, 관리자 User B)와 `admins` 테스트 행 1건 — 통합 테스트 `afterAll`에서 전부 삭제했고, 별도 스크립트로 잔여 데이터 0건을 재확인했다.

**수정하지 않은 파일**: `app/api/admin/draws/route.ts`(생성 안 함), `proxy.ts`, `/admin` 페이지, `lib/api/admin/draws.ts`, `lib/api/notifications.ts`, `user_numbers`/`notifications`/`draws` 스키마·RLS — 전부 이번 Task에서 건드리지 않았다(파일 mtime으로 재확인, §14).

---

## 3. 현재 상태 재확인 (구현 전 실측)

지시문 §2가 요구한 재확인을 구현 착수 전에 다시 실행했다:

| 확인 대상 | 결과 |
|---|---|
| `admins` table | 없음(구현 전) |
| `admin_audit_logs` table | 없음 |
| `is_admin`/`admin_flag` 컬럼 | 없음 |
| `isAdmin.ts` | 없음 |
| 관리자 RLS policy | 없음 |
| 관리자 API route | 없음 |
| `npx supabase migration list` | local/remote 둘 다 `0001~0011, 0013`만 존재, `0012` 미존재(재확인) |

`DATABASE_SCHEMA.md §3.23`의 설계("`admins`/`admin_audit_logs`, `role` 컬럼, MVP는 `super` 단일값")와 `PHASE6_ADMIN_AUTH_DECISION.md`의 최종 결정(Option C)은 **일치한다** — 불일치 없음. 단, `§3.23`이 컬럼 표를 제공하지 않는다는 사실은 Phase6-4-0 감사에서 이미 발견했던 그대로였고, 이번 Task에서 최소 컬럼을 새로 제안해 구현했다(§4).

---

## 4. admins 테이블 schema

```sql
create type public.admin_role as enum ('super');

create table public.admins (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users (id),
  role public.admin_role not null default 'super',
  created_at timestamptz not null default now()
);
```

### 설계 결정 근거

- **`auth.users(id)` 참조, `profiles(id)` 아님**: 관리자가 반드시 온보딩(`profiles` 생성)을 완료했다는 보장이 없으므로, 더 근본적인 대상인 `auth.users`를 직접 참조했다(`profiles.id`도 동일하게 `auth.users(id)`를 참조하는 것과 같은 패턴).
- **`user_id UNIQUE`**: 한 사용자가 중복 `admins` 행을 갖지 않도록 DB 레벨에서 강제.
- **`role` enum, MVP 값은 `super`뿐**: 기존 프로젝트가 통제된 값에 항상 enum을 쓰는 컨벤션(`profile_provider`, `notifications_type` 등)을 그대로 따랐다. `ALTER TYPE ... ADD VALUE`로 나중에 역할을 늘릴 수 있어 Phase9 확장성을 해치지 않는다.
- **`is_active` 컬럼을 두지 않았다**: 지시문 §3이 "관리자 활성/비활성 상태가 필요한지"를 판단하라고 명시적으로 요구했다. `admins` 행을 `DELETE`하는 것 자체가 다음 요청부터 즉시 효력을 갖는 비활성화이므로(`isAdmin()`이 매 요청마다 재조회), 별도 boolean 컬럼은 같은 상태를 두 가지 방법(행 존재 여부 vs `is_active` 플래그)으로 표현하게 만들 뿐 새로운 능력을 주지 않는다고 판단했다 — "불필요한 컬럼 추가 금지" 원칙(Phase6-2에서도 동일하게 적용한 원칙)에 따라 추가하지 않았다.
- **`admin_audit_logs`를 만들지 않았다** — §5에서 별도로 근거를 정리한다.

---

## 5. admin_audit_logs 처리 여부 — Option A 채택

**Option A(admins만 구현, audit_logs는 Phase9로 미룸)를 채택했다.**

근거:
1. `EXECUTION_PLAN.md`의 Phase6 완료 기준(§445~448: "관리자 입력 → 다이어리 결과 반영 확인", "당첨자 알림 생성 확인")에 감사로그가 전혀 언급되지 않는다 — Phase6의 실제 요구사항(회차 입력/당첨 대조)에 `admin_audit_logs`가 필요하지 않다.
2. 현재 유일한 관리자 액션 후보는 "회차 입력"(`registerDrawAndMatchUserNumbers()`, Phase6-3에서 이미 구현) 하나뿐이다 — 감사 로그를 남길 액션 종류 자체가 하나뿐인 시점에 범용 audit_logs 테이블(`action`/`diff` JSONB 등)을 설계하면 실제 사용 패턴 없이 추측으로 스키마를 확정하게 된다.
3. `DATABASE_SCHEMA.md §3.23`이 두 테이블을 한 섹션에 묶어 서술했다고 해서 반드시 동시에 구현해야 하는 것은 아니다 — `ADMIN_REQUIREMENTS.md §8`(감사로그 조회 화면)도 명시적으로 Phase9 관리자 화면의 일부로 분류돼 있다.
4. "문서에 명시된 기존 설계보다 더 큰 범위를 임의로 구현하지 않는다"는 지시문 원칙과, 이번 Task 자체가 명시한 "필요한 최소 구조"라는 지침에 부합한다.

`admin_audit_logs`가 실제로 필요해지는 시점(Phase9, 관리자 액션 종류가 여러 개로 늘어나는 시점)에 별도 migration으로 추가한다.

---

## 6. Migration

**파일**: `supabase/migrations/0012_admin_access.sql`(§4의 SQL 전문). 번호는 추측하지 않고 `npx supabase migration list`로 로컬/원격 둘 다 `0012`가 비어 있음을 재확인한 뒤 사용했다(`0013_profiles_status_default.sql` 자체 주석이 "0012는 Phase9 admin_flag를 위한 예약 번호"임을 이미 명시하고 있어, 이번 Task가 정확히 그 예약된 용도로 사용한 것이다).

### 적용 절차 및 결과

```
npx supabase db push --dry-run --include-all
  → "Would push these migrations: 0012_admin_access.sql" (다른 파일 없음 확인)
npx supabase db push --include-all
  → "Applying migration 0012_admin_access.sql..." 성공
npx supabase migration list
  → local/remote 전부 0001~0013 완전 일치(0012 포함)
```

`--include-all`이 필요했던 이유: `0012`가 파일명 순서상 이미 적용된 `0013`보다 앞서는 번호라, Supabase CLI가 기본적으로 "원격에 적용된 마지막 마이그레이션보다 앞선 로컬 파일"로 인식해 명시적 플래그를 요구했다 — 이는 `0012`가 나중에 채워진 예약 번호라는 이번 프로젝트의 특수한 상황 때문이며, 실제로 적용된 SQL 내용은 `0012_admin_access.sql` 하나뿐임을 dry-run으로 먼저 확인한 뒤 실행했다.

### 타입 재생성

`npx supabase gen types typescript --linked`로 `lib/types/database.ts`를 재생성하고 기존 파일과 `diff`했다 — **`admins` 테이블 Row/Insert/Update 타입과 `admin_role` enum 추가만** 발생했고 기존 61개 이상의 타입 정의는 전혀 바뀌지 않았다(§2 확인).

---

## 7. RLS 정책

```sql
alter table public.admins enable row level security;

create policy admins_select_own
  on public.admins
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- INSERT/UPDATE/DELETE 정책 없음 = 일반 사용자(관리자 포함) 전원 차단.
```

### 재귀(recursion) 방지 근거

지시문이 명시적으로 경고한 `USING (EXISTS (SELECT FROM admins ...))` 형태를 **쓰지 않았다.** `admins_select_own`은 평가 대상 행 자신의 `user_id` 컬럼을 `auth.uid()`와 직접 비교할 뿐, `admins` 테이블을 다시 SELECT하는 서브쿼리가 전혀 없다 — 이 정책을 평가하기 위해 `admins`를 다시 조회할 필요 자체가 없으므로, 애초에 "infinite recursion detected in policy" 오류가 발생할 수 있는 구조가 아니다(`profiles_select_own`, `user_numbers_select_own` 등 기존 정책 전부가 이미 이 안전한 패턴을 쓰고 있다). 실제 Supabase로 재귀 미발생을 실측했다(§12).

INSERT/UPDATE/DELETE에 정책을 만들지 않은 이유는 이 프로젝트 전역 컨벤션(정책 없음=기본 차단, `draws`/`dreams` 등과 동일)을 그대로 따른 것이다.

---

## 8. isAdmin() 계약

```ts
export async function isAdmin(): Promise<boolean>
```

| 요구사항 | 충족 방식 |
|---|---|
| userId를 클라이언트에서 받지 않음 | 파라미터 없음(void) — `getCurrentUser()`로 서버가 직접 현재 세션을 확인 |
| 현재 세션에서 사용자를 확인 | `getCurrentUser()`(`lib/auth/session.ts`, 기존 함수 재사용, 수정 없음) |
| 서버 Supabase client 사용 | `lib/supabase/server.ts`(anon key + 쿠키 세션) |
| service_role 미사용 | `lib/supabase/service.ts`를 import하지 않음(정적으로 확인, §9) |
| 관리자 여부는 DB `admins` 기준 | `.from("admins").select("id").eq("user_id", user.id).maybeSingle()` |
| 비로그인 → false | `user`가 `null`이면 DB 조회 자체를 하지 않고 즉시 `false` |
| 로그인 일반 사용자 → false | `admins`에 행이 없으면(`data === null`) `false` |
| 관리자 → true | 행이 있으면(`data !== null`) `true` |
| DB 오류 → false(fail-closed) | `error`가 있으면 `console.error`로 로그만 남기고 무조건 `false` 반환 — 어떤 경로로도 `true`를 반환하지 않음 |

`proxy.ts`의 기존 `hasProfile()`과 정확히 같은 패턴(anon 세션 클라이언트 + `.maybeSingle()`)을 재사용했다 — 새로운 인증 메커니즘을 발명하지 않았다.

---

## 9. isAdmin 보안 정적 확인

코드를 직접 읽어 확인했다:

| 항목 | 결과 |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY`/`lib/supabase/service` import | 없음 |
| `service_role` 사용 | 없음 |
| userId parameter | 없음(함수 시그니처가 `isAdmin(): Promise<boolean>`, 인자 0개) |
| URL/query parameter로 관리자 ID 수신 | 없음(애초에 HTTP 계층 코드가 아님) |
| 클라이언트 컴포넌트에서 호출 | 없음(`"use client"` 지시어가 있는 파일이 이 함수를 import하지 않음, 어떤 파일도 아직 이 함수를 호출하지 않음 — Route가 없으므로 §16에서 재확인) |
| localStorage/sessionStorage 기반 판정 | 없음 |
| email 문자열 비교 | 없음 |
| UID 하드코딩 | 없음 |
| `user_metadata` 기반 판정 | 없음(`app_metadata`도 사용하지 않음 — 순수하게 `admins` 테이블 존재 여부만 판정 근거) |

---

## 10. Self-promotion 공격 검증

실제 Supabase 통합 테스트로 검증했다(§12에 전체 목록):

| 공격 시나리오 | 결과 |
|---|---|
| User A가 자신의 UID로 `admins` INSERT 시도 | **DENIED**(에러 반환) |
| User A가 User B(실제 관리자)의 UID로 `admins` INSERT 시도 | **DENIED**(에러 반환) |
| 관리자 User B조차 자신의 `admins` 행을 UPDATE 시도 | **DENIED**(0행 영향 — client UPDATE 정책 자체가 없음) |
| User A가 User B의 `admins` 행 DELETE 시도 | **DENIED**(0행 영향, service_role 재조회로 행이 그대로 존재함을 재확인) |

---

## 11. RLS recursion 검증

실제 Supabase에 대해 User A의 세션으로 `admins`를 SELECT하는 요청을 실행해 **에러 없이 정상 완료됨**을 확인했다 — `"infinite recursion detected in policy"` 오류가 발생하지 않았다. `admins_select_own` 정책이 다른 테이블(`EXISTS` 서브쿼리 등)을 참조하지 않고 자신의 컬럼값만 비교하는 구조이므로(§7), 애초에 재귀가 발생할 수 있는 조건 자체가 없다는 설계상의 근거와 실측 결과가 일치했다.

---

## 12. 실제 Supabase 통합 테스트

`lib/auth/isAdmin.integration.test.ts`(임시 파일, 검증 후 삭제)를 `npx vitest run`으로 mock 없이 실제 프로덕션 Supabase 프로젝트에 대해 실행했다. 테스트 계정 2개 생성(User A=일반 사용자, User B=관리자로 `admins`에 service_role로 등록) 후 각자의 실제 인증 세션(anon key + 비밀번호 로그인)으로 검증했다.

| 테스트 | 결과 |
|---|---|
| RLS 재귀 미발생(User A 조회가 에러 없이 완료) | PASS |
| 일반 User A가 `admins` 조회 시 자기 행 없음(빈 배열) | PASS |
| 관리자 User B가 `admins` 조회 시 자기 행 1건 | PASS |
| 최소 권한: 관리자 User B가 필터 없이 전체 조회해도 자기 행만 보임(타인 행 비노출) | PASS |
| Self-promotion 거부 | PASS |
| Other-user promotion 거부 | PASS |
| Update attack 거부(관리자 본인 포함) | PASS |
| Delete attack 거부, 대상 행 보존 확인 | PASS |
| `isAdmin()`이 쓰는 조회 패턴: 일반 사용자 → null, 관리자 → not null | PASS |

**결과: 9 tests 전부 PASS.** 종료 후 테스트 계정 2개, `admins` 테스트 행 1건을 `service_role`로 전부 삭제했고, 별도 조회 스크립트로 잔여 데이터 0건을 재확인했다. 지시문이 요구한 "비로그인/일반 사용자/관리자" 표는 위 결과에 다음과 같이 대응한다: 비로그인은 애초에 `authenticated` 대상 정책만 있어 어떤 행도 조회할 수 없음(anon 역할 자체가 대상이 아님 — Phase6-2에서 이미 다른 테이블로 실측한 것과 동일한 구조), 일반 사용자는 `null`(=`isAdmin()`에서 `false`), 관리자는 `not null`(=`isAdmin()`에서 `true`).

### 단위 테스트로 대체하지 않은 이유(지시문 §10 대응)

`isAdmin()`의 **로직**(비로그인/일반/관리자/DB오류 4가지 분기)은 `lib/auth/isAdmin.test.ts`에서 `@/lib/auth/session`과 `@/lib/supabase/server`를 mock해 정상적으로 단위 테스트할 수 있었다(`lib/api/numbers.test.ts`의 기존 mocking 패턴을 그대로 재사용, 새로운 테스트 인프라 불필요). 다만 **RLS 정책 자체의 동작**(재귀 여부, self-promotion 차단 등)은 mock으로는 검증할 수 없는 실제 Postgres 정책 엔진의 동작이라 실제 Supabase 통합 테스트가 별도로 필요했다 — 두 테스트가 서로 다른 계층을 검증하므로 상호 대체 관계가 아니라 상호 보완 관계다.

---

## 13. 기존 기능 회귀 테스트

`npm run build` 결과 라우트 목록이 Phase6-4-0 시점과 **완전히 동일**했다(`/`, `/login`, `/onboarding`, `/generate`, `/my/journal`, `/my/journal/history`, `/my/journal/dreams`, `/my/journal/fortune-history`, `/ui-preview`, `/api/auth/kakao/*`, `/api/numbers`, `/api/profile`). `proxy.ts`, `lib/auth/kakao.ts`, `lib/auth/profile.ts`, `lib/auth/session.ts`, `app/api/numbers/route.ts`, `app/api/profile/route.ts`는 이번 Task에서 전혀 수정하지 않았다(파일 mtime으로 확인, §14). `lib/types/database.ts`의 유일한 변경(§6)이 기존 118개 테스트 중 어느 것도 깨뜨리지 않았음을 `npm test`로 확인했다.

---

## 14. Validation 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 통과 — **11 test files, 118 tests**(기존 114 + 신규 4: `isAdmin.test.ts`) |
| `npm run build` | 통과, 라우트 목록 변경 없음 |
| `npx supabase migration list` | local/remote **완전 일치**(`0001~0013`, `0012` 포함) |

`git status`/파일 mtime으로 확인한 이번 Task의 실제 변경 파일: `supabase/migrations/0012_admin_access.sql`(신규), `lib/auth/isAdmin.ts`(신규)+테스트, `lib/auth/index.ts`(1줄 추가), `lib/types/database.ts`(재생성), 본 보고서 — 그 외 `app/*`, `components/*`, `proxy.ts`, `lib/api/admin/draws.ts`, `lib/api/notifications.ts`, `user_numbers`/`draws`/`notifications` 스키마·RLS는 전부 미변경.

---

## 15. 발견된 문제

- 이번 Task 범위에서 새로 발견된 결함은 없다 — RLS 재귀, self-promotion, 타인 promotion, UPDATE/DELETE 차단 전부 설계대로 동작했다.
- `DATABASE_SCHEMA.md §3.23`이 `admins`/`admin_audit_logs`의 정확한 컬럼 정의를 제공하지 않는다는 사실은 Phase6-4-0에서 이미 발견했던 것을 이번에 실제로 메꿔야 했다(§4의 최소 컬럼 제안으로 해결) — 문서에는 이 제안을 반영하지 않았다(문서 수정은 이번 Task 범위 밖).
- `0012_admin_access.sql`을 원격에 적용할 때 `--include-all` 플래그가 필요했던 것은 실제 결함이 아니라 "0012가 나중에 채워진 예약 번호"라는 이 프로젝트 고유의 번호 체계 때문이며, dry-run으로 사전에 정확히 무엇이 적용될지 확인했으므로 리스크 없이 처리했다.

---

## 16. Phase6-4-2(`/api/admin/draws` Route 연결) 착수 가능 여부

**CONDITIONAL READY**

관리자 권한 기반(DB/RLS/`isAdmin()`) 자체는 실제 Supabase에 적용되고 검증까지 완료돼 **기술적으로는 즉시 Route를 연결할 수 있는 상태**다. 다만 다음 1가지가 남아 있어 "완전한 READY"가 아니라 "조건부"로 분류한다:

1. **실제 운영 관리자 계정이 아직 `admins`에 없다.** 이번 Task는 지시문에 따라 운영 관리자 계정을 임의로 생성하지 않았다 — 개발자 본인이 §8에 문서화된 절차(service_role로 직접 SQL INSERT)를 실행해 최소 1명을 `admins`에 등록해야, Phase6-4-2에서 실제로 `/api/admin/draws`를 호출해 종단 간(end-to-end) 검증을 할 수 있다. Route 코드 자체(`parseAdminDrawsInput()`+`registerDrawAndMatchUserNumbers()`+`isAdmin()` 조립)를 작성하는 데는 지장이 없지만, "관리자로 로그인해 실제로 성공 응답을 받는" 시나리오 검증은 이 절차가 선행돼야 가능하다.

이 항목은 코드 작업이 아니라 운영 절차(SQL 1줄 실행)이므로, Phase6-4-2 착수 자체를 막지는 않는다 — Route 구현과 병행하거나 구현 직후 수행해도 무방하다.
