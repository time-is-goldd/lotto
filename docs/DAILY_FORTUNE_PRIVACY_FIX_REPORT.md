# Phase10-4B — Daily Fortune 발견성 확인 + 개인정보 노출 제거 보고서

> Phase10-4A가 완료된 상태에서, (1) `/fortune`이 실제 UI에서 어디에 노출되는지 검증하고
> (2) `fortune_results`의 public SELECT 정책으로 인한 개인정보(특히 `input_birth_date`) 노출
> Launch Blocker를 해결하는 것이 이번 Task의 목적이다. 최우선 순위는 개인정보 노출 제거다.

## 1. `/fortune` 실제 노출 위치

코드 수정 전, dev server에서 직접 확인했다.

- `GET /fortune`(비로그인) → HTTP 200, "로그인하면 생년월일을 바탕으로 오늘의 행운을 확인할 수
  있어요." 문구 + "로그인하고 확인하기" CTA 정상 렌더.
- `GET /fortune`(로그인 + profile ready, 세션 쿠키) → HTTP 200, `getOrCreateTodayFortune()`이
  자동으로 오늘의 결과를 생성/조회해 총평·행운지수·추천번호·공유하기 버튼까지 정상 렌더,
  "다시 뽑기" 류 버튼 없음(확인).
- `POST /api/fortune/today` → 로그인 사용자 201/200, 비로그인 401 — 실제 HTTP로 재확인.

profile-pending(로그인했지만 profile 없음) 분기는 `app/fortune/page.tsx`의
`if (!profile) return <SignedOutOrPendingView authState="profile-pending" />` 코드 자체가
이번 Task로 변경되지 않았고 Phase10-4A에서 이미 실측 확인된 로직이라 별도 재확인은 생략했다.

## 2. Navigation 상태

```
components/navigation/GlobalNav.tsx:19:   { label: "운세", href: "/fortune" },
components/navigation/BottomNavigation.tsx:22: { label: "운세", href: "/fortune", icon: <FortuneIcon /> },
```

**GlobalNav/BottomNav 둘 다 이미 `/fortune`을 정확히 가리키고 있었다.** 홈 페이지 렌더 결과에도
두 nav 모두에서 `href="/fortune"`가 실제로 출력됨을 확인했다(placeholder나 잘못된 경로가 아님).
→ PART M 판단: **옵션 1(기존 운세 nav가 충분하다) — nav 자체는 추가 수정 없음.**

## 3. Home에서 변화가 안 보였던 이유

`app/page.tsx`의 "주요 기능" 섹션(`FEATURES` 배열)을 확인한 결과, **이 목록에 "운세"/오늘의
행운 항목이 애초에 존재하지 않았다.** 더 나아가 이 배열의 나머지 4개 항목(번호 생성/꿈해몽/
행운일기/당첨확인)은 전부 이미 실제로 구현되어 동작하는 기능인데도, Phase1 placeholder 시절의
"준비 중" Badge가 그대로 남아 있는 기존 오류도 함께 발견했다(이번 Task 범위 밖이라 그 4개는
고치지 않았다 — 아래 참조).

`docs/EXECUTION_PLAN.md`/`docs/SITEMAP.md`/`docs/MASTER_PRD.md`를 확인했으나 홈에 Daily
Fortune 카드를 추가하기로 한 문서상 계획은 없었다 — 즉 "계획돼 있었는데 안 붙인 것"이 아니라
"애초에 계획된 적이 없는 것"이다. → PART A-1 판단: 대규모 Hero/홈 재설계는 하지 않되, 사용자가
Nav 외에 "홈에서 무엇을 할 수 있는지" 훑어보는 기존 "주요 기능" 카드 영역이 자연스러운 진입점이라
판단해, **그 배열에 "오늘의 행운" 카드 1개만 최소 추가**했다(§19 참조).

`nav`는 이미 정확했으므로(§2) PART M의 "잘못된 href 수정"은 필요 없었다 — 대신 §19에서 다루는
Home 카드 추가만 수행했다. 이는 PART M의 3개 선택지 중 어느 하나에 정확히 들어맞지 않는
케이스였다(nav는 옵션1 상태, Home 카드 부재는 옵션3과 유사하지만 "연결 안 된 기존 카드"가 아니라
"카드 자체가 없던" 경우) — 지시문 취지("사용자가 기능을 발견하기 어려운 구조라면... 검토")를
따라 최소한의 카드 1개 추가로 판단했다.

## 4. 기존 `fortune_results` RLS(수정 전)

`supabase/migrations/0008_rls_policies.sql`(147~165행) 원문:

