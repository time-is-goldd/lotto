# PHASE4-1 DIARY READ SERVICE / API CONTRACT REPORT

> `docs/PHASE4_ARCHITECTURE_DECISION.md` §9(API Contract)를 실제 코드로 구현한 결과다. 조회(Read) 전용이며, 작성/수정/삭제/번호생성/운세생성 로직은 전혀 포함하지 않는다. UI 페이지/컴포넌트도 만들지 않았다.

---

## 1. 생성/수정 파일

| 파일 | 종류 | 내용 |
|---|---|---|
| `lib/types/journal.ts` | 신규 | `UserNumberEntry`/`DreamJournalEntry`/`FortuneResultEntry`/`ListOptions`/`UserNumbersListOptions`/`DiarySummary` 타입 |
| `lib/api/journal.ts` | 신규 | 조회 함수 4개 + `JournalValidationError` |
| `lib/api/journal.test.ts` | 신규 | 단위 테스트 20건 |
| `lib/supabase/server.ts` | **수정(범위 외, 근거는 §2 하단 참조)** | `createServerClient`에 `<Database>` 제네릭 추가 |

`proxy.ts`, Migration, `DATABASE_SCHEMA.md`, RLS, `lib/auth/*`, `components/*`, `app/*`, `DESIGN_SYSTEM.md`는 전혀 수정하지 않았다.

### `lib/supabase/server.ts` 수정에 대한 사전 보고

이번 지시문의 "원칙적으로 수정하지 마라" 목록에 `lib/supabase/*`는 포함되어 있지 않지만, 명시적으로 허용된 것도 아니라 임의 판단으로 처리하지 않고 여기 근거를 남긴다. `lib/supabase/service.ts`(service_role)는 이미 `<Database>` 제네릭을 적용해 `.from(table)` 호출이 스키마에서 타입을 파생하도록 되어 있는데(`docs/AI_ENGINEERING_CONSTITUTION.md §3` 인용 주석 포함), `lib/supabase/server.ts`(anon 세션, 이번 read service가 사용하는 클라이언트)에는 이 제네릭이 없었다. 이 상태로는 `lib/api/journal.ts`가 "TypeScript 타입을 명시적으로 정의"(이번 지시문 §3)하라는 요구를 지킬 수 없어, 제네릭 파라미터 1개만 추가했다. **순수 컴파일 타임 타입 정보이며 런타임 동작은 전혀 바뀌지 않는다** — 기존 호출부(`proxy.ts`의 `hasProfile()`, `lib/auth/session.ts`, `lib/auth/logout.ts`, `lib/auth/kakao.ts`)를 전수 확인했고 전부 그대로 동작함을 `npm run build`/실측(§10)으로 재확인했다.

---

## 2. 실제 확인한 DB Schema

지시받은 대로 추측하지 않고 마이그레이션 원문을 다시 열어 확인했다.

| 테이블 | 실제 컬럼(요약) | RLS(0008 원문) | Phase4-1 사용 여부 |
|---|---|---|---|
| `user_numbers`(0002) | `id, user_id(nullable), session_id, numbers, generation_method, related_dream_id, related_fortune_id, recommendation_reason, is_purchased, purchase_amount, memo, target_round, is_public, match_count, win_rank, checked_at, created_at`(updated_at 없음) | `select/insert/update/delete` 전부 `auth.uid() = user_id`, `to authenticated`만 | **사용** |
| `dream_journal_entries`(0004) | `id, user_id(NOT NULL), entry_date(NOT NULL), dream_text(NOT NULL), linked_dream_id, created_at`(updated_at 없음) | 상동(select/insert/update/delete 전부 본인만) | **사용** |
| `fortune_results`(0005) | `id, user_id(nullable), input_birth_date, zodiac_sign, overall_fortune, luck_score, recommended_numbers, today_energy, money_luck, action_guide, things_to_avoid, lucky_color, lucky_direction, lucky_time, share_id(UNIQUE), created_at`(updated_at 없음) | **SELECT는 `using(true)`, `to anon, authenticated`** — 공유 링크(`/fortune/[shareId]`) 지원을 위해 사실상 전체 공개. INSERT/UPDATE/DELETE는 client 정책 없음(서버 전용) | **사용, 단 애플리케이션 레벨 필터 필수(§5)** |
| `user_period_stats`(0005) | `id, user_id(NOT NULL), period_type, period_key, total_generated, total_purchased_count, total_purchase_amount, best_win_rank, most_frequent_numbers, updated_at`(created_at 없음) | 본인만 SELECT, INSERT/UPDATE는 service_role 전용 | **사용하지 않음** — `docs/PHASE4_ARCHITECTURE_DECISION.md` §5-1 결정 재확인: `/my/journal/stats`, `/my/journal/yearly-report`는 `EXECUTION_PLAN.md` Phase4 파일 목록에 없어 이번 Phase 대상이 아니다 |

