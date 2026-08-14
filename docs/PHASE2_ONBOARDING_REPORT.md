# PHASE2-5 ONBOARDING FLOW 구현 보고서

> 카카오 로그인 이후 `profiles`가 없는 사용자("온보딩 대기" 상태, [[PHASE2_AUTH_DECISION]] Decision 1)를 위한 온보딩 화면을 구현한 결과 기록이다. Authentication 구조·Schema·Migration·OAuth·RLS는 변경하지 않았다. 기존 `lib/auth/profile.ts`(Profile Service)와 `POST /api/profile`을 그대로 재사용했다.

---

## 0. Decision 문서와의 충돌 검토 (착수 전 확인)

지시문은 입력 항목을 "필수: `birth_date`, 선택: `nickname`"으로 규정했다. 그런데 기존 구현을 확인한 결과 다음이 드러났다.

- `supabase/migrations/0001_profiles.sql`: `nickname varchar(30) not null` — DB 레벨에서 이미 **필수**다.
- `lib/auth/profile.ts`의 `parseProfileCreateInput()`은 `nickname`을 무조건 `parseNickname()`으로 검증한다 — 빈 값/누락 시 `ProfileValidationError`(400)를 던진다. 즉 서비스 레벨에서도 이미 **필수**다.

이 Task는 Schema 변경과 OAuth 수정을 금지하고("기존 Profile API 재사용, 직접 DB 접근 금지, 중복구현 금지"), `lib/auth/profile.ts`를 고쳐 `nickname`을 진짜로 선택사항으로 만드는 것도 이번 범위 밖의 서비스 레이어 수정이라고 판단했다. 그래서 다음으로 해소했다.

- **`nickname` 입력을 HTML상 `required`로 유지**하되, 카카오 로그인 시점에 이미 확보된 카카오 닉네임(`user.user_metadata.nickname` — `lib/auth/kakao.ts`의 `establishKakaoSupabaseSession()`이 `generateLink` 호출 시 `options.data.nickname`으로 이미 저장해둔 값)을 폼의 기본값으로 미리 채운다.
- 결과적으로 사용자 관점에서는 "아무것도 새로 입력하지 않아도 되는" 선택 항목처럼 동작하지만(카카오 닉네임이 자동으로 채워짐), 시스템 관점에서는 스키마·서비스가 요구하는 대로 항상 비어있지 않은 값이 전송된다. 카카오가 닉네임을 내려주지 않은 극단적인 경우에만 사용자가 직접 입력해야 한다.
- 이 판단은 "Decision과 충돌 여부를 먼저 확인한다"는 지시에 따라 여기 명시적으로 기록한다 — 진짜로 `nickname`을 선택사항으로 만들려면 `0001_profiles.sql`을 수정하는 신규 migration과 `parseProfileCreateInput()` 수정이 필요하며, 둘 다 이번 Task의 금지 항목(Schema 변경, 서비스 레이어 중복/변경)에 해당해 진행하지 않았다.

다른 Decision 문서와의 충돌은 발견되지 않았다. `POST /api/profile`, `getProfile()`, `getCurrentUser()`, `resolveProfileProvider()`는 모두 기존 그대로 재사용했다.

---

## 1. 생성/수정 파일

| 파일 | 종류 | 내용 |
|---|---|---|
| `app/onboarding/page.tsx` | 신규 | 접근 제어(로그인 확인, profile 존재 확인) + 온보딩 폼 렌더링. Server Component |
| `app/onboarding/OnboardingForm.tsx` | 신규 | 입력 폼(생년월일 필수, 닉네임) + `POST /api/profile` 제출 + 에러 처리. Client Component |
| `app/page.tsx` | 수정 | `?profile=pending` 쿼리를 감지해 `/onboarding`으로 리다이렉트(§3 참조). OAuth 콜백 라우트 자체는 수정하지 않았다 |
| `docs/PHASE2_ONBOARDING_REPORT.md` | 신규 | 본 보고서 |

Migration/schema/RLS/OAuth 파일 변경 없음. `lib/auth/profile.ts`, `lib/auth/kakao.ts`, `lib/auth/session.ts`, `app/api/profile/route.ts`, `app/api/auth/kakao/**`는 이번 Task에서 전혀 수정하지 않았다 — 전부 기존 그대로 재사용.

---

## 2. Onboarding Flow