```sql
create policy fortune_results_select_own_or_shared
  on public.fortune_results
  for select
  to anon, authenticated
  using (true);
```

INSERT/UPDATE/DELETE에는 client 정책이 전혀 없음(service_role 전용, "Decision 1" — Phase10-4A
때 이미 확인, 이번 Task로 바뀌지 않음).

## 5. 실제 anon 노출 재현

수정 전, 실제 원격 Supabase에 테스트 사용자를 만들고 anon key만으로 직접 REST 조회했다.

```
curl "$SUPABASE_URL/rest/v1/fortune_results?select=id,user_id,input_birth_date,overall_fortune,money_luck,luck_score,recommended_numbers" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"

→ [{"id":9,"user_id":"0e6d3790-...","input_birth_date":"1992-07-20",
    "overall_fortune":"...","money_luck":"...","luck_score":81,
    "recommended_numbers":[2,8,9,23,30,40]}]
```

**노출이 확인된 컬럼**: `id`, `user_id`, `input_birth_date`(실제 생년월일), `overall_fortune`,
`money_luck`, `luck_score`, `recommended_numbers` — 로그인 없이, 전체 행 목록 조회로.
(`action_guide`/`things_to_avoid`/`lucky_color`/`lucky_time`/`zodiac_sign`도 같은 정책 아래
있어 동일하게 노출 가능했다.)

## 6. public SELECT가 존재했던 원래 이유

`0008_rls_policies.sql` 151~155행 주석: "'본인 또는 share_id 익명 조회'는 공유 링크
패턴(share_cards §3.18과 동일 성격)이라, RLS는 행 내용이 아니라 '그 share_id를 아는지'로
접근을 제한할 수 없다... 따라서 SELECT는 사실상 전체 공개이며, 실제 프라이버시 보호는
share_id가 추측 불가능한 토큰이라는 점과 애플리케이션이 '전체 목록 조회' UI를 제공하지 않는다는
점에서 나온다."

**이것은 Phase1 시점의 설계 의도였을 뿐, 실제로 구현된 적이 없다.** 아래 §7에서 실제 코드
현황을 확인한다.

## 7. 현재 share 구현 — 실제 코드 확인

```
grep -rln "share_cards|shareCards" app lib components  → lib/types/database.ts 뿐(생성된 타입 정의)
grep -rln "shareId|share_id"        app lib components  → lib/api/fortune.ts(무작위 값 생성만),
                                                            lib/api/journal.ts(주석), lib/types/database.ts(타입)
find app/fortune -type d                                → app/fortune 자신만, [shareId] 서브라우트 없음
find app/api -iname "*share*"                            → 없음
```

- **`share_cards` 테이블은 애플리케이션 코드 어디에서도 쓰이지 않는다**(SELECT/INSERT 전혀
  없음, 생성된 TS 타입 정의 외 참조 0건).
- **`fortune_results.share_id`를 조회하는 라우트/API가 없다.** `/fortune/[shareId]` 같은
  서브라우트도 존재하지 않는다.
- 실제 "공유하기" 기능(`components/fortune/dailyFortuneShareLogic.ts`의 `buildShareText()`)은
  총평/색/시간/행운숫자/추천번호 + 사이트 루트 URL만 담은 **순수 텍스트**를 만들 뿐, DB에서
  공개 조회 가능한 URL을 전혀 쓰지 않는다(Web Share API 또는 클립보드 복사로 끝).

**결론**: "예전에 공유 링크 때문에 필요했다"는 문서상의 이유는 실제로 구현된 적이 없는
가정이었다. 현재 이 공개 SELECT 정책이 지탱하는 실제 기능은 0개다 — PART D-1(가장 단순한
경우)이 그대로 적용된다.

## 8. 선택한 보안 수정

**D-1: public SELECT 제거 + `auth.uid() = user_id` 기반 own-select로 교체, anon SELECT는
완전 DENY.** 별도의 public share 엔드포인트/뷰(D-2)는 만들지 않았다 — 실제로 쓰이는 공유
기능이 없으므로 만들 이유가 없다(불필요한 신규 구조 방지).

```sql
drop policy fortune_results_select_own_or_shared on public.fortune_results;

create policy fortune_results_select_own
  on public.fortune_results
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
```

anon 역할에는 정책을 아예 주지 않는다(정책 없음 = 기본 거부, 다른 "본인 소유" 테이블과 동일한
패턴). INSERT/UPDATE/DELETE 정책은 손대지 않았다(기존 service_role 전용 그대로).

## 9. 신규 migration

