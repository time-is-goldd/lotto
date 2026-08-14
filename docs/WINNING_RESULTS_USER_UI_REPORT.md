# 당첨확인 사용자 기능 완성 보고서

> 목표: 이미 저장된 사용자의 로또 번호가 실제 추첨 후 몇 개 맞았는지, 당첨 여부와 등수를
> 사용자가 직접 확인할 수 있는 완성된 기능. 새 당첨 판정 엔진을 만들지 않고 기존 Phase6
> `matchNumbers.ts`/`registerDrawAndMatchUserNumbers()`를 그대로 재사용했다.

## 1. 기존 당첨확인 상태(구현 전 실측)

- Home "당첨확인" 카드가 가리키던 `/my/journal/results`는 실제로 존재하지 않는 route(404).
- `/my/journal/history`("번호 기록")는 존재하지만 날짜·생성 방식 배지·번호만 보여줄 뿐
  `target_round`/`match_count`/`win_rank`/`checked_at`을 어디에도 렌더링하지 않았다(코드
  전수 확인).
- `lib/api/journal.ts`의 `getRecentUserNumbers()`가 "당첨확인 화면"을 위한
  `onlyChecked` 옵션을 이미 갖고 있었지만, 이 옵션으로 호출하는 페이지가 `app/` 전체에
  0건이었다(전수 grep 확인) — 서비스 레이어에 능력만 있고 화면이 없는 상태.

## 2. 기존 Phase6 matching 구조(실측)

- `lib/logic/matchNumbers.ts`: 순수 함수, 등수 판정의 유일한 source of truth.
  `{matchCount, bonusMatched, winRank}`를 반환한다. `winRank`는 `1|2|3|4|5|null`(6등은
  공식 등수 체계에 없음 — 0~2개 일치는 전부 낙첨).
- `lib/api/admin/draws.ts`의 `registerDrawAndMatchUserNumbers()`: 관리자가 새 회차를
  등록하면, 그 시점까지 `target_round IS NULL AND checked_at IS NULL AND user_id IS NOT
  NULL`인 모든 `user_numbers` 행을 그 회차와 일괄 대조해 `target_round`/`match_count`/
  `win_rank`/`checked_at`을 함께 채운다. 당첨(`win_rank !== null`)이면
  `lib/api/notifications.ts`의 `createWinNotification()`으로 알림도 만든다.
- 즉 `target_round`는 사용자가 고르는 값이 아니라, "다음에 등록되는 회차가 자동으로
  떠안는" 구조다 — 특정 회차를 미리 예측해 보여줄 수 없다(§11 근거).

## 3. 선택한 canonical Route

**`/my/journal/results`를 새로 만들었다**(Option B). 근거:

- `docs/SITEMAP.md`(§1, §4)와 `docs/USER_FLOW.md`("당첨 알림 수신 → /my/journal/results
  직행")가 이미 이 경로를 전용 당첨확인 화면으로 명시적으로 계획해뒀다 — `/my/journal/
  history`("번호 생성/저장 히스토리")와는 서로 다른 목적으로 문서화되어 있었다.
- `lib/api/notifications.ts`의 기존 주석이 이 정확한 상황을 이미 예고해뒀다: "EXECUTION_
  PLAN.md가 계획한 전용 결과 화면은 아직 없으므로 `/my/journal/history`로 임시 연결한다.
  그 화면이 생기면 이 상수만 바꾸면 된다." — 이번 Task가 바로 그 "그 화면"을 만드는
  Task였다.
- 두 페이지는 실제로 다른 정보를 보여준다: `history`는 생성 시점의 번호 로그,
  `results`는 회차별 당첨번호/보너스/일치 볼 강조/등수까지 포함한 판정 결과 — 이미 이
  코드베이스에 있는 "history vs 목적 페이지" 분리 관례(`/fortune` vs
  `/my/journal/fortune-history`)와 일치해, 중복 페이지가 아니라 보완 관계로 판단했다.
- `/my/journal/history`는 이번 Task에서 전혀 수정하지 않았다(라벨 맵 공용화 리팩터 1건
  제외, §12 참조) — 여전히 "번호 기록"이라는 원래 목적 그대로 존재한다.

## 4. 사용자 데이터 flow

`app/my/journal/results/page.tsx` → `getRecentUserNumbers()`(기존 함수, 무수정 재사용,
`created_at DESC`) → 각 행의 `target_round` 목록 수집 → `getDrawsByRounds()`(신규,
`lib/api/journal.ts`)로 해당 회차들의 실제 당첨번호 조회 → `WinningResultCard`(신규,
`components/journal/`)로 렌더링. UI에서 직접 Supabase 쿼리를 작성하지 않았다(§23).

## 5. draw 데이터 flow

`getDrawsByRounds(rounds)`는 `draws` 테이블(SELECT RLS가 이미 `anon, authenticated`
모두에게 공개, `0008_rls_policies.sql`)을 세션 클라이언트로 직접 조회한다 —
`user_id` 필터가 필요 없다(공개 데이터). 새로 인터넷에서 fetch하지 않았고, 검증된
production `draws` 테이블만 source of truth로 썼다(§7).

## 6. pending 상태

`target_round IS NULL`(=`checked_at IS NULL`, 둘은 항상 함께 채워짐)이면
`getResultDisplayStatus()`가 `"pending"`을 반환한다. 특정 회차 번호를 예측 표시하지
않고 "추첨 결과 확인 대기 중 / 다음 회차가 등록되면 자동으로 결과를 확인해드려요."로
표시한다(§11 "임의 회차 배정/자동 추정 금지" 준수).

## 7. losing 상태

`checked_at`은 있지만 `win_rank`가 `null`이면 `"lost"`. "N개 일치 / 아쉽게도 이번 회차는
당첨되지 않았어요."를 표시하고, 0~2개 일치한 볼도 동일하게 하이라이트한다(당첨 여부와
무관하게 "일치한 번호 강조"는 모든 행에 적용, §3).

## 8. winner 상태

`win_rank`가 1~5면 `"won"`. "N개 일치 / 🎉 N등 당첨"을 표시하고, 1~2등은 `text-h2`로
더 크게 강조한다(§14 "높은 등수는 좀 더 강한 강조 가능"). Confetti/배경 애니메이션은
넣지 않았다(§14 "MVP에서 필요 없음").

## 9. matching number 표시

`lib/logic/winningDisplay.ts`의 `getMatchedNumbers(userNumbers, winningNumbers)`(순수
집합 교집합 — `matchNumbers()`의 등수 판정 로직을 재구현하지 않음)로 일치 번호를 구해
`NumberBall`에 `matched` 플래그로 전달한다. 매칭된 볼은 (1) 초록 테두리+배경,
(2) 우측 상단 작은 체크 배지(✓), (3) `aria-label="N번, 일치"`까지 **색상 외 2가지
경로**를 함께 쓴다(§6 "색상만으로 정보를 전달하지 않는다").

## 10. bonus number

당첨번호 줄의 보너스 공은 금색 테두리 + "보너스" 텍스트 캡션으로 별도 표시한다. 내
번호 중 보너스 번호와 같은 값이 있으면(`isBonusMatch()`) 카드 하단에 "보너스 번호와도
일치했어요."를 추가로 보여준다(5개 일치 시 2등/3등을 가르는 이유를 사용자가 이해할 수
있도록).

## 11. rank 표시

`matchNumbers.ts`가 저장한 `win_rank`를 그대로 표시할 뿐, UI에서 등수를 재계산하지
않는다(§5). "6등" 같은 존재하지 않는 등수를 만들지 않았다.

## 12. generation source

`user_numbers.generation_method`(enum: `auto`/`custom`/`dream`/`fortune`, 실제 지원
값만) → `getGenerationMethodLabel()`로 "자동 생성"/"직접 지정"/"꿈 연동"/"운세 연동"
배지를 표시한다. 이 라벨 맵은 원래 `app/my/journal/history/page.tsx`에만 있던 지역
상수였는데, 이번 Task가 같은 라벨을 다시 필요로 해 `lib/logic/generationMethodLabel.ts`
로 공용화하고 `history` 페이지도 그 함수를 쓰도록 바꿨다(두 화면이 같은 값을 다른
문구로 보여주는 것을 막기 위한 최소 리팩터, 동작 변화 없음).

## 13. EmptyState

저장된 번호가 0건이면 "아직 확인할 번호가 없어요" + "번호 생성하기"(`/generate`) CTA를
보여준다 — 실제 신규 테스트 계정으로 HTTP 확인했다(§18).

## 14. Home card 연결

`app/page.tsx`의 "당첨확인" 카드 `href`를 `/my/journal/history` → `/my/journal/results`로
수정했다. 실제 프로덕션 HTML로 링크가 정확히 반영됨을 확인했다.

## 15. `준비 중` badge 상태

`ready: true`로 변경 — 5개 카드 전부 `ready: true`가 되어 "준비 중" 배지가 완전히
사라졌다(실제 HTML에서 0건 확인). `lib/api/notifications.ts`의 `RESULT_LINK_URL`도
`/my/journal/results`로 갱신해, 실제 당첨 알림이 만들어지면 이 새 화면으로 연결되도록
했다(실측: 아래 §17).

## 16. User A/B isolation

`user_numbers` RLS(`0008_rls_policies.sql`, `auth.uid() = user_id`, INSERT/SELECT/UPDATE/
DELETE 전부)가 이미 본인 소유만 허용하도록 구성돼 있었다(무수정) —
`getRecentUserNumbers()`도 `.eq("user_id", userId)`를 이중으로 명시한다. 실제 두 테스트
계정으로 확인:

- User B의 실제 JWT로 무필터 조회 → B 자신의 3행만 반환(A의 행 없음).
- User B의 JWT로 A의 `user_id`를 명시적으로 필터링 → 빈 배열(RLS가 행 자체를 숨김).
- anon key(로그인 없음) → 빈 배열.
- 실제 `/my/journal/results` HTTP 응답에서도 B의 페이지에 A의 고유 번호(`[5,10,15,20,
  25,40]`)가 전혀 나타나지 않음을 grep으로 확인.

새 RLS/마이그레이션 없이 기존 정책 그대로 이 요구사항을 충족한다.

## 17. 실제 draw integration test(end-to-end)

실제 원격 Supabase에서 진행했다(운영 draw 1227~1236은 전혀 건드리지 않음, 테스트 전
`user_numbers` 0건임을 먼저 확인해 다른 사용자 데이터에 영향이 없음을 보장).

1. 테스트 계정 A(3세트+1 pending)/B(3세트) 생성, `target_round: null`로 저장.
2. 테스트 전용 회차 **90001**(운영 회차와 겹치지 않는 값)을 실제 winningNumbers
   `[2,9,16,23,30,37]`, bonus `44`로 실제 `registerDrawAndMatchUserNumbers()` 호출.
3. 결과(서비스 로직이 실제로 계산): `matchedCount: 6, winnersCount: 5, failedUpdateIds: []`.
4. DB에 저장된 실제 값 확인:

   | id | numbers | match_count | win_rank |
   |---|---|---|---|
   | A-1 | 2,9,16,23,30,37 | 6 | **1등** |
   | A-2 | 2,9,16,23,30,1 | 5 | **3등**(보너스 불일치) |
   | A-3 | 2,9,1,3,5,6 | 2 | 낙첨 |
   | B-1 | 2,9,16,23,30,44 | 5 | **2등**(보너스 일치) |
   | B-2 | 2,9,16,23,1,3 | 4 | **4등** |
   | B-3 | 2,9,16,1,3,5 | 3 | **5등** |

   6개 전부 기대값과 정확히 일치.
5. 당첨 알림 5건 생성 확인, `link_url`이 전부 `/my/journal/results`인 것도 실측 확인.
6. `/my/journal/results`를 A/B 각자의 실제 세션 쿠키로 HTTP 요청해 화면 렌더링 확인
   (등수 문구, 회차 표시, generation_method 배지, pending 문구 전부 응답에 존재).
7. `/generate`·`POST /api/numbers`가 이번 Task와 무관하게 여전히 정상 동작함을 재확인
   (201 저장 성공).
8. cleanup: notifications 5건, user_numbers 8건(pending 1건 + 새로 `/api/numbers`로
   저장된 1건 포함), 테스트 draw(round 90001) 1건, profiles 2건, auth.users 2건 삭제.
   재조회로 `user_numbers`/`notifications` 0건, 운영 draws는 여전히 정확히 10건
   (1227~1236)임을 재확인.

## 18. mobile / 19. desktop

브라우저 자동화 도구가 이 환경에 없다(이전 Task들에서 이미 확인된 제약, 재확인
불필요). 대신 실제 HTTP 응답과 코드 검토로 확인했다:

- 번호 ball wrap: `NumberBall`을 감싸는 컨테이너가 `flex flex-wrap gap-2`라 좁은 화면에서
  자동으로 줄바꿈된다(다른 기존 번호 표시 UI와 동일한 패턴 재사용, 새 반응형 로직 없음).
- winning highlight: 색상(테두리/배경) + 체크 배지 + aria-label 3중 신호(§6/§9 실측 —
  실제 렌더된 HTML에서 `border-success`/체크 배지 마크업 확인).
- long history: 페이지네이션 없이 `DEFAULT_LIST_LIMIT`(20건, 기존 값 무수정)까지 표시 —
  기존 `history` 페이지와 동일한 한계를 그대로 공유한다(새 문제 아님).
- empty/pending/winner: 전부 실제 계정으로 HTTP 렌더링 확인(§13, §17).
- 픽셀 단위 375px/1024px 등 뷰포트별 실측은 도구 부재로 수행하지 못했다 — 새 레이아웃이
  기존에 이미 검증된 `Card`/`flex-wrap` 패턴만 재사용하므로 구조적 위험은 낮다고
  판단했지만, 정확히 "수행 못 함"으로 기록한다.

## 20. regression

`/`, `/generate`, `/fortune`, `/my/journal/results`(신규, 307 미로그인), `/my/journal`,
`/my/journal/history`(307), Dream→Generate, `/dream`, `/faq`, `/admin/draws`(307),
`/sitemap.xml` 전부 실제 HTTP로 확인. Daily Fortune privacy RLS(0017)도 anon key
직접 재확인 — `fortune_results` 조회 결과 여전히 `[]`.

## 21. tests/build

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과(0 error) |
| `npx tsc --noEmit` | 통과(0 error) |
| `npx vitest run` | **395/395 통과**(baseline 375 + 신규 20: `winningDisplay` 9, `generationMethodLabel` 2, `getDrawsByRounds` 5, 관련 mock 확장 4) |
| `npm run build` | 통과, **46 routes**(`/my/journal/results` 신규 1개) |
| migration sync | `npx supabase migration list` — local/remote **0001~0017 그대로, 신규 0개**(§30 목표 충족 — 기존 스키마에 필요한 정보가 이미 있어 새 컬럼/테이블이 필요 없다고 판단) |

## 22. cleanup

테스트 계정 A/B/C(auth.users/profiles/user_numbers/notifications) + 테스트 draw(round
90001)를 전부 ID 기준으로 삭제하고 0건 재확인했다. 운영 draws(1227~1236)와 운영
`user_numbers`(테스트 시작 전 이미 0건이었음)는 전혀 건드리지 않았다. 임시
`app/api/jtest/route.ts`도 삭제 완료(재조회 시 404 확인).

## 23. 발견된 문제(수정하지 않고 기록만)

- `/my/journal` 허브 페이지가 "번호 기록"/"꿈 기록"/"운세 기록" 세 섹션만 미리보기로
  보여주고 "당첨확인"으로 가는 링크가 없다 — 이번 Task 지시 범위에 이 페이지 수정이
  명시되지 않아 손대지 않았다. Home 카드와 당첨 알림이 이미 실제 진입 경로를 제공하므로
  기능적 blocker는 아니지만, 발견 사실로 남긴다.
- `WinningResultCard`/`NumberBall`이 이번에 새로 만든 볼 렌더링 패턴인데, 이미
  `NumberGenerator.tsx`/`app/dream/[keyword]/page.tsx`/`DailyFortuneCard.tsx`에도 각자
  조금씩 다른 볼 렌더링이 존재한다(공유 컴포넌트 없음) — 4번째 독립 구현을 추가한
  셈이다. 이번 Task 범위에서 기존 3곳을 리팩터링하지 않았다(범위 확장 금지 원칙) —
  향후 공용 `LottoBall` 컴포넌트로 통합할 여지가 있다는 점만 기록한다.
- 당첨금(2~5등)은 현재 스키마에 없다(`draws.first_prize_amount`는 1등 전용) — 지시대로
  추측/하드코딩하지 않고 등수까지만 표시했다.

## 24. 남은 Launch Blocker

없음(치명적 항목 기준). §23의 두 항목은 개선 여지이지 기능 완성을 막는 요소가 아니다.

## 25. 다음 작업 추천

`/my/journal` 허브 페이지의 "번호 기록" 섹션 옆에 "당첨확인 보기"(`/my/journal/results`)
링크를 추가해, 다이어리 홈에서도 당첨확인 화면을 바로 발견할 수 있게 한다.

---

## TASK REPORT — Winning Results UI

- Canonical Route: `/my/journal/results`(신규) — `docs/SITEMAP.md`/`docs/USER_FLOW.md`가 이미 계획해둔 경로, `lib/api/notifications.ts`의 `RESULT_LINK_URL`도 이 경로로 갱신
- Existing Matching Logic Reused: 예 — `matchNumbers.ts`/`registerDrawAndMatchUserNumbers()` 100% 재사용, 등수 재계산 없음
- New Matching Logic: 없음 — `lib/logic/winningDisplay.ts`는 이미 계산된 결과의 표시(일치 볼 하이라이트, pending/lost/won 분류)만 담당
- User Saved Numbers: `getRecentUserNumbers()`(기존 함수, 무수정) 재사용, `created_at DESC`
- Draw Numbers: `getDrawsByRounds()`(신규, `lib/api/journal.ts`) — 공개 `draws` 테이블만 조회, 외부 fetch 없음
- Pending State: `target_round IS NULL` → "추첨 결과 확인 대기 중", 특정 회차 예측 표시 없음(§11 준수), 실제 계정으로 확인
- Losing State: `checked_at` 있음 + `win_rank` null → "N개 일치 / 낙첨" 문구, 실제 테스트로 확인(2개 일치 사례)
- Winning Rank: 1~5등 전부 실제 매칭 서비스로 생성해 확인(1등/2등-보너스일치/3등-보너스불일치/4등/5등)
- Matching Highlight: 색상+체크 배지+aria-label 3중 신호, `matchNumbers` 로직 재구현 없이 순수 집합 교집합만 사용
- Bonus Number: 당첨번호 줄에 별도 표시(금색 테두리+텍스트 캡션), 내 번호와 일치 시 추가 문구
- Prize Amount: 표시하지 않음 — 스키마에 1등 외 등수별 금액 데이터 없음(추측/하드코딩 금지 준수)
- Source Badge: `generation_method`(auto/custom/dream/fortune) 실제 지원 값만 라벨링, 공용 함수로 `history` 페이지와 공유
- Cross-user Isolation: 실제 JWT로 확인 — B가 A의 데이터를 무필터/필터 조회 모두 볼 수 없음, anon도 차단
- Home Card: `/my/journal/results`로 연결 확인(실제 HTML)
- `준비 중` Removed: 예 — 5개 카드 전부 `ready:true`, 배지 0건(실제 HTML 확인)
- Migration: **0개**(신규 마이그레이션 없음, 기존 스키마 재사용으로 충분)
- Tests: 395/395 통과(신규 20개)
- Build: 통과, 46 routes(`/my/journal/results` 신규)
- Cleanup: 테스트 계정 3명 + 테스트 draw(90001) 전부 ID 기준 삭제 후 0건 재확인, 운영 draws(1227~1236)/운영 데이터 무변경
- Winning Results Feature: **PASS**
- Remaining Launch Blockers: 없음
- 다음 작업: `/my/journal` 허브 페이지에 "당첨확인 보기"(`/my/journal/results`) 링크를 추가해 다이어리 홈에서의 발견성을 높인다
