# PHASE2 AUTHENTICATION ARCHITECTURE DECISION — ADR

> 이 문서는 [[PHASE2_AUTH_ARCHITECTURE_AUDIT]]에서 "확정 필요"로 남겨둔 4개 항목의 **최종 Architecture Decision**을 기록한다. 감사 문서가 선택지를 나열하고 리스크를 분석하는 문서였다면, 이 문서는 그 선택지 중 하나를 실제로 고르고 이유를 남기는 ADR(Architecture Decision Record)이다.
>
> **이 문서 자체는 코드/migration/schema를 만들지 않으며, 기존 문서([[DATABASE_SCHEMA]]·[[EXECUTION_PLAN]]·[[IMPLEMENTATION_PLAN]]·[[AI_ENGINEERING_CONSTITUTION]]·[[BACKLOG]])도 수정하지 않는다.** 이 문서가 승인되면, 그 반영(RLS 정책 정리 migration, `lib/supabase/service.ts` 생성, 관련 문서 갱신 등)은 **별도의 Phase2 구현 Task**에서 [[AI_ENGINEERING_CONSTITUTION]] §4 Task Execution Protocol을 따라 수행한다.
>
> 결정 시점: 2026-08-06. 결정 기준: [[AI_ENGINEERING_CONSTITUTION]] §2 원칙 우선순위(단순함 > 유지보수 > 보안/데이터무결성 > …) 및 [[MASTER_PRD]] §3 "1인 개발 원칙".

---

## 1. Authentication Architecture Overview

4개 Decision은 서로 독립적이지 않다 — Decision 1(profile 생성 방식)과 Decision 3(민감 컬럼 보호)은 사실상 하나의 아키텍처로 수렴하고, Decision 2(카카오 통합 방식)는 Decision 1의 진입점을 결정하며, Decision 4(service_role 클라이언트)는 나머지 세 결정을 구현하는 공통 인프라다. 최종 흐름은 다음과 같다.

```
[카카오 로그인 버튼 클릭]
        │
        ▼
app/(auth)/auth/kakao/route.ts   ← Decision 2: REST API + Admin API 방식
  - 카카오 REST API로 토큰 교환/사용자 정보 조회
  - supabase.auth.admin.createUser / generateLink (lib/supabase/service.ts 사용, Decision 4)
        │
        ▼
세션 발급 (쿠키)
        │
        ▼
profiles 존재 여부 확인 (auth.uid()로 SELECT)
        │
   ┌────┴────┐
   │ 없음     │ 있음
   ▼          ▼
/onboarding   서비스 이용
  (생년월일 입력)
        │
        ▼
POST /api/profile   ← Decision 1: API Route + service_role (트리거 없음)
  - lib/supabase/service.ts로 profiles 최초 INSERT
  - provider/nickname/birth_date/age_verified 서버가 계산해 채움
        │
        ▼
profiles 존재 → 서비스 이용

[이후 프로필 수정(닉네임 변경 등)]
        │
        ▼
PATCH /api/profile   ← Decision 3: RLS UPDATE 정책 제거 + service_role 화이트리스트
  - nickname/gender/birth_time/marketing_opt_in/privacy_public_default만 허용
  - age_verified/status/provider/birth_date는 이 경로로도 클라이언트 값 신뢰 안 함
```

**핵심 설계 원칙 하나로 요약**: `profiles`에 대한 INSERT/UPDATE는 클라이언트가 Supabase 세션으로 직접 수행하지 않는다. 항상 `app/api/profile/route.ts`(service_role, [[IMPLEMENTATION_PLAN]] §5 "관리자 전용 작업은 API Route에서만" 원칙의 연장)를 경유한다. `profiles_select_own`만 클라이언트 직접 접근을 유지한다. 이 원칙이 4개 Decision 전체를 관통한다.

---

## 2. Decision 목록

### Decision 1 — `profiles` 생성 방식

**문제**: 회원가입(카카오/이메일) 시 `profiles` 행을 누가/언제/어떻게 생성하는가. [[DATABASE_SCHEMA]] §6은 "가입 트리거"를, [[EXECUTION_PLAN]] Phase2 §3은 "API Route"를 암시해 문서 간 불일치가 있었다([[PHASE2_AUTH_ARCHITECTURE_AUDIT]] §1.3). 근본 제약: `profiles.provider`/`nickname`/`birth_date`가 전부 `NOT NULL`([[DATABASE_SCHEMA]] §3.1)인데, 카카오 동의항목은 닉네임·프로필만 제공하고 `birth_date`는 제공하지 않는다.