`lib/types/database.ts`의 4개 테이블 타입 정의를 원문과 대조해 완전히 일치함을 확인했다(컬럼명/nullable 여부/enum 전부 일치).

---

## 3. 구현한 Read Service 목록

| 함수 | 대상 테이블 |
|---|---|
| `getRecentUserNumbers(options?)` | `user_numbers` |
| `getRecentDreamJournalEntries(options?)` | `dream_journal_entries` |
| `getRecentFortuneResults(options?)` | `fortune_results` |
| `getDiarySummary()` | `user_numbers`(count + 최근 목록) |

**만들지 않은 것과 이유**: 별도 "결과 확인 전용" 함수를 만들지 않고 `getRecentUserNumbers`에 `onlyChecked` 옵션 하나로 히스토리/당첨확인 화면을 공용 처리했다 — 두 화면이 같은 테이블·같은 정렬 기준을 쓰는데 함수만 두 개로 쪼개면 "미래에 필요할 것 같다"는 이유로 거의 동일한 코드를 중복시키는 셈이라 판단했다(이번 지시문 §3 "죽은 코드를 만들지 마라"와 직결). `dream_journal_entries`/`fortune_results`에는 요약(summary) 함수를 만들지 않았다 — `INFORMATION_ARCHITECTURE.md` §2.2가 "요약 카드"를 요구하는 대상은 다이어리 홈(`user_numbers` 기반 생성 이력)뿐이고, 꿈기록/운세이력은 EXECUTION_PLAN Phase4 자체가 "최소 골격"으로만 규정해 목록 조회 이상이 필요하다는 근거가 없었다.

---

## 4. 각 함수의 계약

공통: **모든 함수는 `userId`를 파라미터로 받지 않는다.** 내부에서 `getCurrentUser()`(`lib/auth/session.ts`)로 현재 세션을 직접 확인한다. 비로그인이면 에러를 던지지 않고 그 함수의 "빈 결과" 형태를 그대로 반환한다.

### `getRecentUserNumbers(options?: UserNumbersListOptions): Promise<UserNumberEntry[]>`
- 입력: `{ limit?: number; offset?: number; onlyChecked?: boolean }` (전부 선택)
- 반환: `UserNumberEntry[]`(= `Tables<"user_numbers">[]`)
- 정렬: `created_at desc`
- pagination: `limit`(기본 `DEFAULT_LIST_LIMIT = 20`, 최대 100) + `offset`(기본 0) → `.range(offset, offset+limit-1)`
- empty result: 비로그인 또는 데이터 없음 → `[]`(정상, 에러 아님)
- error: `limit`/`offset`이 정수 범위를 벗어나면 `JournalValidationError` 던짐. Supabase가 `error`를 반환하면 그대로 `throw`
- 사용 테이블: `user_numbers`
- RLS 의존: `auth.uid() = user_id`(본인만) + 애플리케이션 레벨 `.eq("user_id", userId)` 중복 필터(§5)

### `getRecentDreamJournalEntries(options?: ListOptions): Promise<DreamJournalEntry[]>`
- 입력: `{ limit?; offset? }`
- 반환: `DreamJournalEntry[]`
- 정렬: `entry_date desc`(작성 시각이 아니라 "꿈을 꾼 날짜" 기준 — §5 날짜 처리 참조)
- pagination/empty/error: 위와 동일한 규칙
- 사용 테이블: `dream_journal_entries`
- RLS 의존: `auth.uid() = user_id` + 애플리케이션 레벨 중복 필터

### `getRecentFortuneResults(options?: ListOptions): Promise<FortuneResultEntry[]>`
- 입력: `{ limit?; offset? }`
- 반환: `FortuneResultEntry[]`
- 정렬: `created_at desc`
- pagination/empty/error: 동일
- 사용 테이블: `fortune_results`
- RLS 의존: **없음(사실상)** — SELECT가 `using(true)`라 RLS는 이 함수를 전혀 보호하지 않는다. `.eq("user_id", userId)`가 유일한 방어선(§5)