`supabase/migrations/0017_fortune_results_privacy.sql` — 0001~0016 무수정, 위 정책 교체만
수행. `npx supabase db push`로 실제 원격 DB에 적용, `npx supabase migration list`로
local/remote 0001~0017 전부 일치 확인. 다른 테이블의 RLS는 건드리지 않았다(`share_cards`도
실사용이 없다는 것과 별개로 이번 Task 범위 밖 — fortune_results 하나만 수정).

## 10. 최종 RLS

`fortune_results`:
- SELECT: `to authenticated using (auth.uid() = user_id)` — 본인 행만. anon 정책 없음(DENY).
- INSERT/UPDATE/DELETE: client 정책 없음(service_role 전용, 0008부터 무변경).

## 11. `input_birth_date` 저장 필요성 검토

코드 전체에서 `input_birth_date`를 실제로 **읽는** 지점은 단 하나,
`lib/api/fortune.ts`의 `getLuckyNumbersForEntry()`가 저장된 행에서 다시 읽어 행운 숫자를
파생 계산하는 부분이었다. 이 호출부(`app/fortune/page.tsx`, `app/api/fortune/today/route.ts`)
양쪽 모두 이미 `getProfile(user.id)`로 조회한 `profile.birth_date`를 스코프에 갖고 있어,
DB에서 다시 읽을 필요가 실제로는 없었다.

**조치**: `getLuckyNumbersForEntry(entry, userId)` → `getLuckyNumbersForEntry(entry, userId,
birthDate)`로 시그니처를 바꿔, 호출부가 이미 갖고 있는 `profile.birth_date`를 직접 전달하도록
했다. 이로써 **애플리케이션 코드에서 `input_birth_date` 컬럼을 읽는 지점이 0개**가 됐다(단위
테스트로 "entry.input_birth_date 값이 잘못돼 있어도 결과에 영향 없음"을 검증).

**컬럼 자체는 이번 Task에서 삭제/nullable 전환하지 않았다** — 지시문이 명시적으로 "바로 컬럼
삭제하지 않는다"고 요구했고, 이번 Task의 최우선 목표(RLS 접근 통제)는 컬럼 존재 여부와
무관하게 이미 달성됐기 때문이다(own-select 정책이 이미 걸려 있어 컬럼이 남아있어도 본인 외에는
조회 불가). NOT NULL 제약을 nullable로 바꾸려면 별도 migration이 필요해 이번 Task 범위를
벗어난다고 판단, **Case A 방향의 코드 의존성 제거까지만 수행하고 스키마 변경은 다음 작업으로
남겼다**(§24 참조).

## 12. User A/B 격리(실제 Supabase)

RLS 수정 후, 테스트 사용자 A/B에 각각 profile + 오늘의 행운 row를 만들고 각자의 실제 JWT로
PostgREST에 직접 질의했다(앱 코드를 거치지 않음).

| 질의 주체 | 질의 내용 | 결과 |
|---|---|---|
| User A JWT | `select id,user_id,input_birth_date from fortune_results`(필터 없음) | **A 자신의 행 1개만**(`id:9`) — B의 행(`id:10`)은 보이지 않음 |
| User A JWT | `...&user_id=eq.<B의 id>`(B를 명시적으로 필터링 시도) | `[]` — RLS가 행 자체를 숨겨 필터 조건과 무관하게 결과 없음 |
| User B JWT | `select id,user_id,input_birth_date from fortune_results`(필터 없음) | **B 자신의 행 1개만**(`id:10`) — A의 행은 보이지 않음 |

## 13. anon 차단

수정 후, plain anon key(로그인 없음)로 모든 민감 컬럼을 명시 조회:

```
curl "$SUPABASE_URL/rest/v1/fortune_results?select=input_birth_date,user_id,overall_fortune,money_luck,action_guide,things_to_avoid,luck_score,recommended_numbers,zodiac_sign,lucky_color,lucky_time" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
→ [] (HTTP 200)

Content-Range: */0 (Prefer: count=exact 기준 전체 0건)
```

"UI에 안 보임"이 아니라 **DB RLS 기준으로 0건**임을 확인했다 — 두 테스트 사용자의 행이
실제로 존재하는 상태(service_role로 별도 확인)에서 anon에게는 정확히 0건이 반환된다.

## 14. Daily Fortune API 회귀

| 시나리오 | 결과 |
|---|---|
| `POST /api/fortune/today`(User A, 세션 쿠키) | `200`, RLS 수정 전과 **동일한 id(9)/내용** — 같은 날 재조회 정상 |
| `POST /api/fortune/today`(User B, 세션 쿠키) | `200`, 본인 행(id:10) 정상 반환 |
| `POST /api/fortune/today`(비로그인) | `401 UNAUTHORIZED` |

