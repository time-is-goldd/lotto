# Phase6-4-0 관리자 인증 아키텍처 결정 및 사전 구현 감사

> 이 Task는 순수 조사·결정 Task다. 프로덕션 코드, DB 스키마, Migration, RLS, `proxy.ts`, HTTP Route를 전혀 수정하지 않았다. 산출물은 이 문서 1개뿐이다.

## 1. 조사 범위

지시문이 요구한 문서/코드를 실제로 열어 확인했다. 지시문이 언급한 파일명 중 실제와 다른 것이 있어 아래처럼 정정한다:

| 지시문이 언급한 이름 | 실제 존재 여부 | 실제 파일 |
|---|---|---|
| `docs/PHASE6_DATA_ARCHITECTURE_REPORT.md` | 없음 | `docs/PHASE6_DATA_ARCHITECTURE_DECISION.md`(Phase6-2 실제 산출물) |
| `docs/PHASE6_ARCHITECTURE_DECISION.md` | 없음 | 위와 동일 파일을 가리키는 것으로 판단 |

이 두 이름 불일치를 제외하면 지시문이 요구한 나머지 파일은 전부 실제로 존재해 그대로 읽었다: `docs/PHASE6_PRE_IMPLEMENTATION_AUDIT.md`, `docs/PHASE6_WINNING_LOGIC_REPORT.md`, `docs/PHASE6_ADMIN_DRAW_PROCESSING_REPORT.md`(Phase6-3 실제 산출물), `EXECUTION_PLAN.md`, `ROADMAP.md`, `DATABASE_SCHEMA.md`, `docs/ADMIN_REQUIREMENTS.md`, `docs/INFORMATION_ARCHITECTURE.md`, `docs/CRITICAL_REVIEW.md`, `proxy.ts`, `lib/auth/*`(6개 파일 전부), `app/api/profile/route.ts`, `lib/api/admin/draws.ts`, `lib/api/notifications.ts`, `lib/logic/matchNumbers.ts`, 실제 migration 12개 파일 전부, `npx supabase migration list` 실행 결과.

---

## 2. 현재 관리자 인증 상태

전부 추측 없이 실제 코드/커맨드로 확인한 결과다.

| 확인 대상 | 결과 |
|---|---|
| `profiles` 테이블에 admin 관련 컬럼 | **없음**(`0001_profiles.sql` 원문 확인 — `provider`/`nickname`/`birth_date`/`gender`/`birth_time`/`age_verified`/`marketing_opt_in`/`privacy_public_default`/`best_win_rank_ever`/`status`/`created_at`/`updated_at`뿐) |
| `is_admin` 컬럼 | 프로젝트 전체 어디에도 없음(전수 grep) |
| `admin_flag` 관련 컬럼 | 없음 |
| 별도 `admins` 테이블 | **DB에는 없음.** 다만 `DATABASE_SCHEMA.md` §3.23이 이미 이 테이블을 설계 대상으로 명시해뒀다(§3 참조) — "존재하지 않지만 이미 계획된 상태" |
| Supabase Auth `app_metadata` 기반 권한 구조 | 관리자 목적으로는 없음. 다만 `lib/auth/kakao.ts`가 `app_metadata.auth_provider`/`kakao_id`를 이미 다른 목적(로그인 제공자 식별)으로 쓰고 있어 "app_metadata를 서버가 신뢰된 값으로 쓰는 패턴" 자체는 이미 이 코드베이스에 선례가 있다 |
| `user_metadata` 기반 권한 구조 | 없음. `app/onboarding/page.tsx`가 `user_metadata.nickname`(카카오 제공, 사용자가 사실상 통제 가능한 값)을 읽는 용도로만 쓰고 있어, 오히려 "권한 판단에 `user_metadata`를 쓰면 안 된다"는 근거 사례로 확인됐다 |
| `0012_admin_flag.sql`의 정확한 내용 | **파일 자체가 존재하지 않는다.** `Glob supabase/migrations/0012*` → 0건. `EXECUTION_PLAN.md` L574가 파일명만 텍스트로 언급("*번호는 Phase1 Change Log 반영에 따라 밀림*")했을 뿐, 실제로 작성된 적이 없다 |
| 해당 migration 적용 여부 | 해당 없음(파일이 없으므로 적용도 불가능) |
| local/remote migration 상태 | `npx supabase migration list` 실행 결과: `local`/`remote` 둘 다 `0001~0011, 0013`만 존재하고 완전히 동기화돼 있다. **`0012`는 로컬에도 원격에도 없다** |
| `lib/auth/*`에 관리자 판정 함수 | 없음. 6개 파일(`profile.ts`, `profile.test.ts`, `kakao.ts`, `kakao.test.ts`, `session.ts`, `logout.ts`) 전수 확인, `index.ts` 배럴 export에도 admin 관련 export 없음 |
| `proxy.ts`의 관리자 경로 보호 구조 | 없음. `PROTECTED_PATHS = ["/onboarding", "/my"]`뿐이고 `/api/admin`이나 `/admin`을 다루는 코드가 전혀 없다(직접 읽어 확인) |
| 기존 RLS 정책의 관리자 예외 | `0008_rls_policies.sql`에 "관리자 전용" 정책은 하나도 없다 — `draws`/`dreams`/`winning_cases` 등은 전부 "정책 없음 = service_role 전용"으로 처리돼 있다(관리자 개념 자체가 RLS 레벨에 아직 등장하지 않음) |
| service_role을 쓰는 기존 서버 전용 패턴 | 있음. `lib/supabase/service.ts`(브라우저에서 호출 시 즉시 throw하는 가드 포함), `lib/auth/profile.ts`, `lib/auth/kakao.ts`, Phase6-3의 `lib/api/admin/draws.ts`/`lib/api/notifications.ts`가 이미 이 패턴을 쓰고 있다 |