**선택지**:
- A안 — DB Trigger(`auth.users` INSERT 시 자동 생성)
- B안 — Next.js API Route + service_role
- C안 — Hybrid(트리거가 최소 행 생성 → API Route가 나머지 채움)

**평가**:

| 기준 | A안(트리거) | B안(API Route) | C안(하이브리드) |
|---|---|---|---|
| 유지보수성 | 낮음 — SQL/PLpgSQL 함수 유지보수, TS 테스트 도구 미적용 | 높음 — TypeScript, 기존 테스트 도구 그대로 적용 | 낮음 — 두 실행 경로(트리거+API)를 동시에 유지보수 |
| 1인 개발 적합성 | 낮음 — DB 함수 디버깅은 별도 학습곡선 | 높음 — 이미 익숙한 Next.js 스택 | 낮음 — 두 경로의 상태 동기화까지 신경써야 함 |
| Supabase 권장 패턴 | 커뮤니티에서 흔한 패턴이나, 전제(트리거만으로 완전한 row 생성 가능)가 이 스키마에서 깨짐(`birth_date NOT NULL`) | 표준 패턴은 아니지만 Supabase 공식 문서도 "서버에서 admin API로 생성" 경로를 지원 | 두 패턴을 억지로 결합 — 어느 쪽 문서도 이 조합을 권장하지 않음 |
| 장애 디버깅 용이성 | 낮음 — Postgres 로그만으로 원인 추적, Vercel 로그와 분리됨 | 높음 — Vercel 함수 로그/스택트레이스로 즉시 원인 파악 | 낮음 — 트리거 단계 실패인지 API 단계 실패인지부터 구분해야 함 |
| RLS와의 충돌 가능성 | 낮음(SECURITY DEFINER가 RLS 우회) | 낮음(service_role이 RLS 우회) | 낮음(둘 다 우회) — 이 기준에서는 우열 없음 |
| `birth_date NOT NULL` 문제 해결 | **해결 불가** — placeholder 값을 넣어야 하며, 이는 하드코딩 금지 원칙([[AI_ENGINEERING_CONSTITUTION]] §3)과 충돌하고 "가짜 생년월일이 저장된 미완성 행"이라는 새로운 오염 상태를 만든다 | **회피** — 생년월일을 실제로 받은 시점에만 INSERT하므로 애초에 문제가 발생하지 않음 | 부분 해결 — 여전히 트리거 단계에서 placeholder 필요 |

**결정**: **B안(Next.js API Route + service_role) 채택. 트리거는 사용하지 않는다.**

추가로, [[PHASE2_AUTH_ARCHITECTURE_AUDIT]] §6이 우려한 "고아 `auth.users`" race condition은 **재정의로 해소한다**: 로그인 세션은 있지만 `profiles` 행이 아직 없는 상태를 오류가 아니라 **"온보딩 미완료"라는 정상적인 애플리케이션 상태**로 취급한다. `proxy.ts`(Decision과 무관하게 어차피 Phase2에서 구현해야 함)가 이 상태를 감지해 `/onboarding`으로 리다이렉트하면 된다. 사용자가 온보딩을 중단해도 데이터 오염이 없다 — 재로그인 시 동일한 리다이렉트가 다시 발생할 뿐이며, `profiles` INSERT는 멱등적으로(이미 있으면 무시) 설계하면 된다.

**결정 이유**: [[AI_ENGINEERING_CONSTITUTION]] §2 우선순위 1위 "단순함"과 2위 "유지보수"를 정면으로 만족한다. 1인 개발자가 Postgres 함수와 Next.js 코드 두 스택을 동시에 디버깅할 필요가 없어지고, C안처럼 두 경로를 동기화할 필요도 없다. `birth_date NOT NULL` 제약은 이번 Task에서 스키마 변경이 금지되어 있으므로 그대로 두되, B안은 이 제약과 정면으로 충돌하지 않는 유일한 선택지다.

