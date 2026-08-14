# PHASE2 AUTHENTICATION ARCHITECTURE AUDIT — 구현 착수 전 검토 기록

> 이 문서는 **분석 전용 문서**다. 코드/migration/schema를 만들지 않으며, [[DATABASE_SCHEMA]]·[[EXECUTION_PLAN]]·[[IMPLEMENTATION_PLAN]]·[[AI_ENGINEERING_CONSTITUTION]]도 변경하지 않는다. Phase1 RLS Preparation Audit([[PHASE1_RLS_PREPARATION_AUDIT]])과 동일한 성격의 문서로, Phase2(Authentication) 착수 전 "설계 승인용" 자료다. 이 문서의 권고안은 승인 전까지 확정이 아니다.
>
> 검토 시점 코드베이스 상태(직접 확인): `lib/supabase/client.ts`/`server.ts`는 이미 anon key 기반 SSR 클라이언트로 구현되어 있다(Phase0 산출물). `proxy.ts`는 `matcher: []`인 빈 껍데기다. `app/api/profile/`, `lib/auth/`는 아직 존재하지 않는다. service_role을 쓰는 서버 전용 클라이언트 파일은 코드베이스 어디에도 없다.

---

## 1. 현재 인증 관련 설계 현황 정리

### 1.1 사용 예정 Auth 방식

| 방식 | 상태 | 근거 |
|---|---|---|
| Kakao OAuth | Must, 방식 A/B 미확정 | [[MASTER_PRD]] §6 Must, [[IMPLEMENTATION_PLAN]] §3 |
| 이메일/비밀번호 | Must(폴백) | Supabase Auth 기본 제공, "카카오 장애 시 폴백"([[DATABASE_SCHEMA]] §2) |
| 익명(비회원) 이용 | 기능적으로 존재하나 **Supabase Anonymous Auth 아님** | 아래 참조 |

**익명 사용자 지원에 대한 중요한 구분**: 이 프로젝트가 말하는 "비회원 이용"(번호생성 결과만 표시, `fortune_results`/`share_cards`의 `user_id NULL` 허용)은 Supabase의 `auth.signInAnonymously()` 같은 **익명 인증 세션**을 쓰는 것이 아니다. 단순히 "세션 자체가 없는(anon key로만 요청하는) 상태"를 가리킨다. 즉 `auth.uid()`가 존재하는 "익명 로그인 사용자"가 아니라 `auth.uid()`가 아예 `NULL`인 "비로그인 요청"이다. 이 구분은 RLS 정책 설계(`0008`에서 이미 `to authenticated`/`to anon`을 역할별로 분리한 이유)와 직결되므로 Phase2 구현 시에도 혼동하지 않아야 한다.

### 1.2 Supabase Auth user와 `public.profiles` 관계

`profiles.id`가 `auth.users.id`를 그대로 사용하는 1:1 관계(PK=FK, `0001`). `auth.users`는 Supabase가 관리하는 유일한 신원 테이블이고, 애플리케이션 프로필 데이터는 전부 `profiles`에 저장한다([[DATABASE_SCHEMA]] §2). `ON DELETE`는 지정되지 않아 Postgres 기본값(`NO ACTION`) — `auth.users`가 삭제되면 `profiles`가 조용히 사라지는 대신 오류로 막히는 것이 §7 A안(탈퇴는 UPDATE로 익명화, 실삭제 없음)과 일치한다.

### 1.3 회원가입 시 profile 생성 방식 후보

**A안 — Database Trigger**
```
auth.users INSERT
  ↓ (같은 트랜잭션)
BEFORE/AFTER INSERT 트리거(SECURITY DEFINER)
  ↓
profiles 자동 생성
```

| 항목 | 내용 |
|---|---|
| 장점 | `auth.users`와 `profiles` 생성이 원자적(atomic) — "auth.users는 있는데 profiles가 없는" 상태가 구조적으로 발생할 수 없음. 클라이언트/서버 코드 개입 없이 DB가 보장. Supabase 커뮤니티에서 가장 흔히 쓰이는 표준 패턴(`on auth.users insert` 트리거) |
| 단점 | 새 함수(SECURITY DEFINER 트리거 함수) 생성이 필요 — Phase1 내내 지켜온 "신규 함수/트리거 임의 생성 금지" 원칙과 표면적으로 부딪히는 것처럼 보이지만, 이는 Phase1에서 다루지 않은 **정당한 신규 기능**이라 별개 사안이다. 더 심각한 문제는 트리거 실행 시점에 `profiles.provider`/`nickname`/`birth_date`(전부 NOT NULL)를 채울 데이터가 부족할 수 있다는 것 — 카카오 동의항목이 "닉네임·프로필만"이라 `birth_date`가 없다([[IMPLEMENTATION_PLAN]] §3). 트리거만으로는 이 컬럼을 채울 수 없어 별도 온보딩 단계가 필수가 된다 |