### `DATABASE_SCHEMA.md`가 이미 결정해 둔 설계 (중요한 발견)

`DATABASE_SCHEMA.md` §3.23을 직접 확인한 결과, **이 프로젝트는 이미 "별도 `admins`/`admin_audit_logs` 테이블" 설계를 확정해뒀다**:

> "### 3.23 `admins` / `admin_audit_logs` (개정) — 1인 운영 기준으로 `admins.role`은 MVP에서 `super` 단일값만 사용한다([[ADMIN_REQUIREMENTS]] 단순화 원칙). `admin_audit_logs.diff`(JSONB)에 개인정보가 포함될 경우 마스킹 처리 규칙을 추가한다."

같은 문서 §6("RLS 정책 요약표")도 "`admins` 테이블/관리자 플래그는 Phase 9에야 생성된다... Phase 9에서 관리자 플래그가 생기더라도, 클라이언트가 직접 RLS를 통과해 쓰는 대신 서버 API route + service_role 패턴을 그대로 유지할 것을 권장한다"고 명시한다.

**단, 정확한 컬럼 정의(테이블의 다른 섹션처럼 컬럼/타입/설명 표)는 어디에도 없다** — §3.23은 이 문서에서 유일하게 컬럼 표가 없는 섹션이다. `role` 컬럼이 존재한다는 사실과 MVP 값(`super`)만 확인되고, `user_id`/`created_at` 등 나머지 컬럼, `admin_audit_logs`의 전체 컬럼은 이번 조사로 확정할 수 없었다 — Phase6-4(또는 실제 Phase9)에서 새로 설계해야 한다(§5에서 최소 제안).

### 문서 간 불일치 발견

`EXECUTION_PLAN.md`가 예약해 둔 파일명은 `0012_admin_flag.sql`("flag"라는 단수 컬럼/플래그 뉘앙스)이지만, `DATABASE_SCHEMA.md` §3.23의 실제 설계는 "별도 테이블 2개"(컬럼 단일 플래그가 아님)다. 두 문서가 가리키는 아키텍처가 미묘하게 다르다 — 이번 Task는 문서를 고치지 않지만(범위 밖), **`DATABASE_SCHEMA.md` §3.23을 더 상세하고 최근에 개정된 권위 있는 스키마 문서로 보고 그 설계를 따르기로 결정한다**(§3). 파일명은 그대로 `0012_admin_flag.sql`을 써도 되고(번호 재배치를 피하기 위해), 내용은 §3.23의 테이블 설계를 담으면 된다.

---

## 3. Migration 0012 상태

지시문 §4가 요구한 9개 항목 전부에 대한 답은 **"파일이 존재하지 않아 해당 없음"**이다:

1. 변경 대상 테이블 — 없음(파일 없음)
2. 추가 컬럼 — 없음
3. 기본값 — 없음
4. NULL 허용 여부 — 없음
5. 기존 사용자 적용값 — 없음
6. RLS 변경 여부 — 없음
7. 기존 정책과 충돌 여부 — 없음(비교 대상 자체가 없음)
8. local/remote 적용 상태 — 둘 다 미존재(§2 확인)
9. 다음 migration 번호와의 관계 — `0012`는 지금도 비어 있는 예약 번호다. `0013_profiles_status_default.sql` 자신의 주석이 "0012는 Phase9의 `0012_admin_flag.sql`을 위해 예약된 번호이고, 0001(Schema Freeze)을 직접 못 고쳐 0013을 대신 썼다"고 명시적으로 밝히고 있어, **`0012`는 정확히 이 관리자 인증 기능을 위해 아직 아무도 쓰지 않고 남겨둔 번호**임을 재확인했다. 이번 Task는 이 파일을 만들지 않는다(지시문 금지 사항).

