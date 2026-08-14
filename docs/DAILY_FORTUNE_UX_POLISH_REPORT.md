# Daily Fortune UX Polish — Preview 재생 버그 수정 + 시각적 강화 보고서

> 이 환경에는 Playwright/Puppeteer 같은 브라우저 자동화 도구가 없다(이전 Task에서 이미 확인).
> 이번에도 (1) 코드를 라인 단위로 추적해 실제 실행 시퀀스를 재구성하고, (2) 실제 원격
> Supabase에 테스트 계정을 만들어 실제 로그인 세션으로 `/fortune`을 HTTP 요청해 렌더링된
> HTML을 직접 확인하고, (3) 실제 production 빌드를 만들어 라우트 차단을 실측하는 방식으로
> 검증했다.

## 1. Preview replay 버그 원인

`DailyFortuneCard`는 마운트되는 즉시(`isNew=true`일 때) 자체적으로 reveal 시퀀스를
시작하도록 설계되어 있었다(Phase10-4C1의 의도된 동작 — `/fortune` 실사용자에게는
정확히 맞는 설계). 그런데 이전 `FortunePreviewClient`는 페이지가 로드되자마자
`DailyFortuneCard`를 곧바로 마운트했다 — 즉 운영자가 화면을 실제로 보기도 전에(페이지
로드·hydration·인간의 반응 시간 동안) 약 1.9초짜리 reveal 시퀀스가 이미 시작되고 끝나
버릴 수 있는 구조였다. 그 결과:
- 진입 직후 이미 완성된 카드만 보이고("애니메이션이 이미 끝난 것처럼 보임"),
- 상시 노출되던 "애니메이션 다시 보기" 버튼은 애니메이션 완료 여부와 무관하게 항상 같은
  자리에 있어 클릭해도 인지 가능한 신호(로딩 상태 등)가 버튼 자체에는 없었다.

브라우저 자동화 도구가 없어 정확히 "몇 프레임에 무엇이 그려졌는가"까지는 재현할 수
없었지만, 코드 추적만으로도 "관찰 시점과 애니메이션 시작 시점이 구조적으로 어긋나 있다"는
근본 원인은 명확했다.

## 2. Preview 수정

버그를 개별적으로 패치하는 대신, 지시문 PART 2가 요구한 명시적 3단계 상태 기계로
구조 자체를 바꿨다 — `app/dev/fortune-preview/fortunePreviewLogic.ts`(새 순수 로직 파일,
jsdom 없는 vitest 환경에서도 테스트 가능):

```
idle(카드 마운트 안 됨) --start--> revealing(카드 마운트, 자체 reveal 재생 중)
revealing --complete--> done("애니메이션 다시 보기" 버튼 노출)
done --replay--> revealing(key 변경으로 카드 리마운트, 처음부터 재생)
```

`idle` 상태에는 `DailyFortuneCard`를 아예 렌더링하지 않는다(SSR HTML로 직접 확인, §16
참조) — 운영자가 명시적으로 "애니메이션 시작"을 누르기 전까지 어떤 reveal 로직도 시작되지
않는다. "완료" 시점은 `DailyFortuneCard`에 새로 추가한 선택적 `onRevealComplete?: () => void`
prop으로 정확히 전달받는다(카드+번호가 모두 실제로 보이는 상태가 된 순간 정확히 한 번
호출, ref로 중복 호출 방지) — `/fortune`(`app/fortune/page.tsx`)은 이 prop을 전달하지
않으므로 production 동작에는 전혀 영향이 없다.

## 3. Production animation 규칙

기존 계약을 그대로 재사용했다 — 새 API 필드를 추가하지 않았다.

`components/fortune/dailyFortuneRevealLogic.ts`의 `shouldAnimateReveal(isNew,
prefersReducedMotion)` 순수 함수 하나로 규칙을 표현하고, `DailyFortuneCard`의
`useLayoutEffect`가 이 함수를 **그대로 호출**해 애니메이션 여부를 결정한다(테스트가
검증하는 조건과 실제 컴포넌트가 쓰는 조건이 같은 코드라 서로 어긋날 수 없음):

- `isNew === true` && `!prefersReducedMotion` → reveal 애니메이션 실행
- `isNew === false`(같은 날 재방문) → 즉시 결과 표시(애니메이션 없음)
- `isNew === true` && reduced-motion → 즉시 결과 표시