```
(카카오 콜백이 이미 처리) /?login=success&profile=pending
        │  app/page.tsx가 profile=pending 감지
        ▼
   /onboarding (Server Component)
        │  getCurrentUser() — 비로그인이면 "/"로 리다이렉트
        │  getProfile(user.id) — 이미 있으면 "/"로 리다이렉트
        ▼
   OnboardingForm (Client Component)
   - 생년월일 입력(필수, HTML5 date, 미래 날짜 차단)
   - 닉네임 입력(카카오 닉네임으로 기본값 채움, §0)
        │  제출 → POST /api/profile { birth_date, nickname }
        ▼
   기존 app/api/profile/route.ts (수정 없음)
   - getCurrentUser() 재확인 → createProfile() → parseProfileCreateInput()/calculateAgeVerified() 재사용
        │
   ┌────┴─────────────┐
   │ 201 또는 409       │ 그 외 에러(400/401/500/네트워크)
   ▼                   ▼
router.push("/")     사용자에게 메시지 표시, 재시도 가능
```

`birth_date` 유효성 검사와 만 19세 계산은 클라이언트에서 다시 구현하지 않았다 — `lib/auth/profile.ts`의 `parseBirthDate()`/`calculateAgeVerified()`가 서버에서 그대로 수행한다. 클라이언트는 HTML5 `required`/`max` 속성으로 "비어있음"/"미래 날짜"만 제출 전에 걸러 불필요한 요청을 줄인다.

---

## 3. 접근 제어

| 상태 | 동작 | 구현 위치 |
|---|---|---|
| 로그인 안 됨 | `/`로 리다이렉트 | `app/onboarding/page.tsx` — `getCurrentUser()`가 `null` |
| profile 존재 | `/`로 리다이렉트 | `app/onboarding/page.tsx` — `getProfile(user.id)`가 non-null |
| profile 없음 | 온보딩 폼 렌더링 | `app/onboarding/page.tsx` |
| 온보딩 제출 시점에 세션 만료 | 폼에 "다시 로그인해주세요" 표시(리다이렉트는 하지 않음) | `app/onboarding/OnboardingForm.tsx` — `POST /api/profile` 401 응답 처리 |

**"로그인 안 됨 → 로그인 페이지"에 대한 결정**: 지시문 체크리스트는 "로그인 안됨 → 로그인 페이지"를 요구하지만, 이 코드베이스에는 아직 전용 로그인 페이지(`/login` 등)가 없다 — [[EXECUTION_PLAN]] Phase3(공통 UI)에서 `LoginButton`/`Header`와 함께 만들어질 예정이며, 지금은 카카오 로그인 진입점이 `/api/auth/kakao/login`(API Route) 하나뿐이다. 이번 Task는 온보딩 페이지 구현만 범위이고 새 페이지/기능 추가가 금지되어 있어, 전용 로그인 페이지를 새로 만들지 않고 **현재 유일한 진입점인 홈(`/`)으로 리다이렉트**했다. Phase3에서 로그인 페이지가 생기면 이 리다이렉트 대상을 그곳으로 바꾸는 한 줄 수정만 필요하다.

**profile 없는 사용자를 다른 보호 경로에서 온보딩으로 보내는 전역 로직(`proxy.ts`)은 이번에도 만들지 않았다** — "Proxy 구현 금지"에 따라 명시적으로 범위 밖으로 뒀다. 이번 Task는 온보딩 페이지 자신의 접근 제어와, 카카오 콜백이 이미 만들어둔 `?profile=pending` 신호를 홈페이지가 받아 온보딩으로 넘겨주는 연결까지만 다룬다.

---

## 4. 발견된 문제

1. **`nickname` 필수/선택 충돌** — §0에서 이미 상세히 다룸. 스키마·서비스는 필수, 지시문은 선택으로 서술. 카카오 닉네임 기본값 채우기로 해소했다.
2. **홈페이지(`/`)가 `profile=pending` 신호를 받는 코드가 없었음** — [[PHASE2_KAKAO_E2E_REPORT]]까지는 카카오 콜백이 이 쿼리로 리다이렉트하는 것까지만 구현되어 있었고, 그 신호를 받아 실제로 `/onboarding`으로 이동시키는 코드가 어디에도 없었다. 이 연결이 없으면 실사용자는 로그인 후 홈 화면에 그냥 머물게 되어 온보딩에 도달할 방법이 없다. `app/page.tsx`에 최소한의 리다이렉트를 추가해 해소했다(§1) — OAuth 콜백 자체는 건드리지 않았다.
3. **전용 로그인 페이지 부재** — §3에서 다룸. 이번 Task 범위에서 새로 만들지 않고 홈으로 대체.
4. **`app/page.tsx`가 정적 페이지에서 동적 페이지로 전환됨** — `searchParams`를 읽어야 해서 빌드 결과가 `○ /`(Static)에서 `ƒ /`(Dynamic)로 바뀌었다. 지금은 홈페이지에 실질적인 콘텐츠가 없어 영향이 없지만, Phase3~4에서 홈페이지에 실제 콘텐츠가 채워질 때 이 부분(정적 프리렌더링 여부)을 다시 검토할 필요가 있다.
5. **컴포넌트 테스트 인프라 부재** — 이 프로젝트의 `vitest.config.mts`는 `environment: "node"`로만 설정되어 있고 `@testing-library/react` 등이 설치되어 있지 않아, `OnboardingForm`에 대한 렌더링/상호작용 테스트를 추가할 수 없었다(새 의존성 추가는 이번 Task 범위 밖). 재사용한 로직(`parseProfileCreateInput`/`calculateAgeVerified`)은 [[PHASE2_PROFILE_SERVICE_REPORT]]에서 이미 단위 테스트로 검증되어 있으므로 중복 테스트를 추가하지 않았다.

