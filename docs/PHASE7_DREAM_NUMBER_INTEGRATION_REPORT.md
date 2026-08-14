# Phase7-3 Dream → Lotto Number 연동 및 저장 구현 보고서

## 1. 생성/수정 파일

**수정**: `lib/api/dreams.ts`(`getDreamById` 추가), `lib/api/dreams.test.ts`(테스트 3건 추가), `lib/api/numbers.ts`(`parseDreamContext`/`DreamNotFoundError`/`saveUserNumbers` 확장), `lib/api/numbers.test.ts`(테스트 12건 추가, 기존 테스트 무변경), `app/api/numbers/route.ts`(dream context 처리 추가), `components/generate/generatorSaveLogic.ts`(`buildSaveRequestPayload` 확장), `components/generate/generatorSaveLogic.test.ts`(테스트 2건 추가), `components/generate/NumberGenerator.tsx`(`dreamContext` prop 추가), `app/generate/page.tsx`(`dream` 쿼리파라미터 처리 추가), `app/dream/[keyword]/page.tsx`(CTA 추가).

**신규**: 본 보고서뿐. 새 파일(별도 저장 함수, 새 Route 등)을 만들지 않았다 — 기존 파일 확장만으로 구현했다.

**미변경**: Migration/RLS, `lib/logic/generateNumbers.ts`, `proxy.ts`, `app/my/journal/*`, 관리자 기능.

---

## 2. saveUserNumbers 확장 방식

기존 시그니처 `saveUserNumbers(userId, numbers)`를 그대로 유지하고, 세 번째 선택적 인자로 판별 유니온 `DreamContext`를 추가했다:

```ts
export type DreamContext =
  | { generationMethod: "auto"; relatedDreamId: null }
  | { generationMethod: "dream"; relatedDreamId: number };

export async function saveUserNumbers(
  userId: string,
  numbers: number[],
  dreamContext: DreamContext = { generationMethod: "auto", relatedDreamId: null }
): Promise<UserNumberEntry>
```

기존 호출부(`app/api/numbers/route.ts`가 dream 없이 부르는 경우)는 세 번째 인자를 생략하면 기존과 **완전히 동일한 INSERT**(`{user_id, numbers, generation_method: "auto"}`, 3개 키 그대로)가 실행된다 — `related_dream_id`는 `dreamContext.generationMethod === "dream"`일 때만 payload에 스프레드로 추가해, 기존 `saveUserNumbers` 테스트의 `toHaveBeenCalledWith({...3개 키...})` 단언을 한 글자도 바꾸지 않고 그대로 통과시켰다.

두 번째 저장 함수를 만들지 않았다 — 지시문 원칙(§14 "저장 로직을 중복 구현하지 않는다") 그대로.

`generationMethod === "dream"`이면 INSERT 전에 `lib/api/dreams.ts`의 `getDreamById()`(신규 추가, 기존 `getDreamByKeyword`와 동일한 패턴)를 호출해 실제 존재하는 꿈인지 검증한다. 존재하지 않으면 `DreamNotFoundError`를 던지고 INSERT 자체를 시도하지 않는다(실측: §8 참조).

---

## 3. API 계약 변경

```ts
POST /api/numbers
// 기존(변경 없음)
{ "numbers": [1,2,3,4,5,6] }

// 신규(선택적)
{ "numbers": [1,2,3,4,5,6], "generationMethod": "dream", "relatedDreamId": 1 }
```

`parseNumbersInput()`(기존, `number[]` 반환)은 **한 글자도 수정하지 않았다.** 새 필드는 별도의 순수 함수 `parseDreamContext(body)`로 독립 검증한다 — `parseNumbersInput`의 기존 계약을 지키면서 새 검증 로직을 추가하기 위한 의도적 분리다(§2 참고, 지시문 §14 "이미 결정된 내용을 다시 결정하지 않는다"와 일치).

`parseDreamContext`는 `relatedDreamId`를 문자열("5")과 숫자(5) 둘 다 허용해 정수로 정규화한다 — `/generate?dream=1`처럼 쿼리파라미터에서 유래한 문자열 값을 클라이언트가 그대로 보내도 되게 하기 위함이다. 형식 검증(양의 정수 여부)만 여기서 하고, **실제 존재 여부 검증은 DB 조회가 필요해 `saveUserNumbers()`에서** 한다(순수 함수와 DB 접근을 분리하는 기존 컨벤션 유지).

---

## 4. dream context 전달 방식

```
/dream/[keyword] CTA
  → <Link href={`/generate?dream=${dream.id}`}>
/generate (Server Component)
  → searchParams.dream 파싱(형식만 확인) → getDreamById()로 실제 존재 확인
  → 존재하면 { id, keyword }를 NumberGenerator에 prop으로 전달, 없으면 null(일반 생성으로 폴백)
NumberGenerator (Client Component)
  → dreamContext가 있으면 화면에 "‘{keyword}’ 꿈과 연결된 번호예요" 표시
  → 자동 저장 시 buildSaveRequestPayload(numbers, dreamContext)가 generationMethod/relatedDreamId를 포함
POST /api/numbers
  → parseDreamContext()로 형식 재검증 → saveUserNumbers()가 존재 여부 재검증 → INSERT
```