### `getDiarySummary(): Promise<DiarySummary>`
- 입력: 없음
- 반환: `{ totalUserNumbersCount: number; recentUserNumbers: UserNumberEntry[] }`
- 내부: `count: "exact", head: true`로 전체 개수 조회 + `getRecentUserNumbers({ limit: 5 })` 재사용
- empty result: 비로그인 → `{ totalUserNumbersCount: 0, recentUserNumbers: [] }`
- error: count 쿼리 실패 시 `throw`
- 사용 테이블: `user_numbers`
- **의도적으로 만들지 않은 것**: "이번 달 N번 생성" 같은 기간별 집계. §5에서 상세 설명

---

## 5. RLS 의존 구조 및 날짜 처리

### RLS 의존 구조 — "RLS를 신뢰하되 이중으로 확인한다"

`user_numbers`/`dream_journal_entries`는 RLS(`auth.uid() = user_id`, `to authenticated`)가 이미 타인의 행을 반환하지 않는다. `fortune_results`는 공유 링크(`/fortune/[shareId]`) 열람을 위해 SELECT가 `anon`/`authenticated` 모두에게 `using(true)`로 열려 있어 **RLS가 소유자 기준 필터링을 전혀 하지 않는다.** 이 차이 때문에 세 함수 모두에 `.eq("user_id", userId)`를 동일하게 명시했다 — 이미 RLS가 보장하는 두 테이블에도 굳이 중복 필터를 넣은 이유는, 코드를 볼 때마다 "이 테이블은 RLS가 걸려 있던가?"를 매번 따로 확인하지 않고도 일관된 패턴만으로 안전함을 판단할 수 있게 하기 위함이다(방어적 이중 안전장치).

### 날짜/시간 처리

- `user_numbers.created_at`, `fortune_results.created_at`은 `timestamptz` — 정렬은 절대 시각 비교라 타임존 이슈가 없다.
- `dream_journal_entries.entry_date`는 `date`(타임존 없는 순수 날짜) — "꿈을 꾼 날짜"라는 의미가 명확해 이 컬럼으로 정렬했다. `created_at`(작성 시각)과 혼동하지 않도록 주석에 명시했다.
- **"이번 달 생성 횟수" 같은 기간 집계를 만들지 않은 이유**: 이런 집계는 "이번 달"의 경계를 어떤 타임존(예: KST) 기준으로 볼지 결정해야 하는데, 이번 지시문 §5가 "로컬 timezone에 의존하는 Date 계산을 임의로 넣지 마라"고 명시했고, 이 프로젝트가 이미 한 번 이 문제로 실제 버그를 겪은 전례가 있다(`lib/auth/profile.ts`의 `calculateAgeVerified`가 UTC 기준으로 통일한 이유 — 주석 참조). 정책이 정해지지 않은 상태에서 임의로 타임존을 골라 구현하는 대신, `getDiarySummary()`는 타임존 중립적인 값(전체 개수, 최근 목록)만 반환하도록 최소화했다. 월별 집계가 실제로 필요해지면 그 시점에 타임존 정책을 사용자에게 확인한 뒤 추가해야 한다 — 지금 임의로 만들지 않았다.

---

## 6. service_role 미사용 검증

```
grep -rn "service_role\|supabase/service" lib/api/journal.ts lib/types/journal.ts
```
→ 주석 1건("service_role을 쓰지 않는다")만 매치, 실제 import/호출 없음을 확인했다. `lib/api/journal.ts`는 `@/lib/supabase/server`(anon 세션)만 import한다. `"use client"` 지시어도 없어 Server 전용 모듈로 유지된다(클라이언트 번들 유입 경로 자체가 없음 — Server Component에서 직접 호출하는 구조이므로 별도 번들 분석 도구 없이도 import 그래프로 확인 가능).

---

## 7. Empty State 처리 방식

"데이터 없음"과 "조회 실패"를 명확히 분리했다:
- 비로그인, 또는 로그인했지만 행이 0건 → 정상적인 `[]`(목록 함수) / `{ totalUserNumbersCount: 0, recentUserNumbers: [] }`(요약 함수). 예외를 던지지 않는다.
- Supabase가 `error`를 반환(DB 연결 실패, 잘못된 쿼리 등) → 그 `error`를 그대로 `throw`.
- `limit`/`offset`이 유효하지 않은 값 → `JournalValidationError`를 던져 "잘못된 요청"과 "정상 빈 결과"를 구분한다.

이 규칙은 `lib/auth/profile.ts`의 기존 관례(`getProfile`이 DB 에러는 throw, 행 없음은 `null` 반환)를 그대로 재사용한 것이다.