**영향 범위**:
- 신규 파일(향후 구현 Task): `app/api/profile/route.ts`(POST — 최초 생성), `lib/supabase/service.ts`(Decision 4), 온보딩 화면(예: `app/(auth)/onboarding/page.tsx` — **[[EXECUTION_PLAN]] Phase2 §3 파일 목록에 현재 없음, 신규 필요 항목으로 체크리스트에 반영**).
- `proxy.ts`: "세션은 있으나 profiles 없음" 상태를 감지하는 로직 추가 필요(원래도 계획된 세션 갱신/보호경로 로직에 통합 가능).
- DB: `0008`에서 만들어진 `profiles_insert_own` 정책은 Decision 3에 따라 제거 대상(§Decision 3 참조) — 트리거를 안 쓰므로 클라이언트 직접 INSERT 경로 자체가 필요 없어짐.
- 문서: [[DATABASE_SCHEMA]] §6 "본인만(가입 트리거)" 표현, [[EXECUTION_PLAN]] Phase2 파일 목록 — 실제 갱신은 구현 Task의 Phase E에서 수행.

---

### Decision 2 — Kakao OAuth 통합 방식

**문제**: 카카오는 Supabase Auth 기본 제공 OAuth 프로바이더 목록에 없다([[DATABASE_SCHEMA]] §2). 어떤 경로로 카카오 로그인을 Supabase 세션으로 연결할지 확정한다.

> **표기 주의**: 이번 Task 지시문의 라벨(A안=Supabase Auth Provider 직접 연결/OIDC, B안=Route Handler 처리 후 연결/REST API)은 [[PHASE2_AUTH_ARCHITECTURE_AUDIT]]·[[IMPLEMENTATION_PLAN]] §3의 라벨과 **반대로 매핑**된다(감사 문서의 "방식 A"=REST API, "방식 B"=OIDC). 아래는 이번 Task 지시문 기준 라벨을 사용하고, 괄호로 감사 문서 라벨을 병기한다.

**선택지**:
- A안(=감사 문서 "방식 B") — Supabase Auth의 커스텀 OIDC 프로바이더로 카카오를 직접 등록
- B안(=감사 문서 "방식 A") — Next.js Route Handler에서 카카오 REST API로 토큰 검증 후 `auth.admin.createUser`/`generateLink`로 Supabase 세션 발급

**평가**:

| 기준 | A안(OIDC) | B안(REST API + Admin API) |
|---|---|---|
| 구현 난이도 | 카카오의 OIDC 표준 준수 범위가 불확실 — [[IMPLEMENTATION_PLAN]] §3 자체가 "카카오의 OIDC 지원 범위 확인 필요"라고 명시. PoC 실패 시 전면 재작업 위험 | 카카오 공식 문서/예제가 REST API 흐름을 기준으로 작성되어 있어 상대적으로 예측 가능 |
| 보안성 | Supabase가 OAuth 왕복 전체를 대행 — 검증된 경로지만, 카카오가 OIDC 스펙을 불완전하게 지원할 경우 사각지대 발생 가능 | 서버가 토큰 검증 전 과정을 직접 제어 — `admin.createUser` 같은 강한 권한을 다루므로 service_role 캡슐화(Decision 4)가 필수 |
| Supabase Auth 활용도 | 높음 — 세션 관리 전체를 Supabase 표준 흐름에 위임 | 상대적으로 낮음 — 우리 서버가 admin API로 세션을 직접 발급 |
| 유지보수 비용 | 이론적으로 낮음(프로토콜 세부사항을 Supabase가 관리) — 단, 전제인 "카카오 OIDC 정상 동작"이 검증되지 않은 상태에서는 이 장점이 확정적이지 않음 | 카카오 API 스펙 변경에 우리 코드가 직접 대응해야 함 — 그러나 카카오 REST API는 안정적으로 유지되는 공개 API |
| 기존 확보 자원과의 정합성 | 낮음 — `.env.local`에 이미 확보된 `KAKAO_REST_API_KEY`/`KAKAO_CLIENT_SECRET`/`NEXT_PUBLIC_KAKAO_JS_KEY` 구성은 OIDC 흐름에서는 대부분 불필요(Client ID/Secret은 보통 Supabase Dashboard에 등록) | 높음 — 확보된 키 구성이 정확히 이 방식에 대응([[PHASE2_AUTH_ARCHITECTURE_AUDIT]] §2.2) |