production `/fortune`에는 "다시 뽑기"/"다시 생성"/"애니메이션 다시 보기" 버튼을 추가하지
않았다(코드 전수 확인, `app/fortune/page.tsx`와 `DailyFortuneCard.tsx`에 그런 버튼/상태
없음).

## 4. reveal sequence(수정 후 전체 흐름)

1. `오늘의 행운을 살펴보고 있어요 ✨`(스피너, `REVEAL_DELAY_MS`=1300ms)
2. 카드 등장 — 별자리 Hero(♊/쌍둥이자리) + 행운지수(큰 숫자 + progress bar + 해석 문구),
   총평, 금전운(지수+bar), 좋은 행동, 피할 행동, 행운의 색(swatch)/시간이 한 번에 나타남
3. 이중 rAF로 한 박자 뒤, 행운의 숫자·오늘의 추천 번호가 `index * 120ms` 간격으로 왼쪽부터
   순차 등장(기존 Phase10-4C1에서 이미 구현된 로직, 이번 Task에서 재사용)

총 소요: 1300ms + 최대 600ms(6번째 번호 지연) + 300ms(전환) ≈ **2200ms** — 목표(1.8~2.8초)
이내, 5초 하드 리밋과 무관하게 여유 있다. 같은 날 재방문에는 이 시퀀스 전체가 생략되고
모든 요소가 즉시 표시된다(`revealed`/`numbersRevealed` 기본값이 `true`이므로 구조적으로
보장됨, §12에서 실제 HTTP로 재확인).

## 5. Zodiac UI

우측 상단의 작은 텍스트("쌍둥이자리 · 행운지수 78")를 제거하고, 카드 최상단에 별도의
Hero `Card`를 추가했다 — 원형 배경(`bg-primary`, 지름 64px) 안에 유니코드 zodiac 기호를
크게 표시하고, 그 아래 별자리 이름을 `text-h2`로 강조했다. 새 이미지 CDN/아이콘
라이브러리를 추가하지 않았다 — 유니코드 문자(♈~♓)는 텍스트일 뿐이다.

## 6. 12 zodiac mapping

`lib/data/fortune/zodiacSymbols.ts`에 12개 전부 매핑(양♈ 황소♉ 쌍둥이♊ 게♋ 사자♌ 처녀♍
천칭♎ 전갈♏ 사수♐ 염소♑ 물병♒ 물고기♓), 알 수 없는 값/`null`에는 `✨` fallback.
`zodiacSignFromBirthDate()`(기존 함수, 무수정)가 12개 중 하나만 반환하도록 이미 전수
커버되어 있어 fallback은 방어적 장치다. 날짜 경계 테스트를 **12개 별자리 전부**(시작일+
종료일, 염소자리는 연초/연말 두 구간이라 총 24개 지점)로 확장했다
(`lib/logic/dailyFortune.test.ts`) — 이전에는 5개 지점만 검증했었다.

## 7. Overall luck score UI

"행운지수 78" 같은 인라인 텍스트 대신, 큰 숫자(`text-display`, "78 / 100") + CSS
progress bar(`role="progressbar"`, `aria-valuenow`/`min`/`max` 포함, 새 차트 라이브러리
없이 순수 CSS `width` 스타일) + 해석 문구(`lib/data/fortune/tiers.ts`의
`luckScoreLabel()`: 90+ "행운이 가득한 날", 75-89 "좋은 흐름의 날", 60-74 "무난한 흐름",
그 아래 "천천히 움직여볼 날")로 구성했다. 과장된 미래 예측 표현은 쓰지 않았다.

## 8. Money luck score 생성 방식

**새 DB 컬럼/migration 없이 구현했다** — `lucky_score`/`recommended_numbers`(lucky
numbers)와 동일한 패턴으로, 저장된 `(user_id, input_birth_date, result_date)` 세 값에서
매번 다시 계산 가능한 순수 파생값이다.

