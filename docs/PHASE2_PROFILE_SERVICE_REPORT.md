# PHASE2-2 PROFILE SERVICE LAYER — 구현 보고서

> [[PHASE2_AUTH_DECISION]](Decision 1·3·4)과 [[PHASE2_AUTH_FOUNDATION_IMPLEMENTATION_REPORT]](service_role 클라이언트, `profiles` RLS 정리)를 기반으로, "로그인 이후 사용할 Profile Service"를 구현한 결과 기록이다. 이 Task는 OAuth/로그인 UI/온보딩 화면을 만들지 않는다 — `profiles` 조회·생성·수정을 위한 서버 계층(`lib/auth/`)과 그것을 노출하는 API Route만 구현한다.

---

## 1. 생성/수정 파일

| 파일 | 종류 | 내용 |
|---|---|---|
| `lib/auth/profile.ts` | 신규 | Profile Service — 조회/생성/존재 확인/수정, 입력 검증, 에러 타입 |
| `lib/auth/session.ts` | 신규 | `getCurrentUser()`, `resolveProfileProvider()` |
| `lib/auth/index.ts` | 신규 | `lib/auth/profile`·`lib/auth/session` 배럴 export |
| `lib/auth/profile.test.ts` | 신규 | `calculateAgeVerified`/`parseProfileCreateInput`/`parseProfileUpdateInput` 단위 테스트 |
| `app/api/profile/route.ts` | 신규 | `GET`/`POST`/`PUT` Route Handler |
| `lib/supabase/service.ts` | 수정 | `createClient<Database>()`로 제네릭 추가(타입 안전한 `.from("profiles")` 접근을 위해 필요) |
| `lib/constants/index.ts` | 수정 | `PROFILE_NICKNAME_MAX_LENGTH`(30), `PROFILE_MIN_AGE`(19) 상수 추가 |
| `docs/PHASE2_PROFILE_SERVICE_REPORT.md` | 신규 | 본 보고서 |

Migration/schema/RLS 변경 없음. 카카오 OAuth, 로그인 UI, 온보딩 화면, 회원가입 UI 없음. 기존 코드(기존 `lib/supabase/client.ts`/`server.ts`, `proxy.ts` 등) 리팩토링 없음 — `service.ts`/`constants/index.ts` 수정은 이번 Task가 요구한 기능(타입 안전한 service_role 클라이언트, 검증 상수)을 위해 필요한 최소 추가다.

---

## 2. Profile Service 구조 (`lib/auth/profile.ts`)

모든 DB 접근은 `lib/supabase/service.ts`(service_role)만 사용한다. 클라이언트 세션 기반 접근 경로는 이 파일에 존재하지 않는다.

| 함수 | 역할 | 비고 |
|---|---|---|
| `getProfile(userId)` | 조회 | `.maybeSingle()` — 없으면 에러 대신 `null` 반환 |
| `profileExists(userId)` | 존재 여부 확인 | `getProfile`을 재사용하는 얇은 래퍼. 이번 Task의 API Route에서는 직접 쓰지 않지만, `proxy.ts`가 "로그인했지만 profile 없음 → `/onboarding`"을 판단할 때 쓸 용도로 [[PHASE2_AUTH_DECISION]] Decision 1이 명시적으로 요구한 기능이라 미리 구현했다(§5 참조) |
| `createProfile(userId, provider, input)` | 생성 | `provider`는 별도 인자로 받는다 — body에서 절대 읽지 않는다(§4) |
| `updateProfile(userId, input)` | 수정 | `input`은 이미 화이트리스트를 통과한 값만 들어온다는 전제 |
| `parseProfileCreateInput(body)` | 생성 입력 검증 | `nickname`/`birth_date`(필수), `gender`/`birth_time`/`marketing_opt_in`/`privacy_public_default`(선택, 기본값 채움). `provider`/`status`/`age_verified`는 이 함수가 아예 읽지 않는다 |
| `parseProfileUpdateInput(body)` | 수정 입력 검증 | `nickname`/`gender`/`birth_time`/`marketing_opt_in`/`privacy_public_default`만 인식. 다른 키는 존재해도 무시. 화이트리스트 통과 후 필드가 하나도 없으면 `ProfileValidationError` |
| `calculateAgeVerified(birthDate)` | 만 19세 이상 계산 | `age_verified`는 항상 이 함수의 결과만 쓴다(§4) |
| `ProfileNotFoundError`/`ProfileAlreadyExistsError`/`ProfileValidationError` | 도메인 에러 타입 | Route가 `instanceof`로 구분해 HTTP 상태코드에 매핑(§3) |

### idempotent한 생성 (중복 생성 방지)