RLS를 own-select로 좁혀도 `getOrCreateTodayFortune()`의 SELECT(세션 클라이언트 +
`.eq("user_id", userId)`)가 정확히 `auth.uid() = user_id` 조건과 일치해 정상 동작한다 —
service_role INSERT 경로는 애초에 RLS를 우회하므로 이번 변경과 무관하다.

## 15. Fortune History 회귀

`/my/journal/fortune-history`를 User A 세션으로 요청한 결과, A의 항목(`id:9`, 행운지수 81)
하나만 정상 표시되고 B의 데이터는 전혀 섞이지 않았다(RSC payload의 `li` 항목이 정확히 1개,
key가 A의 row id와 일치).

## 16. Share 회귀

`components/fortune/dailyFortuneShareLogic.ts`의 `buildShareText()`는 DB를 전혀 조회하지
않는 순수 함수라(§7에서 이미 확인) RLS 변경의 영향을 전혀 받지 않는다. 기존 단위 테스트
3건(`dailyFortuneShareLogic.test.ts`) 그대로 통과.

## 17. client bundle 검증

프로덕션 빌드(`.next/static`) 전체를 아래 값으로 grep했다 — 전부 **0건**.

- `SUPABASE_SERVICE_ROLE_KEY` 실제 값
- `KAKAO_CLIENT_SECRET` 실제 값
- `SUPABASE_SERVICE_ROLE_KEY`/`KAKAO_CLIENT_SECRET`/`KAKAO_REST_API_KEY` 환경변수 이름 자체
- 테스트 사용자의 실제 `birth_date`(`1992-07-20`, `1988-02-14`)
- 테스트 사용자의 `user_id`(UUID)

`DailyFortuneCardProps`(Client Component)는 애초에 `birthDate`/`userId`/`input_birth_date`
필드를 받지 않도록 설계되어 있어(Phase10-4A) 구조적으로도 유출 경로가 없다.

## 18. Privacy 재검증