---

## 4. 후보 아키텍처 비교

### Option A — `profiles.is_admin`(또는 동등 컬럼) 기반

### Option B — Supabase Auth `app_metadata` 기반

### Option C — 별도 `admins` 테이블 기반(`DATABASE_SCHEMA.md` §3.23과 일치)

| 항목 | A: profiles 컬럼 | B: app_metadata | C: admins 테이블 |
|---|---|---|---|
| 현재 DB 구조와 호환성 | 보통 — `0001` Schema Freeze 때문에 ALTER는 새 migration으로만 가능(`0013`과 동일 패턴), 사용자 프로필 책임에 권한 개념이 섞임 | 높음 — 스키마 변경 자체가 불필요 | 높음 — 기존 테이블 무엇도 건드리지 않고, §3.23이 이미 이 형태를 전제로 설계돼 있어 "제자리"를 찾아가는 변경 |
| Supabase Auth와의 적합성 | 보통(일반 컬럼일 뿐, Auth와 직접 연동 안 됨) | 높음 — app_metadata는 정확히 "서버만 쓸 수 있는 신뢰된 메타데이터"라는 Auth의 1급 용도에 맞는 사용례. `lib/auth/kakao.ts`가 이미 이 용도로 씀 | 보통 — `auth.users.id`를 FK로 참조하는 일반 애플리케이션 테이블(`profiles`와 동일 패턴) |
| service_role 사용 시 보안성 | 보통 — profiles UPDATE에 이미 본인 정책이 있어 컬럼 화이트리스트 관리가 필요 | 높음 — 클라이언트가 `app_metadata`를 절대 쓸 수 없음(Admin API 전용), 공격 표면 자체가 없음 | 높음 — 신규 테이블에 client 쓰기 정책을 아예 안 만들면(기존 전역 컨벤션) 안전 |
| 클라이언트 위조 가능성 | **위험 존재** — `profiles_update_own` 정책이 이미 본인 UPDATE를 허용하므로, `is_admin`을 실수로 업데이트 화이트리스트에 포함시키면 즉시 자기권한상승 취약점이 된다 | 불가능 — `user_metadata`와 달리 `app_metadata`는 클라이언트 SDK로 절대 수정 불가 | 불가능 — 애초에 client 대상 쓰기 정책이 없는 새 테이블(=정책 없음=차단, 이 프로젝트의 기존 컨벤션과 동일) |
| RLS와의 조합 | 기존 정책에 컬럼 하나가 얹혀, "본인이 자기 `is_admin`값을 읽을 수 있다"는 부수 효과 발생(정보 최소화 관점에서 약간 불리) | RLS 대상 테이블이 아님(Auth 내부 데이터) | 깔끔 — RLS enable 후 정책 없음=완전 차단이 기존 컨벤션과 정확히 같은 패턴 |
| proxy.ts 적용 가능성 | 가능 — `hasProfile()`과 동일하게 anon 세션 클라이언트로 `select is_admin from profiles`가 가능(RLS가 본인 SELECT를 이미 허용) | 가장 쉬움 — `getCurrentUser()`가 반환하는 `User.app_metadata`에 이미 포함돼 있어 추가 쿼리 자체가 불필요 | **본인 SELECT 정책을 별도로 추가해야만** 가능(기본은 정책 없음=차단이라 본인도 조회 불가) — 유일한 단점이지만 `profiles_select_own`과 동일한 패턴으로 쉽게 해결 |
| 관리자 추가/삭제 편의성 | 쉬움(`UPDATE profiles SET is_admin=true ...`) | 불편 — `auth.users`를 직접 SQL로 건드리는 것은 권장되지 않고, Admin API(`updateUserById`) 호출이 필요 | 쉬움(`INSERT/DELETE ... admins ...`, 일반 SQL) |
| 1인 개발 유지보수성 | 보통 — 사용자 데이터와 권한 데이터가 섞임 | 보통 — "관리자 목록"을 SQL로 조회할 수 없어(Admin API로 `auth.users` 순회 필요) Phase9 관리자 목록 화면에 불리 | 높음 — SQL로 목록/추가/삭제 전부 간단, `admin_audit_logs`와 FK로 자연 연결 |
| Migration 복잡도 | 낮음(컬럼 1개 ALTER) | 없음(마이그레이션 불필요) | 중간(테이블 2개 + RLS, 그래도 여전히 단순한 수준) |
| Phase9 Admin UI 확장성 | 낮음 — 역할이 늘면 `profiles`에 계속 컬럼/enum 추가 필요 | 낮음 — 여러 관리자/역할을 JSON으로 표현하면 SQL 필터링 불가 | **높음** — `admins.role` enum 확장, `admin_audit_logs` 감사로그 화면(`ADMIN_REQUIREMENTS.md` §8)까지 자연 확장, 팀원 합류 시 역할 재도입(`ADMIN_REQUIREMENTS.md` §0)도 이 구조가 전제 |
| 기존 사용자 데이터 영향 | 낮음(DEFAULT false로 전체 행 안전하게 채워짐, `0013`과 동일 안전 패턴) | 없음(기존 `app_metadata` 키와 충돌 없이 새 키만 추가) | 없음(완전히 새 테이블) |
| 향후 확장성 | 낮음 | 보통(조회 성능은 최고 — JWT에 이미 포함) | **높음** |