**B안 — Next.js API Route + service_role**
```
auth.users INSERT (Supabase Auth가 처리)
  ↓
클라이언트가 세션 확보 후 API Route 호출
  ↓
app/api/profile/route.ts
  ↓
service_role로 profiles 생성
```

| 항목 | 내용 |
|---|---|
| 장점 | 생성 로직이 TypeScript에 있어 유지보수/테스트 용이([[AI_ENGINEERING_CONSTITUTION]] "유지보수 우선"과 부합). 카카오 프로필 정보 + 추가로 입력받은 생년월일을 조합해 완전한 row를 한 번에 구성 가능. 19세 미만 검증(Must)을 이 경로에서 서버 사이드로 강제하기 쉬움 |
| 단점 | `auth.users` 생성과 `profiles` 생성 사이에 시간차가 생겨, 그 사이 클라이언트가 API 호출을 빠뜨리거나 실패하면 "고아 `auth.users`" 상태가 남을 수 있음 — 재시도/upsert 설계 필요 |

**문서 간 표현 불일치(발견)**: [[DATABASE_SCHEMA]] §6은 profiles INSERT를 "본인만(**가입 트리거**)"로 표기해 A안(DB 트리거)을 암시하지만, [[EXECUTION_PLAN]] Phase2 §3은 생성 파일 목록에 "`app/api/profile/route.ts`(최초 로그인 시 profiles 생성/갱신)"만 명시해 B안(API Route)을 암시한다. 두 문서가 서로 다른 메커니즘을 전제하고 있다 — 이는 `0009` Task 보고서에서 이미 한 차례 지적된 사안(§3 유사 문제)과 같은 종류이며, Phase2 착수 전 확정이 필요하다.

**권고(확정 아님)**: 완전한 A안 또는 B안 단독보다, "가입 시 트리거가 카카오 프로필(nickname)만으로 최소 `profiles` 행을 즉시 생성(트리거가 채울 수 있는 컬럼만) → 이후 온보딩 화면에서 API Route가 `birth_date`/`age_verified` 등 나머지 컬럼을 UPDATE로 채우는" 하이브리드가 실무적으로 더 안전하다. 단, `nickname`/`provider`/`birth_date`가 모두 NOT NULL이라 트리거 단계에서 `birth_date`를 채울 수 없다는 문제가 여전히 남는다 — 이 경우 트리거가 임시 placeholder 값을 넣거나, 애초에 A안을 포기하고 B안으로 가되 "auth.users 생성 즉시 클라이언트가 자동으로 API Route를 호출"하도록 강제하는 UX 설계(재시도 포함)로 race condition을 완화하는 방향도 검토 가능하다. **이 결정은 Phase2 구현 Task에서 사용자 승인 후 확정한다.**

---

## 2. Kakao OAuth 흐름 검증

### 2.1 예상 흐름과 분기점

```
사용자
  ↓
로그인 버튼 클릭
  ↓
Kakao OAuth  ← 방식 A/B에 따라 경로가 완전히 갈라짐(아래 참조)
  ↓
Supabase Auth callback
  ↓
session 생성
  ↓
profile 생성/조회  ← §1.3의 A/B/하이브리드 결정에 종속
  ↓
서비스 이용
```

**방식 B(OIDC 커스텀 프로바이더)**: 표준 Supabase OAuth 흐름. `/auth/kakao` → Kakao 로그인 페이지 → Kakao가 **Supabase 관리형 콜백**(`<project-ref>.supabase.co/auth/v1/callback`)으로 redirect → Supabase가 세션 발급 → 우리 앱 `/auth/callback`으로 최종 redirect해 세션 교환.

**방식 A(REST API + Admin API)**: 카카오 로그인이 Supabase OAuth 흐름 밖에서 완전히 별도로 진행. 카카오 JS SDK가 브라우저에서 직접 로그인 → access token 획득 → 우리 서버(`app/(auth)/auth/kakao/route.ts` 등)로 토큰 전달 → 서버가 카카오 API로 토큰 검증/사용자 정보 조회 → `supabase.auth.admin.createUser`/`generateLink`로 세션 발급 → 클라이언트가 세션을 쿠키에 저장.