---

## 5. Validation

실제 Supabase 프로젝트를 대상으로(카카오 API는 호출하지 않고 `establishKakaoSupabaseSession()`을 합성 사용자로 직접 실행하는 검증용 임시 라우트 사용, [[PHASE2_KAKAO_E2E_REPORT]]와 동일한 방법 — 검증 후 삭제, 테스트 계정도 전량 삭제):

| 시나리오 | 결과 |
|---|---|
| 비로그인 상태로 `/onboarding` 접근 | `307` → `/` |
| 로그인(합성 사용자, profile 없음) 상태로 `/onboarding` 접근 | `200`, 폼에 카카오 닉네임이 기본값으로 채워져 렌더링됨 확인 |
| 폼과 동일한 요청으로 `POST /api/profile` 제출 | `201`, `provider: "kakao"`로 정상 생성 |
| profile 생성 후 다시 `/onboarding` 접근 | `307` → `/` (재접근 차단 확인) |
| `/?login=success&profile=pending` 접근 | `307` → `/onboarding` (연결 확인, §4-2) |
| 세션 없이 `POST /api/profile` | `401 UNAUTHORIZED` — 폼의 401 처리 분기와 응답 형태 일치 확인 |
| 잘못된 `birth_date` 형식으로 제출 | `400 VALIDATION_ERROR` — 폼의 400 처리 분기와 응답 형태 일치 확인 |

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 16개 테스트 통과(기존 그대로, 신규로 깨진 테스트 없음) |
| `npm run build` | 통과. `/onboarding`이 동적 라우트로 정상 등록됨 |
| 빌드 산출물에 `SUPABASE_SERVICE_ROLE_KEY` 노출 여부 | `grep` 재확인, 0건 — `OnboardingForm.tsx`(Client Component)는 `lib/auth/profile.ts`/`lib/supabase/service.ts`를 import하지 않음(fetch로 API만 호출) |

---

## 6. 다음 Task

1. **전용 로그인 페이지(`/login`) 구현**(Phase3 공통 UI) — 현재 홈으로 대체된 리다이렉트 대상을 실제 로그인 페이지로 교체.
2. **`proxy.ts`에서 "로그인했지만 profile 없음" 전역 감지** — 지금은 `/onboarding`과 `/`(profile=pending 쿼리 경유)만 이 상태를 인지한다. `/my/*` 등 다른 보호 경로에 로그인했지만 온보딩을 마치지 않은 사용자가 직접 접근하면 아직 온보딩으로 안내되지 않는다. `profileExists()`(이미 구현됨, [[PHASE2_PROFILE_SERVICE_REPORT]])를 소비할 첫 지점.
3. **`docs/BACKLOG.md` 항목 E(RLS 실사용자 테스트)** — 이제 온보딩까지 완료해 정상 상태(profile 존재)인 실제 계정을 만들 수 있으므로 착수 가능.
4. `nickname` 필수/선택 불일치(§0)를 실제로 "선택"으로 만들 필요가 있다면, `0001_profiles.sql`을 건드리지 않는 신규 migration(`nickname` nullable 전환 또는 서버 기본값 생성 로직)과 `parseProfileCreateInput()` 수정을 별도 승인 후 Task로 진행.

---

## 7. Ready 여부

**Ready.** 카카오 로그인 → profile 없음 → 홈의 `profile=pending` 신호 → 온보딩 페이지 → 폼 제출 → 기존 `POST /api/profile` → profile 생성 → 재접근 시 홈으로 차단까지, 실제 Supabase 프로젝트를 대상으로 전체 흐름을 실측 완료했다. Authentication 구조·Schema·Migration·OAuth·RLS는 전혀 변경하지 않았고, 4개 정적 validation과 실제 시나리오 검증 모두 통과했다. 유일한 설계상 타협은 `nickname` 필수/선택 불일치(§0)이며, 그 이유와 해소 방법을 이 문서에 명시적으로 남겼다.
