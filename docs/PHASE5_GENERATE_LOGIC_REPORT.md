# PHASE5-1 GENERATE LOGIC REPORT — 번호 생성 순수 함수 계약

> `lib/logic/generateNumbers.ts`와 그 단위 테스트만 구현했다. API Route/Supabase 호출/저장/로그인 연동/UI/컴포넌트/DB/Migration/RLS는 전혀 만들거나 수정하지 않았다.

---

## 1. 구현 파일

| 파일 | 종류 |
|---|---|
| `lib/logic/generateNumbers.ts` | 신규 — 순수 함수 + 상수 3개 |
| `lib/logic/generateNumbers.test.ts` | 신규 — 단위 테스트 7건 |

별도 타입 정의 파일은 만들지 않았다 — 반환 타입이 `number[]`로 이미 완전히 명확해 별도 타입 별칭(`type LottoGame = number[]` 등)이 실질적 가치를 더하지 않는다고 판단했다(§9 "불필요한 abstraction 금지"). `MIN_NUMBER`/`MAX_NUMBER`/`NUMBERS_PER_GAME` 상수는 같은 파일에서 함께 export해, Phase5-2(API)가 애플리케이션 레벨 검증(DB CHECK와 이중 방어, `docs/PHASE5_PRE_IMPLEMENTATION_AUDIT.md` §8)을 만들 때 매직넘버를 새로 정의하지 않고 그대로 재사용할 수 있게 했다.

---

## 2. 함수 API 계약

```ts
export const MIN_NUMBER = 1;
export const MAX_NUMBER = 45;
export const NUMBERS_PER_GAME = 6;

export function generateNumbers(): number[]
```

- **입력**: 없음.
- **출력**: 길이 6의 `number[]`, 오름차순 정렬.
- **`userId`/`sessionId`/저장 옵션/추천 알고리즘 옵션/커스텀 범위/UI 상태**: 전부 받지 않는다(지시문 §4 그대로 준수, 함수 시그니처 자체에 이런 파라미터가 존재하지 않음).
- **부수효과**: 없음. 네트워크/브라우저/React/Supabase 의존성 없음(import 구문 자체에 이런 모듈이 전혀 없음 — 재확인).
- **재현성**: 필요 없음(매 호출 다른 결과가 기능의 목적).

---

## 3. 문서 계약과의 일치 여부 (원문 재확인)

- `docs/EXECUTION_PLAN.md` Phase5: "`generateNumbers()` 순수 함수 구현 + 단위 테스트(1~45 범위, 중복없음, 6개)" — **정확히 이 계약대로 구현**.
- `docs/PHASE5_PRE_IMPLEMENTATION_AUDIT.md` §8(API 계약 제안): "입력 없음, `number[]` 반환, 정렬 권장" — **그대로 반영**.
- `docs/DATABASE_SCHEMA.md`/실제 `0002_draws_user_numbers.sql`의 `is_valid_lotto_numbers()` CHECK(길이 6, 1~45, 중복없음) — **이 함수의 출력이 그 CHECK를 항상 만족하도록 구현**(§5 불변조건 검증).
- **"여러 게임 동시 생성"**: 세 문서(EXECUTION_PLAN/ROADMAP/SITEMAP) 어디에도 명시가 없다는 사실을 Phase5-0 감사에서 이미 확인했고(`docs/PHASE5_PRE_IMPLEMENTATION_AUDIT.md` §16-2, Decision 필요 항목), 이번 지시문도 예시로 `generateNumbers(): number[]`(단일 게임)를 제시했다 — **단일 게임 계약으로 확정**하고 확장하지 않았다.

**문서 간 충돌**: 이번 Task 범위(순수 함수 계약)에서는 새로운 충돌을 발견하지 못했다. Phase5-0에서 이미 발견한 `/generate` vs `/generate/auto` 등은 이 파일의 계약과 무관하다.

---

## 4. 번호 생성 알고리즘

Rejection sampling: `Math.floor(Math.random() * 45) + 1`로 후보를 뽑아 `Set<number>`에 넣고, 크기가 6이 될 때까지 반복한 뒤 배열로 변환해 오름차순 정렬한다.

- **암호학적 안전 난수 불필요**: 실제 추첨이 아니라 "후보 제안" 기능이라(`docs/PHASE5_PRE_IMPLEMENTATION_AUDIT.md` §6) `Math.random()`으로 충분하다 — 별도 판단 없이 그대로 적용.
- **"통계 기반 추천", "당첨 확률 향상", "AI 추천", "과거 당첨번호 분석"**: 전혀 구현하지 않았다. 이 함수는 균등 분포를 "보장"한다고 주장하지도 않는다 — 그냥 1~45 중 6개를 무작위로 고를 뿐이다.

---

## 5. 불변조건 (전부 테스트로 검증)

