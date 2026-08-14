# Phase10-4A — 오늘의 행운(Daily Fortune) MVP 구현 보고서

> 이 문서는 Phase10-4A("오늘의 행운" MVP 구현) 지시문의 요구에 따라 실제 코드/DB/테스트
> 결과만을 근거로 작성했다. 추측이나 계획 단계의 서술은 포함하지 않는다.

## 1. 목적 및 성공 조건 재확인

로그인 사용자가 기존 `profiles.birth_date`를 이용해 오늘의 행운을 한 번 생성하면, 한국 시간
(Asia/Seoul) 기준 그날 하루 동안 같은 금전운·행동 지침·행운 요소·추천번호를 계속 확인할 수
있고, 다음 날 새로운 결과를 받는다. AI API 비용은 0원이다.

이 Task는 Phase10-5(카카오 실제 E2E)를 대체하지 않으며, 출시 전 마지막 핵심 제품 기능으로
삽입되었다.

## 2. 사전 투자(§1 조사) 결과

| 확인 항목 | 결과 |
|---|---|
| `fortune_results` 실제 컬럼 | `id, user_id(nullable), input_birth_date(not null), zodiac_sign, overall_fortune(not null), luck_score(not null), recommended_numbers(not null), today_energy, money_luck, action_guide, things_to_avoid, lucky_color, lucky_direction, lucky_time, share_id(not null unique), created_at` — 0005_fortune_results_user_period_stats.sql 원문으로 재확인 |
| PRODUCT_EXPANSION_PLAN.md의 "result_date 하나만 추가하면 된다" 판단 | **재확인 후 유지.** 7개 필수 항목(금전운/좋은 행동/피할 행동/색/시간/행운숫자/추천번호)이 모두 기존 컬럼에 매핑되고, 행운 숫자(1~3개)는 저장하지 않고 조회 시 파생시키는 방식을 택해 새 컬럼이 필요 없었다 |
| `fortune_results` 기존 row 수 | **0건** (service_role REST 쿼리로 직접 확인, `Content-Range: */0`) — NOT NULL 컬럼 추가에 backfill 문제 없음 |
| RLS(0008_rls_policies.sql) | `fortune_results_select_own_or_shared`: `to anon, authenticated using (true)` — **완전 공개 SELECT**. INSERT/UPDATE/DELETE 클라이언트 정책 **없음** — "Decision 1" 주석이 이미 "운세 생성은 서버 API Route가 service_role로만 처리한다"고 명시 |
| `lib/api/journal.ts`의 `getRecentFortuneResults()` | 이미 존재, `FortuneResultEntry` 타입도 이미 export됨 — 재사용 가능. `.eq("user_id", userId)`를 명시적으로 강제하는 이유가 위 RLS 공개-SELECT 사실을 이미 알고 있었기 때문임을 주석에서 확인 |
| `app/my/journal/fortune-history/page.tsx` | 이미 존재, `getRecentFortuneResults()` 호출·`EmptyState` 폴백 보유. "운세 생성 기능 준비 중" Badge가 있었음(이번 Task로 사실이 아니게 됨 → §11에서 수정) |
| GlobalNav/BottomNavigation | `/fortune` href가 **이미** 존재(이번 Task 이전부터, 링크는 404였음) |
| `lib/logic/generateNumbers.ts` | `MIN_NUMBER=1, MAX_NUMBER=45, NUMBERS_PER_GAME=6`, `Math.random()` 기반 — **무수정** |
| `user_numbers.generation_method` enum | `'fortune'` 값이 **이미 존재**하지만 `lib/api/numbers.ts`의 `parseDreamContext()`가 `'dream'`만 허용하도록 검증해 실제로는 막혀 있음 |
| `user_numbers.related_fortune_id` | nullable bigint, FK 없음 — 존재하지만 미사용 |
| `docs/SITEMAP.md` | `/fortune`을 P0(최우선 SEO)로 명시. 원문 라벨은 "[Fortune] AI 운세 입력"이나, 이는 AI를 쓰지 않기로 확정한 이번 구현 이전의 초기 기획 문구라 실제와 다르다(문서 자체는 수정하지 않음, 사실과의 괴리만 기록) |
| 다음 migration 번호 | `npx supabase migration list`로 0001~0015가 모두 local=remote 적용 완료 상태임을 확인, 다음 번호 0016 사용 |