"먼저 존재를 확인하고 없으면 생성"(check-then-act) 방식은 동시 요청 사이에 경쟁 조건이 생길 수 있어 채택하지 않았다. 대신 `profiles.id`가 PK라는 사실을 그대로 활용한다 — `insert()`를 바로 시도하고, Postgres가 반환하는 `23505`(`unique_violation`) 에러코드를 `ProfileAlreadyExistsError`로 변환한다. 두 요청이 동시에 들어와도 DB가 최종 중재자이므로 반드시 하나만 성공하고 하나는 명확한 409로 실패한다 — 코드로 직접 락을 구현할 필요가 없다.

### 타임존 버그 수정 (구현 중 발견)

최초 구현은 `new Date(birthDate)`로 파싱한 뒤 `getMonth()`/`getDate()`(로컬 getter)로 나이를 계산했다. `"YYYY-MM-DD"` 형식 문자열은 Date 생성자가 **UTC 자정**으로 해석하는데, 그 뒤 로컬 getter로 읽으면 서버가 실행되는 타임존에 따라 계산된 날짜가 하루 밀릴 수 있다(음의 UTC 오프셋 지역에서 특히). 이 문제는 `npm test` 실행 중 로컬 타임존에서 실제로 재현되어 발견했다(§5). `birthDate` 문자열에서 정수를 직접 추출하고 "오늘"도 UTC getter로 통일해 서버 배포 타임존과 무관하게 항상 같은 결과가 나오도록 수정했다 — 만 19세 판정은 법적 요건([[AI_ENGINEERING_CONSTITUTION]] §2 "데이터 무결성 우선")이라 타임존에 따라 결과가 달라지는 것은 허용할 수 없는 결함이었다.

---

## 3. API Route 설명 (`app/api/profile/route.ts`)

| 메서드 | 동작 | 성공 응답 | 실패 응답 |
|---|---|---|---|
| `GET` | 현재 사용자 profile 조회 | `200 { data: profile }` | `401`/`404`/`500` |
| `POST` | profile 최초 생성 | `201 { data: profile }` | `400`/`401`/`409`/`500` |
| `PUT` | profile 수정(화이트리스트 필드만) | `200 { data: profile }` | `400`/`401`/`404`/`500` |
| `DELETE` | **구현하지 않음** | — | Next.js가 자동으로 `405 Method Not Allowed` 반환(export 안 된 메서드는 App Router가 기본 처리) |

모든 핸들러의 첫 동작은 `getCurrentUser()`로 세션을 확인하는 것이다 — 세션이 없으면 즉시 `401`, DB 접근을 전혀 시도하지 않는다. 에러 응답은 `{ error: { code, message } }` 공통 구조를 따른다.

### 403(권한 없음)을 이번 Task에서 실제로 트리거하지 않는 이유

공통 에러 코드 타입(`ErrorCode`)에 `"FORBIDDEN"`을 정의는 해뒀지만, 이 라우트의 세 메서드는 전부 "자기 자신의 profile"만 다루고 역할(관리자 등) 구분이 아직 없어 403이 발생할 실제 시나리오가 없다. 존재하지 않는 조건을 억지로 만들어 트리거하기보다, 다른 사용자의 리소스나 관리자 전용 작업이 생기는 시점(Phase9 관리자 기능 등)에 자연스럽게 쓰이도록 타입만 남겨뒀다 — 이 결정을 솔직하게 기록한다.

---

## 4. 보안 구조

[[PHASE2_AUTH_DECISION]] Decision 3·4를 그대로 코드에 반영했다.

1. **서버 전용 접근**: `lib/auth/profile.ts`의 모든 DB 함수는 `lib/supabase/service.ts`(service_role)만 사용한다. 클라이언트 세션으로 `profiles`에 접근하는 코드 경로는 이 프로젝트 어디에도 없다 — [[PHASE2_AUTH_FOUNDATION_IMPLEMENTATION_REPORT]]에서 이미 `profiles_insert_own`/`profiles_update_own` RLS 정책을 제거했으므로, 설령 실수로 클라이언트에서 직접 호출하는 코드가 생기더라도 DB가 구조적으로 차단한다(방어 심층화).
2. **민감 컬럼은 클라이언트 입력을 아예 읽지 않는다**: `provider`는 body가 아니라 `resolveProfileProvider(user)`(세션의 `app_metadata.provider`)로 서버가 판단한다. `age_verified`는 항상 `calculateAgeVerified(birth_date)`의 계산 결과만 쓴다. `status`는 어떤 API 경로로도 아예 다루지 않는다(DB `DEFAULT 'active'`에 위임). `birth_date`는 생성 시에는 필수 입력이지만 `parseProfileUpdateInput`은 이 필드를 인식조차 하지 않으므로 최초 생성 이후에는 수정 불가능하다.
3. **화이트리스트는 "허용 목록"이지 "차단 목록"이 아니다**: `parseProfileUpdateInput`은 `nickname`/`gender`/`birth_time`/`marketing_opt_in`/`privacy_public_default`만 알고 있고, 그 외 어떤 키(`provider`/`status`/`age_verified`/`birth_date`/`id`/`created_at`/`updated_at`/`best_win_rank_ever` 포함)도 이 함수의 코드 자체가 참조하지 않는다. "금지 컬럼 목록에서 걸러낸다"가 아니라 "허용 컬럼만 안다"는 구조라, 스키마에 새 민감 컬럼이 추가돼도 명시적으로 화이트리스트에 넣지 않는 한 자동으로 안전하다.
4. **`lib/auth/session.ts`는 service_role을 쓰지 않는다**: `getCurrentUser()`는 `lib/supabase/server.ts`(anon key + 쿠키)만 사용하며 DB를 전혀 수정하지 않는다. `getSession()`이 아니라 `getUser()`를 쓴 이유는 매 요청마다 Supabase Auth 서버에 재검증을 요청하기 위함이다([[AI_ENGINEERING_CONSTITUTION]] §11).

