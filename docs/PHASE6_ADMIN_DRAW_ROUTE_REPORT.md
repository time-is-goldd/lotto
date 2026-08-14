# Phase6-4-2 관리자 당첨번호 등록 API 연결 보고서

## 1. 변경 파일

**신규**: `app/api/admin/draws/route.ts`(POST 핸들러).
**수정**: `proxy.ts`(`/api/admin/*` 1차 보호 추가), `lib/api/admin/draws.ts`(Case C 최소 안전장치 추가, §7), `lib/api/admin/draws.test.ts`(위 변경에 맞춰 mock 체인 갱신 + 케이스 1건 추가).
**미변경**: `lib/auth/isAdmin.ts`, `lib/api/notifications.ts`, `lib/logic/matchNumbers.ts`, `admins` 스키마/RLS, `user_numbers`/`notifications` 스키마 — 전부 기존 구현을 그대로 재사용했다(파일 mtime으로 확인).

---

## 2. Route 인증 흐름

`app/api/profile/route.ts`와 동일한 순서(인증 → JSON 파싱)를 그대로 따랐다:

```
getCurrentUser() 없음      → 401 UNAUTHORIZED
isAdmin() false            → 403 FORBIDDEN
JSON 파싱 실패              → 400 VALIDATION_ERROR
parseAdminDrawsInput() 실패 → 400 VALIDATION_ERROR
registerDrawAndMatchUserNumbers()
  DuplicateRoundError      → 409 DUPLICATE_ROUND
  기타 에러                 → 500 INTERNAL_ERROR
성공                        → 201 { data: { round, matchedCount, winnersCount, failedUpdateIds } }
```

요청 본문에서 `user_id`를 전혀 읽지 않는다(`parseAdminDrawsInput`이 `round`/`winningNumbers`/`bonusNumber`/`firstPrizeAmount`/`firstPrizeCount`만 화이트리스트로 추출) — 관리자 판정은 `isAdmin()`이 `getCurrentUser()`로 확인한 현재 세션만 근거로 한다.

---

## 3. Proxy 보호

`PROTECTED_API_PATHS = ["/api/admin"]`를 추가하고, 비로그인이면 `/login`으로 리다이렉트하는 대신 **JSON 401을 직접 반환**하도록 했다(`/api/admin/*`는 페이지가 아니라 API이므로). `isAdmin()` 판정은 proxy에서 하지 않는다 — 비로그인만 1차로 차단하고, 실제 관리자 검증은 Route의 `isAdmin()` 재확인이 최종 보안 경계다. `proxy.ts`는 여전히 `service_role`을 쓰지 않는다. 기존 `/my/*`, `/login`, `/onboarding`, `/my/journal` 예외 정책은 한 줄도 바꾸지 않았다.

---

## 4. API 계약

```json
POST /api/admin/draws
{
  "round": 1234,
  "winningNumbers": [1,2,3,4,5,6],
  "bonusNumber": 7,
  "firstPrizeAmount": 1234567890,
  "firstPrizeCount": 12
}
```

`lib/api/admin/draws.ts`(Phase6-3)의 `AdminDrawInput` 계약과 정확히 일치한다 — Route는 이 타입을 재정의하지 않고 `parseAdminDrawsInput()`의 반환 타입을 그대로 쓴다.

---

## 5. 에러 처리

| 상황 | 상태 코드 | code |
|---|---|---|
| 비로그인 | 401 | `UNAUTHORIZED` |
| 로그인, 관리자 아님 | 403 | `FORBIDDEN` |
| JSON/입력 검증 실패 | 400 | `VALIDATION_ERROR` |
| 중복 회차 | 409 | `DUPLICATE_ROUND` |
| 내부 오류 | 500 | `INTERNAL_ERROR` |

전부 `{ error: { code, message } }` 형식 — `app/api/profile/route.ts`와 동일한 컨벤션.

---

## 6. 기존 service 재사용 여부

`registerDrawAndMatchUserNumbers()`, `parseAdminDrawsInput()`, `isAdmin()`, `matchNumbers()`, `createWinNotification()` — 전부 Route에서 호출만 하고 재구현하지 않았다. Route 파일 자체는 인증/에러 매핑 코드만 담고 있다.

---

## 7. Case C 처리

Phase6-4-0이 제안한 `.upsert()` 기반 일괄 처리를 **실제로 시도했으나 채택하지 않았다.** 실제 Supabase에 대해 직접 검증한 결과, `user_numbers.id`/`draws.id`가 `generated always as identity`라 upsert 페이로드에 `id`를 실어 보내면 Postgres가 `428C9`(`cannot insert a non-DEFAULT value into column "id"`)로 즉시 거부했다(`OVERRIDING SYSTEM VALUE`가 필요한데 PostgREST가 이를 자동으로 붙이지 않음). 이를 우회하려면 identity 컬럼 정의를 바꾸는 migration이 필요해 이번 Task의 "새 migration 금지" 원칙과 충돌한다.

대신 지시문이 허용한 "또는" 대안 — **현재 서비스 코드의 최소 안전장치**를 적용했다: 각 행의 `UPDATE`에 `.eq("id", row.id)` 외에 `.is("target_round", null)` 조건과 `.select("id")`를 추가했다. 이렇게 하면 SELECT와 UPDATE 사이에 그 행이 이미 다른 처리로 `target_round`를 갖게 된 경우(에러 없이 0행 적용) 이를 명시적으로 감지해 `failedUpdateIds`에 포함시킨다 — 기존에는 이런 "에러 없는 0행 적용"을 감지할 방법이 없었다. 새 migration/RPC/대규모 transaction 설계는 하지 않았다. 단위 테스트 1건을 추가해 이 안전장치를 검증했다(§8, `updateResultForId: () => ({ data: [], error: null })` 케이스).