## 3. 개인정보 입력 범위(§3)

새로 수집하는 개인정보 없음. `getCurrentUser()`(세션)와 `getProfile(userId).birth_date`(기존
컬럼), 그리고 서버가 계산하는 오늘 날짜만 사용한다. `birth_time`/`gender`는 요청도, 저장도
하지 않는다.

## 4. 타임존 처리(§4)

`lib/utils/kstDate.ts`의 `getKstDateString()`이 `Intl.DateTimeFormat`(`timeZone: "Asia/Seoul"`,
`formatToParts`)으로 KST 기준 날짜 문자열(YYYY-MM-DD)을 계산한다. 기존
`lib/api/journal.ts`의 `todayDateString()`(UTC 기준)과는 별도 파일 — 재사용하지 않았다(그
함수를 쓰면 KST 자정 경계에서 하루 밀리는 버그가 그대로 재현됨).

단위 테스트로 자정 경계를 직접 검증했다: KST 23:59:59(=UTC 14:59:59)는 이전 날짜, 정확히
1초 뒤 KST 00:00:00(=UTC 15:00:00)은 다음 날짜로 바뀜을 확인(`lib/utils/kstDate.test.ts`).

## 5. DB 변경(§5)

`supabase/migrations/0016_fortune_results_daily.sql` 하나만 추가했다(0001~0015 무수정).

```sql
alter table public.fortune_results add column result_date date not null;
alter table public.fortune_results
  add constraint fortune_results_user_id_result_date_key unique (user_id, result_date);
```

- 기존 row 0건이라 NOT NULL 추가에 backfill 불필요.
- `user_id`가 nullable(비회원 설계 흔적)이라 UNIQUE는 Postgres NULL-distinct 규칙상 비회원 다건에는
  적용되지 않지만, 이 기능은 로그인 사용자만 대상이라 실무 영향 없음.
- 새 테이블은 만들지 않았다. `npx supabase db push`로 실제 원격 DB에 적용, `npx supabase migration list`로
  local/remote 0016 일치 확인.
- `lib/types/database.ts`를 `supabase gen types typescript --linked` 결과와 diff해 `result_date` 3곳
  (Row/Insert/Update)만 수동 반영했다(생성기 버전 차이로 인한 무관한 포맷팅 diff는 배제).

## 6. 결정론적 엔진(§6)

`lib/logic/dailyFortune.ts` — 순수 함수, AI/외부 API 호출 없음.

- `computeFortuneSeed(userId, birthDate, resultDate)`: `crypto.createHash("sha256")`로 세 값을 해시,
  앞 4바이트를 부호 없는 32비트 정수로 읽어 시드로 사용.
- `deriveSeed(base, salt)`: 콘텐츠 선택/추천번호/행운숫자-개수/행운숫자-값 각각을 위한 독립
  하위 시드를 파생시켜, 한 영역의 draw 횟수 변화가 다른 영역 결과에 영향을 주지 않게 분리.
- `createSeededRandom(seed)`: mulberry32 구현(Node 표준 `crypto`만 사용, 새 npm 의존성 없음).
- `generateSeededNumbers(seed, count=6)`: `generateNumbers()`(Math.random 기반)와 완전히 분리된
  독립 함수. 기존 함수는 import조차 하지 않는다.
- `zodiacSignFromBirthDate(birthDate)`: birthDate에만 의존, userId/resultDate와 무관(매일 바뀌지
  않는 안정적 속성).

## 7. 콘텐츠 뱅크(§7)

새 `fortune_templates` DB 테이블/CMS 없음. `lib/data/fortune/*.ts`에 정적 배열로 구성했다.

