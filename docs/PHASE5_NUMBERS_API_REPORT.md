# PHASE5-2 NUMBERS API REPORT — 번호 저장 API

> `POST /api/numbers`와 그 저장 서비스만 구현했다. `/generate` UI, 여러 게임 UI, 삭제/수정/당첨확인/통계/공유/커뮤니티/AI추천/꿈연동/rate limit/`session_id`/새 Migration/새 RLS/`generateNumbers.ts` 수정은 전혀 하지 않았다.

---

## 1. 생성/수정 파일

| 파일 | 종류 |
|---|---|
| `app/api/numbers/route.ts` | 신규 — `POST /api/numbers` |
| `lib/api/numbers.ts` | 신규 — `parseNumbersInput`, `saveUserNumbers`, `NumbersValidationError` |
| `lib/api/numbers.test.ts` | 신규 — 단위 테스트 19건 |
| `docs/PHASE5_NUMBERS_API_REPORT.md` | 신규 — 본 보고서 |

`lib/logic/generateNumbers.ts`(Phase5-1), `lib/api/journal.ts`(Phase4), `proxy.ts`, `app/my/*`, `components/*`, Migration, RLS는 전혀 수정하지 않았다(§9에서 재확인).

별도 `lib/types/numbers.ts`는 만들지 않았다 — `UserNumberEntry`(`Tables<"user_numbers">`) 타입 하나뿐이라 `lib/api/numbers.ts` 안에서 정의해도 충분하고, 파일을 분리할 재사용 가치가 없다고 판단했다.

---

## 2. API Endpoint / Request·Response 계약

### `POST /api/numbers`

**Request**
```json
{ "numbers": [1, 2, 3, 4, 5, 6] }
```
`numbers` 외의 필드(예: `user_id`)는 전부 무시된다 — 읽지도 않는다.

**성공 응답 (`201`)**
```json
{ "data": { "id": 20, "numbers": [3, 11, 22, 28, 35, 44], "created_at": "2026-08-09T03:47:13.35215+00:00" } }
```
`user_id`/`session_id`/`is_purchased`/`memo` 등 나머지 DB 컬럼은 응답에 포함하지 않는다 — UI가 저장 성공을 확인하는 데 필요한 최소 정보(`id`, 실제 저장된 `numbers`, `created_at`)만 반환한다.

**실패 응답**
```json
{ "error": { "code": "UNAUTHORIZED" | "VALIDATION_ERROR" | "INTERNAL_ERROR", "message": "..." } }
```
`app/api/profile/route.ts`와 완전히 동일한 형태(코드/메시지 구조)를 그대로 재사용했다.

| 상황 | status | code |
|---|---|---|
| 비로그인 | `401` | `UNAUTHORIZED` |
| JSON 파싱 실패 | `400` | `VALIDATION_ERROR` |
| `numbers` 계약 위반 | `400` | `VALIDATION_ERROR` |
| DB 저장 실패 | `500` | `INTERNAL_ERROR`(원본 DB 에러 메시지는 노출하지 않고 서버 로그에만 `console.error`) |

---

## 3. 인증 방식

`getCurrentUser()`(`lib/auth/session.ts`, 기존 함수 그대로 재사용) → 없으면 `401`. `user.id`는 이 호출 결과에서만 얻고, `saveUserNumbers(userId, numbers)`처럼 **명시적 파라미터로 전달**한다 — 이는 `app/api/profile/route.ts`의 `createProfile(user.id, provider, input)`과 동일한 패턴이다(Route Handler가 이미 인증을 확인한 뒤 그 결과값만 서비스 함수에 넘기는 구조, 클라이언트 입력이 아님). Phase4의 `lib/api/journal.ts`(내부에서 자체적으로 `getCurrentUser()`를 다시 호출하는 읽기 전용 함수)와는 다른 패턴이지만, 그 이유는 대상이 다르기 때문이다 — journal.ts는 Server Component가 직접 호출하는 것을 전제하고, 이 저장 함수는 Route Handler 안에서만 호출되어 이미 인증이 끝난 시점에 재사용되므로 중복 인증 호출을 피했다.

**별도 인증 시스템을 추가하지 않았다** — 기존 세션 확인 메커니즘만 사용.

---

## 4. 입력 검증 규칙 (`parseNumbersInput`)

Phase5-1이 export한 `MIN_NUMBER`(1)/`MAX_NUMBER`(45)/`NUMBERS_PER_GAME`(6)을 그대로 import해 재사용했다(재정의 없음). 순서대로 검증:

1. body가 객체인지
2. `numbers`가 배열인지
3. 길이가 정확히 6인지
4. 전부 정수인지
5. 전부 1~45 범위인지
6. 중복이 없는지(`Set.size === 6`)
7. 오름차순 정렬인지

