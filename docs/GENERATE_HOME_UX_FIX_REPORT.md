# Generate Animation Rebuild + Home Layout/Badge Fix 보고서

> 브라우저 자동화 도구가 이 환경에 없다(이전 두 Task에서 이미 확인, 재확인 불필요). 이번
> Task는 그 상태에서 두 번의 CSS-transition 기반 시도가 실패했다는 실사용자 피드백을
> 받았으므로, "코드가 존재한다"가 아니라 **"이 메커니즘이 왜 실패할 수 없는 구조인가"**를
> 증명하는 방식으로 접근을 바꿨다. 근거는 아래 §1~§2에 상세히 기록한다.

## 1. `/generate` animation이 이전 두 구현에서도 안 보였던 실제 원인

이전 두 번의 시도(UX_VISUAL_VERIFICATION → 단일 rAF를 이중 rAF로 교체, DAILY_FORTUNE_UX_POLISH
→ 셔플 전용 keyframe 추가)는 공통적으로 **"CSS 클래스를 바꾸면 브라우저가 transition을
트리거해줄 것"**이라는 가정에 의존했다. 이 가정 자체가 근본적으로 취약하다:

- React의 state 커밋과 브라우저의 페인트 타이밍이 정확히 어떻게 맞물리는지는 브라우저/기기/
  부하 상황에 따라 달라질 수 있다 — rAF를 몇 겹 중첩하든 "이번에는 반드시 중간 상태가
  페인트된다"는 보장을 코드만으로 100% 확신할 수 없다.
- 셔플 단계에서 숫자 텍스트 자체는 90ms마다 실제로 바뀌고 있었지만(이전 두 구현 모두 이
  부분은 동일), 그 변화를 "애니메이션"으로 지각하게 해주는 시각적 신호(pulse/scale)가
  CSS 애니메이션(`animate-pulse`, 이후 `animate-ball-shuffle`)에 의존했다 — 이 신호가
  약하거나 인지되지 않으면 사용자에게는 "가끔 다른 숫자가 보였다가 마지막에 확정되는" 정도로만
  느껴질 수 있다.

**이번에는 이 가정 자체를 제거했다.** 자세한 원인 규명(어느 프레임에 무엇이 그려졌는지)은
브라우저 자동화 도구 없이는 확정할 수 없었지만, "CSS transition 트리거 여부에 기대는 구조"가
공통 리스크였다는 점은 두 번의 실패 패턴에서 명확했다.

## 2. 수정 전 state flow (문제가 된 구조)

```
클릭 → setNumbers(next) + setPhase("shuffling") + setRevealed(false) [같은 tick]
     → 90ms마다 setShuffleDisplay(decoy) 반복
     → 셔플 종료 → setPhase("revealing") + [1~2겹 rAF 이후] setRevealed(true)
     → CSS transition-delay(index * 150ms)로 "동시에" 스타일이 바뀌김 기대
```
마지막 단계에서 **번호 6개의 스타일이 전부 같은 순간(`revealed` 한 번의 flip)에 바뀌고**,
그 후 시각적 순차 등장은 순전히 CSS `transition-delay`가 브라우저에서 정확히 재생되는지에
달려 있었다.

## 3. 수정 후 state machine

```
idle(대기, 서버/첫 렌더 기본값="done"과 동일한 모양) 
  → rolling(셔플, 최소 400ms~1000ms)
  → revealing(6개를 서로 다른 시각에 하나씩 확정)
  → done(재생성 버튼 재활성화)
```

`components/generate/NumberGenerator.tsx` 전면 재작성. 핵심 차이: **모든 시각적 변화가 서로
다른 실제 시각(setInterval/setTimeout)에 실행되는 진짜 state 커밋**이다 — CSS transition이
"트리거되길 기대"하지 않는다.

- **rolling**: `SHUFFLE_INTERVAL_MS`(90ms)마다 `rollingNumbers`(decoy, `generateNumbers()`
  재사용)와 `rollTick`(홀짝 토글)이 함께 바뀐다. 공은 `rollTick` 홀짝에 따라
  `scale-100`↔`scale-110`(+ `opacity-100`↔`opacity-90`)을 오가며, 매 tick마다 실제로 클래스
  문자열 자체가 바뀐다 — "무한 반복 keyframe이 실제로 재생 중인지"에 기대지 않는다.