### 종합 판단

Option B(app_metadata)는 "클라이언트 위조 불가능"이라는 강점이 명확하고 이미 이 코드베이스에 선례(`auth_provider`)가 있지만, **관리자 목록 조회/추가/감사로그가 전부 SQL이 아닌 Admin API에 의존하게 돼 Phase9 Admin UI 확장성이 떨어진다.** Option A는 구현이 가장 간단하지만 **기존 `profiles_update_own` RLS 정책과 결합했을 때 자기권한상승 취약점을 만들 실수 여지**가 구조적으로 존재한다(화이트리스트에서 한 번만 실수해도 치명적). Option C는 Migration이 하나 더 필요하다는 것 외에는 열세인 항목이 없고, **`proxy.ts` 적용을 위해 SELECT 정책 하나가 추가로 필요하다는 유일한 단점도 기존 `profiles_select_own`과 완전히 같은 패턴이라 리스크가 낮다.**

---

## 5. 최종 관리자 인증 방식

**Option C(별도 `admins`/`admin_audit_logs` 테이블)를 채택한다.**

이것은 새로 발명한 결정이 아니라 **`DATABASE_SCHEMA.md` §3.23이 이미 확정해 둔 설계를 그대로 따르는 것**이다 — 이 프로젝트의 기존 설계 문서와 상충하는 별도 구조를 조용히 만들지 않는다는 원칙([[AI_ENGINEERING_CONSTITUTION]], 여러 Phase에서 이미 반복 적용된 원칙)과 정확히 일치한다.

### 지시문 원칙 대조

| 원칙 | 충족 방식 |
|---|---|
| 임시 관리자 인증 금지 | 이번 Task에서 실제로 아무 인증도 구현하지 않았다 — 방식만 결정 |
| 하드코딩된 이메일/UID 관리자 금지 | `admins` 테이블 행으로 관리 — 코드에는 어떤 UID도 기록되지 않는다(§6) |
| 클라이언트가 관리자 여부를 결정하지 않음 | `admins` 조회/판정은 서버(`isAdmin()`, 예정)에서만 수행 |
| `user_metadata`를 신뢰 근거로 사용하지 않음 | Option C는 애초에 `user_metadata`를 전혀 참조하지 않음 |
| service_role key 클라이언트 비노출 | `lib/supabase/service.ts`의 기존 가드가 이미 이를 보장(수정 없음) |
| HTTP Route에서 서버 측 재검증 | §8 Route Handler 설계가 이를 최종 보안 경계로 명시 |
| 일반 사용자/관리자 권한 명확 분리 | `admins`에 client 쓰기 정책 없음 = 일반 사용자는 절대 자신을 admin으로 만들 수 없음 |
| Phase9 Admin UI 확장 가능 | §4 비교의 "Phase9 확장성" 항목에서 C가 최선으로 평가됨 |
| 기존 일반 사용자 인증 불필요 변경 없음 | `profiles`/`auth.users`/기존 RLS 어느 것도 변경하지 않음(§8) |

### 제안하는 최소 컬럼 (Phase6-4 설계용 제안, 이번 Task에서 확정/구현 아님)

`DATABASE_SCHEMA.md` §3.23이 컬럼 표를 제공하지 않으므로, 이번 조사를 바탕으로 최소안을 제안한다(실제 채택은 Phase6-4 몫):