하나라도 위반하면 `NumbersValidationError`를 던지고, Route Handler가 이를 `400`으로 매핑한다. **"DB CHECK가 있으니 서버 검증이 필요 없다"고 판단하지 않았다** — 애플리케이션 레벨 검증을 전부 구현했고, 이번 실측(§7)에서 잘못된 요청이 DB에 도달하기 전에 API 단계에서 걸러짐을 확인했다.

---

## 5. DB 저장 방식 / `user_id` 결정 방식

`lib/supabase/server.ts`(anon key + 쿠키 세션)의 서버 클라이언트로 `user_numbers`에 `.insert({ user_id, numbers, generation_method: "auto" }).select().single()`을 수행한다. **`service_role`은 사용하지 않았다.**

`user_id`는 Route Handler가 `getCurrentUser()`로 얻은 `user.id`만 사용한다 — 요청 본문에 `user_id` 필드가 있어도 `parseNumbersInput`이 애초에 그 필드를 읽지 않으므로 저장 함수에 전달될 방법 자체가 없다(코드 구조상 원천 차단, 실측으로 재확인 §7).

`generation_method`는 항상 `'auto'`로 서버가 고정한다 — 클라이언트가 이 값을 지정할 수 없다(Phase5-0 감사에서 이미 결정된 사항 재적용).

---

## 6. RLS와의 관계

`user_numbers`의 RLS(`0008_rls_policies.sql`, `auth.uid() = user_id`, 이번 Task에서 전혀 수정하지 않음)가 이미 "본인 `user_id`로만 INSERT 가능"을 강제한다. 애플리케이션 레벨 검증(§4)과 RLS는 서로 다른 층위의 방어다:
- 애플리케이션 검증: 번호 자체의 도메인 규칙(6개/범위/중복/정렬)을 사용자 친화적인 에러로 먼저 걸러낸다.
- RLS: `user_id` 위조를 DB 레벨에서 최종적으로 차단한다(이번 API는 애초에 클라이언트의 `user_id`를 읽지 않아 위조 시도 자체가 무의미하지만, RLS는 그와 무관하게 이중 방어로 여전히 존재한다).

---

## 7. 실제 Supabase 실측 결과 (이번 Task에서 신규 실행, 검증 후 전량 삭제)

카카오 API만 우회(`establishKakaoSupabaseSession()`)한 임시 라우트로 User A/B 계정을 만들고 실제 배포된 API에 실제 HTTP 요청을 보냈다. 검증에만 `service_role`을 사용했고(저장된 행을 직접 조회해 실제 `user_id`/`numbers`를 확인하는 용도), **프로덕션 코드에는 어디에도 `service_role`을 넣지 않았다.**

| 검증 | 결과 |
|---|---|
| 비로그인 → `POST /api/numbers` | `401 UNAUTHORIZED`(요청 자체가 DB에 도달하지 않음) |
| User A 정상 저장 | `201`, 응답 `numbers`가 요청과 정확히 동일(`[3,11,22,28,35,44]`) |
| **저장된 행을 service_role로 직접 조회** | `user_id`가 실제 User A의 uuid와 정확히 일치, `numbers`도 요청과 정확히 일치, `generation_method`는 `"auto"` |
| **User B가 User A의 `user_id`를 요청 본문에 위조해 전송** | `201` 성공(요청 자체는 거부되지 않음 — 위조 필드가 조용히 무시될 뿐 에러가 아님), **저장된 행을 service_role로 직접 재조회한 결과 `user_id`는 User B의 실제 uuid** — User A 소유로 저장되지 않았음을 확인 |
| 잘못된 `numbers`(5개/46 포함/중복/역순정렬/문자열포함/필드누락) 6종 | 전부 `400 VALIDATION_ERROR`, 각기 다른 구체적 메시지. 이 6번의 시도 이후 `id > 21`인 행이 **0건** — 잘못된 요청이 단 하나도 DB에 도달하지 않았음을 확인 |

테스트 계정 2개와 그 `user_numbers`/`profiles`/기타 데이터는 검증 직후 전량 삭제했다(`auth.users` `200`, 나머지 테이블 전부 `204`).

---

## 8. 테스트 결과

`lib/api/numbers.test.ts` — **19건, 전부 통과**.

- `parseNumbersInput`: 정상 케이스 1건 + "위조 `user_id` 필드가 무시됨" 1건 + `it.each`로 15가지 거부 케이스(null/비객체/누락/배열아님/객체/빈배열/5개/7개/문자열포함/소수포함/0포함/46포함/음수포함/중복/역순정렬) — 지시문 §6이 나열한 악성/잘못된 입력을 전부 커버했다.
- `saveUserNumbers`: `lib/api/journal.test.ts`와 동일한 `vi.mock("@/lib/supabase/server")` 패턴으로 (a) `insert()`가 정확히 `{ user_id, numbers, generation_method: "auto" }`로 호출되는지, (b) DB 에러가 그대로 `throw`되는지 검증.