---

## 8. Pagination/Limit 결정 근거

- cursor 기반 등 복잡한 pagination은 만들지 않고 `limit`+`offset`(Supabase `.range()`)만 사용했다 — 이번 지시문 §4가 명시적으로 요구한 범위.
- `DEFAULT_LIST_LIMIT = 20`을 목록 조회 공통 기본값으로 export해 향후 페이지 구현(Phase4-2)에서 재사용할 수 있게 했다.
- 다이어리 홈 요약 카드는 전체 목록이 아니라 미리보기 몇 건만 필요해 `SUMMARY_RECENT_LIMIT = 5`를 별도 상수로 분리했다(목록 화면 기본값과 다른 값이라 상수를 공유하지 않음).
- `MAX_LIST_LIMIT = 100`으로 상한을 둬 클라이언트가 비정상적으로 큰 값을 넘겨도 전체 테이블 스캔성 조회가 발생하지 않도록 했다.

---

## 9. 테스트 결과

`lib/api/journal.test.ts` — 20건 전부 통과(`npm test` 기준 전체 4개 파일 36건 통과).

| 검증 항목 | 테스트 |
|---|---|
| 정상 데이터 조회 | "returns rows for the current logged-in user", "combines the total count and the recent list" 등 |
| 데이터 없음(정상 empty) | "returns an empty array when there is no data (not an error)" |
| 로그인하지 않은 경우 | 4개 함수 전부 "returns an empty array ... when not logged in" + `from`이 아예 호출되지 않았음을 `expect(from).not.toHaveBeenCalled()`로 확인 |
| 잘못된 옵션 검증 | `limit`(0/-1/1.5/101), `offset`(-1/1.5) 각각 `JournalValidationError` 던짐을 `it.each`로 확인 |
| DB 오류 처리 | mock이 `error`를 반환하면 그 에러가 그대로 `reject`됨을 확인(사용자 목록 조회, 요약 count 조회 양쪽) |
| onlyChecked 옵션 | 옵션을 줬을 때만 `.not("checked_at","is",null)` 호출, 안 줬을 때는 호출 안 함을 각각 확인 |

**"사용자 간 데이터 격리"는 단위 테스트로 검증하지 않았다** — RLS는 DB 레벨 동작이라 mock으로는 의미 있게 검증할 수 없다(mock 자체가 RLS 유무와 무관하게 항상 내가 설정한 값을 반환하므로, "RLS가 막아주는지"를 이 방식으로는 절대 확인할 수 없다). 이 부분은 §10 실제 Supabase 실측으로 검증했다.

---

## 10. 실제 Supabase 실측 결과

Phase2 RLS 실사용자 테스트 방식(`establishKakaoSupabaseSession()`으로 카카오 API만 우회, 실제 Supabase 프로젝트 대상)을 재사용했다. 임시 Route Handler 2개(`app/api/dev-test-login`, `app/api/dev-test-journal` — 검증 후 즉시 삭제)를 만들어 실제 Next.js 요청 컨텍스트(쿠키 기반 세션) 안에서 `lib/api/journal.ts` 함수를 그대로 호출했다.

1. User A(신규 카카오 테스트 계정) 로그인 + profile 생성(기존 `POST /api/profile` 재사용)
2. **service_role로 테스트 데이터만 직접 삽입**(read service 코드 경로는 거치지 않음 — 이 삽입 자체가 검증 대상이 아니므로): User A 소유 `user_numbers` 1건, `fortune_results` 1건
3. User B(별도 카카오 테스트 계정, profile 없음) 로그인만 수행 — User B 소유 데이터는 만들지 않음
4. `/api/dev-test-journal`(내부에서 `getRecentUserNumbers()`/`getRecentFortuneResults()`/`getDiarySummary()` 호출)을 세 가지 세션으로 각각 호출

| 호출 주체 | `userNumbers` | `fortuneResults` | `summary.totalUserNumbersCount` |
|---|---|---|---|
| User A(본인 데이터 있음) | 1건(본인 행) | 1건(본인 행) | `1` |
| **User B(다른 계정)** | **`[]`** | **`[]`** | **`0`** |
| 비로그인 | `[]` | `[]` | `0` |

**핵심 확인 사항**: `fortune_results`는 RLS가 `using(true)`로 전체 공개인데도 User B 요청에서 User A의 행이 전혀 반환되지 않았다 — `.eq("user_id", userId)` 애플리케이션 필터가 실제로 작동함을 실측으로 확인했다. 이 필터가 없었다면 User B가 User A의 운세 결과를 그대로 받았을 것이다.