---

## 8. 실제 인증 테스트 결과 (실제 HTTP + 실제 Supabase)

로컬 dev 서버에 대해 실제 HTTP 요청으로 검증했다(테스트 계정 2개 생성 → `@supabase/ssr`의 `createServerClient`로 이 프로젝트와 동일한 방식의 세션 쿠키 생성 → `fetch()`로 실제 Route 호출 → 종료 후 계정/데이터 전부 삭제 및 잔여 0건 재확인).

| Test | 시나리오 | 결과 |
|---|---|---|
| C | 비로그인 | `401 UNAUTHORIZED` |
| B | 일반 사용자 | `403 FORBIDDEN` |
| D | 관리자 세션 + 잘못된 payload(`winningNumbers` 5개) | `400 VALIDATION_ERROR` |
| F | 관리자 세션 + body에 위조 `user_id` 포함 | `201` 성공, `user_id` 필드는 조용히 무시됨(화이트리스트 밖) |
| A | 관리자 세션, 정상 요청(Test F와 동일 요청) | `201`, `{ round, matchedCount: 1, winnersCount: 1, failedUpdateIds: [] }` |
| E | 동일 `round` 재등록 | `409 DUPLICATE_ROUND` |

---

## 9. DB 결과

같은 통합 테스트에서 `service_role`로 직접 재조회해 확인했다:

- `draws`: 요청한 `round`/`numbers`/`bonus_number`/`first_prize_amount`/`first_prize_count` 그대로 저장됨. 재등록 시도 이후에도 **정확히 1건만** 존재(중복 INSERT 없음).
- `user_numbers`: 사전에 저장해 둔 일반 사용자의 번호가 `target_round`/`match_count: 6`/`win_rank: 1`/`checked_at`(NOT NULL)로 정확히 갱신됨.
- `notifications`: 해당 사용자에게 `type: "win_result"`, 회차/등수가 포함된 제목으로 1건 생성됨.

테스트 종료 후 `draws`/`user_numbers`/`notifications`/`admins`/`profiles`/`auth.users` 테스트 데이터를 전부 삭제하고 별도 스크립트로 잔여 0건을 재확인했다.

---

## 10. Validation

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 통과 — **11 test files, 119 tests**(기존 118 + Case C 안전장치 검증 1건 추가) |
| `npm run build` | 통과, `app/api/admin/draws`가 라우트 목록에 정상 추가됨, 그 외 라우트 변경 없음 |
| 기존 페이지 회귀 확인(fresh dev server) | `/`, `/login`, `/generate`, `/my/journal`, `/ui-preview` → `200`. `/onboarding`, `/my/journal/history`, `/my/journal/dreams`, `/my/journal/fortune-history` → `307`(비로그인 리다이렉트) — 이는 Phase4가 이미 설계한 "허브 페이지는 비로그인 진입 허용, 하위 데이터 페이지는 페이지 자체가 개별적으로 로그인을 확인해 리다이렉트"는 기존 동작이며, `proxy.ts`의 `PUBLIC_EXCEPTIONS`/`PROTECTED_PATHS` 로직을 코드로 직접 대조해 이번 변경(`/api/admin` 블록 추가)과 무관함을 확인했다 |

### 보안 정적 확인(§10 요구사항)

`app/api/admin/draws/route.ts`를 직접 읽어 확인: `service_role`/`lib/supabase/service` import 없음, `user_id`를 요청 본문에서 읽는 코드 없음, 관리자 email 비교 없음, UID 하드코딩 없음. `proxy.ts`에 `/api/admin/*`가 matcher로 등록되어 1차 보호됨. Route 내부에서 `isAdmin()`으로 재검증함. 기존 `/my/*` 보호 정책은 `git diff` 대상 라인에 포함되지 않음(추가만 있고 기존 로직 수정 없음).

---

## 11. 발견된 문제

- **upsert 기반 Case C 개선안이 이 스키마에서 동작하지 않는다는 사실**을 실측으로 확인했다(§7) — `identity` 컬럼 정의를 바꾸지 않는 한 근본적으로 불가능하다. 향후 대규모 트래픽으로 진짜 원자성이 필요해지면 RPC(Postgres 함수) 도입이 유일한 완전한 해법이라는 Phase6-4-0의 결론이 이번 실측으로 재확인됐다.
- 그 외 새로 발견된 결함은 없다 — 인증 순서, 에러 코드, DB 반영, 알림 생성 전부 설계대로 동작했다.

---

## 12. Phase6-5 착수 가능 여부

**READY**

`/api/admin/draws`가 실제로 연결되어 관리자 인증(401/403), 입력 검증(400), 중복 회차(409), 정상 처리(201, draws/user_numbers/notifications 전부 실제 반영)까지 실제 HTTP 요청과 실제 Supabase로 검증을 마쳤다. Phase6-4-1에서 남아있던 유일한 조건("운영 관리자 계정 등록")은 코드 작업이 아니라 운영 절차이며, 이번 Task의 통합 테스트가 임시 관리자 계정으로 동일한 절차를 그대로 재현해 정상 동작을 입증했다 — 실제 운영 관리자를 등록하기만 하면 즉시 사용 가능한 상태다. 남은 작업(다이어리 결과 화면 실데이터 연결, 관리자 UI 등)은 Phase6-5 이후 범위다.