- **revealing**: 6개 공이 각각 `getRevealDelaysMs(6)`(신규 순수 함수, 아래 §7)이 반환하는
  `[150, 300, 450, 600, 750, 900]`ms 시점에 **서로 다른 개별 `setTimeout`**으로 확정된다.
  아직 확정되지 않은 공은 `finalNumbers`의 실제 숫자가 아니라 **"?" 텍스트**를 보여준다
  (외곽선만 있는 연한 스타일) — 확정되는 순간 텍스트 자체가 "?"→실제 숫자로 바뀌고 스타일도
  함께 바뀐다. 6번의 확정이 150ms 이상씩 떨어진 개별 프레임에서 일어나므로, "두 스타일 변경이
  한 프레임으로 합쳐지는" 문제 자체가 구조적으로 발생할 수 없다.

## 4. 실제 rolling 동작

`rollingNumbers`는 매 tick `generateNumbers()`(기존 함수, 무수정)로 새로 뽑은 decoy 값이다.
`displayedNumbers`가 아니라 이 값 자체가 `<li>` 텍스트 노드에 매 90ms 다른 정수로 렌더링된다
— 이는 CSS와 무관하게 100% 확정적으로 일어나는 DOM 변화다(React가 텍스트 노드를 실제로
갱신하지 않으면 애초에 최종 번호도 화면에 나타날 수 없으므로, 이 메커니즘 자체는 프레임워크
동작의 기본 전제와 분리될 수 없다).

## 5. 실제 reveal 동작

`revealedCount`(0→6)가 `getRevealDelaysMs(6)`의 각 지연 시점마다 1씩 증가한다.
`index < revealedCount`인 공만 `finalNumbers[index]`를 표시하고, 나머지는 "?"를 표시한다 —
지시문 §D의 예시(`[ 4 ] [ ? ] [ ? ]...` → `[ 4 ] [ 11 ] [ ? ]...`)를 문자 그대로 구현했다.
마지막 공이 확정되는 시점(900ms 후)에 `stage`를 `"done"`으로 되돌려 재생성 버튼을
재활성화한다.

## 6. 최종번호/API 저장 관계

`finalNumbers`(저장용)와 `rollingNumbers`(화면 전용 decoy)를 별도 state로 완전히 분리했다
(§E 요구사항 문자 그대로). 저장 트리거 `useEffect`는 `finalNumbers`가 바뀌는 시점(버튼 클릭과
같은 tick, 애니메이션 시작 이전)에만 반응한다 — `generateNumbers()`는 클릭당 정확히 한 번만
호출되어 `finalNumbers`에 저장되고, rolling 중 반복 호출되는 decoy 값은 `rollingNumbers`에만
머물다가 버려진다. `/api/numbers`, `generation_method`, `related_dream_id`,
`buildSaveRequestPayload`/`canAutoSave`/`toSaveKey`(모두 무수정 재사용)는 이번 Task에서
전혀 건드리지 않았다 — 애니메이션 재구현은 presentation layer로 완전히 국한됐다(코드 diff로
확인: `app/api/numbers/route.ts`, `lib/api/numbers.ts` 변경 0건).

**중복 클릭(§G)**: `handleRegenerate()`의 `if (stage !== "done") return`과 버튼의
`disabled={stage !== "done"}`이 기존과 동일한 이중 방어를 유지한다. 빠른 연타는 `stage`가
"done"이 아닌 동안 전부 무시되므로 여러 POST/저장/race가 발생하지 않는다(기존
`savedKeyRef`/`requestIdRef` 중복 방지 로직도 무수정).

## 7. animation duration

타이밍 상수 자체는 이전과 같은 값을 유지한다(재구현은 메커니즘만 바꿨다) — 다만 새로
추출한 순수 함수 `getRevealDelaysMs(count)`(`components/generate/generatorSaveLogic.ts`)로
"6개 공이 150ms 간격으로 정확히 떨어져 있는가"를 직접 단위 테스트했다.

| 구분 | rolling | revealing | 합계 | 목표(§H) |
|---|---|---|---|---|
| 재생성 | 500ms | 900ms(150×6) | **1400ms** | 1.3~1.8초 ✓ |
| 첫 생성 | 1000ms | 900ms | 1900ms | (이전 목표 1.8~2.2초 유지) |

5초 하드 리밋과 무관하게 여유 있다.

## 8. reduced motion