```
admins: id, user_id(FK→profiles.id, UNIQUE), role(enum, MVP는 'super'만), created_at
admin_audit_logs: id, admin_id(FK→admins.id), action(text), diff(jsonb, 마스킹 규칙 적용), created_at
```

`user_id`에 `UNIQUE`를 두는 이유는 한 사용자가 중복 admin 행을 갖지 않도록 하기 위함이며, `role`을 `profiles`가 아니라 `admins`에 두는 것이 §4의 "권한/프로필 책임 분리" 장점을 그대로 살린다.

---

## 6. 관리자 권한 부여 절차

| 항목 | 설계 |
|---|---|
| 최초 관리자 생성 | 개발자 본인이 이미 카카오 로그인으로 발급받은 `auth.users` 행의 UUID를, Supabase Dashboard SQL Editor(또는 1회성 service_role 스크립트)에서 `INSERT INTO admins (user_id, role) VALUES ('<uuid>', 'super');`로 직접 실행한다. 이 UUID는 실행 시점에만 값으로 존재하며 **코드 저장소 어디에도 기록되지 않는다** |
| 일반 사용자가 스스로 admin이 될 수 없는 구조 | `admins`에 client 대상 INSERT/UPDATE/DELETE 정책을 아예 만들지 않는다(이 프로젝트 전역 컨벤션: 정책 없음=기본 차단, `0008`의 `draws`/`dreams` 등과 동일). SELECT도 "본인 행만"으로 제한한다(§4 proxy.ts 항목과 연동) |
| service_role이 필요한 작업 | `admins` INSERT/DELETE(관리자 임명/해제), `draws` INSERT, `user_numbers` 배치 UPDATE, `notifications` INSERT — 전부 기존 "관리자 정책 공통 원칙"(`DATABASE_SCHEMA.md` §6)에 이미 해당하는 범주 |
| service_role이 필요 없는 작업 | `admins` 본인 SELECT(자기 자신이 관리자인지 확인, RLS로 처리), `draws`/`dreams` 등 기존 공개 데이터 열람(이미 공개 SELECT 정책 존재) |
| 개발/운영 환경 차이 | `npx supabase migration list`가 실제로 "Connecting to remote database"로 원격 프로덕션 프로젝트에 접속함을 이번 조사로 확인했다 — 로컬 스택과 프로덕션 프로젝트가 분리돼 있으므로, 관리자 행도 각 환경에 개별적으로 심어야 한다. 로컬 시드(`0010_seed_data.sql`류)에 개발자 계정을 자동으로 넣을지, 매번 수동으로 넣을지는 Phase6-4에서 결정 |
| 관리자 제거 방법 | `DELETE FROM admins WHERE user_id = '...';` — 매 요청마다 서버가 `admins`를 재조회하므로 즉시 효력이 발생하고, 세션을 별도로 무효화할 필요가 없다 |
| 관리자 계정 탈취 시 영향 범위 | 그 계정으로 로그인 가능한 공격자는 `/api/admin/*` 전체(임의 회차 등록, 전체 사용자 판정 결과 조작)에 접근 가능 — 이는 "관리자"라는 개념 자체가 갖는 본질적 리스크이며 이번 인증 방식 선택으로 없앨 수 있는 종류가 아니다. `admin_audit_logs`가 있으면 최소한 침해 발생 시 사후 추적이 가능하다는 점이 Option C의 부가적 이점이다 |

---

## 7. Proxy 보호 설계

지시문이 명시한 대로 **`proxy.ts`만으로 관리자 권한을 보장하지 않는다** — 2계층으로 분리한다.

```text
Proxy (1차 계층 — 빠른 접근 차단/UX/라우팅 보호)
  - PROTECTED_PATHS에 "/api/admin" 추가(제안, 이번 Task에서 실행 안 함)
  - hasProfile()과 동일한 패턴: service_role 없이 anon 세션 클라이언트로
    "select id from admins where user_id = auth.uid()" 조회
  - 이 조회가 가능하려면 admins에 "본인 행만 SELECT" RLS 정책이 필요
    (profiles_select_own과 동일한 패턴, §4/§5 참조)
  - 관리자가 아니면 로그인 페이지가 아니라 404 또는 홈으로 리다이렉트
    (관리자 API 경로의 존재 자체를 일반 사용자에게 드러내지 않기 위함,
    구체적 상태 코드는 Phase6-4에서 결정)

Route Handler (2차 계층 — 실제 보안 경계)
  - getCurrentUser() 재확인
  - isAdmin(user.id)(신규, service_role로 admins 조회) 재확인
  - Proxy를 통과했다는 사실을 신뢰하지 않고 매번 독립적으로 검증
```