| 파일 | 구성 | 개수 |
|---|---|---|
| `moneyLuck.ts` | good/neutral/caution 3단계 | 38 (14/13/11) |
| `recommendedAction.ts` | 3단계 | 38 (14/13/11) |
| `avoidAction.ts` | 3단계 | 36 (12/13/11) |
| `overallFortune.ts` | 3단계 | 33 (12/11/10) |
| `luckyColor.ts` | 단계 구분 없음 | 18 |
| `luckyTime.ts` | 단계 구분 없음 | 15 |

`tiers.ts`의 `tierFromLuckScore()`가 `luck_score`(기존 컬럼 재사용, 55~92 범위)를
good(≥75)/neutral(60~74)/caution(<60) 3단계로만 나눈다 — 사주/점성술 엔진 없이 이 분기 하나로
내부 일관성을 유지한다(§9).

## 8. 톤/표현(§8)

모든 문구가 "~해보세요"/"~일 거예요" 식의 가볍고 긍정적인 제안형이다. caution 단계도 "나쁜
하루"가 아니라 "조금 더 신중하게"에 가깝게 작성했다. 의료·금융·법률 강한 조언(예: "투자하세요",
"계약하지 마세요" 같은 단정) 없음. 당첨 확률 상승 표현 없음(§13/§22와 동일 원칙 전체 적용).

## 9. 서비스 성격/luck_score(§10)

기존 `luck_score` 컬럼을 그대로 재사용했다(새 점수 컬럼 없음). 55~92 범위로 계산해 UI에
"행운지수 N" 형태로 텍스트 중심 표시만 한다.

## 10. 행운 숫자(§11)

1~3개, 1~45 범위, 추천번호 6개와 중복 허용. **저장 컬럼을 새로 만들지 않고** 조회 시
`lib/api/fortune.ts`의 `getLuckyNumbersForEntry(entry, userId)`가 저장된 `input_birth_date`/
`result_date`로 `generateDailyFortune()`을 다시 호출해 파생시킨다 — 시드가 세 값으로 완전히
결정되므로 항상 같은 값이 나온다(단위 테스트로 검증).

## 11. 로또 번호(§12)

`generateSeededNumbers()`가 1~45 범위 유일값 6개를 오름차순으로 반환한다. 기존
`lib/logic/generateNumbers.ts`(Math.random 기반)는 **무수정**이며 이 파일에서 import조차
하지 않는다.

## 12. 면책/AI 표현(§13)

`components/fortune/DailyFortuneCard.tsx`의 추천번호 섹션 바로 아래에 "오락·참고용으로
제공되는 오늘의 행운 번호입니다. 당첨 확률을 보장하지 않아요." 문구를 고정 배치했다. UI
전체에 "AI"라는 단어는 등장하지 않는다(전수 확인 — 페이지/컴포넌트/메타데이터 모두).

## 13. Generate-or-get / 동시성(§14)

`lib/api/fortune.ts`의 `getOrCreateTodayFortune(userId, birthDate)`:

1. `getTodayFortuneResult()`(세션 클라이언트, `.eq(user_id).eq(result_date).maybeSingle()`)로 조회.
2. 있으면 `{entry, isNew:false}` 즉시 반환.
3. 없으면 `createTodayFortuneResult()`(service_role INSERT) 시도.
4. INSERT가 `23505`(UNIQUE 위반, 동시 요청 경쟁)로 실패하면 재조회해 그 행을 `{entry, isNew:false}`로 반환.

**실제 DB로 동시성 테스트(Test E, §18 참조)**: 같은 신규 사용자에 대해 `Promise.all`로 두
`getOrCreateTodayFortune()`을 동시에 호출한 결과, 두 호출이 **같은 행 id로 수렴**했고, DB에는
정확히 1행만 남았으며, 두 결과 중 정확히 하나만 `isNew:true`였다. (단위 테스트 작성 중 이
"패자 쪽도 isNew:true를 반환하는" 실제 버그를 발견해 수정했다 — §17 참조)