---

## 5. 발견된 문제

1. **타임존에 따른 나이 계산 오류(수정 완료)**: §2에서 설명한 대로, 최초 구현이 `npm test` 단계에서 실패해 발견했다. 로컬 Date 파싱/포맷팅을 완전히 제거하고 UTC 정수 비교로 재작성해 해결했다. 회귀 방지를 위해 `lib/auth/profile.test.ts`에 경계값 테스트(정확히 19번째 생일 당일 / 하루 전)를 남겼다.
2. **`profileExists`는 이번 Task의 실제 호출부가 없다**: API Route는 `getProfile`의 `null` 여부로 존재를 판단하므로 `profileExists`를 직접 쓰지 않는다. [[PHASE2_AUTH_DECISION]] Decision 1이 명시한 미래 소비처(`proxy.ts`)를 위해 서비스 계층에 미리 정의해뒀다 — 죽은 코드가 아니라 다음 Task가 바로 쓸 공개 API로 간주했다. `lib/auth/index.ts` 배럴도 같은 이유(현재 소비처는 없지만 `lib/utils/index.ts`/`lib/constants/index.ts`와 동일한 기존 컨벤션을 따름)로 유지했다.
3. **`app/api/profile/route.ts`는 아직 실사용 불가능한 상태**: 카카오/이메일 로그인이 없어 실제 세션을 만들 방법이 없으므로, 이 API를 지금 호출하면 항상 `401`이 난다(의도된 상태 — 다음 Task에서 로그인 플로우가 붙어야 end-to-end로 검증 가능).
4. **`ErrorCode.FORBIDDEN`이 이번 Task에서 한 번도 쓰이지 않는다**: §3에서 설명한 대로 의도적 결정이며 새로운 문제는 아니다.

---

## 6. 다음 Task 추천 순서

[[PHASE2_AUTH_FOUNDATION_IMPLEMENTATION_REPORT]] §6 순서를 그대로 승계한다.

1. **카카오×Supabase Auth 통합(REST API + Admin API) PoC** — `app/(auth)/auth/kakao/route.ts`, `lib/auth/kakao.ts`. `resolveProfileProvider`가 세션의 `app_metadata.provider`로 판단하므로, 이 PoC에서 `admin.createUser` 호출 시 `app_metadata: { provider: "kakao" }`를 명시적으로 설정해야 한다.
2. **이메일 로그인 연결** — 더 단순한 경로로 세션/쿠키 흐름을 먼저 검증. 이 시점부터 `GET/POST/PUT /api/profile`을 실제 세션으로 end-to-end 테스트할 수 있다.
3. **온보딩 화면(`birth_date` 입력)** — `POST /api/profile`을 호출하는 첫 실제 클라이언트.
4. **`proxy.ts` 보호 로직** — `profileExists()`를 실제로 소비하는 첫 지점. "로그인했지만 profile 없음 → `/onboarding`" 리다이렉트 구현.
5. **[[BACKLOG]] 항목 E(RLS 실사용자 테스트)** — 로그인이 동작해야 가능.

---

## 7. Ready 여부

**Profile Service Layer 완료 — Ready.** `profiles` 조회/생성/존재확인/수정이 service_role 기반으로 구현되었고, 민감 컬럼은 코드 구조상 클라이언트 입력이 도달할 수 없다. `lint`/`type-check`/`test`(12개, 신규 타임존 버그 수정 포함)/`build` 전부 통과했고, 빌드 산출물(`client 번들`)에 `service_role`/profile 서비스 코드가 포함되지 않았음을 직접 확인했다. 다음 Task(카카오 PoC 또는 이메일 로그인)를 시작하기 위한 선행 조건이 모두 충족되었다.