`proxy.ts`가 service_role을 쓰지 않는다는 기존 원칙(`proxy.ts` 자체 주석, `hasProfile()`의 설계 근거)을 그대로 유지한다 — admins 조회도 `hasProfile()`과 동일하게 anon 세션 클라이언트 + RLS로 수행한다.

---

## 8. Route Handler 보호 설계

`app/api/profile/route.ts`를 실제로 읽고 확인한 이 프로젝트의 **기존 컨벤션은 "인증(`getCurrentUser()`) 먼저, 그 다음 JSON 파싱/검증"** 순서다(`app/api/numbers/route.ts`도 동일). 지시문 §6이 제시한 다이어그램("JSON parsing → Input validation → Authentication → Admin authorization")은 이 기존 컨벤션과 순서가 반대라, 지시문 자체가 허용한 대로("위 흐름을 그대로 채택하지 말고 실제 프로젝트 구조와 비교하여 수정한다") 기존 컨벤션에 맞춰 수정한다:

```text
HTTP POST /api/admin/draws
        ↓
getCurrentUser() 없음           → 401 UNAUTHORIZED
        ↓ 있음
isAdmin(user.id) false          → 403 FORBIDDEN
        ↓ true
JSON 파싱 실패                   → 400 VALIDATION_ERROR
        ↓ 성공
parseAdminDrawsInput() 실패      → 400 VALIDATION_ERROR
        ↓ 성공
registerDrawAndMatchUserNumbers()
  - DuplicateRoundError          → 409 DUPLICATE_ROUND  (기존 ProfileAlreadyExistsError→409 패턴과 동일)
  - 기타 에러                     → 500 INTERNAL_ERROR
        ↓ 성공
201/200 + { data: { round, matchedCount, winnersCount, failedUpdateIds } }
```

- 비로그인 → **401**(기존 전 API의 일관된 컨벤션 — `UNAUTHORIZED`)
- 로그인했지만 관리자 아님 → **403**(`app/api/profile/route.ts`의 `ErrorCode` 타입에 이미 `"FORBIDDEN"`이 정의돼 있으나 실사용된 적은 없다 — 이번이 최초 실사용처가 된다)
- 관리자 검증은 **service_role보다 먼저** 수행된다: `isAdmin()` 자체는 (관리자 판별을 위해) service_role로 `admins`를 조회할 수 있지만, 이 조회가 성공/실패하는 시점이 `registerDrawAndMatchUserNumbers()`(회차 INSERT+배치 UPDATE) 실행보다 반드시 앞선다 — 즉 일반 사용자는 `isAdmin()` 체크에서 이미 막혀 `registerDrawAndMatchUserNumbers()`의 service_role 경로에 절대 도달하지 못한다.

---

## 9. RLS 영향 분석

| 테이블 | 영향 | 결론 |
|---|---|---|
| `draws` | 없음 | 현재("전체 공개 SELECT, service_role 전용 쓰기") 그대로 유지 — `admins` 도입으로 client 대상 INSERT 정책을 추가할 필요가 없다(`DATABASE_SCHEMA.md` §6이 이미 이 방향을 권고: "관리자 플래그가 생기더라도 서버 API route + service_role 패턴 유지") |
| `user_numbers` | 없음 | 관리자 배치는 이미 service_role로 RLS를 우회한다 — `admins` 도입이 이 테이블의 RLS에 새로운 요구를 만들지 않는다 |
| `notifications` | 없음 | 이미 service_role 전용 INSERT — 변경 불필요 |
| `profiles` | 없음 | Option C를 채택했으므로 `profiles`는 전혀 손대지 않는다(Option A였다면 컬럼 추가가 필요했을 부분) |

**일반 사용자가 관리자 API를 우회해 Supabase에 직접 접근해 당첨 결과를 조작할 수 있는가?** `draws`는 client 대상 INSERT/UPDATE 정책이 없어 anon/authenticated 어느 역할로도 직접 조작이 불가능하다(Phase6-2에서 실제 Supabase로 이미 실측: anon INSERT `draws` → `403`). 유일하게 남는 경로는 사용자가 **자기 자신의** `user_numbers` 행의 `match_count`/`win_rank`를 직접 UPDATE하는 것인데(§10에서 재검토), 이것으로 `draws.numbers`(공식 당첨번호) 자체를 바꾸거나 다른 사용자의 결과에 영향을 줄 수는 없다.

---

## 10. Case C 대응 권고