## 14. API(§15)

`POST /api/fortune/today` — 요청 본문을 읽지 않는다. `user_id`는 `getCurrentUser()`로만,
`birth_date`는 `getProfile(user.id)`로만 서버가 직접 결정한다. 401(미로그인)/404(profile 없음,
code: `PROFILE_NOT_FOUND`)/500 외에 200(기존 결과)·201(신규 생성)을 구분해 반환한다.

## 15. service_role 사용 판단(§16)

기본 원칙(client RLS 우선, service_role 최소화)에 따라 **먼저 client INSERT 가능 여부를
확인**했다. 결과: **불가능** — 0008_rls_policies.sql이 이미 이 테이블에 client INSERT 정책을
전혀 두지 않기로 결정했었다("Decision 1": 비회원 운세 생성도 지원해야 해서
`auth.uid()=user_id` 방식의 client INSERT 정책 자체를 두지 않고, 운세 생성은 서버 API
Route가 service_role로만 처리하도록 이미 설계됨). 따라서 이 Task가 새로 내린 보안 완화
결정이 아니라, 기존에 이미 확정된 설계를 그대로 따른 것이다. SELECT(조회)는 service_role을
쓰지 않고 세션 클라이언트 + `.eq("user_id", userId)` 명시로 처리했다(`getRecentFortuneResults()`와
동일 패턴).

## 16. RLS/개인정보 위험 — 발견 및 판단(§17, 중요)

**발견한 사실 (실측)**: `fortune_results`의 SELECT RLS는 `to anon, authenticated using (true)`로
**완전히 공개**되어 있다 — 로그인 여부와 무관하게 공개 anon key만으로 REST API를 직접 호출하면
전체 행을 조회할 수 있다. 실제로 테스트 계정 3명을 만들어 확인한 결과:

```
curl "$SUPABASE_URL/rest/v1/fortune_results?select=id,user_id,input_birth_date,luck_score" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
→ [{"id":5,"user_id":"...","input_birth_date":"1990-05-15","luck_score":77}, ...]
```

이 RLS는 이번 Task가 만든 것이 아니라 0008_rls_policies.sql(공유 링크 `/fortune/[shareId]`
설계)에서 이미 결정된 것이다. 이 테이블이 지금까지 **0건**이었기 때문에 지금까지는 이론상의
위험이었지만, 이번 Task로 처음 실제 개인정보(`input_birth_date`, 실제 생년월일)가 채워지기
시작하면서 **실질적인 위험이 된다**.

