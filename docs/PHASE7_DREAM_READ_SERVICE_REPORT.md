# Phase7-1 Dream Read Service 구현 보고서

## 1. 생성/수정 파일

**신규**: `lib/api/dreams.ts`, `lib/api/dreams.test.ts`, 본 보고서. 그 외 어떤 파일도 수정하지 않았다(migration/RLS/proxy/auth/UI 전부 미변경, `git status`로 확인).

---

## 2. 실제 DB schema와 구현 계약

Phase7-0에서 이미 확인한 스키마를 그대로 사용했고, 이번 Task에서 다시 감사하지 않았다.

- `dreams`(`id`/`keyword` varchar(50) not null/`category` varchar(30) **NULL 허용**/`interpretation`/`image_url`/`created_at`/`updated_at`) — `0003_dreams.sql`.
- `dream_number_mappings`(`id`/`dream_id` bigint FK→`dreams.id` on delete cascade, **UNIQUE 아님**/`numbers` int[]/`created_at`) — `0003_dreams.sql`.
- RLS: 둘 다 전체 공개 SELECT, 쓰기는 service_role 전용(`0008_rls_policies.sql`, 변경 없음).

---

## 3. 확정된 category taxonomy 및 함수 이름 Decision

### Category taxonomy

Phase7-0이 발견한 문서(`INFORMATION_ARCHITECTURE.md`, 5개) vs 실제 데이터(7개) 불일치를 이번 Task 지시대로 **실제 DB 값을 기준으로 확정**했다. 새 카테고리를 발명하지 않고, `getDreamCategories()`가 실제 `dreams.category` 컬럼 값을 그대로 반환하도록만 구현했다 — 즉 taxonomy 자체를 코드에 하드코딩하지 않고 **DB가 유일한 진실 소스**가 되도록 설계했다(현재 값: 동물/신체/인물/상황/자연/행동/사물, 7개).

### URL slug

**별도 slug 컬럼/매핑 테이블을 만들지 않았다.** `EXECUTION_PLAN.md`의 라우트가 이미 `app/dream/[keyword]/page.tsx`(파라미터명이 `keyword`)이고 `app/dream/category/[category]/page.tsx`(파라미터명이 `category`)로, **한글 값을 URL 세그먼트에 그대로 쓰는 것이 기존 프로젝트 컨벤션**이다. 이 컨벤션을 그대로 따라 카테고리도 실제 문자열("동물" 등)을 그대로 슬러그로 쓰는 것으로 확정했다 — 영문 slug 매핑 테이블을 새로 만드는 것이 "가장 단순하고 유지보수하기 쉬운 방식"이라는 지시 기준에 부합하지 않는다고 판단했다(매핑 테이블 자체가 유지보수 대상이 되기 때문). `/dream/category/*` 페이지 구현 자체는 이번 Task 범위가 아니다.

### 함수 이름: `getDreamBySlug` → `getDreamByKeyword`

지시문이 예시로 든 `getDreamBySlug(slug)`를 그대로 쓰지 않고 `getDreamByKeyword(keyword)`로 구현했다. 이유: `dreams` 테이블에 `slug` 컬럼 자체가 없고, 조회 키는 실제로 `keyword`이며, 라우트 파라미터명도 `[keyword]`다. "실제 DB 기준", "기존 프로젝트 컨벤션 준수" 원칙에 따라 존재하지 않는 개념(slug)에 이름을 맞추지 않았다.

---

## 4. 구현한 함수 계약

```ts
getDreamCategories(): Promise<string[]>
// dreams.category의 중복 없는 값 목록, 정렬됨. NULL은 제외.

getDreams(options?: { category?: string }): Promise<Dream[]>
// 전체 목록(id 오름차순) 또는 category로 필터링한 목록. 페이지네이션 없음(현재 25건 규모에 불필요).

getDreamByKeyword(keyword: string): Promise<Dream | null>
// 정확히 일치하는 keyword 조회. 없으면 null(에러 아님).

getDreamNumbers(dreamId: number): Promise<number[] | null>
// 해당 꿈의 추천번호(dream_number_mappings.numbers). 없으면 null.
```

`Dream = Tables<"dreams">`(별도 `lib/types/dreams.ts` 없이 `lib/api/numbers.ts`와 동일하게 이 파일 안에서만 정의 — 과도한 abstraction 지양).

---

## 5. 인증/RLS/service_role 사용 여부

- **인증 강제 없음** — `getCurrentUser()`를 어디서도 호출하지 않는다. 4개 함수 전부 인자로 `userId`를 받지 않는다.
- **service_role 미사용** — `lib/supabase/service.ts`를 import하지 않는다(전수 확인). `lib/supabase/server.ts`(anon key + 쿠키 세션)만 사용.
- **RLS 변경 없음** — 기존 공개 SELECT 정책만으로 4개 함수 전부 정상 동작(코드 검토로 확인, 별도 실측 불필요 — Phase6-2/Phase7-0에서 이미 이 두 테이블의 공개 SELECT를 실측 확인했으므로 반복하지 않음).

---

## 6. 테스트 결과

`lib/api/dreams.test.ts` 14건, 전부 mock 기반 단위 테스트(`vi.mock("@/lib/supabase/server")`, `lib/api/numbers.test.ts`와 동일한 컨벤션):