Phase6-3이 발견한 문제: 배치 도중 일부 `user_numbers` UPDATE가 실패하면, 그 행은 `target_round`가 계속 `NULL`로 남아 **다음 회차**가 등록될 때 재조회 대상이 되어 원래 대조됐어야 할 회차가 아닌 엉뚱한 회차와 대조될 위험이 있다.

| 방식 | 평가 |
|---|---|
| 전체 작업 Transaction | Supabase-js(PostgREST)는 여러 개별 REST 호출을 하나의 DB 트랜잭션으로 묶는 기능을 제공하지 않는다 — 이 방식 자체가 불가능 |
| RPC(Postgres 함수) | 진짜 원자성을 보장하는 유일한 방법(하나의 `plpgsql` 함수 안에서 `draws` INSERT + 전체 `user_numbers` UPDATE 후 실패 시 자동 롤백). 다만 새 DB 함수 = 새 migration이 필요해 "정말 필요한 경우에만 migration 허용" 기준을 충족하는지는 **실제 실패 빈도가 관측된 뒤** 재평가해야 한다 |
| 실패 시 즉시 중단 | 이미 처리된 행은 target_round가 세팅되고 나머지는 안 된 채로 남아, 지금 방식(계속 진행+실패 목록 반환)보다 "부분 성공" 상태가 오히려 더 불명확해진다 — 개선이 아니다 |
| batch 단위 처리(`.upsert()`) | **유력한 개선안.** Supabase-js의 `.upsert(rows, { onConflict: "id" })`는 여러 행을 하나의 HTTP 요청 = 하나의 SQL 문으로 보내 PostgREST 레벨에서 원자적으로 처리된다. 지금처럼 행마다 개별 `.update().eq()` 호출을 반복하는 대신, 판정이 끝난 행 전체를 한 번의 `upsert()`로 묶으면 "부분 실패"가 발생할 지점 자체가 크게 줄어든다. 새 migration이나 RPC 없이, 순수 `lib/api/admin/draws.ts` 로직 개선만으로 가능하다 |
| `target_round` 조건을 UPDATE에도 포함 | 동시성(같은 행을 두 배치가 동시에 건드리는 것) 방지에는 도움되지만 Case C(단일 배치 내 일부 실패)와는 별개 문제 |
| `checked_at IS NOT NULL`인 행 제외 | 이미 현재 SELECT 조건(`target_round IS NULL AND checked_at IS NULL`)에 포함되어 있다 — 새로운 조치가 아님 |

**권고**: 단기적으로 `.upsert()` 기반 일괄 UPDATE로 전환해 부분 실패 가능성 자체를 낮춘다(코드 개선만으로 가능, migration 불필요). `draws` INSERT와 `user_numbers` 배치 사이의 완전한 원자성이 실제로 필요해지는 시점(사용자 규모가 커지고 부분 실패가 실제로 관측되는 시점)에 RPC 도입을 재검토한다 — 지금 RPC를 만드는 것은 "불필요하게 복잡한 transaction 금지" 원칙에 비추어 과도하다.

---

## 11. user_numbers 결과 위조 문제 대응 시점

Phase6-2/6-3이 이미 이 문제(`user_numbers_update_own` RLS의 컬럼 단위 제한 부재)를 발견하고 "지금 당장 보안 위험은 아니다(개인 다이어리 용도, 실제 상금 지급과 무관), Phase7 이후 공유 기능 설계 시 재검토"로 결론지었다. 이번 조사는 **관리자 인증 방식과 직접적인 관련이 없고**, `admins` 테이블 도입 여부가 이 문제의 위험도를 바꾸지 않는다는 것을 §9에서 확인했다. 기존 결론을 뒤집을 새로운 근거를 발견하지 못했으므로 **그대로 유지한다** — Phase7 이후 재검토.

---

## 12. Phase6-4 구현 정확한 범위

관리자 인증이 실제로 준비된 이후(§15 참조) Phase6-4가 해야 할 일:

1. `supabase/migrations/0012_admin_flag.sql` 작성(§5 제안 컬럼 기준) + `0008` 스타일 RLS(본인 SELECT만 허용, 그 외 client 정책 없음) — **사용자 승인 필요**
2. 개발자 본인 계정을 `admins`에 1건 등록(service_role, §6 절차)
3. `lib/auth/isAdmin.ts` 구현 — `admins` 테이블을 service_role로 조회하는 단순 함수(`lib/auth/profile.ts`의 기존 패턴과 동일한 형태로)
4. `proxy.ts`에 `/api/admin` 1차 보호 추가(§7)
5. `app/api/admin/draws/route.ts` 생성 — §8 순서로 `parseAdminDrawsInput()` + `registerDrawAndMatchUserNumbers()`(둘 다 Phase6-3에서 이미 완성, 수정 불필요) 조립
6. `lib/api/admin/draws.ts`의 배치 UPDATE를 `.upsert()` 기반으로 개선(§10 권고, 선택적이지만 권장)
7. Phase6-3에서 수행하지 못한 Test B/C(일반 사용자 403, 비로그인 401, 둘 다 DB 변경 없음)를 실제 Route에 대해 재검증