`/privacy` 전체를 "공개"/"공유"/"share" 키워드로 재검색한 결과, fortune 관련해서는 공개
공유를 암시하는 문구가 없었다(유일한 "공개" 언급은 무관한 기존 기능인 "다이어리 공개 기본값
설정"). RLS를 own-select로 좁힌 것이 오히려 Phase10-4A가 이미 써둔 "계정 연결 저장" 문구와
더 정확히 일치하게 됐다 — **수정 불필요**로 판단, 손대지 않았다.

## 19. UI 발견성 개선 여부

`app/page.tsx`의 "주요 기능" 카드 목록에 "오늘의 행운" 카드 1개를 추가했다(`href: "/fortune"`).
기존 4개 카드는 완전히 무수정(제목/설명/href/Badge 렌더링 결과 100% 동일) — `ready` 필드를
추가해 새 카드에만 "준비 중" Badge를 숨겼다. 대규모 Hero/섹션 추가 없음, 그리드 레이아웃은
기존 `sm:grid-cols-2 lg:grid-cols-4`를 그대로 사용(5번째 카드는 다음 행으로 자연스럽게
줄바꿈).

## 20. 기존 기능 회귀

| 경로 | 결과 |
|---|---|
| `/` | 200 |
| `/fortune` | 200 |
| `/generate` | 200 |
| `/dream`, `/dream/[keyword]` | 200 |
| `/my/journal` | 200 |
| `/my/journal/fortune-history` | 307(미로그인 리다이렉트, 정상) |
| `/faq` | 200 |
| `/about` | 200 |
| `/privacy` | 200 |
| `/terms` | 200 |
| `/admin`, `/admin/draws`, `/admin/dreams`, `/admin/faq`, `/admin/guides` | 307(미로그인 리다이렉트, 정상) |
| `/robots.txt`, `/sitemap.xml` | 200 |

`/generate`의 번호 생성 셔플/공개 애니메이션 로직(`generatorSaveLogic.ts`)은 이번 Task에서
전혀 건드리지 않았고 관련 단위 테스트도 그대로 통과했다.

## 21. lint / type-check / test / build

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과(0 error) |
| `npx tsc --noEmit` | 통과(0 error) |
| `npx vitest run` | **318/318 통과**(Phase10-4A 317 + `getLuckyNumbersForEntry`의 `input_birth_date` 비의존성 테스트 1건 추가) |
| `npm run build` | 통과, 45 routes(Phase10-4A와 동일 — 이번 Task는 신규 라우트 없음) |

## 22. migration sync

`npx supabase migration list` — local/remote **0001~0017 전부 일치**.

## 23. cleanup

테스트 사용자 A/B(`auth.users`/`profiles`/`fortune_results`)를 정확한 id로 전부 삭제,
service_role 재조회로 0건 재확인. 운영 데이터는 조회·수정하지 않았다. 임시
`app/api/jtest/route.ts`도 삭제 완료(재조회 시 404 확인).

## 24. 남은 Launch Blocker

- `fortune_results.input_birth_date` 컬럼 자체는 여전히 NOT NULL로 존재하고 INSERT 시 계속
  채워진다. 애플리케이션 코드가 더 이상 이 값을 읽지 않고(§11) RLS가 본인만 조회 가능하도록
  막고 있어(§10) **더 이상 Launch Blocker는 아니지만**, 데이터 최소 수집 원칙을 완전히
  만족시키려면 컬럼을 nullable로 바꾸고 신규 행에는 저장하지 않는 후속 migration을 검토할
  여지가 있다(선택 사항, 급하지 않음).
- `app/page.tsx`의 "번호 생성"/"꿈해몽"/"행운일기"/"당첨확인" 4개 카드가 여전히 "준비 중"
  Badge를 달고 있다(실제로는 전부 구현되어 있음) — 이번 Task 범위 밖이라 고치지 않았다.
- "당첨확인" 카드의 href가 `/my/journal/results`인데, 실제 구현된 경로는
  `/my/journal/history`로 보인다(전수 확인 결과 `/my/journal/results` 라우트 없음) — 이번
  Task와 무관한 기존 버그로 보이며, 수정하지 않고 발견 사실만 기록한다.

## 25. 다음 작업 추천

`app/page.tsx`의 기존 4개 기능 카드("준비 중" Badge)와 "당첨확인" 카드의 잘못된 href를
실제 구현 상태에 맞게 정리한다.

---

## TASK REPORT — Daily Fortune Privacy Fix

- `/fortune` Reachable: 예 — 비로그인/로그인 상태 모두 실제 HTTP 200으로 확인
- GlobalNav: 이미 `/fortune`로 정확히 연결되어 있었음(수정 없음)
- BottomNav: 이미 `/fortune`로 정확히 연결되어 있었음(수정 없음)
- Home Change Expected: 예 — 기존 "주요 기능" 카드 목록에 "오늘의 행운" 카드 1개만 추가(대규모 재설계 없음)
- Previous Public Exposure: `fortune_results` SELECT가 `to anon, authenticated using(true)` — anon key만으로 전체 행의 `id`/`user_id`/`input_birth_date`/`overall_fortune`/`money_luck`/`luck_score`/`recommended_numbers` 등 조회 가능함을 실측 확인
- Anonymous Fortune SELECT After Fix: 모든 컬럼 명시 조회 시 `[]`(0건), `Content-Range: */0` — 실측 확인
- User Own SELECT: 본인 JWT로 조회 시 본인 행만 반환(실측)
- Cross-user SELECT: 상대방 JWT/필터로도 조회 불가 — RLS가 행 자체를 숨김(실측)
- Birth Date Exposure: 제거됨 — anon 조회 0건, 애플리케이션 코드도 더 이상 `input_birth_date`를 읽지 않도록 리팩터링
- Share Feature: 영향 없음 — 순수 텍스트 공유(Web Share API/클립보드)로 DB 공개 조회에 의존하지 않음, 기존 단위 테스트 그대로 통과
- Migration: `0017_fortune_results_privacy.sql`(local/remote 적용 및 동기화 확인)
- RLS: `fortune_results_select_own` — `to authenticated using (auth.uid() = user_id)`, anon 정책 없음(DENY)
- Daily Fortune Regression: 없음 — 같은 날 재조회 동일 결과, User A/B 각자 정상 생성/조회
- Fortune History: 본인 항목만 정상 표시(실측)
- Tests: 318/318 통과(신규 1건: `input_birth_date` 비의존성 검증)
- Build: 통과, 45 routes(신규 라우트 없음, Phase10-4A와 동일)
- Cleanup: 테스트 계정 2명(auth.users/profiles/fortune_results) 전부 삭제 후 0건 재확인, `app/api/jtest/route.ts` 삭제 완료
- Security Fix: **PASS**
- Remaining Launch Blockers: 없음(치명적 항목 기준) — `input_birth_date` 컬럼의 nullable 전환은 선택적 후속 개선으로 분류
- 다음 작업: `app/page.tsx`의 기존 4개 기능 카드("준비 중" Badge)와 "당첨확인" 카드의 잘못된 href(`/my/journal/results`)를 실제 구현 상태에 맞게 정리한다