**결정**: **B안(Next.js Route Handler에서 카카오 REST API 처리 후 Supabase Auth 연결) 채택.**

**결정 이유**: 이미 확보된 환경변수 구성이 이 방식을 명확히 가리키고 있어 추가 계정/키 설정 없이 바로 착수 가능하다. 더 결정적으로, A안(OIDC)의 최대 리스크는 "카카오가 OIDC를 지원하는지 자체가 불확실"하다는 점인데, 이는 PoC 단계에서야 드러날 수 있는 리스크이며 실패 시 [[EXECUTION_PLAN]] Phase2 일정 전체가 지연된다. B안은 카카오 공식 문서 기준의 표준 REST 플로우라 이 불확실성이 없다. 유지보수 비용 항목만 보면 A안이 이론적으로 우수하지만, "확정되지 않은 이론적 장점"보다 "지금 확보된 자원으로 바로 검증 가능한 경로"를 택하는 것이 [[AI_ENGINEERING_CONSTITUTION]] §2 "단순함 우선"에 부합한다.

**영향 범위**:
- 신규 파일(향후 구현 Task): `app/(auth)/auth/kakao/route.ts`(REST API 토큰 교환/검증), `lib/auth/kakao.ts`(카카오 연동 헬퍼), `app/(auth)/auth/callback/route.ts`는 이메일 로그인 콜백 전용으로 단순화 가능(카카오는 자체 라우트에서 세션을 직접 발급하므로 Supabase 관리형 콜백을 타지 않음).
- 카카오 개발자 콘솔: Redirect URI를 우리 앱의 커스텀 라우트로 등록(Supabase 관리형 콜백 URL 불필요, [[PHASE2_AUTH_ARCHITECTURE_AUDIT]] §2.3).
- `lib/supabase/service.ts`(Decision 4)에 대한 의존성 — `admin.createUser`/`generateLink`는 반드시 service_role 클라이언트로 수행.
- 문서: [[DATABASE_SCHEMA]] §2 두 방식 병기 서술, [[BACKLOG]] F11(PoC 시점 표기 불일치) — 이번 결정으로 F11의 실질적 내용(PoC를 Phase2 착수 시 최우선으로 수행)은 그대로 유지되며 문서 표기만 향후 정정 대상.

---

### Decision 3 — `profiles` 민감 컬럼 보호 방식

**문제**: `profiles_update_own` RLS 정책(`auth.uid() = id`)은 행 단위로만 검사해 컬럼 단위 제약이 없다. 사용자가 자신의 `age_verified`(19세 미만 검증 무력화 — 법적 요건 위반), `status`(정지 상태 자가 해제), `provider`, `birth_date`를 직접 UPDATE할 수 있는 구조적 허점이 있다([[PHASE2_AUTH_ARCHITECTURE_AUDIT]] §3.3-A). `notifications_update_own`의 동일한 구조적 한계가 이미 [[BACKLOG]] F8로 기록되어 있으나, `profiles`는 법적 요건과 직결되어 훨씬 심각하다.

**선택지**:
- A안 — DB Trigger로 민감 컬럼 변경을 감지/차단
- B안 — RLS 유지 + 서버 API Route에서 update whitelist 적용
- C안 — `profiles` UPDATE 정책 제거 후 모든 변경을 service_role 경유로 강제

**평가**:

| 기준 | A안(트리거 차단) | B안(RLS 유지+API 화이트리스트) | C안(정책 제거+service_role 전면 강제) |
|---|---|---|---|
| 방어의 구조적 강도 | 높음 — 클라이언트가 어떤 경로로 호출해도(직접 supabase-js 포함) DB 레벨에서 차단 | **낮음** — API Route를 우회해 클라이언트에서 `supabase.from('profiles').update(...)`를 직접 호출하면 화이트리스트가 전혀 적용되지 않고 RLS도 컬럼 단위로는 막지 못함. 방어가 "개발자가 실수하지 않는다"는 코드 컨벤션에만 의존 | 높음 — 정책 자체가 없으므로(DATABASE_SCHEMA §6 "정책 없음=기본 차단" 원칙과 동일 패턴) 클라이언트가 어떤 경로로 호출해도 원천 차단 |
| 유지보수성 | 낮음 — 신규 SECURITY DEFINER/트리거 함수, OLD/NEW 비교 로직을 SQL로 유지보수 | 중간 — TypeScript지만 "RLS도 통과되고 화이트리스트도 통과해야 안전"이라는 이중 방어 모델을 계속 설명/유지해야 함 | 높음 — TypeScript 화이트리스트 하나만 유지보수하면 됨. 새 함수 불필요 |
| 1인 개발 적합성 | 낮음 | 중간 | 높음 |
| 장애 디버깅 용이성 | 낮음 — 트리거가 조용히 값을 되돌리면(silent revert) 클라이언트가 "성공했는데 왜 안 바뀌었지" 상태에 빠짐 | 높음(API 경유 시에는) | 높음 — RLS가 차단하면 명확한 42501 에러, API가 차단하면 명확한 4xx 응답 |
| Decision 1과의 일관성 | 낮음 — Decision 1은 이미 "INSERT도 service_role 전용"으로 결정함. A안은 INSERT는 서버 전용인데 UPDATE만 클라이언트+트리거 방어로 남겨 비대칭 구조가 됨 | 낮음 — 같은 비대칭 문제 | **높음** — INSERT/UPDATE 모두 "클라이언트 직접 접근 없음, service_role만" 원칙으로 통일 |

**결정**: **C안(`profiles` UPDATE — 및 Decision 1에 따라 INSERT도 — RLS 정책 제거, 모든 변경을 `app/api/profile/route.ts`의 service_role 경유로 강제) 채택.**

**결정 이유**: [[AI_ENGINEERING_CONSTITUTION]] §2는 보안/데이터무결성을 "사실상 타협 대상이 아니다"라고 명시한다. B안은 코드 컨벤션(항상 API Route를 통해서만 호출한다)에 의존하는 방어라 이 기준을 만족하지 못한다 — 미래의 어느 시점에 실수로(혹은 새 기능 추가 중 편의상) 클라이언트에서 `profiles`를 직접 update하는 코드가 한 줄이라도 들어가면 19세 미만 검증이 통째로 무력화된다. A안은 구조적으로는 안전하지만 Decision 1에서 이미 트리거를 배제한 결정과 모순되고, 새 SQL 함수 유지보수 부담이 추가된다. C안은 `draws`/`dreams` 등 다른 테이블에 이미 적용된 "관리자 정책 공통 원칙"([[DATABASE_SCHEMA]] §6 — 정책 없음=기본 차단, 서버가 service_role로만 씀)과 동일한 패턴이라 프로젝트 전체의 일관성도 높인다. `profiles_select_own`은 그대로 유지한다(SELECT는 컬럼 단위 위험이 없다).

**영향 범위**:
- DB: `0008`에서 생성된 `profiles_insert_own`/`profiles_update_own` 정책을 제거하는 **신규 migration(`0011`+)**이 필요 — 이번 Task에서는 생성하지 않음, Phase2 구현 착수 시 첫 작업으로 진행 권장.
- 신규 파일(향후 구현 Task): `app/api/profile/route.ts`에 PATCH 핸들러 추가, 화이트리스트 상수(예: `lib/constants/profile.ts`에 "클라이언트가 수정 가능한 컬럼 목록" 정의 — [[AI_ENGINEERING_CONSTITUTION]] §3 "매직스트링 금지"에 따라 상수화).
- `age_verified` 갱신 로직: 클라이언트가 boolean을 직접 보내는 것을 신뢰하지 않고, 서버가 `birth_date` 기준으로 만 19세 여부를 재계산해 세팅.
- 문서: [[DATABASE_SCHEMA]] §6 RLS 정책표(`profiles` INSERT/UPDATE 열)를 "service_role 전용"으로 갱신 필요 — 실제 갱신은 구현 Task Phase E에서.
- 참고(이번 결정의 범위 밖): [[BACKLOG]] F8(`notifications` UPDATE 동일 문제)·F10(`share_cards` INSERT 하이브리드)에도 같은 판단 기준(구조적 방어 > 코드 컨벤션 의존)을 적용할 수 있으나, 대상 테이블이 다르므로 이번 Task에서 결정하지 않는다.

---

### Decision 4 — `service_role` client 구조