**중요**: `/generate` 페이지의 `dream` 쿼리파라미터 처리는 순전히 표시/전달용이다 — 여기서 검증에 실패해도(예: 존재하지 않는 dreamId) 에러를 내지 않고 조용히 일반 생성으로 폴백한다(§9 회귀 원칙). 실제 데이터 무결성은 저장 시점에 서버가 다시 검증하므로, 표시 단계의 느슨한 처리가 보안 문제로 이어지지 않는다.

꿈의 추천번호(`dream_number_mappings.numbers`)는 이 흐름 어디에서도 읽어서 저장하지 않는다 — `/generate`는 항상 `generateNumbers()`로 새로 생성한다(지시문 §8 "꿈의 추천번호를 그대로 user_numbers에 저장하지 않는다"를 코드로 확인 가능하게 유지: `app/generate/page.tsx`가 `getDreamById()`만 호출하고 `getDreamNumbers()`는 호출하지 않는다).

---

## 5. 서버 검증 방식

| 검증 | 위치 | 실패 시 |
|---|---|---|
| numbers 형식(6개/1~45/중복없음/정렬) | `parseNumbersInput()`(기존, 무변경) | `400 VALIDATION_ERROR` |
| 로그인 여부 | `getCurrentUser()`(기존, 무변경) | `401 UNAUTHORIZED` |
| generationMethod 허용값("dream"만) | `parseDreamContext()`(신규) | `400 VALIDATION_ERROR` |
| relatedDreamId 형식(양의 정수) | `parseDreamContext()`(신규) | `400 VALIDATION_ERROR` |
| relatedDreamId 실제 존재 여부 | `saveUserNumbers()` → `getDreamById()`(신규) | `400 VALIDATION_ERROR`(`DreamNotFoundError`) |
| user_id 결정 | Route의 `getCurrentUser()` 결과만 사용(기존, 무변경) | 클라이언트가 보낸 `user_id`/`relatedDreamId`로 다른 사용자를 사칭할 방법 없음 |

클라이언트가 `user_id`를 보내도 `parseNumbersInput`/`parseDreamContext` 둘 다 그 필드를 아예 읽지 않는다 — 실제 Supabase로 위조 시도를 실측했다(§8).

---

## 6. DB 저장 결과 (실제 Supabase 실측)

| 시나리오 | 저장 결과 |
|---|---|
| 일반 저장(dream 없음) | `generation_method: 'auto'`, `related_dream_id: NULL`(기존과 동일) |
| 꿈 연동 저장(실제 dream id) | `generation_method: 'dream'`, `related_dream_id: <실제 dream.id>` — DB 재조회로 정확히 확인 |

Migration을 만들지 않았다 — `user_numbers.generation_method`(enum에 `'dream'` 이미 존재)와 `related_dream_id`(FK 없는 애플리케이션 레벨 참조, `0002_draws_user_numbers.sql`)를 Phase7-0이 이미 확인한 그대로 사용했다. `lib/types/database.ts`도 이미 이 두 컬럼을 포함하고 있어 타입 재생성이 필요하지 않았다.

---

## 7. 기존 Phase5 회귀 검증

- `parseNumbersInput`, `canAutoSave`, `toSaveKey`의 기존 테스트 — **한 줄도 수정하지 않고 전부 그대로 통과**.
- `saveUserNumbers`의 기존 2개 테스트(정상 저장/DB 에러 전파) — **그대로 통과**(`insert` 호출 인자가 여전히 3개 키뿐임을 재확인).
- `buildSaveRequestPayload`의 기존 2개 테스트 — **그대로 통과**.
- 실제 dev 서버로 `/generate`(dream 쿼리 없음)가 기존과 동일하게 동작함을 확인(§8).
- 실제 Supabase로 일반 저장이 기존과 동일한 값(`generation_method: 'auto'`, `related_dream_id: NULL`)을 만듦을 재확인(§8).

---

## 8. 실제 Supabase 검증 (실제 HTTP + 실제 DB)

로컬 dev 서버 + 실제 Supabase 프로젝트에 대해 테스트 계정 2개(User A, User B)로 검증했다(종료 후 계정/데이터 전부 삭제, 잔여 0건 재확인).

| 테스트 | 결과 |
|---|---|
| User A 일반 번호 저장 | `201`, 응답 정상 |
| User A 꿈 연동 저장(실제 `돼지꿈`, id=1) | `201` — DB 재조회: `generation_method: 'dream'`, `related_dream_id: 1`, `user_id`는 User A |
| 존재하지 않는 dreamId(999999) | `400 VALIDATION_ERROR`, "존재하지 않는 꿈입니다. (id: 999999)" |
| 잘못된 generationMethod("fortune") | `400 VALIDATION_ERROR`, "generationMethod는 'dream'만 지정할 수 있습니다." |
| 비로그인 저장 시도 | `401 UNAUTHORIZED` |
| `user_id` 위조 시도(body에 User B의 uid 삽입) | `201` 성공했지만 **DB에 저장된 실제 `user_id`는 User A**(요청 본문의 위조값이 조용히 무시됨을 실측 확인) |
| User B가 User A의 저장 결과를 자신의 다이어리에서 볼 수 없는지 | User B 세션으로 `/my/journal/history`를 직접 요청해, 위에서 생성된 모든 행 id가 응답에 전혀 포함되지 않음을 확인(기존 RLS, `0008_rls_policies.sql`가 이미 보장 — 이번 Task에서 RLS를 새로 검증할 필요는 없었지만 실제 저장 흐름과 함께 재확인) |