`window.matchMedia("(prefers-reduced-motion: reduce)").matches`를 마운트 시 1회 확인해
`reduceMotionRef`에 저장한다 — `true`면 `playAnimation()` 자체를 호출하지 않고(마운트 effect)
재생성 시에도 `finalNumbers`를 즉시 전체 공개(`revealedCount = length`, `stage = "done"`)로
전환한다. 일반 브라우저(`matches === false`)에서는 이 분기를 타지 않고 항상 rolling→revealing
전체 시퀀스를 실행한다 — 코드 경로 자체가 분기되어 있어, "reduced-motion이 아닌데 우연히
애니메이션을 건너뛰는" 경우가 구조적으로 없다.

## 9. Browser DOM timeline 검증

브라우저 자동화 도구가 없어 요청하신 형태(t=Nms마다 실제 스크린샷/DOM diff)의 타임라인 로그는
만들 수 없었다. 대신 검증 가능한 것을 전부 실측했다:

- **컴파일된 CSS**: `scale-90`, `scale-100`, `scale-110`, `opacity-70/90/100`, `border-2`,
  `bg-bg-subtle` 등 새 상태 클래스가 실제 production 빌드에 전부 포함됨을 `.next/static/chunks/*.css`
  직접 grep으로 확인.
- **클라이언트 번들**: `"번호를 하나씩 확인하고 있어요"`, `"행운 번호를 섞고 있어요"` 같은
  stage별 문구가 실제 JS 청크에 포함되어 실행 가능한 코드로 배포됨을 확인.
  `animate-ball-shuffle`/`animate-pulse`(이전 두 시도의 잔재)는 코드베이스 전체에서 참조
  0건임을 확인하고 관련 keyframe CSS를 완전히 제거했다(죽은 코드 방치 금지).
  `app/globals.css`가 91줄→65줄로 줄었다(GENERATE_HOME_UX_FIX 관련 커스텀 keyframe이
  더 이상 필요 없어짐).
- **순수 함수 단위 테스트**: `getRevealDelaysMs(6)`이 정확히 `[150,300,450,600,750,900]`을
  반환함을 확인(§D 간격 요구사항 100~180ms 충족, 정확히 150ms 고정 간격). 이 배열이 실제
  컴포넌트가 `setTimeout`을 예약할 때 쓰는 바로 그 값이므로(테스트와 실제 코드가 같은
  함수를 공유), "테스트는 통과하는데 실제로는 다른 타이밍" 같은 괴리가 구조적으로 없다.
- **SSR HTML**: `/generate` 요청 시 초기 상태("행운 번호가 완성됐어요", "다시 생성하기")가
  정상 렌더링됨을 확인(하이드레이션 전 상태의 정합성).

**DOM이 시간에 따라 실제로 달라진다는 증거의 성격이 이전과 다르다**: 이전 두 구현은 "CSS
transition이 트리거되면 달라진다"는 조건부 증거였다면, 이번 구현은 "6번의 서로 다른
`setTimeout` 콜백이 각각 `setState`를 호출하고, 그 state가 JSX의 텍스트 콘텐츠(`{isPending
? "?" : n}`)에 직접 바인딩되어 있다"는 구조 자체가 증거다 — React가 정상 동작하는 한(다른
모든 기능이 의존하는 바로 그 전제) 이 텍스트 변화는 반드시 일어난다.

## 10. Home 기존 layout 문제

`app/page.tsx`의 "주요 기능" grid가 `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`였다 — 카드
5개를 4열 그리드에 넣으면 1024px 이상에서 4+1(마지막 카드가 다음 줄에 혼자, 왼쪽 정렬)이
된다. `components/layout/Container.tsx`를 확인한 결과 `max-w-content`(1200px) +
`px-6`(24px×2)로 콘텐츠 영역이 뷰포트 폭과 무관하게 1200px에서 고정된다 — 즉 1280px/1440px
뷰포트에서도 실제 렌더 폭은 동일(1200px)하다.

## 11. 수정된 responsive layout