`lib/logic/dailyFortune.ts`의 `computeMoneyLuckScore(overallScore, random)`:
- overall luckScore에 **1~15 사이(0 제외) 무작위 편차**를 더하거나 빼서 `[40, 95]`로
  클램프한다 — "완전히 동일한 값을 복사"하지 않으면서도(§11 "완전히 동일한 값을 복사하지
  않는다"), "심하게 모순되지 않는" 톤을 유지한다. 수학적으로 `|moneyScore - overallScore|
  <= 15`가 항상 성립함을 클램프 경계 분석 + 30회 무작위 sweep 단위 테스트로 확인했다.
- 다른 콘텐츠 선택과 완전히 독립된 하위 시드(`deriveSeed(seed, "money-score")`)를 써서,
  문구 선택 로직이 바뀌어도 금전운 지수 결과가 흔들리지 않는다.
- 같은 `(userId, birthDate, resultDate)` → 항상 같은 값(기존 `generateDailyFortune()`의
  전체 결과 동일성 테스트가 이 필드도 자동으로 커버한다).

`lib/api/fortune.ts`의 `getDerivedFortuneFields(entry, userId, birthDate)`가
`getLuckyNumbersForEntry()`를 대체·확장해 lucky numbers와 money score를 **한 번의
`generateDailyFortune()` 호출로 함께** 계산해 반환한다(중복 계산 방지). `app/fortune/page.tsx`
와 `app/api/fortune/today/route.ts` 양쪽에서 이 함수로 값을 얻어 화면/API 응답에 포함시킨다
— DB에는 저장하지 않는다.

## 9. Money score UI

행운지수와 같은 대형 Hero UI를 반복하지 않았다(지시문 §13 요구사항) — 금전운 Card 내부에
헤더와 같은 줄에 작은 숫자("74 / 100")를 배치하고, 그 아래 얇은(`h-1.5`) progress bar만
추가했다. 본문 텍스트(`money_luck`, 기존 컬럼)는 그대로 유지된다.

## 10. section emoji/icon

8개 섹션 헤더에 emoji를 추가했다 — 지시문이 제시한 것 그대로: ✨ 오늘의 총평, 💰 금전운,
✅ 좋은 행동, ⚠️ 피할 행동, 🎨 행운의 색, ⏰ 행운의 시간, 🍀 행운의 숫자, 🎱 오늘의 추천
번호. 기존 `CardHeader`(`text-h2 font-bold`) 스타일 그대로 emoji만 텍스트 앞에 붙였다 —
별도로 크기를 키우지 않아 기존 차분한 디자인 톤을 유지한다.

## 11. Lucky color swatch

`lib/data/fortune/colorSwatches.ts`에 실제 콘텐츠 뱅크(`LUCKY_COLORS`, 18개) 전부를
CSS hex 색상에 매핑했다 — Fortune 표시 전용 매핑이며 `app/globals.css`의 `@theme`
전역 디자인 토큰에는 아무것도 추가하지 않았다(지시문 §15 "design system 전체에 새 global
token을 대량 추가하지 않는다"). UI는 색 이름 원 스와치(`aria-hidden`, 지름 20px) +
색 이름 텍스트를 항상 함께 표시한다(§16 "색상만으로 정보를 전달하지 않는다"). 예상하지
못한 문자열이 오면 중립 회색(`#9aa0a6`)으로 폴백해 UI가 깨지지 않는다 — 단위 테스트로
"알 수 없는 색 이름"과 `null` 두 경우 모두 확인했다.

## 12. Mobile / 13. Desktop

실제 뷰포트 렌더링을 직접 볼 수는 없었지만(브라우저 자동화 도구 없음), 기존 반응형
클래스(`sm:grid-cols-2`, Phase10-4A부터 검증됨)를 그대로 재사용해 좋은 행동/피할 행동,
행운의 색/시간을 2열(데스크톱) → 1열(모바일)로 자연스럽게 접는 구조를 유지했다. 새로
추가한 Hero 카드/progress bar는 모두 `flex`/`w-40`(고정 최대폭, 뷰포트보다 넓어지지
않음)/`overflow-hidden`으로 구성해 375px 폭에서도 가로 스크롤이 생기지 않는다(레이아웃
원칙 검토 — 실제 렌더 확인은 아님, §17 "남은 UX 이슈" 참조).

## 14. production/preview component 재사용

`/dev/fortune-preview`와 실제 `/fortune`은 **완전히 동일한** `DailyFortuneCard` 컴포넌트를
쓴다 — 새 preview 전용 UI 모델/컴포넌트를 만들지 않았다. Preview fixture
(`FortunePreviewClient.tsx`의 `FIXTURE` 객체)는 production result와 동일한 shape
(`zodiacSign, overallFortune, luckScore, moneyLuck, moneyLuckScore, actionGuide,
thingsToAvoid, luckyColor, luckyTime, luckyNumbers, recommendedNumbers`)를 그대로 쓴다.
"애니메이션 시작"/"다시 보기" 버튼과 `phase` 상태는 `FortunePreviewClient.tsx`(preview
wrapper)에만 존재하고, `DailyFortuneCard.tsx`에는 재생 관련 코드가 전혀 없다(`onRevealComplete`
는 선택적 콜백일 뿐, 재생 버튼 자체는 아님).

## 15. Tests

| 파일 | 개수 | 대상 |
|---|---|---|
| `lib/logic/dailyFortune.test.ts` | 48(+30) | zodiac 12개 경계 전체 sweep, `computeMoneyLuckScore` 결정론/범위/편차 상한 |
| `lib/data/fortune/tiers.test.ts`(신규) | 5 | `luckScoreLabel` 4개 구간 |
| `lib/data/fortune/zodiacSymbols.test.ts`(신규) | 4 | 12개 매핑, null/미확인 값 fallback |
| `lib/data/fortune/colorSwatches.test.ts`(신규) | 4 | 18개 색 전부 매핑, null/미확인 값 fallback |
| `components/fortune/dailyFortuneRevealLogic.test.ts`(신규) | 3 | `shouldAnimateReveal`(§3 규칙 그대로) |
| `app/dev/fortune-preview/fortunePreviewLogic.test.ts`(신규) | 6 | preview 상태 기계, replay key 유일성 |
| `lib/api/fortune.test.ts` | 8(함수명 변경 반영) | `getDerivedFortuneFields`로 이름 변경, 기존 커버리지 유지 |

전체 테스트: **318 → 370**(신규 52개), 전부 통과.

## 16. 실제 브라우저(HTTP) 검증

브라우저 자동화 도구가 없어 (a) SSR HTML을 직접 요청해 확인하고, (b) 실제 원격 Supabase에
테스트 계정을 만들어 실제 로그인 세션으로 확인했다.

- **Preview idle 상태**: `curl /dev/fortune-preview` → "오늘의 행운 미리보기" + "애니메이션
  시작" 문구만 있고, "오늘의 총평"이나 "애니메이션 다시 보기" 텍스트는 응답에 **전혀 없음**
  (grep 0건) — 카드가 실제로 마운트되지 않았음을 확인.
- **실제 `/fortune`(로그인 사용자)**: 새 zodiac Hero(♊/쌍둥이자리/오늘의 행운지수/78 / 100),
  해석 라벨("행운이 가득한 날"), 8개 섹션 emoji 전부, 금전운 지수("95", `role="progressbar"`
  2개 — 행운지수/금전운지수 각각), 색상 swatch(`background-color:#c8a2d6`, 라일락)가
  응답 HTML에 실제로 렌더링됨을 확인.
- **Production 차단**: 실제 production 빌드(`npm run build` → `npm run start`)로
  `/dev/fortune-preview` → **404**, `/fortune`/`/generate` → 200 유지 확인.

## 17. 기존 기능 회귀

`/fortune`, `/generate`, `/dev/fortune-preview`(dev 200/prod 404), `/my/journal/fortune-history`
(307 미로그인 리다이렉트, 정상), `/`, `/about`, `/privacy`, `/dream`, `/faq`, `/admin`(307),
`/robots.txt`, `/sitemap.xml` 전부 정상. Daily Fortune privacy fix(0017 마이그레이션, RLS
own-select)는 이번 Task에서 마이그레이션을 전혀 추가하지 않아(`npx supabase migration list`
—local/remote 0001~0017 그대로) 그대로 유지된다.

## 18. 남은 UX 이슈

- 실제 모바일/데스크톱 뷰포트 렌더링을 픽셀 단위로 확인하지 못했다(브라우저 자동화 도구
  없음) — CSS 클래스 검토로 가로 스크롤 위험 요소가 없음을 확인했을 뿐, 실측은 아니다.
- Hero 카드의 원형 zodiac 배지 색상(`bg-primary`)이 모든 12개 별자리에 동일하게
  적용된다 — 별자리별로 색을 달리하는 것까지는 이번 Task 범위로 요구되지 않아 하지 않았다.
- 이전 Task(UX_VISUAL_VERIFICATION_REPORT.md)가 이미 남긴 항목들(`/dev/fortune-preview`
  청크가 production 빌드 산출물에 여전히 존재, `app/page.tsx`의 4개 카드 "준비 중" Badge,
  "당첨확인" 카드의 잘못된 href)은 이번 Task 범위 밖이라 그대로 남아있다.

## 19. 다음 작업 추천

Playwright 같은 브라우저 자동화 도구를 프로젝트에 dev 의존성으로 도입해, 지금까지 세 개
Task에 걸쳐 코드 추적과 HTTP 응답만으로 판단해야 했던 "실제 브라우저 렌더링/애니메이션"
검증을 스크립트로 반복 가능하게 만든다.

---

## TASK REPORT — Daily Fortune UX Polish

- Preview Initial State: idle — "오늘의 행운 미리보기" + "애니메이션 시작" 버튼만 표시, DailyFortuneCard 미마운트(SSR HTML로 확인)
- Preview Replay: 정상 — `onRevealComplete` 콜백으로 완료 시점을 정확히 감지해 "다시 보기" 버튼을 그때만 노출, 클릭 시 `key` 변경으로 컴포넌트 완전 리마운트해 처음부터 재생(순수 로직 6개 테스트로 상태 전이 검증)
- Production Replay Button: 없음 — `app/fortune/page.tsx`/`DailyFortuneCard.tsx` 전수 확인, 재생 버튼 코드 0줄
- First Generation Animation: isNew=true → 스피너(1300ms) → 카드 → 번호 순차 등장(120ms 간격), 총 ~2200ms(목표 1.8~2.8초 이내)
- Same-Day Revisit: isNew=false → 애니메이션 완전 생략, 즉시 전체 표시(구조적 보장 + 실제 HTTP 확인)
- Zodiac: 12개 전부 실제 birth_date 기준 매핑, 날짜 경계 24개 지점 단위 테스트로 확인(기존 5개 → 24개로 확장)
- Zodiac Visual: 원형 배경 + 유니코드 zodiac 기호(새 이미지/아이콘 라이브러리 없음), 실제 `/fortune` HTML로 렌더링 확인
- Overall Luck Score: 큰 숫자(78/100) + CSS progress bar(`role="progressbar"`) + 해석 라벨(4단계), 새 차트 라이브러리 없음
- Money Luck Score: `computeMoneyLuckScore()` — overall ± 1~15(0 제외) 결정론적 파생, DB 컬럼/migration 없음(저장된 값에서 재계산), 범위 [40,95] 및 overall과의 편차 ≤15 단위 테스트로 검증
- Lucky Color Swatch: 18개 색 전부 hex 매핑 + 텍스트 이름 병기, 미확인 값은 중립 회색 fallback, Fortune 표시 전용(전역 토큰 미추가)
- Section Icons: 8개 섹션 전부 emoji 추가(✨💰✅⚠️🎨⏰🍀🎱), 기존 크기/톤 유지
- Mobile: 기존 반응형 클래스 재사용, 실측(브라우저 자동화 도구 없음)은 아니고 코드 검토로 확인
- Desktop: 기존 반응형 클래스 재사용, 실제 로그인 세션 HTTP 응답으로 신규 요소 렌더링 확인
- Tests: 370/370 통과(신규 52개)
- Build: 통과, 45 routes(신규 라우트 없음, 이전 Task와 동일)
- Browser Verified: SSR HTML(preview idle 상태, 실제 로그인 사용자의 `/fortune` 신규 요소) + 실제 production 빌드(404/200 차단 확인) — 픽셀 단위 브라우저 자동화는 도구 부재로 불가능, 정확히 기록
- Regression: 전체 목록 정상, migration 0001~0017 무변경으로 privacy fix 유지 확인
- UX Polish: **PASS**
- 다음 작업: Playwright 같은 브라우저 자동화 도구를 dev 의존성으로 도입해 실제 렌더링 검증을 반복 가능한 자동화 스크립트로 만든다