**문제**: Decision 1~3 모두 서버 전용 `service_role` 클라이언트를 전제한다. 현재 코드베이스에는 이런 파일이 없다(`lib/supabase/client.ts`/`server.ts`는 둘 다 anon key만 사용, 직접 확인). 파일 위치·사용 가능 영역·클라이언트 번들 유입 방지 규칙을 확정한다.

**확인된 현재 구조**:
- `lib/supabase/client.ts` — `createBrowserClient`(anon key), 브라우저용.
- `lib/supabase/server.ts` — `createServerClient`(anon key) + 쿠키 기반 세션, Server Component/Route Handler용.
- 두 파일 모두 `lib/utils/env.ts`의 `getEnv()` 헬퍼로 환경변수를 읽는 패턴을 공유한다.
- `package.json`에 `server-only` 패키지는 설치되어 있지 않다(직접 확인).

**결정**:
1. **파일 위치**: `lib/supabase/service.ts` — 기존 `client.ts`/`server.ts`와 같은 디렉터리, 같은 명명 패턴(`createClient` export)을 따른다. 새 폴더를 만들지 않는다([[AI_ENGINEERING_CONSTITUTION]] §3 "폴더 구조를 임의로 바꾸지 않는다").
2. **구현 방식**: `@supabase/ssr`이 아니라 `@supabase/supabase-js`의 순수 `createClient`를 사용한다 — service_role은 세션리스(쿠키/사용자 세션과 무관)이므로 SSR 쿠키 어댑터가 불필요하다. `getEnv("SUPABASE_SERVICE_ROLE_KEY")`로 키를 읽되, 이 환경변수는 **`NEXT_PUBLIC_` 접두사를 절대 붙이지 않는다**([[AI_ENGINEERING_CONSTITUTION]] §11).
3. **사용 가능 영역**: Route Handler(`app/api/**/route.ts`), Server Action, 그리고 이들만 import하는 서버 전용 `lib/auth/*` 헬퍼로 한정한다. Server Component에서의 사용도 원칙적으로 지양한다 — 대부분의 읽기는 `lib/supabase/server.ts`(anon+RLS)로 충분하며, service_role은 "RLS 우회가 명확히 필요한 쓰기 작업"(profile 생성/갱신, notification 생성, 관리자 작업)에만 쓴다([[IMPLEMENTATION_PLAN]] §5, [[AI_ENGINEERING_CONSTITUTION]] §11).
4. **절대 금지**: `'use client'` 컴포넌트에서 import 금지. `proxy.ts`(미들웨어)에서도 사용 금지 — 세션 갱신/보호경로 체크는 anon 기반 `getUser()`로 충분하며, service_role이 필요한 시나리오가 아니다.
5. **번들 유입 방지**: 이번 Task는 코드 작성이 금지되어 있어 실제 가드는 구현 Task에서 적용하지만, 방향을 기록해둔다 — 파일 최상단에 `import "server-only"`를 추가해 클라이언트 번들에 포함되면 **빌드 타임에 즉시 에러**가 나도록 하는 것을 권장한다. `server-only`는 Vercel이 공식 유지하는 단일 목적 zero-dependency 패키지이며, [[AI_ENGINEERING_CONSTITUTION]] §15-8("service_role 키를 클라이언트 코드에 노출 금지")이 "절대 금지" 최상위 항목인 만큼 코드 리뷰만으로 방어하기보다 빌드 타임 강제가 타당하다. 다만 신규 라이브러리 추가는 §3 원칙에 따라 **Phase2 구현 Task 착수 시 별도로 정식 결정**한다(이번 문서에서 설치를 확정하지 않는다).

**결정 이유**: 기존 `lib/supabase/` 디렉터리 컨벤션을 그대로 확장하는 것이 [[AI_ENGINEERING_CONSTITUTION]] §2 "재사용 우선"·"단순함 우선"에 부합한다. 사용 가능 영역을 좁게 한정하는 이유는 Decision 1·3에서 service_role의 책임 범위를 "profiles 생성/갱신"으로 명시적으로 좁혀뒀기 때문에, 클라이언트 구조도 그 범위를 벗어나지 않도록 강제하는 것이 보안 원칙(§11)과 일치한다.