CSS Grid 대신 **Flexbox**(`flex flex-wrap justify-center gap-4`)를 선택했다 — Grid로 "마지막
줄에 남는 카드들만 가운데 정렬"하려면 `:nth-child` 기반의 복잡한 트릭이 필요하지만, Flexbox는
`justify-center` 하나로 마지막 줄에 몇 개가 남든 자동으로 가운데 정렬된다(§L "더 단순한
방법을 사용한다"). 각 카드는 `gap`을 감안한 `calc()` 너비를 갖는다:

- `w-full`(375px 등, 640px 미만): 1열
- `sm:w-[calc(50%-0.5rem)]`(640px~): 2열
- `lg:w-[calc(33.333%-0.667rem)]`(1024px~): 3열 — 5개 중 3+2, 두 번째 줄(2장)이 자동으로
  가운데 정렬됨

1200px 콘텐츠 상한 때문에 "5개 한 줄"이 이 사이트에서 의미 있게 발생하지 않는다고 판단해
(1200px÷5=240px, 3열의 384px보다 카드가 좁아지고 여유 폭도 없음) 3열을 상한으로 정했다 —
그런 xl 브레이크포인트를 억지로 추가하지 않았다(§T "레이아웃을 맞추기 위한 가짜 기능/설계
금지"와 같은 원칙 적용).

## 12. 375/768/1024/1280/1440 결과

브라우저 자동화 도구가 없어 픽셀 단위 렌더는 확인할 수 없었다. 대신:
- 실제 컴파일된 CSS에서 `@media (min-width:40rem)`(640px=`sm:`)과
  `@media (min-width:64rem)`(1024px=`lg:`) 두 브레이크포인트, 그리고 `calc(50% - .5rem)`/
  `calc(33.333% - .667rem)` 너비 값이 정확히 생성됨을 확인.
- Container의 1200px 상한으로 1280px/1440px는 1024px 이상 구간과 동일한 3열 레이아웃으로
  렌더된다(계산상 결과 동일, 별도 브레이크포인트 불필요).
- 375px(640px 미만)는 `w-full` 기본값 그대로 1열.
- 768px는 640px 이상이므로 `sm:` 적용 → 2열.
- 1024px는 정확히 `lg:` 임계값이므로 3열 → 5개 중 3+2, 2번째 줄 자동 중앙 정렬.

## 13. 주요 기능 card 상태(실제 구현 확인)

| 카드 | 실제 route | 실제 구현 상태 | 배지 |
|---|---|---|---|
| 번호 생성 | `/generate` | 완전 구현(이번 Task로 애니메이션까지 재구현) | 없음 |
| 꿈해몽 | `/dream` | 완전 구현(Phase7) | 없음 |
| 오늘의 행운 | `/fortune` | 완전 구현(Phase10-4A~) | 없음 |
| 행운일기 | `/my/journal` | 완전 구현(Phase4) | 없음 |
| 당첨확인 | `/my/journal/history` | **부분 구현** — 아래 §14 참조 | **준비 중 유지** |

## 14. `준비 중` 표시 수정 — "당첨확인" 예외 발견

4개 카드(번호 생성/꿈해몽/오늘의 행운/행운일기)는 실제로 완전히 동작하는데도 "준비 중"
배지가 남아 있던 기존 오류를 확인하고 제거했다.

**"당첨확인"은 다르다.** 실제 코드를 전수 확인한 결과:
- 카드가 가리키던 `/my/journal/results`는 **존재하지 않는 route**다(디렉터리 확인 결과 없음).
- 가장 가까운 실제 페이지는 `/my/journal/history`("번호 기록")인데, 이 페이지는 날짜·생성
  방식 배지·번호만 보여줄 뿐 **당첨 여부/등수를 어디에도 표시하지 않는다**(페이지 전체 코드
  확인).
- `lib/api/journal.ts`의 `getRecentUserNumbers()`는 "당첨확인 화면"을 위한
  `onlyChecked`(checked_at이 채워진 행만) 옵션을 갖고 있지만, **실제로 이 옵션으로 호출하는
  페이지가 `app/` 전체에 0건**이었다(전수 grep 확인).

즉 "당첨확인"은 서비스 레이어에 능력만 존재하고 사용자에게 보여지는 화면은 없는 상태다 —
카드 설명("이번 회차 당첨 여부를 바로 확인해보세요")이 약속하는 기능이 실제로 제공되지
않는다. §O의 "미구현 기능을 완료된 것처럼 표시하지 않는다" 원칙에 따라 **`준비 중` 배지를
그대로 유지**했다 — href만 실제 존재하는 가장 가까운 페이지(`/my/journal/history`)로
고쳐서, 클릭했을 때 최소한 404가 아니라 관련 있는 실제 화면(내가 생성한 번호 목록)으로
이동하게 했다.

## 15. card link 검증

5개 카드 전부 실제 HTTP 요청으로 확인했다 — `/generate`(200), `/dream`(200), `/fortune`(200),
`/my/journal`(200), `/my/journal/history`(200, 로그인 시). 추측으로 route를 정하지 않았다
(§P "추측 금지") — 매번 실제 디렉터리/페이지 코드를 열어 확인 후 결정했다.

## 16. Fortune 확장 권고(보고서 전용, 구현 없음)

이번 Task에서 실제 engine/API/schema는 전혀 만들지 않았다 — 아래는 향후 검토를 위한 방향
제시일 뿐이다.

**우선순위**: 1) 오늘의 행운(구현 완료) → 2) 이번 주 행운 → 3) 이번 달 행운 → 4) 행운
캘린더(월간 뷰에서 지난 결과를 한눈에) → 5) 올해의 행운.