**Route Handler(`app/api/numbers/route.ts`) 자체의 단위/통합 테스트는 작성하지 않았다** — `app/api/profile/route.ts`도 이 코드베이스에 전용 테스트 파일이 없어(확인됨, 이 프로젝트에 Route Handler를 `NextRequest` mock으로 직접 테스트하는 컨벤션이 존재하지 않음) 없는 인프라를 이번 Task에서 새로 만들지 않았다. Route Handler 레벨의 실제 동작(인증/검증/저장/에러 매핑 전체 흐름)은 대신 §7의 실제 Supabase 실측으로 검증했다 — 단위 테스트(순수 로직)와 실제 환경 검증(엔드투엔드)을 분리해서 다뤘다.

---

## 9. Validation 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | **62개 통과**(기존 43개 + 신규 19개) |
| `npm run build` | 통과. 라우트에 `/api/numbers` 1개만 추가, 나머지 변경 없음 |
| `service_role`/`SUPABASE_SERVICE_ROLE_KEY` import(`app/api/numbers`, `lib/api/numbers.ts`) | 없음(주석 1건만 매치, 실제 코드 아님을 확인) |
| URL/query에서 `user_id` 읽는 코드 | 없음 |
| SQL 문자열 조합 | 없음(Supabase JS 빌더만 사용) |
| Migration/RLS 파일 변경 | 없음 |
| `git status`(범위 확인) | 이번 Task의 실제 변경분은 `app/api/numbers/route.ts`, `lib/api/numbers.ts`, `lib/api/numbers.test.ts`, 본 보고서 4개뿐임을 확인. `proxy.ts`/`app/my/*`/`components/*`/`lib/logic/generateNumbers.ts`/`lib/api/journal.ts`/Migration/RLS는 전혀 손대지 않았다(파일별 수정 시각 직접 대조로 재확인) |
| 임시 테스트 라우트/파일 잔존 | 없음(`app/api/dev-test-login`, 검증용 스크립트 전부 삭제) |

---

## 10. Phase5-3 UI 구현 시 호출 방법

```
generateNumbers()(Client Component, 즉시 실행) → 화면에 결과 표시
  → (로그인 상태라면) 그 배열을 그대로:

fetch("/api/numbers", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ numbers }),  // generateNumbers()가 반환한 그 배열 그대로
})
```
- 응답이 `201`이면 `data.id`/`data.numbers`/`data.created_at`으로 "저장됨" 토스트 등을 표시할 수 있다.
- 응답이 `401`이면(이론상 거의 발생하지 않아야 함 — UI 자체가 비로그인이면 애초에 저장을 시도하지 않아야 하므로) 조용히 무시하거나 로그인 배너로 유도.
- 응답이 `400`이면(정상 흐름에서는 발생할 수 없음 — `generateNumbers()`가 항상 유효한 값만 반환하므로) 방어적으로 일반 에러 메시지만 표시.
- 다이어리 히스토리 화면(`/my/journal/history`)에 즉시 반영하고 싶다면 별도 캐시 무효화 로직 없이 **그 페이지로 이동하거나 새로고침하면** Phase4의 `getRecentUserNumbers()`가 이미 커밋된 최신 행을 그대로 조회한다(§7의 실측이 이 흐름 전체를 이미 검증했다 — Phase5-0/5-2 어느 쪽에서도 Phase4 코드를 수정하지 않았음이 재확인됨).

---

## 11. 새로 발견된 문제 / 문서 간 충돌

새로 발견된 문제는 없다. 이번 Task 범위(저장 API)에서는 Phase5-0/5-1이 이미 기록한 결정 사항(`/generate` 경로, 여러 게임 생성 여부, 저장개수 제한, 공유 기능 Phase 배정, `session_id` 사용 여부) 중 어느 것도 이 API의 구현을 막거나 새로운 충돌을 만들지 않았다 — `session_id`는 이번 API가 아예 다루지 않아(요청/저장 어디에도 없음) 여전히 열린 Decision으로 남아있을 뿐 새로운 문제는 아니다.

---

## 12. Phase5-3(`/generate` UI) 착수 준비 상태

**Ready.** `generateNumbers()`(Phase5-1)와 `POST /api/numbers`(Phase5-2) 양쪽 다 구현·테스트·실측이 끝났고, 두 계약이 서로 어긋나는 지점이 없다(§10). Phase5-3은 이 두 함수를 그대로 가져다 쓰는 UI 조립 작업만 남아있으며, 코드 재작업이 필요한 미해결 이슈는 없다. Phase5-0에서 식별된 5가지 Decision 중 "`/generate` 경로"만 UI 착수 전에 확인하면 재작업 위험이 없다 — 나머지는 이번 Phase5-3의 최소 범위(완전자동 단일 게임)와 무관하다.