**이번 Task에서 취한 조치**:
- RLS 정책 자체는 **재설계하지 않았다**(지시문 §17 "공유 기능 때문에 존재한 기존 설계를
  깨뜨리지 않는다"). `share_id` 기반 공유 링크 설계가 이 공개-SELECT에 의존하고 있어, 임의로
  잠그면 §23이 이번 MVP 범위 밖으로 명시한 공유 상세 페이지 설계 자체를 미리 깨뜨릴 수 있다.
- 대신 **이 기능의 코드 자체가 새로운 노출 경로를 추가하지 않도록** 했다: `/api/fortune/today`와
  `app/fortune/page.tsx`는 항상 `getCurrentUser()`로 확인한 본인 `user_id`만 조회·표시하고,
  "전체 목록 조회" UI는 어디에도 만들지 않았다.
- `input_birth_date`는 0005에서 이미 NOT NULL로 정의된 기존 컬럼이라 INSERT 시 값을 넣지 않을
  방법이 없다(지시문 §17 "birth_date 자체를 저장하지 않는다"는 원칙과 기존 스키마 제약이
  충돌하는 지점 — 스키마를 이번 Task 범위에서 변경할 권한은 없다고 판단해 기존 NOT NULL
  제약을 그대로 따랐다).

**Known Issue(출시 전 검토 권장, 이번 Task 범위에서 고치지 않음)**: `fortune_results`가 이제
실제 개인정보를 담게 되므로, 공개 SELECT를 계속 열어둘지, 아니면 `share_id` 기반 공유 조회를
위한 별도의 공개 뷰/컬럼-한정 함수로 분리하고 기본 SELECT는 `auth.uid() = user_id`로 좁힐지에
대한 결정이 실제 공개 launch 전에 필요하다고 판단한다. 이 판단과 실측 결과를 §16(TASK
REPORT)의 Remaining Launch Blockers에도 반영했다.

## 17. 서비스 레이어 구현 중 발견한 버그(수정함)

단위 테스트(`lib/api/fortune.test.ts`)를 작성하는 과정에서, `createTodayFortuneResult()`가
UNIQUE 충돌로 기존 행을 재조회해 반환하는 경로에서도 `getOrCreateTodayFortune()`이 무조건
`isNew:true`를 반환하던 버그를 발견했다. `createTodayFortuneResult()`가 `{entry, created:boolean}`을
반환하도록 수정해, "이 요청이 실제로 새로 만들었는가"를 정확히 반영하도록 고쳤다(§13의 첫
확인 reveal 애니메이션이 실제로 새로 생성된 경우에만 재생되도록 하기 위함). 이 수정은
실제 DB 동시성 테스트(Test E)로도 재확인했다.

## 18. UI(§18~§22)

기존 `/fortune` 라우트(GlobalNav/BottomNavigation이 이미 링크만 갖고 있던)를 그대로 사용했다
— 중복 라우트를 만들지 않았다.

- 비로그인: 설명 문구 + "/login?next=%2Ffortune" CTA(기존 카카오 로그인 플로우 재사용, 가짜
  로그인 UI 없음).
- 로그인 + profile 없음: "/onboarding" CTA.
- 로그인 + profile 있음: `getOrCreateTodayFortune()` 서버 실행 → 결과를
  `DailyFortuneCard`(Client Component)에 props로 전달. 첫 생성(`isNew:true`)일 때만 약 1.3초
  reveal 연출("오늘의 행운을 살펴보고 있어요" + Spinner → 카드 등장), `prefers-reduced-motion`
  존중, 이미 있던 결과(`isNew:false`)는 연출 없이 즉시 표시.
- 화면 구성: 제목, 날짜, 총평, 금전운, 좋은 행동, 피할 행동, 행운의 색, 행운의 시간, 행운의
  숫자(LottoBall 스타일), 오늘의 추천번호 6개(LottoBall 스타일) + 면책 문구, "내일 새로운
  행운이 찾아와요." 문구.
- "다시 뽑기"/"다른 운세 보기"/"번호 다시 생성" 버튼 **없음** — 코드 전수 확인.
- 새로고침해도 결과 불변: `getOrCreateTodayFortune()`이 같은 날에는 항상 기존 행만 반환하므로
  구조적으로 보장된다(Test A2로 실측 확인).

## 19. 공유(§23)

`components/fortune/dailyFortuneShareLogic.ts`의 `buildShareText()`가 총평/행운의 색·시간/행운
숫자/추천번호 + 사이트 URL만 담은 텍스트를 만든다 — `birth_date`/`user_id`/닉네임/이메일 등
개인정보 필드는 입력 타입(`ShareableFortune`)에 애초에 존재하지 않는다. `navigator.share()`
지원 시 공유 시트, 아니면 `navigator.clipboard.writeText()` 폴백. **새 public 상세 라우트/API는
만들지 않았다** — `share_id`는 기존 NOT NULL UNIQUE 컬럼 제약을 만족시키기 위해 여전히
생성하지만, 실제로 조회 가능한 링크로 이어지지는 않는다(그 라우트 자체가 이번 MVP 범위 밖).

## 20. related_fortune_id 연동(§24) — Deferred

`user_numbers.generation_method` enum에 `'fortune'` 값이 이미 존재하고 `related_fortune_id`
컬럼도 있지만, `lib/api/numbers.ts`의 `parseDreamContext()`가 `generationMethod`를 `'dream'`
하나만 허용하도록 검증하고 있어 실제로는 막혀 있다. 이 계약을 넓히려면 `/api/numbers`의 기존
요청 스펙(Phase5/7이 이미 확정)을 변경해야 하는데, 이는 지시문이 "기존 계약을 확장하지 말고
Deferred로 남기라"고 명시한 정확히 그 상황이다. **이번 MVP에서는 추천번호를 화면에 표시만
하고, `user_numbers` 저장 연동은 구현하지 않았다.** ("저장하기" 버튼 자체도 만들지 않음 —
§22의 "다시 뽑기 없음" 원칙과 같은 이유로, 이 MVP에 없는 행동을 위한 UI를 미리 만들지 않았다.)

## 21. 운세 기록 화면(§25)

`app/my/journal/fortune-history/page.tsx`는 **무수정 재사용**(새 히스토리 페이지를 만들지
않음) — `getRecentFortuneResults()`를 그대로 호출하므로 새로 쌓이는 오늘의 행운 결과가 자동으로
보인다(실제 DB로 확인, §18의 Test 참조). 이제 사실이 아니게 된 "운세 생성 기능 준비 중"
Badge를 제거하고, 다른 journal 목록 페이지(`/my/journal/dreams`)와 동일한 스타일의 "오늘의
행운 확인하기" CTA로 교체했다(헤더 + 빈 상태 두 곳).

## 22. 법적 페이지(§26~§28)

- `/privacy`: §1(수집 항목)에 "생년월일을 바탕으로 하루 1회 생성되는 오늘의 행운 결과" 한 줄,
  §2(이용 목적)에 "외부 AI 서비스를 이용하지 않고 서비스 내부 로직으로만 계산합니다" 한 줄
  추가. birth_time/gender 수집 주장 없음, AI 데이터 공유 주장 없음.
- `/about`: 기존 "제공하는 기능" 목록에 "오늘의 행운" 항목 1개 추가(기존 항목과 동일한 톤).
- `/terms`: **수정하지 않았다.** §6("번호 생성·꿈해몽·행운 다이어리 서비스의 성격")의 기존
  문구("서비스가 생성하는 번호는... 당첨을 보장하지 않습니다", "참고와 오락을 위한 정보로,
  당첨 확률이나 결과를 예측하지 않습니다")가 오늘의 행운의 추천번호/행운숫자에도 그대로
  적용되는 일반적 문구라고 판단했다(불충분하지 않음 → 재작성하지 않음).

## 23. SEO/sitemap(§29)

`docs/SITEMAP.md` §4가 `/fortune`을 P0로 명시하고 있어 `app/sitemap.ts`의 정적 목록에
`/generate`와 동일한 `priority: 0.9, changeFrequency: "daily"`로 추가했다. 페이지 자체에
`alternates.canonical: "/fortune"` 메타데이터를 부여했다. Fortune 전용 JSON-LD는 추가하지
않았다(다른 기능 페이지들도 없음, 일관성 유지). sitemap 총 URL 수: 39 → **40**.

## 24. 테스트(§30~§32)

### 단위 테스트(신규)

| 파일 | 개수 | 대상 |
|---|---|---|
| `lib/utils/kstDate.test.ts` | 6 | KST 자정 경계 포함 |
| `lib/logic/dailyFortune.test.ts` | 18 | 결정론/가변성/범위/제로산/varchar(20) 제약 등 |
| `lib/api/fortune.test.ts` | 8 | generate-or-get, race 복구, service_role/세션 클라이언트 분리 |
| `components/fortune/dailyFortuneShareLogic.test.ts` | 3 | 공유 문구에 개인정보 없음, 당첨확률 문구 없음 |

전체 테스트: **282 → 317** (신규 35개), 전부 통과.

### 실제 Supabase 통합 테스트(ephemeral `app/api/jtest/route.ts`, 검증 후 삭제)

| Test | 시나리오 | 결과 |
|---|---|---|
| A1 | 신규 사용자 첫 `POST /api/fortune/today` | `201`, `isNew:true` |
| A2 | 같은 날 재호출 | `200`, **동일 id/내용**, `isNew:false` |
| B | 다른 사용자, 같은 날 | `201`, **다른 id**, 같은 `result_date` |
| C | 미로그인 `POST /api/fortune/today` | `401 UNAUTHORIZED` |
| D | `/my/journal/fortune-history`에서 본인 결과만 노출 | 확인(본인 1건만, 타 사용자 행 없음) |
| E | 같은 신규 사용자에 `Promise.all`로 동시 2회 호출 | 두 결과 같은 id로 수렴, DB에 정확히 1행, `isNew` 정확히 하나만 true |
| RLS 실측 | anon key로 `fortune_results` 직접 REST 조회 | 3명분 `input_birth_date` 전부 노출 확인(§16 근거) |

**클린업**: 테스트 계정 3명(auth.users/profiles/fortune_results)을 정확한 id로 전부 삭제,
service_role 재조회로 0건 재확인. 운영 데이터는 조회·수정하지 않았다. `app/api/jtest/route.ts`
파일 자체도 삭제 완료(재조회 시 404 확인).

## 25. 보안/UI 검증(§33~§35)

- 서버가 클라이언트 입력을 신뢰하는 지점 없음: `user_id`는 항상 `getCurrentUser()`, `birth_date`는
  항상 `getProfile()`에서만 읽는다. `POST /api/fortune/today`는 요청 본문 자체를 읽지 않는다.
- `lucky_color`/`lucky_time` 문자열이 `varchar(20)` 제약을 넘지 않는지 단위 테스트로 검증.
- 데스크톱/모바일 각각 `/fortune`(비로그인) HTTP 200, 타이틀·설명 문구 정상 렌더 확인.
- 기존 기능 회귀 확인(스모크): `/`, `/generate`, `/dream`, `/faq`, `/about`, `/terms`, `/privacy`,
  `/login`, `/robots.txt`, `/sitemap.xml` 전부 200, `/my/journal/*`는 미로그인 시 307(로그인
  리다이렉트, 정상 동작). lint/type-check/전체 테스트 스위트/프로덕션 빌드 전부 통과 —
  Phase10-3에서 새로 추가된 번호 생성 reveal 애니메이션 등 기존 기능에 코드 변경 없음(전수 diff 확인).

## 26. 검증 스위트 결과(§37)

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과(0 error) |
| `npx tsc --noEmit` | 통과(0 error) |
| `npx vitest run` | **317/317 통과**(기존 282 + 신규 35) |
| `npm run build` | 통과, 45개 route 생성(신규: `/fortune`, `/api/fortune/today`) |
| migration sync | `npx supabase migration list` — local/remote 0001~0016 전부 일치 |
| sitemap | 39 → 40 URL |
| git status | 이번 Task로 추가/수정된 파일 외 세션 전체의 기존 미커밋 변경사항 그대로 유지(커밋 요청 없었음, 별도 조치 안 함) |

## 27. 다음 작업

`fortune_results` SELECT RLS가 공개(`using(true)`)인 상태에서 실제 개인정보(`input_birth_date`)가
채워지기 시작한 것에 대한 launch 전 정책 결정(공개 유지 vs. 공유 전용 뷰로 분리) 필요.

---

## TASK REPORT — Daily Fortune MVP

- AI API Used: 없음(OpenAI/Claude/Gemini/외부 운세 API 전부 미사용, 코드 전수 확인)
- API Cost: 0원(외부 AI 호출 없음, Node 표준 `crypto`만 사용)
- Existing fortune_results Reused: 예 — 신규 컬럼은 `result_date` 1개뿐, 신규 테이블 없음
- Migration: `0016_fortune_results_daily.sql`(local/remote 적용 및 동기화 확인)
- New Table: 없음
- Personalization Inputs: `user_id`(세션) + `profiles.birth_date`(기존 컬럼) + 서버 계산 오늘 날짜(KST) — 이 세 개뿐
- Birth Time: 미수집(기존과 동일, 추가 없음)
- Gender: 미수집(기존과 동일, 추가 없음)
- Daily Rule: `UNIQUE(user_id, result_date)` DB 제약 + generate-or-get 서비스 로직으로 보장
- Timezone: Asia/Seoul(KST), `Intl.DateTimeFormat` 기반, 자정 경계 단위 테스트로 검증
- Deterministic: 예 — `crypto.createHash("sha256")` 기반 시드 + mulberry32 PRNG, AI/외부 API 없음
- Same-Day Reuse: 예 — 실제 DB로 재확인(같은 날 재호출 시 동일 id/내용, `isNew:false`)
- Money Fortune: 기존 `money_luck` 컬럼 재사용, 정적 콘텐츠 뱅크 38개(3단계)
- Recommended Action: 기존 `action_guide` 컬럼 재사용, 정적 콘텐츠 뱅크 38개(3단계)
- Avoid Action: 기존 `things_to_avoid` 컬럼 재사용, 정적 콘텐츠 뱅크 36개(3단계)
- Lucky Color: 기존 `lucky_color` 컬럼 재사용, 정적 풀 18개(varchar(20) 제약 내)
- Lucky Time: 기존 `lucky_time` 컬럼 재사용, 정적 풀 15개(varchar(20) 제약 내)
- Lucky Numbers: 1~3개, 1~45 범위, 저장하지 않고 조회 시 파생 계산
- Lotto Numbers: 기존 `recommended_numbers` 컬럼 재사용, `generateNumbers()`와 완전히 분리된 `generateSeededNumbers()` 사용
- Re-roll: 없음(다시 뽑기/다른 운세 보기/번호 다시 생성 버튼 전수 확인 결과 없음)
- Share: Web Share API + clipboard 폴백, 개인정보 미포함, 새 public 상세 라우트/API 없음
- Fortune History: 기존 `/my/journal/fortune-history` 무수정 재사용(자동으로 신규 결과 노출 확인), 안내 문구/CTA만 최소 수정
- Privacy Updated: `/privacy` 최소 반영(수집 항목/이용 목적 각 1줄), `/about` 기능 목록 1건 추가, `/terms`는 기존 문구로 충분해 미수정
- Security: client INSERT RLS 정책이 기존에 아예 없어(0008 Decision 1) service_role INSERT 사용(신규 보안 완화 아님), SELECT는 세션 클라이언트 + `.eq(user_id)` 명시. **fortune_results SELECT RLS가 공개(`using(true)`)라 anon key로 `input_birth_date`를 포함한 전체 행을 조회할 수 있음을 실측으로 확인·보고**(§16) — 이번 Task 범위에서 RLS 자체는 변경하지 않음(공유 링크 설계 보존)
- Tests: 317/317 통과(신규 35개: kstDate 6, dailyFortune 18, fortune service 8, share logic 3) + 실제 Supabase 통합 테스트 Test A~E 전부 통과(동시성 포함)
- Build: 통과, 45 routes(`/fortune`, `/api/fortune/today` 신규)
- Migration Sync: local/remote 0001~0016 전부 일치
- Cleanup: 테스트 계정 3명(auth.users/profiles/fortune_results) 정확한 id로 전부 삭제 후 0건 재확인, ephemeral `app/api/jtest/route.ts` 삭제 완료
- Daily Fortune MVP verdict: **PASS**
- Remaining Launch Blockers: `fortune_results` SELECT RLS 공개 정책과 실제 개인정보(`input_birth_date`) 저장 시작이 맞물리는 지점에 대한 launch 전 정책 결정(§16/§27) — 기능 자체의 결함은 아니나 공개 launch 전 검토 권장
- 다음 작업: `fortune_results` SELECT RLS를 공개 유지할지, `share_id` 기반 공유 전용 뷰로 분리하고 기본 SELECT를 `auth.uid() = user_id`로 좁힐지 결정한다