두 방식은 콜백 URL 구조·필요 환경변수·실제 코드 위치가 전혀 다르다. **"방식 A/B 최종 확정"이 Phase2의 실질적인 첫 번째 관문이어야 하는 이유가 여기서 명확해진다** — 확정 전에는 `/auth/callback` 라우트의 실제 구현조차 정의할 수 없다.

### 2.2 현재 환경변수 구조와의 일치 여부

`.env.local`에 확보된 카카오 관련 키(직접 확인): `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `NEXT_PUBLIC_KAKAO_JS_KEY`.

**관찰**: 이 키 구성은 **방식 A(REST API 기반)에 더 가깝다.** `KAKAO_REST_API_KEY`+`KAKAO_CLIENT_SECRET`은 서버가 카카오 토큰 교환에 직접 쓰는 REST API 키/시크릿 조합이고, `NEXT_PUBLIC_KAKAO_JS_KEY`는 클라이언트 SDK용이다. 방식 B(OIDC 커스텀 프로바이더)라면 보통 Client ID/Secret을 Supabase Dashboard 자체에 등록해 Supabase가 OAuth 왕복을 대행하므로, 애플리케이션 `.env`에 이런 키가 반드시 필요하지는 않다. **즉, 지금까지 확보해둔 환경변수 구성 자체가 이미 방식 A 쪽을 은연중에 가리키고 있다** — 확정된 결정은 아니지만, Phase2 PoC 착수 시 이 힌트를 무시하지 않는 것이 좋다.

### 2.3 필요한 Callback URL

- 우리 앱 내부: `/auth/callback`(README "환경변수 설정"에 이미 언급, [[EXECUTION_PLAN]] Phase0 체크리스트에서 확인).
- 방식 B를 택할 경우 추가로: Supabase 관리형 콜백 URL(`<project-ref>.supabase.co/auth/v1/callback`)을 카카오 개발자 콘솔의 Redirect URI로 등록해야 한다. 방식 A라면 이 URL은 불필요하고 우리 앱의 커스텀 콜백 라우트만 등록하면 된다.

### 2.4 `proxy.ts` 역할

현재 `matcher: []`로 어떤 요청에도 개입하지 않는 껍데기 상태(직접 확인). Phase2에서 채워야 할 두 역할:
1. **세션 갱신(refresh)**: Supabase SSR 패턴은 매 요청마다 `supabase.auth.getUser()`를 호출해 만료 임박 세션 쿠키를 갱신해야 한다 — 이게 없으면 세션이 예기치 않게 끊길 수 있다. `lib/supabase/server.ts`의 기존 주석("세션 갱신은 middleware(Phase 2)가 담당하므로 무시해도 안전하다")이 이미 이 책임을 `proxy.ts`에 위임해둔 상태다.
2. **보호 경로 접근 제어**: `/my/*`, `/admin/*` 매칭 시 비로그인 요청을 `/login`으로 리다이렉트.

### 2.5 Middleware/proxy에서 처리해야 할 인증 체크

- 세션 쿠키 파싱 및 갱신(표준 `@supabase/ssr` 패턴).
- `matcher` 배열을 실제 보호 경로로 채우기(현재 빈 배열).
- `profiles.status = 'withdrawn'`인 사용자의 로그인 차단 — [[DATABASE_SCHEMA]] §7이 "로그인 자체는 애플리케이션 레벨에서 차단"이라고 명시했으므로 이는 DB 제약이 아니라 `proxy.ts`(또는 그 뒤의 API 레벨)에서 구현해야 하는 로직이다.

---

## 3. `profiles` 테이블 RLS 검토

`0008`에서 실제 적용된 정책(`pg_policies` 조회로 재확인):

| 정책 | CMD | 대상 | 조건 |
|---|---|---|---|
| `profiles_select_own` | SELECT | authenticated | `(select auth.uid()) = id` |
| `profiles_insert_own` | INSERT | authenticated | `(select auth.uid()) = id` |
| `profiles_update_own` | UPDATE | authenticated | `(select auth.uid()) = id` (USING/WITH CHECK 동일) |
| (DELETE 정책 없음) | - | - | 불허(§7 A안) |

### 3.1 Kakao OAuth 로그인 이후 profile 생성이 가능한 구조인지

INSERT 정책이 `to authenticated`이므로, 카카오 로그인 성공(세션 발급) 이후부터 `auth.uid()`가 유효해지고 그 시점부터 "본인 id로 INSERT"가 RLS상 허용된다. 다만 **누가 실제로 이 INSERT를 실행하느냐**에 따라 이 정책이 실질적으로 쓰이는지가 갈린다:
- A안(SECURITY DEFINER 트리거)이면 트리거가 RLS를 완전히 우회하므로 이 정책은 평가되지 않는다(안전망으로만 존재).
- B안(service_role API Route)이면 service_role도 RLS를 우회하므로 마찬가지다.
- **클라이언트가 로그인 직후 자신의 세션으로 직접 INSERT하는 경로를 택할 때만** 이 정책이 실제 관문이 된다.

**결론**: 구조적으로 어떤 방식을 택하든 RLS가 profile 생성을 막지 않는다 — 문제 없음.

### 3.2 service_role 사용이 필요한 부분인지

- A안(트리거): 트리거 자체가 DB 레벨에서 실행되므로 별도 service_role 클라이언트가 필요 없다.
- B안(API Route): 명시적으로 `SUPABASE_SERVICE_ROLE_KEY`를 쓰는 서버 전용 클라이언트가 필요하다. **현재 코드베이스에는 이런 파일이 아직 없다**(`lib/supabase/client.ts`/`server.ts` 둘 다 anon key만 사용 — 직접 확인). Phase2에서 신규로 만들어야 한다(§4 참조).

### 3.3 RLS 때문에 발생 가능한 문제

**(A) UPDATE 정책의 컬럼 단위 제약 부재 — 이번 감사에서 발견한 가장 중요한 리스크**
`profiles_update_own`은 행 전체에 대해 `auth.uid()=id`만 검사한다. 즉 사용자가 자신의 `status`(예: 관리자가 `'suspended'`로 바꿔둔 것을 스스로 `'active'`로 되돌리기), `age_verified`(19세 미만 검증 결과 자가 조작), `provider`, `birth_date` 같은 민감 컬럼도 클라이언트에서 직접 UPDATE할 수 있는 구조다. Must 기능인 "19세 미만 이용제한"이 `age_verified`에 의존하는데, 이 컬럼을 본인이 임의로 `true`로 바꿀 수 있다면 나이 검증 자체가 무력화된다.

이는 이미 `0008`에서 발견한 `notifications_update_own`의 "`is_read`만 제한 불가" 문제([[BACKLOG]] F8)와 **정확히 같은 종류의 Postgres RLS 구조적 한계**(OLD/NEW 컬럼별 비교는 트리거 없이 표현 불가)이지만, `profiles`에서는 법적 요건(19세 미만 이용제한)과 직결되어 훨씬 더 심각하다.

**권고**: RLS만으로 해결할 수 없으므로, API Route(또는 Server Action)가 `age_verified`/`status`/`provider`/`birth_date` 같은 민감 컬럼은 항상 서버(service_role)에서만 쓰도록 강제하고, 클라이언트에는 `nickname`/`gender`/`birth_time`/`marketing_opt_in`/`privacy_public_default` 같은 "본인이 자유롭게 바꿔도 되는" 컬럼만 노출하는 애플리케이션 레벨 화이트리스트 검증이 필요하다. **이 결정은 Phase2 구현 시 사용자 승인이 필요한 사안이다.**

**(B) INSERT 시 NOT NULL 컬럼 충족 문제**
`provider`/`nickname`/`birth_date`가 전부 NOT NULL인데 카카오 동의항목은 "닉네임·프로필만"이라 `birth_date`를 제공하지 않는다. 클라이언트가 직접(또는 트리거가) 이 시점에 INSERT를 시도하면 `birth_date` 없이는 NOT NULL 위반으로 실패한다. **이는 RLS 문제가 아니라 NOT NULL 제약과 OAuth 동의항목 범위 사이의 구조적 간극**이며, §1.3의 A/B/하이브리드 결정과 직접 연결된다.

---

## 4. Phase2 구현 파일 계획

[[EXECUTION_PLAN]] Phase2 §3/§4에 이미 명시된 목록을 기준으로, 이번 감사에서 파악한 현재 코드 상태와 역할을 덧붙인다.

### 생성 파일

| 파일 | 역할 | 현재 상태 |
|---|---|---|
| `app/(auth)/login/page.tsx` | 로그인 화면(카카오 버튼 + 이메일 폼) | 없음 |
| `app/(auth)/auth/callback/route.ts` | OAuth 콜백 처리(세션 교환) | 없음 — 방식 A/B 확정 후 구현 가능 |
| `app/(auth)/auth/kakao/route.ts` | 카카오 로그인 개시(방식 A라면 토큰 검증 로직 포함) | 없음 |
| `lib/auth/kakao.ts` | 카카오 SDK/REST 연동 헬퍼 | 없음 |
| `lib/auth/session.ts` | 세션 관련 헬퍼 | 없음 |
| `lib/auth/getCurrentUser.ts` | 현재 로그인 사용자 조회 | 없음 |
| `app/api/profile/route.ts` | 최초 로그인 시 profiles 생성/갱신(B안/하이브리드 채택 시 service_role 사용) | 없음 |
| `components/auth/AgeVerificationModal.tsx` | 19세 미만 검증 모달(Must) | 없음 |
| `components/auth/LoginButton.tsx` | 로그인 버튼 | 없음 |

**이번 감사에서 추가로 식별한, [[EXECUTION_PLAN]]에 명시되지 않은 필요 파일**
| 파일(가칭) | 역할 | 비고 |
|---|---|---|
| `lib/supabase/service.ts` | `SUPABASE_SERVICE_ROLE_KEY`를 쓰는 서버 전용 클라이언트 | B안/하이브리드 채택 시 반드시 필요. [[EXECUTION_PLAN]] Phase2 §3 목록에 없음 — 누락 가능성으로 §5 "발견된 리스크"에 별도 기록. 클라이언트 번들에 절대 포함되지 않도록 서버 전용 파일 경계를 명확히 해야 함([[AI_ENGINEERING_CONSTITUTION]] §3, §11) |

### 수정 파일

| 파일 | 필요한 변경 | 현재 상태 |
|---|---|---|
| `proxy.ts` | 세션 갱신 + `matcher`를 `/my/*`, `/admin/*` 등으로 채움 | `matcher: []` 빈 껍데기(직접 확인) |
| `lib/supabase/server.ts` | 쿠키 기반 세션 연결 | **이미 구현되어 있음**(직접 확인 — Phase0에서 [[EXECUTION_PLAN]] 계획보다 먼저 완료된 것으로 보임). Phase2에서는 재검증 정도만 필요할 가능성 |
| `app/layout.tsx` | 전역 인증 상태 연결 | 미확인(Phase2 착수 시 재확인 필요) |

---

## 5. Phase2 구현 순서 제안

[[EXECUTION_PLAN]] Phase2 §5의 8단계를 이번 감사 결과에 맞춰 재구성했다 — 원안과 목표는 동일하되, "확정 → 단순 경로 검증 → 실제 구현 → 보호 → 테스트" 순서를 더 명확히 분리했다.

| 단계 | 내용 | 비고 |
|---|---|---|
| Phase2-1 | Supabase Auth client/server 구조 재검증 + `lib/supabase/service.ts`(service_role) 신규 추가 | `client.ts`/`server.ts`는 이미 존재 — "구축"이 아니라 "재검증+보완" |
| Phase2-2 | 카카오×Supabase Auth 통합 방식(A/B) 최종 확정(PoC) | §2.2의 환경변수 힌트(방식 A 쪽) 참고, 최종 결정은 실제 PoC로 |
| Phase2-3 | 이메일 로그인 먼저 연결(배관 검증) | [[EXECUTION_PLAN]] 권장 순서와 동일 — 더 단순한 경로로 세션/쿠키 흐름부터 검증 |
| Phase2-4 | Auth callback 처리 + 세션 발급 확인 | 이메일 로그인으로 먼저 검증 |
| Phase2-5 | 카카오 로그인 플로우 구현 | Phase2-2에서 확정한 방식대로 |
| Phase2-6 | profile 생성/갱신 로직 구현(A/B/하이브리드) | §1.3 결정 사항 반영, NOT NULL 컬럼 충족 전략 포함, `age_verified`/`status` 등 민감 컬럼 서버 전용 화이트리스트 적용(§3.3-A 권고 반영) |
| Phase2-7 | 19세 미만 이용제한 체크(클라이언트+서버) | Must, [[FEATURE_SPEC]] §9.3 |
| Phase2-8 | `proxy.ts` 보호 로직(matcher, 세션 갱신, `withdrawn` 상태 차단) | |
| Phase2-9 | 로그아웃 구현 | |
| Phase2-10 | RLS 실사용자 테스트 | [[BACKLOG]] 항목 E — 실제 계정 2개로 "본인만 보임/타인 안 보임" 교차 검증. Phase2 완료 기준에 포함시킬 것을 권장 |

---

## 6. 발견 가능한 위험 요소

**Supabase Auth와 Kakao OAuth 충돌 가능성**
방식 A/B에 따라 완전히 다른 인프라 경로를 타므로(§2.1), 방식을 정하지 않고 코드부터 짜기 시작하면 전면 재작업 위험이 크다. 순서상 최우선(Phase2-2)으로 배치해 구조적으로 완화했다.

**profile 생성 race condition**
§1.3에서 분석한 대로, A안(트리거)은 원자적이라 이 위험이 낮고 B안(API Route)은 "고아 `auth.users`" 상태가 발생할 수 있다. 하이브리드를 택하더라도 "트리거가 만든 최소 profiles 행"과 "API Route가 채우는 나머지 컬럼" 사이에는 여전히 시간차가 존재한다 — upsert 또는 재시도 로직 설계가 필요하다.

**RLS INSERT 실패 가능성**
NOT NULL 컬럼(특히 `birth_date`)을 충족하지 못한 상태로 INSERT를 시도하면 RLS 통과 여부와 무관하게 NOT NULL 제약 위반으로 실패한다(§3.3-B). RLS 문제가 아니라 데이터 완전성 문제이며, "온보딩 완료 전까지 profiles row가 아예 없는" 상태를 화면/API가 어떻게 다룰지 결정이 필요하다.

**Session cookie 처리 문제**
`lib/supabase/server.ts`는 이미 "Server Component에서 쿠키 쓰기 불가 → middleware(Phase2)가 담당하므로 무시해도 안전"이라는 전제를 코드 주석에 남겨두고 있다(직접 확인). 이 전제가 실제로 유효해지려면 `proxy.ts`가 세션 갱신을 실제로 구현해야 한다 — 현재는 빈 매처 상태라, `proxy.ts` 구현 전까지는 이 전제가 아직 충족되지 않은 상태다. Phase2 착수 시 최우선으로 다뤄야 한다.

**Next.js App Router 환경 문제**
Next.js 16.2.12 + `proxy.ts`(구 `middleware.ts`) 컨벤션 변경은 이미 코드에 반영되어 있어(직접 확인) 이 자체의 리스크는 낮다. 다만 `@supabase/ssr`(`^0.12.4`, `package.json` 확인)이 이렇게 최신 버전의 Next.js와 완전히 호환되는지는 실제 auth 플로우를 구현하는 시점에 재확인이 필요하다 — 프로젝트가 매우 최신 Next.js를 채택하고 있어 서드파티 SSR 패키지 호환성 리스크가 상존한다.

**문서 간 표현 불일치(재확인)**
- `profile 생성 방식`: [[DATABASE_SCHEMA]] §6("가입 트리거") vs [[EXECUTION_PLAN]] Phase2 §3("API Route") — §1.3에서 상세 분석.
- 카카오 PoC 시점: [[IMPLEMENTATION_PLAN]] §3 제목("Phase 0 필수 기술검증") vs 실제 [[EXECUTION_PLAN]] 계획(Phase2-1단계) — 이미 [[BACKLOG]] F11로 기록되어 있으며, 기능적 블로커는 아니다(재확인).

---

## 다음 단계

이 문서는 승인용 자료다. Phase2 구현 Task를 시작하려면 최소한 아래가 결정돼야 한다:

1. profile 생성 방식(A안 트리거 / B안 API Route / 하이브리드) 중 선택
2. 카카오 통합 방식(A: REST API+Admin / B: OIDC 커스텀 프로바이더) — PoC로 확정(§2.2의 환경변수 힌트 참고)
3. `profiles`의 민감 컬럼(`age_verified`/`status` 등)을 클라이언트 UPDATE에서 제외하는 방법(서버 화이트리스트 검증 vs 트리거) 확정
4. `lib/supabase/service.ts`(service_role 클라이언트) 신규 추가를 [[EXECUTION_PLAN]] Phase2 파일 목록에 반영할지 여부