| 불변조건 | 검증 방법 |
|---|---|
| 결과 길이 === 6 | `toHaveLength(6)` |
| 모든 값이 정수 | `Number.isInteger(n)` |
| 모든 값이 1 이상 45 이하 | 범위 비교 |
| 중복 없음(`Set.size === 6`) | `new Set(numbers).size` |
| 오름차순 정렬 | 원본과 정렬된 사본 비교 |
| 호출마다 독립적인 새 배열 | 참조 비교(`not.toBe`) + 한쪽 변형이 다른 쪽에 영향 없음 확인 |
| 입력 mutation 문제 | 해당 없음(입력 자체가 없음) |

---

## 6. 테스트 목록 및 결과

`lib/logic/generateNumbers.test.ts` — 7건, 전부 통과.

1. `returns exactly 6 numbers`
2. `returns only integers within 1~45`
3. `contains no duplicates`
4. `is sorted in ascending order`
5. `satisfies the contract across many repeated calls`(200회 반복, 계약 위반만 검사 — 통계적 균등성/성능 검증 아님, §7 지시 준수)
6. `returns a new, independent array on every call`
7. `maps Math.random() boundary values (0 and just under 1) to 1 and 45 without going out of range`

### Flaky 방지 설계 (경계값 테스트)

`Math.random()`을 하나의 고정값(예: 항상 `0`)으로 mock하면 `while (numbers.size < 6)` 루프가 서로 다른 값을 절대 만들지 못해 **무한 루프에 빠진다** — 구현 중 이 위험을 직접 인지하고, 서로 다른 6개 값(`0`, `0.999999999`, `0.1`, `0.3`, `0.5`, `0.7`)을 순환하는 시퀀스로 mock해 경계값(`0`→`1`, `0.999999999`→`45`)과 일반값을 함께 검증하도록 설계했다. `vi.spyOn(Math, "random")` + `afterEach(vi.restoreAllMocks)`로 다른 테스트에 영향을 주지 않는다. 나머지 6개 테스트는 실제 `Math.random()`을 그대로 사용하되 **특정 숫자가 나왔는지가 아니라 "결과가 계약을 만족하는가"만 검증**해 실행할 때마다 값이 달라져도 실패하지 않는다.

---

## 7. Validation 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | **43개 통과**(기존 36개 + 신규 7개, 전부 통과) |
| `npm run build` | 통과, 라우트 목록 변경 없음(순수 로직 파일이라 당연히 라우트에 영향 없음) |

### 범위 준수 확인

| 확인 항목 | 결과 |
|---|---|
| DB/Migration/RLS 변경 | 없음(파일 자체를 열지 않음) |
| `proxy.ts`/`app/*`/`components/*` 변경 | 없음(`git status`로 재확인, 이번 Task에서 Edit/Write 호출 없음) |
| Supabase 호출/`service_role` 사용 | 없음(`lib/logic/`에 grep, import 구문 자체가 없음) |
| 임시 테스트 파일/라우트 잔존 | 없음 — 이번 Task는 실 DB 검증이 필요 없는 순수 함수라 애초에 임시 라우트/계정을 만들지 않았다 |
| `git status`(범위 확인) | 이번 Task의 실제 변경분은 `lib/logic/`(신규 2개 파일) + 본 보고서뿐임을 확인 |

---

## 8. Phase5-2(API) 구현에 필요한 다음 계약

- `POST /api/numbers`가 받을 요청 바디는 `{ numbers: number[] }`이며, 그 `numbers`는 클라이언트가 **이미 이 함수로 생성해 화면에 보여준 값**을 그대로 보내는 구조다(서버가 재생성하지 않음 — 그래야 "화면에 보인 번호"와 "저장된 번호"가 항상 일치한다, `docs/PHASE5_PRE_IMPLEMENTATION_AUDIT.md` §8).
- Phase5-2의 서버 측 검증 로직은 이 파일이 export하는 `MIN_NUMBER`/`MAX_NUMBER`/`NUMBERS_PER_GAME`을 그대로 import해 사용할 것을 권장한다 — DB CHECK(`is_valid_lotto_numbers`)와 동일한 기준을 애플리케이션 레벨에서도 중복 없이 재사용하기 위함.
- `generateNumbers()` 자체는 Client Component에서 직접 호출 가능(순수 함수, DB 호출 없음) — Phase5-2/5-3에서 `components/lotto/NumberGenerator.tsx`가 이 함수를 그대로 import해 쓰면 된다.

---

## 9. 발견된 문제 / 결정 필요 사항

새로 발견된 문제는 없다. Phase5-0 감사에서 이미 식별한 5가지 Decision(`/generate` 경로, 여러 게임 생성 여부, 저장개수 제한, 공유 기능 Phase 배정, `session_id` 사용 여부)은 이번 Task 범위(순수 함수) 밖이라 재론하지 않았다 — 그중 "여러 게임 생성 여부"만 이번 함수 시그니처(`generateNumbers(): number[]`, 단일 게임)에 간접적으로 영향을 준다는 점을 §3에 기록했다. 만약 향후 "여러 게임 동시 생성"이 승인되면, 이 함수 자체를 변경하지 않고 `Array.from({ length: n }, () => generateNumbers())` 형태로 상위 레이어에서 감싸는 것으로 충분하다 — 지금 이 함수의 계약을 미리 확장할 필요가 없다는 뜻이기도 하다.