실제 브라우저 UX도 확인: `/dream/돼지꿈` → CTA(`이 꿈으로 번호 생성하기`, `href="/generate?dream=1"`) 정상 렌더링, `/generate`(dream 없음)는 배너 없음, `/generate?dream=1`은 "‘돼지꿈’ 꿈과 연결된 번호예요" 배너 정상 표시.

---

## 9. 테스트/lint/type-check/build

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 통과 — 12 test files, **150 tests**(기존 133 + 신규 17: `parseDreamContext` 10건 + `saveUserNumbers` dream 2건 + `getDreamById` 3건 + `buildSaveRequestPayload` dream 2건) |
| `npm run build` | 통과, 라우트 목록 변화 없음(기존 `/generate`/`/api/numbers` 재사용, 새 라우트 없음) |

`git status`로 확인한 변경 파일은 §1에 나열한 파일뿐 — Migration/RLS/`proxy.ts`/관리자 기능/`app/my/journal/*`는 전부 미변경.

---

## 10. 발견된 문제

새로 발견된 결함은 없다. 구현 중 확인한 사항:

- `parseNumbersInput`을 확장하는 대신 `parseDreamContext`를 분리한 결정 덕분에 기존 numbers 관련 테스트(Phase5, 15건 이상)를 전혀 건드리지 않고 신규 기능을 추가할 수 있었다 — 설계가 의도대로 작동했다.
- `saveUserNumbers`의 조건부 스프레드(`...(dreamContext.generationMethod === "dream" ? {...} : {})`) 덕분에 기존 INSERT payload 모양이 완전히 보존됐다 — 실제로 기존 테스트를 한 줄도 안 고치고 통과시켰다.
- `/generate` 페이지의 `dream` 쿼리파라미터는 숫자 ID라 Phase7-2에서 발견했던 "Next.js 페이지 컴포넌트 params가 URL 디코딩되지 않는" 문제(한글 `[keyword]`/`[category]`에서 발생)가 여기서는 재현되지 않았다 — `searchParams`는 동적 라우트 `params`와 다른 메커니즘이고 처음부터 정상적으로 디코딩된 값을 주며, 숫자 ID 자체에 퍼센트 인코딩될 문자가 없어 실측으로도 문제없이 동작했다.

---

## TASK REPORT

1. **생성/수정 파일**: `lib/api/dreams.ts`(+`getDreamById`), `lib/api/numbers.ts`(+`parseDreamContext`/`DreamNotFoundError`/`saveUserNumbers` 확장), `app/api/numbers/route.ts`, `components/generate/generatorSaveLogic.ts`, `components/generate/NumberGenerator.tsx`, `app/generate/page.tsx`, `app/dream/[keyword]/page.tsx` — 전부 기존 파일 확장, 신규 파일 없음(보고서 제외).

2. **saveUserNumbers/API 변경**: `saveUserNumbers(userId, numbers, dreamContext?)` — 세 번째 인자 생략 시 기존과 100% 동일 동작. `POST /api/numbers`에 `generationMethod`/`relatedDreamId` 선택적 필드 추가, 기존 `{numbers}`만 보내는 요청은 완전히 그대로 동작.

3. **Dream → Generate 흐름**: `/dream/[keyword]` CTA → `/generate?dream=<id>`(표시용, 검증은 서버가 다시 함) → `generateNumbers()`로 새로 생성(꿈의 추천번호를 그대로 쓰지 않음) → 로그인 시 자동 저장에 dream context 포함.

4. **저장 데이터 검증**: 서버가 `generationMethod`/`relatedDreamId`(실제 존재 여부까지)를 전부 독립 검증, `user_id`는 항상 `getCurrentUser()`만 사용 — 실제 Supabase로 위조 시도가 전부 차단됨을 확인.

5. **기존 Phase5 회귀 검증**: 기존 테스트 전부(변경 없이) 통과, 실제 dev 서버에서 일반 `/generate` 동작 무변화 확인.

6. **테스트/Validation**: lint/type-check 통과, test 12 files·**150 tests**(신규 17건) 통과, build 통과(라우트 변화 없음).

7. **발견된 문제**: 없음(신규 결함 없음, 설계 결정이 의도대로 작동함을 실측으로 확인).

8. **Phase7-4 착수 가능 여부: READY** — 꿈과 번호 생성 기록의 연결이 실제 HTTP+실제 DB로 end-to-end 검증됐다. Phase7-0이 지정한 범위(꿈 기록 작성, 당첨 확인 등)는 이번 Task에서 손대지 않아 그대로 후속 작업으로 남아 있다.