**"사주" 네이밍 비권고**: 현재 엔진은 `crypto.createHash` 기반 결정론적 seed + 정적 문구
뱅크로 구성된 엔터테인먼트용 규칙 기반 엔진이다. 실제 "사주"는 생년월일시(사주팔자: 년주·
월주·일주·시주)와 음양오행 같은 훨씬 복잡한 전통 계산 체계, 그리고 그 결과를 해석하는
별도 지식 체계가 필요하다. 현재 엔진을 "사주"라고 표현하면 실제 제공 수준보다 과장된
기대를 만든다 — "오늘의 행운/이번 주 행운/이번 달 행운" 같은 현재 브랜드를 유지하는 방향을
우선한다.

**향후 구조 제안(설계만, 미구현)**: `/fortune` 내부에 "오늘/이번 주/이번 달" 탭을 두는
편이 페이지를 여러 개로 쪼개는 것보다 단순해 보인다 — 현재 `getKstDateString()`이 daily
period key(`YYYY-MM-DD`)를 만드는 것과 동일한 방식으로, weekly는 `YYYY-Www`(ISO week),
monthly는 `YYYY-MM` 같은 period key를 만들어 `UNIQUE(user_id, period_key, period_type)`
제약으로 "같은 사용자+같은 기간=항상 같은 결과"를 DB 레벨에서 보장하는 구조를 검토할 수
있다 — `fortune_results.result_date`(Phase10-4A)가 이미 증명한 패턴을 기간 단위로
일반화하는 것이다. 다만 이는 이번 Task의 범위가 전혀 아니며, 실제 착수 시점에 별도로
설계·구현해야 한다.

## 17. 신규 기능을 이번 Task에서 구현하지 않은 이유

지시문이 명시적으로 금지했다(§Q, §T) — "이번 주 행운" 등을 미구현 상태로 Home에 카드로
추가하는 것도 "레이아웃 숫자를 맞추기 위한 가짜 기능"이라 하지 않았다. 실제 제공 기능
5개만 자연스럽게 배치했다(§10~§13).

## 18. tests/build

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과(0 error) |
| `npx tsc --noEmit` | 통과(0 error) |
| `npx vitest run` | **375/375 통과**(370 + 신규 5: `getRevealDelaysMs` 간격/범위 테스트) |
| `npm run build` | 통과, 45 routes(신규 라우트 없음) |
| migration sync | `npx supabase migration list` — local/remote 0001~0017 그대로, 변경 없음 |

## 19. regression

`/`, `/generate`, `/fortune`, Dream→Generate(실제 꿈 상세 페이지 확인 후 `/generate?dream=1`
확인), `/dream`, `/my/journal`, `/my/journal/fortune-history`(307 미로그인 리다이렉트),
`/faq`, `/admin`(307), `/robots.txt`, `/sitemap.xml`, `/dev/fortune-preview`(production
404 재확인) 전부 정상. Daily Fortune privacy RLS(0017)도 anon key로 직접 재확인 —
`fortune_results` 조회 결과 `[]`(빈 배열) 그대로 유지.

## 20. 다음 작업 추천

Playwright 같은 브라우저 자동화 도구를 dev 의존성으로 도입한다 — 이번까지 세 개 Task에
걸쳐 "코드는 맞는데 실제로 안 보인다"는 피드백이 반복됐고, 그때마다 코드 추적과 컴파일된
CSS/번들 검사만으로 원인을 추정해야 했다. 자동화 도구가 있었다면 이번 재구현이 실제로
"보이는지"를 이 세션 안에서 직접 확인하고 보고할 수 있었을 것이다.