**정리(테스트 계정/데이터 전량 삭제 확인)**:
- `user_numbers`/`fortune_results`/`profiles` 삭제: 두 계정 전부 `204`
- `auth.users` 삭제: 두 계정 전부 `200`
- 임시 Route Handler(`app/api/dev-test-login`, `app/api/dev-test-journal`) 삭제 완료, `git status`/`Glob`으로 재확인
- 검증에 사용한 데이터는 합성 카카오 ID(`999999911`/`999999912`)와 테스트용 닉네임/문구뿐 — 실제 개인정보나 기존 사용자 데이터는 전혀 건드리지 않았다

---

## 11. 발견한 문제

- `lib/supabase/server.ts`에 `<Database>` 제네릭이 없어 read service 구현 중 타입 안전성 확보가 어려웠다 — §1 하단에서 이미 근거를 남긴 대로 최소한으로 보완했다.
- 검증용 service_role INSERT 과정에서 두 가지를 실제로 겪었다(코드 결함이 아니라 테스트 스크립트 작성 중 발견한 스키마 제약): (1) `user_numbers.user_id`가 `profiles`를 FK로 참조해 `profiles` 행이 먼저 있어야 삽입이 가능하다(예상된 제약, 정상 동작), (2) `fortune_results.share_id`가 `varchar(20)`이라 임의의 긴 테스트 문자열은 제약 위반으로 거부된다(정상 동작, 스키마가 의도대로 강제하고 있음을 오히려 재확인). 둘 다 애플리케이션/서비스 코드의 결함이 아니다.
- 그 외 코드 결함은 발견되지 않았다.

---

## 12. 이번 Task에서 의도적으로 하지 않은 것

- 작성/수정/삭제(Create/Update/Delete) — Phase5(번호 자동저장)/Phase6(당첨 반영)/Phase7(꿈 기록 작성)에 분산된 범위, 이번 Task는 조회만.
- `user_period_stats` 기반 통계/연말 리포트 — `PHASE4_ARCHITECTURE_DECISION.md` §5-1에서 이미 Phase4 범위 밖으로 확정.
- "이번 달 생성 횟수" 등 기간별 집계 — 타임존 정책 미확정 상태에서 임의로 만들지 않음(§5).
- REST API Route(`app/api/journal/*`) — `PHASE4_ARCHITECTURE_DECISION.md` §9 결정대로 Server Component가 `lib/api/journal.ts`를 직접 호출하는 구조를 기본으로 하고, 실제로 필요한 클라이언트 상호작용이 식별되기 전까지는 만들지 않았다.
- UI 페이지/컴포넌트 — 이번 Task 범위 아님(Phase4-2).
- `proxy.ts`/Migration/RLS/`DESIGN_SYSTEM.md` 수정 — 전부 범위 외로 유지.

---

## 13. Validation

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 36개 테스트 통과(신규 20건 포함) |
| `npm run build` | 통과, 라우트 목록 변경 없음(임시 테스트 라우트는 삭제되어 빌드 산출물에 없음) |
| `git status`(허용 범위 확인) | 이번 Task의 실제 변경분은 `lib/api/journal.ts`(신규), `lib/api/journal.test.ts`(신규), `lib/types/journal.ts`(신규), `lib/supabase/server.ts`(수정, §1 근거) 4개뿐임을 확인. `proxy.ts`/`app/*`/`components/*`/Migration/`DESIGN_SYSTEM.md`는 이번 Task에서 손대지 않았다(이번 세션 전체가 아직 커밋되지 않아 `git status`에는 이전 Phase들의 기존 변경분도 함께 표시되므로, 파일별로 실제 수정 여부를 직접 대조해 확인했다) |

---

## 14. Phase4-2 착수 가능 여부

**Ready.** 다이어리 조회 전용 서비스 계약이 실제 스키마·RLS와 교차검증되어 구현·테스트·실측까지 완료됐다. 특히 `fortune_results`처럼 RLS만으로는 안전하지 않은 테이블의 방어 로직이 실제 Supabase 프로젝트에서 의도대로 동작함을 확인했다. Phase4-2(페이지 골격 6개 + EmptyState)는 이 서비스 계층(`getDiarySummary`, `getRecentUserNumbers`, `getRecentDreamJournalEntries`, `getRecentFortuneResults`)을 Server Component에서 직접 호출해 그대로 사용할 수 있다.