**영향 범위**:
- 신규 파일(향후 구현 Task): `lib/supabase/service.ts`.
- 환경변수: `SUPABASE_SERVICE_ROLE_KEY`가 `.env.local`/Vercel 환경변수에 이미 있는지 구현 Task 착수 시 재확인 필요(이번 감사에서는 카카오 관련 키만 직접 확인됨).
- 문서: [[EXECUTION_PLAN]] Phase2 §3 파일 목록에 `lib/supabase/service.ts`를 추가 반영 필요(감사 문서 §4가 이미 "누락 가능성"으로 지적) — 실제 갱신은 구현 Task Phase E에서.

---

## 3. Phase2 구현 규칙

Decision 1~4에서 도출된, Phase2 코드 작성 시 예외 없이 지켜야 할 규칙:

1. **`lib/supabase/service.ts`는 서버 전용 경로(Route Handler/Server Action/서버 전용 `lib/auth/*`)에서만 import한다.** Client Component와 `proxy.ts`에서는 절대 사용하지 않는다.
2. **`profiles`의 INSERT/UPDATE는 클라이언트가 Supabase 세션으로 직접 호출하지 않는다.** 항상 `app/api/profile/route.ts`(service_role)를 경유한다. `profiles_select_own`만 클라이언트 직접 접근을 허용한다.
3. **`age_verified`/`status`/`provider`/`birth_date`는 어떤 API 요청 바디 값도 그대로 신뢰하지 않는다.** `age_verified`는 서버가 `birth_date`로 재계산, `status`는 별도 관리자/탈퇴 플로우에서만, `provider`/`birth_date`는 최초 생성 이후 클라이언트 수정 대상에서 제외한다.
4. **"로그인했지만 `profiles`가 없는 상태"는 정상적인 온보딩 대기 상태로 처리한다.** 에러로 취급하거나 재시도 루프로 처리하지 않고, `/onboarding`으로 리다이렉트한다.
5. **카카오 로그인은 REST API + Admin API 방식(Decision 2)으로만 구현한다.** OIDC 커스텀 프로바이더 경로는 채택하지 않았으므로 관련 코드를 만들지 않는다.
6. **`auth.users`가 유일한 신원 테이블 원칙을 유지한다.** `profiles.id = auth.users.id` 1:1 관계를 벗어나는 보조 신원/세션 테이블을 새로 만들지 않는다.
7. **`profiles` 관련 신규 migration(정책 제거 등)은 이미 적용된 `0001`/`0008` 파일을 직접 수정하지 않고 새 번호(`0011`+)로 추가한다**([[AI_ENGINEERING_CONSTITUTION]] §7 Migration 원칙).
8. **service_role 사용 범위는 profile 생성/갱신, 관리자 작업, notification 생성으로 한정한다.** 새로운 용도로 확장하려면 그 자체를 별도 결정 사안으로 다룬다.

---

## 4. Phase2 구현 전 체크리스트

- [ ] 이 문서(`PHASE2_AUTH_DECISION.md`)에 대한 사용자 승인
- [ ] `0011` migration 준비: `profiles_insert_own`/`profiles_update_own` 정책 `DROP`, `profiles_select_own`은 유지 확인(Decision 1·3)
- [ ] `SUPABASE_SERVICE_ROLE_KEY`가 `.env.local` 및 Vercel 환경변수에 등록되어 있는지 확인(Decision 4)
- [ ] 카카오 개발자 콘솔에서 REST API 연동 기준 Redirect URI(`/auth/kakao` 등, Supabase 관리형 콜백 아님) 재등록 확인(Decision 2)
- [ ] 온보딩 화면(생년월일 입력) 설계 확정 — 현재 [[EXECUTION_PLAN]] Phase2 §3 파일 목록에 없는 신규 페이지임(Decision 1)
- [ ] `server-only` 패키지 도입 여부를 구현 Task 착수 시 별도로 정식 결정(Decision 4, 설치는 이번 문서에서 확정하지 않음)
- [ ] [[EXECUTION_PLAN]] Phase2 §3 파일 목록에 `lib/supabase/service.ts`, 온보딩 페이지 반영(구현 Task Phase E)
- [ ] [[DATABASE_SCHEMA]] §6 RLS 정책표(`profiles` INSERT/UPDATE 열)를 "service_role 전용"으로 갱신(구현 Task Phase E)
- [ ] [[BACKLOG]] 항목 E(RLS 실사용자 테스트)를 Phase2 완료 기준에 포함