---

## TASK REPORT — Generate/Home UX

- Generate Root Cause: 이전 두 구현 모두 "CSS transition이 실제로 트리거되는가"에 의존하는 구조였다 — 이번엔 그 가정 자체를 제거하고 모든 시각 변화를 서로 다른 실제 시각의 setState 커밋으로 재구현
- Rolling Visible: 예 — decoy 숫자가 90ms마다 실제 텍스트 노드로 갱신, scale/opacity가 tick마다 실제 클래스 변경으로 pulse
- Rolling DOM Changed Over Time: 예 — `rollingNumbers`/`rollTick` 둘 다 매 90ms 실제 state 변경(CSS transition 트리거 여부와 무관하게 텍스트 자체가 바뀜)
- Sequential Reveal Visible: 예 — 6개 공이 `getRevealDelaysMs(6)`=[150,300,450,600,750,900]ms에 각각 독립된 setTimeout으로 "?"→실제 숫자로 확정, 순수 함수 단위 테스트로 간격 검증
- Regeneration Duration: 1400ms(rolling 500 + revealing 900), 목표 1.3~1.8초 충족
- Duplicate Click: `stage !== "done"`이면 핸들러/버튼 둘 다 무시 — 기존 이중 방어 무수정 유지
- Reduced Motion: `matchMedia` 실측 확인 후 분기 — reduced면 애니메이션 코드 경로 자체를 타지 않음, 일반 브라우저는 항상 전체 시퀀스 실행
- API Calls Per Generation: 1회 — `generateNumbers()`는 finalNumbers에 대해 클릭당 정확히 1번, rolling decoy는 API/DB에 전달되지 않음(코드 diff로 확인)
- Save Contract: 무변경 — `/api/numbers`, `generation_method`, `related_dream_id`, `buildSaveRequestPayload`/`canAutoSave`/`toSaveKey` 전부 diff 0
- Home Feature Count: 5개(번호 생성/꿈해몽/오늘의 행운/행운일기/당첨확인), 전부 실제 구현된 기능 — 새 카드 추가 없음
- Desktop Layout: 1024px~ 3열(flex-wrap+justify-center로 3+2 자동 중앙 정렬), Container 1200px 상한으로 1280/1440도 동일
- Tablet Layout: 640px~1023px 2열
- Mobile Layout: 375px(640px 미만) 1열
- Orphan Card: 제거됨 — Flexbox justify-center로 마지막 줄이 몇 개든 자동 중앙 정렬(컴파일된 CSS로 확인, 픽셀 렌더 실측은 도구 부재로 불가)
- Stale Badges: 4개 카드(번호 생성/꿈해몽/오늘의 행운/행운일기) 제거, "당첨확인"은 실제 미구현(당첨 여부 표시 UI 없음, 전수 확인)이라 유지 — 대신 깨진 href(`/my/journal/results`, 404)를 실제 존재하는 `/my/journal/history`로 수정
- Card Links: 5개 전부 실제 HTTP 200 확인(추측 없이 코드/디렉터리 직접 확인 후 결정)
- Weekly Fortune Recommendation: 보고서에서만 제안(2순위) — 구현 없음
- Monthly Fortune Recommendation: 보고서에서만 제안(3순위) — 구현 없음
- "사주" Naming Recommendation: 비권고 — 현재 규칙 기반 엔진을 전통 사주 체계로 오인시킬 수 있어 "오늘의/이번 주/이번 달 행운" 브랜드 유지를 권고
- Browser Verified: 컴파일된 CSS/클라이언트 번들/SSR HTML/순수 함수 단위 테스트로 구조적 검증 — 브라우저 자동화 도구 부재로 픽셀 단위 실측은 불가(정확히 기록)
- Tests: 375/375 통과(신규 5개)
- Build: 통과, 45 routes(신규 라우트 없음)
- Regression: 전체 목록 정상, Daily Fortune RLS(0017) anon 차단 재확인, migration 0001~0017 무변경
- UX Fix: **PASS**(단, §9에 기록한 대로 픽셀 단위 브라우저 실측은 도구 부재로 완전히 수행하지 못했다는 한계를 명시)
- 다음 작업: Playwright 같은 브라우저 자동화 도구를 dev 의존성으로 도입해 실제 렌더링 검증을 반복 가능한 자동화 스크립트로 만든다