---

## 13. 금지된 변경 사항 확인

이번 Task에서 지시문 §11이 금지한 항목을 실제로 건드리지 않았음을 `git status`로 확인했다:

- `app/api/admin/draws/route.ts` — 생성 안 함(디렉터리 자체가 없음)
- `proxy.ts` — 미수정
- Migration — 생성/수정/실행 없음(`supabase/migrations/`에 새 파일 없음)
- DB Schema/RLS — 수정 없음
- 관리자 계정 생성/권한 부여 — 실행하지 않음
- `lib/api/admin/draws.ts`/`lib/api/notifications.ts` — 로직 미수정(읽기만 함)
- UI/`/admin` 페이지 — 구현 안 함
- 외부 로또 API 연동 — 없음

---

## 14. Validation 결과

이번 Task는 코드를 전혀 수정하지 않았으므로 아래 결과는 Phase6-3 종료 시점과 동일하다(회귀 없음을 재확인하는 차원에서 재실행):

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 통과 — 10 test files, 114 tests(변경 없음) |
| `npm run build` | 통과, 라우트 목록 Phase6-3과 완전히 동일(`app/api/admin` 없음) |

---

## 15. 최종 Decision 목록

| # | 항목 | 분류 |
|---|---|---|
| 1 | 관리자 인증 방식 | **결정 완료** — Option C(`admins`/`admin_audit_logs` 테이블, `DATABASE_SCHEMA.md` §3.23과 일치) |
| 2 | Migration 0012 사용 여부 | **결정 완료(사용한다)**, 단 실제 작성/적용은 **Phase6-4에서**(사용자 승인 필요) |
| 3 | `/api/admin/*` 보호 방식 | **결정 완료** — 2계층(Proxy 1차 UX 차단 + Route Handler 2차 실제 검증) |
| 4 | 관리자 권한 검증 위치 | **결정 완료** — Route Handler가 최종 보안 경계, Proxy는 보조 |
| 5 | 최초 관리자 생성 방법 | **결정 완료** — service_role로 SQL 직접 INSERT, 코드에 UID 미기록 |
| 6 | Case C 원자성 문제 | **Phase6-4에서 결정** — 단기: `.upsert()` 전환 권고, 장기: RPC는 실패 빈도 관측 후 재검토 |
| 7 | `user_numbers` 결과 필드 위조 문제 | **Phase7 이후** — 기존 결론 유지, 이번 조사로 변경 없음 |
| 8 | 알림 중복 방지 | **결정 완료** — Phase6-3에서 이미 구조적으로 해결(round UNIQUE + target_round 단방향 전이), 추가 작업 불필요 |
| 9 | `draws` 공개 SELECT 정책 | **결정 완료(변경 불필요)** — 그대로 유지 |
| 10 | Phase8 외부 API 연동 | **Phase8 이후** — 이번 조사 범위 밖, 영향 없음 확인만 |
| 11 | 관리자 UI Phase9 범위 | **Phase9 이후** — 이번 조사 범위 밖, `admins.role` 확장성이 이를 지원하도록 설계됨(§4) |

---

## 16. Phase6-4 착수 가능 여부

**BLOCKED**

다음 3개 항목이 선행되어야 `/api/admin/draws`를 실제로 연결하는 작업(Phase6-4)에 착수할 수 있다:

1. **`0012_admin_flag.sql` migration 작성 및 적용**(§5 제안 컬럼: `admins`/`admin_audit_logs` 테이블 + RLS) — 사용자 승인이 필요한 스키마 변경이라 이번 Task에서 수행하지 않았다.
2. **최초 관리자(개발자 본인) 계정을 `admins`에 등록** — 위 migration이 적용된 뒤에만 가능하다.
3. **`lib/auth/isAdmin.ts` 구현** — 위 두 가지가 준비된 뒤에만 실제로 동작을 검증할 수 있다.

이 세 가지가 갖춰지면 `app/api/admin/draws/route.ts` 자체는 이미 완성된 `parseAdminDrawsInput()`/`registerDrawAndMatchUserNumbers()`(Phase6-3)를 그대로 조립하기만 하면 되므로, 남은 구현 자체의 난이도는 낮다.