| 함수 | 케이스 |
|---|---|
| `getDreamCategories` | 중복 제거+정렬, NULL 제외, 빈 결과, Supabase 오류 전파 |
| `getDreams` | 옵션 없음(전체), `category` 필터, 빈 결과, Supabase 오류 전파 |
| `getDreamByKeyword` | 정상 keyword, 존재하지 않는 keyword(null, 에러 아님), Supabase 오류 전파 |
| `getDreamNumbers` | 매핑 있음, 매핑 없음(null), Supabase 오류 전파 |

기존 테스트 파일은 하나도 수정하지 않았다.

---

## 7. lint/type-check/test/build 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 통과 — **12 test files, 133 tests**(기존 119 + 신규 14) |
| `npm run build` | 통과, 라우트 목록 변화 없음(이번 Task는 UI/Route를 만들지 않음) |

`git status`로 확인한 변경 파일은 `lib/api/dreams.ts`/`dreams.test.ts`/본 보고서 3개뿐이다.

---

## 8. Phase7-2에서 바로 사용할 수 있는 API 계약

```ts
import { getDreamByKeyword, getDreamCategories, getDreamNumbers, getDreams } from "@/lib/api/dreams";

// 목록 페이지: const dreams = await getDreams();
// 카테고리 페이지: const dreams = await getDreams({ category: "동물" });
// 카테고리 목록(내비게이션 등): const categories = await getDreamCategories();
// 상세 페이지: const dream = await getDreamByKeyword(params.keyword); if (!dream) notFound();
// 추천번호 페이지: const numbers = await getDreamNumbers(dream.id);
```

Server Component에서 직접 `await`로 호출 가능(다른 Phase7-0 확인 함수들과 동일 패턴), 인증/service_role 불필요.

---

## 9. 발견된 문제 (해결하지 않고 기록만 함)

- **`dreams.keyword`에 DB 레벨 UNIQUE 제약이 없다.** 실제 시드 데이터 25건은 전부 고유하지만(읽기 전용 조회로 확인), 스키마가 이를 보장하지 않는다. `getDreamByKeyword()`가 `.maybeSingle()`을 쓰므로 향후 중복 keyword가 들어오면 조용히 틀린 값을 반환하는 대신 명시적 에러를 던진다 — 안전한 실패 방식이라고 판단해 이번 Task에서 별도 조치를 하지 않았다. 실제로 중복 방지가 필요하다고 판단되면 별도 migration(`UNIQUE` 제약 추가)이 필요하나, 이는 이번 Task 범위가 아니다.
- **`dream_number_mappings.dream_id`도 UNIQUE가 아니다** — 위와 같은 이유로 `getDreamNumbers()`는 `.limit(1)`로 첫 매핑만 반환하도록 설계했다(스키마가 실제로 허용하는 것보다 더 강한 가정을 하지 않음). 여러 세트를 지원해야 한다는 요구사항이 생기면 그때 반환 타입을 바꾸면 된다.

두 문제 모두 이번 Task의 조회 함수 구현 범위 안에서 안전하게 처리했으며, 해결 범위를 넓혀 migration을 만들지 않았다.

---

## TASK REPORT

**변경 파일**: `lib/api/dreams.ts`(신규), `lib/api/dreams.test.ts`(신규), `docs/PHASE7_DREAM_READ_SERVICE_REPORT.md`(신규). 그 외 미변경.

**구현 내용**: `getDreamCategories()`, `getDreams(options?)`, `getDreamByKeyword(keyword)`, `getDreamNumbers(dreamId)` — 4개 조회 전용 함수. 인증/service_role 미사용, RLS 변경 없음, 번호 생성/저장/`/generate` 연동/꿈 기록 작성 전부 미구현(범위 제외 그대로 준수).

**taxonomy 결정**: 실제 DB의 7개 category 값을 그대로 taxonomy로 채택(하드코딩 없이 DB가 진실 소스), 영문 slug 매핑 없이 한글 값을 그대로 URL 세그먼트로 사용(기존 `[keyword]` 컨벤션과 일치). `getDreamBySlug` 대신 `getDreamByKeyword`로 명명(실제 컬럼/라우트명과 일치).

**테스트**: 14건 신규(카테고리 조회/목록 조회/필터/정상 및 미존재 keyword/빈 결과/Supabase 오류 전파 전부 커버), 기존 테스트 무수정.

**Validation**: lint/type-check 통과, test 12 files·133 tests 전체 통과(기존 119 + 신규 14), build 통과(라우트 변화 없음).

**발견된 문제**: `dreams.keyword`/`dream_number_mappings.dream_id` 모두 DB UNIQUE 제약 부재 — 현재 데이터는 문제없이 고유하나 스키마가 보장하지 않음. 조회 함수를 그 불확실성에 안전하도록 설계(에러로 드러나거나 first-match 반환)하는 것으로 대응, migration은 만들지 않고 기록만 함.

**Phase7-2 착수 가능 여부: READY** — `lib/api/dreams.ts`가 열람 UI(목록/카테고리/상세/추천번호)에 필요한 모든 조회를 제공하며, DB/RLS/인증 어느 것도 추가 변경 없이 그대로 사용 가능하다.

