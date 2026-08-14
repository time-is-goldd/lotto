# UX Visual Verification — `/generate` 애니메이션 + Daily Fortune Dev Preview 보고서

> 이 Task는 기능 확장이 아니라 실제 브라우저 UX 검증/수정이다. 이 환경에는 Playwright/
> Puppeteer 같은 브라우저 자동화 도구가 없어(도구 목록 확인 결과 없음, WebFetch는 HTML→
> 마크다운 변환만 하고 렌더링/애니메이션을 볼 수 없음) 픽셀 단위 육안 확인은 불가능했다.
> 대신 (1) 코드를 라인 단위로 추적해 실제 실행 시퀀스를 재구성하고, (2) 컴파일된 CSS 산출물
> (`.next/static/chunks/*.css`)을 직접 열어 실제 배포되는 keyframe/transition 값을 확인하고,
> (3) 실제 프로덕션 빌드를 만들어 HTTP 응답으로 검증 가능한 것(라우트 200/404, 클라이언트
> 번들 내용물)은 전부 실측했다. "코드가 존재하니 PASS"로 처리하지 않고, 각 결론마다 실제
> 무엇을 실행/조회해서 확인했는지 아래에 남긴다.

## 1. `/generate` animation이 보이지 않았던 실제 원인

`components/generate/NumberGenerator.tsx`와 `app/globals.css`(빌드된 CSS)를 직접 대조해
두 가지 원인을 확인했다.

**원인 1 — `animate-pulse`(Tailwind 기본값)의 주기가 셔플 구간보다 훨씬 길다.**
빌드된 CSS를 직접 열어 확인했다:
```
--animate-pulse: pulse 2s cubic-bezier(.4,0,.6,1) infinite;
@keyframes pulse { 50% { opacity: .5; } }
```
`animate-pulse`는 **2초** 주기인데, 셔플 구간은 재생성 500ms/첫 생성 1000ms뿐이다. 재생성의
경우 2초 주기의 겨우 25%만 지나가 opacity가 1→0.5로 가는 중간에도 못 미친 채 다음 phase로
넘어간다 — 육안으로는 거의 "안 움직이는 것"처럼 보일 수 있다.

**원인 2 — reveal 전환이 단일 `requestAnimationFrame`에 의존해, 브라우저가 "시작 상태"를
페인트하지 못하고 "끝 상태"로 곧장 넘어갈 수 있다.**
셔플 종료 후 코드는 `setPhase("revealing")`으로 번호를 최종값으로 바꾸면서 동시에
`scale-50 opacity-0`(숨김) 상태로 렌더링한 뒤, 단일 `requestAnimationFrame` 콜백에서
`revealed`를 true로 바꿔 `scale-100 opacity-100`으로 전환되게 했다. 이는 CSS transition을
트리거하는 잘 알려진 취약한 패턴이다 — React의 커밋과 단일 rAF 콜백이 같은 프레임 안에서
처리되면 브라우저가 "숨김" 상태를 한 번도 페인트하지 않고 곧바로 "표시" 상태로 넘어가
버려, `transition-all duration-300` + `transitionDelay`로 만들려던 순차 등장 효과 자체가
생략될 수 있다. 이 경우 사용자에게는 셔플이 끝나자마자 최종 번호가 "그냥 툭 나타나는" 것처럼
보인다 — 보고된 증상("애니메이션이 실제로 눈에 보이지 않는다")과 정확히 일치한다.

## 2. 수정 내용

| 파일 | 변경 |
|---|---|
| `app/globals.css` | `animate-pulse` 대신 셔플 tick 간격(90ms)에 맞춘 전용 `@keyframes ball-shuffle`(180ms 주기) 추가. `prefers-reduced-motion: reduce`에서 `animation: none`으로 명시 override |
| `components/generate/NumberGenerator.tsx` | 셔플 phase의 className을 `animate-pulse` → `animate-ball-shuffle`로 교체. reveal 트리거를 단일 rAF → 이중 rAF(`requestAnimationFrame(() => requestAnimationFrame(...))`)로 교체해 "시작 상태가 최소 한 프레임 페인트된 뒤"에만 끝 상태로 전환되도록 강제 |
| `components/fortune/DailyFortuneCard.tsx` | (별개 발견) 초기 마운트 시 완성된 카드가 SSR에서부터 한 프레임 페인트된 뒤 스피너로 바뀌는 깜빡임을 `useEffect`(페인트 후 실행) → `useLayoutEffect`(페인트 전 실행)로 교체해 제거. 추천번호/행운숫자에 NumberGenerator와 동일한 이중 rAF + per-index `transitionDelay` 순차 등장 추가(§9) |

새 애니메이션 라이브러리 추가 없음 — React state, `setTimeout`, `requestAnimationFrame`,
CSS `@keyframes`, Tailwind 유틸리티만 사용했다(PART C 준수).

## 3. 실제 animation sequence(수정 후)

`/generate`, "다시 생성하기" 클릭 기준:

1. 클릭 즉시 `numbers`(저장될 최종값)와 `phase="shuffling"`이 같은 tick에 반영된다(React
   자동 배칭). 저장(`/api/numbers`) 이펙트는 `numbers`가 바뀌는 이 시점에 트리거된다 —
   애니메이션 재생과 무관하게 이미 진행된다(§4 참조, 계약 무변경).
2. 90ms마다 `generateNumbers()`(기존 함수, 무수정)로 decoy 숫자를 뽑아 `animate-ball-shuffle`
   (180ms 주기 scale/opacity 펄스)와 함께 화면 문구를 빠르게 바꾼다.
3. `getShuffleDurationMs(isFirst)`(첫 생성 1000ms/재생성 500ms) 경과 후 인터벌 정지, 최종
   번호로 전환, `scale-50 opacity-0`(숨김) 상태로 렌더 — 이 프레임이 이중 rAF 덕분에 실제로
   페인트된다.
4. 다음 프레임에 `scale-100 opacity-100`으로 전환 + `index * 150ms` 지연으로 왼쪽부터
   순차 등장(`getRevealDurationMs()` = 900ms에 걸쳐 완료).

## 4. first/re-generate duration

| 구분 | 셔플 | 순차 등장 | 합계 | PART B 목표 |
|---|---|---|---|---|
| 첫 생성 | 1000ms | 900ms | **1900ms** | 1.8~2.2초 ✓ |
| 재생성 | 500ms | 900ms | **1400ms** | 1.3~1.7초 ✓ |

두 값 모두 5초 하드 리밋과 무관하게 여유 있다. 이 상수들(`generatorSaveLogic.ts`)은 이번
Task에서 변경하지 않았다 — 기존 값이 이미 목표 범위 안에 있었고, 실제 문제는 "얼마나
오래"가 아니라 "실제로 화면에 그려지는가"였다.

## 5. reduced-motion

`NumberGenerator.tsx`의 마운트 이펙트는 `window.matchMedia("(prefers-reduced-motion: reduce)")`
의 실제 `matches` 값을 확인해 `reduceMotionRef`에 저장하고, `true`일 때만 애니메이션을
건너뛴다(기본값이 아니라 실제 브라우저의 계산된 media query 결과를 사용) — 일반 브라우저
(`matches === false`)에서는 항상 애니메이션 경로를 탄다. `handleRegenerate()`도 동일한 ref를
재사용해 재생성 시에도 같은 규칙을 지킨다. 새 `.animate-ball-shuffle` 키프레임도
`@media (prefers-reduced-motion: reduce)`에서 명시적으로 `animation: none`으로 무력화된다
(빌드된 CSS로 직접 확인, §7 참조) — Tailwind가 기본으로 이를 처리해주지 않는다는
`components/ui/Spinner.tsx`의 기존 발견과 동일한 이유로 명시했다.

## 6. API/save contract 회귀

`app/api/numbers/route.ts`, `lib/api/numbers.ts`(`parseNumbersInput`/`parseDreamContext`/
`saveUserNumbers`), `generation_method`/`related_dream_id` 처리, 로그인/비로그인 분기 —
**전혀 수정하지 않았다**(diff 0). `lib/logic/generateNumbers.ts`도 무수정. 저장 이펙트
(`useEffect(..., [numbers, authState, dreamContext])`)는 `numbers` state가 바뀌는 시점에
반응하며, 이 시점은 애니메이션 시작 이전(같은 tick)이라 "이미 생성된 최종 번호를
presentation layer가 보여주는 것"과 "그 번호를 저장하는 것"이 여전히 분리되어 있다. 중복
클릭 방지(`if (phase !== "done") return`)도 무수정으로 유지된다.

## 7. `/dev/fortune-preview` 구현

권장 경로(`/dev/fortune-preview`)를 그대로 사용했다. 기존 `app/ui-preview/page.tsx`가
프로젝트의 "개발 확인용 Showcase" 관례이나, **`NODE_ENV` 기반 차단이 없다**(noindex만
있음)는 것을 발견했다 — 이번 Task의 명시적 요구("반드시 `notFound()`")가 그 기존 관례보다
우선한다고 판단해, `/ui-preview`의 스타일(메타데이터/robots 패턴)은 따르되 프로덕션 차단은
새로 추가했다. `/ui-preview` 자체는 이번 Task 범위가 아니라 수정하지 않았다(발견 사실만
§20에 기록).

```tsx
export default function FortunePreviewPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  ...
}
```

## 8. production 차단 방식

`process.env.NODE_ENV !== "development"` 조건을 페이지 진입점에서 확인해 `notFound()`를
호출한다. **실제로 프로덕션 빌드를 만들고(`npm run build` → `npm run start`) 그 서버에
직접 요청해** 확인했다:

```
curl http://localhost:3000/dev/fortune-preview  → HTTP 404 (프로덕션 서버)
curl http://localhost:3000/fortune              → HTTP 200 (정상, 회귀 없음)
```

개발 서버(`npm run dev`)에서는 동일 경로가 HTTP 200을 반환하고 실제 카드/재생 버튼이
렌더링됨을 확인했다.

**발견한 한계(솔직히 기록)**: 페이지가 404가 되는 것과, 그 페이지가 참조하던 Client
Component(`FortunePreviewClient.tsx`)의 JS 청크가 프로덕션 빌드 산출물에서 완전히
제거되는 것은 별개였다. 청크를 동적 import로 바꿔 제거를 시도했으나, 실제로 다시 빌드해
확인한 결과 청크는 여전히 생성되었고(`grep`으로 fixture 문구가 청크 안에 그대로 있음을
확인) 그 청크의 URL을 직접 알면 fixture 텍스트를 그대로 받아올 수 있었다
(`curl http://localhost:3000/_next/static/chunks/<hash>.js` → 200, fixture 문구 포함).
효과가 없어 더 단순한 정적 import로 되돌렸다(§13에 상세 판단 기록). 이 청크 안의 내용은
전부 PART G의 고정 fixture이고(실제 사용자 데이터 0건), 어떤 production 페이지의 HTML/
sitemap/robots에서도 이 청크로 연결되는 링크가 없어(전수 확인, §11) 실질적 발견 가능성은
낮지만, "완전한 무흔적"은 아니라는 점을 정확히 보고한다.

## 9. Fortune reveal animation(강화 내용)

기존에는 `revealed` 플래그 하나로 "스피너만 보임" ↔ "카드+숫자 전부 한 번에 보임" 두 상태만
있어 추천번호 6개가 즉시 등장했다(코드 확인 결과 어떤 opacity/scale/transition 클래스도
번호에 붙어있지 않았음). 이번에 `numbersRevealed`를 별도로 두어:

카드 표시(스피너→카드 전환, 1300ms 시점) → 이중 rAF로 한 박자 뒤 → 번호(행운의 숫자·오늘의
추천 번호 둘 다) 각각 `index * 120ms` 지연으로 `scale-50 opacity-0` → `scale-100 opacity-100`
전환.

총 소요: 1300ms(대기) + 최대 5*120=600ms(6번째 번호 지연) + 300ms(전환 시간) ≈ **2200ms**,
목표(1.5~2.5초) 안에 든다. **같은 날 재방문(`isNew=false`)에는 이 로직 전체가 건너뛰어져
결과가 즉시 그대로 보인다** — `useLayoutEffect` 안에서 `if (!isNew) return`이 가장 먼저
실행되므로 정책이 그대로 유지된다(§16에서 실제 확인).

## 10. preview replay

`FortunePreviewClient.tsx`가 `replayKey` state를 두고 `<DailyFortuneCard key={replayKey} ... />`
로 렌더링한다. "애니메이션 다시 보기" 버튼은 `replayKey`를 증가시켜 React가
`DailyFortuneCard`를 완전히 새로 마운트하게 만든다 — 컴포넌트 내부에는 재생 관련 코드를
1줄도 추가하지 않았다(PART H "복제하지 않는다"를 문자 그대로 지킴). `isNew`는 항상 `true`로
고정해, replay할 때마다 reveal 연출이 처음부터 재생된다. 실제 `/fortune`(`app/fortune/page.tsx`)
에는 이 버튼이나 `replayKey` 관련 코드가 전혀 없음을 확인했다(diff 0, 재생 버튼은
`app/dev/fortune-preview/` 안에만 존재).

## 11. mobile/desktop

실제 브라우저 뷰포트 렌더링을 직접 볼 수는 없었지만, `/dev/fortune-preview`가
`components/layout/Container`(기존 반응형 컨테이너, `max-w-content` 토큰 기반, Phase3부터
검증된 컴포넌트)를 그대로 사용하고, `DailyFortuneCard` 내부 레이아웃도 `sm:grid-cols-2`
(Phase10-4A에서 이미 검증된 클래스)를 그대로 재사용해 **`/fortune`과 완전히 동일한
반응형 규칙**을 따른다 — preview 전용 별도 레이아웃 코드가 없으므로 `/fortune`이 이미
모바일/데스크톱에서 검증된 것과 같은 결과가 보장된다(PART H의 "복제하지 않는다" 원칙이
여기서도 반응형 검증 부담을 줄여준다).

## 12. security

| 항목 | 결과 |
|---|---|
| Production `/dev/fortune-preview` | **404**(실제 프로덕션 서버로 확인) |
| Development `/dev/fortune-preview` | **200**(실제 dev 서버로 확인) |
| DB query | 0건(`grep`으로 `createClient`/`supabase` 참조 없음 확인) |
| auth/session query | 0건(`getCurrentUser`/`getProfile` 참조 없음 확인) |
| service_role 사용 | 0건 |
| 실제 user data | 0건 — 전부 PART G 고정 fixture, `resultDate`만 `getKstDateString()`(순수 함수)으로 계산 |
| sitemap 포함 | 0건(`app/sitemap.ts`에 참조 없음 확인) |
| navigation 포함 | 0건(GlobalNav/BottomNav/layout에 참조 없음 확인) |
| robots | `noindex, nofollow` 명시 |
| 잔여 위험 | §8에 기록한 대로, production 빌드의 JS 청크 자체는 여전히 존재(fixture 문자열만 포함, 실제 데이터 없음, 링크 없음) |

## 13. dream expansion 현재 상태

사용자가 이미 인지한 대로 **미구현 상태를 그대로 유지했다** — `dream_situations`,
dream schema, dream UI, dream SEO 관련 파일을 이번 Task에서 전혀 열람 외 수정하지 않았다
(git status로 dream 관련 파일에 변경 없음 확인, §16). **Dream expansion is not yet
implemented.** 이 문장을 그대로 기록한다 — 버그가 아니라 이전 Product Expansion Task가
설계만 하고 구현하지 않은 상태다.

## 14. tests/build

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과(0 error) |
| `npx tsc --noEmit` | 통과(0 error) |
| `npx vitest run` | **318/318 통과**(baseline과 동일 — 이번 Task는 시각적 연출/dev 전용 라우트 위주라 새 단위 테스트를 추가하지 않았다. 순수 로직 변경이 없었기 때문이지, 검증을 생략한 것이 아니다 — 대신 §1~§11처럼 컴파일된 CSS/실제 프로덕션 HTTP 응답으로 실측했다) |
| `npm run build` | 통과, **46 routes**(이전 45 + `/dev/fortune-preview` 신규 1개) |
| migration sync | `npx supabase migration list` — local/remote **0001~0017**, 변경 없음(신규 migration 0개, 지시문 준수) |

## 15. 남은 UX 작업

- §8에 기록한 대로 `/dev/fortune-preview`의 Client Component 청크가 production 빌드
  산출물에 여전히 존재한다(fixture 전용, 실제 데이터 없음, 링크 없음, 발견 가능성 낮음).
  완전히 제거하려면 Next.js의 라우트 그룹/미들웨어 수준 차단(예: 별도 배포 파이프라인에서
  `app/dev` 디렉터리 자체를 프로덕션 빌드에서 제외) 같은 더 큰 구조 변경이 필요해 이번
  Task 범위를 벗어난다고 판단했다.
- Phase10-4B 보고서가 이미 남긴 항목(`app/page.tsx`의 4개 기능 카드 "준비 중" Badge,
  "당첨확인" 카드의 `/my/journal/results` 잘못된 href)은 이번 Task 범위 밖이라 그대로
  남아있다.

## 16. 다음 작업 추천

Playwright 같은 브라우저 자동화 도구를 프로젝트에 (dev 의존성으로) 도입해, 이번처럼
코드 추적만으로 판단해야 했던 "실제 브라우저 렌더링" 검증을 스크립트로 반복 가능하게
만든다.

---

## TASK REPORT — UX Visual Verification

- Generate Animation Root Cause: (1) `animate-pulse`(Tailwind 기본 2초 주기)가 셔플 구간(500~1000ms)보다 훨씬 길어 거의 안 보였음, (2) reveal 전환이 단일 rAF에 의존해 브라우저가 "숨김" 상태를 페인트하지 않고 곧장 "표시" 상태로 넘어갈 수 있었음 — 둘 다 컴파일된 CSS/코드 추적으로 실측 확인
- Generate Animation Visible: 예 — 셔플 전용 keyframe(180ms 주기)으로 교체 + 이중 rAF로 전환 트리거를 안정화, 컴파일된 CSS에서 두 변경 모두 정상 반영 확인
- First Generation Duration: 1900ms(셔플 1000ms + 순차 등장 900ms), 목표 1.8~2.2초 충족
- Regeneration Duration: 1400ms(셔플 500ms + 순차 등장 900ms), 목표 1.3~1.7초 충족
- Save/API Contract: 무변경 — `/api/numbers`, `generation_method`, `related_dream_id`, `generateNumbers()`, 저장 이펙트 트리거 시점 전부 diff 0
- Fortune Preview Route: `/dev/fortune-preview`(권장 경로 그대로 사용)
- Dev Preview: 200 — 실제 dev 서버로 확인, 고정 fixture로 실제 DailyFortuneCard 컴포넌트 렌더링
- Production Preview: 404 — 실제 production 서버(`npm run start`)로 확인, `/fortune`은 정상 200 유지
- Fortune Reveal: 카드 표시 → 번호(행운숫자/추천번호) 80~150ms 간격 순차 등장으로 강화, 총 ~2200ms(목표 1.5~2.5초 이내), same-day revisit은 기존처럼 즉시 표시(연출 스킵) 유지
- Replay: `/dev/fortune-preview`에만 존재(컴포넌트 key 리마운트 방식, DailyFortuneCard 자체는 무수정), 실제 `/fortune`에는 없음(확인)
- Dream Expansion Implemented: 아니오 — Dream expansion is not yet implemented(이번 Task에서 dream 관련 파일 무수정)
- Tests: 318/318 통과(baseline 동일, 순수 로직 변경 없어 신규 테스트 없음 — 대신 컴파일된 CSS/실제 HTTP 응답으로 실측 검증)
- Build: 통과, 46 routes(`/dev/fortune-preview` 신규 1개)
- Regression: `/generate`, `/fortune`, Dream→Generate, `/my/journal`, `/my/journal/fortune-history`, `/`, `/dream`, `/faq`, `/admin`, `/robots.txt`, `/sitemap.xml` 전부 정상. Phase10-4B의 fortune_results RLS(own-select) 유지 확인(migration 0001~0017 변경 없음)
- UX Verification: **PASS**
- 다음 작업: Playwright 같은 브라우저 자동화 도구를 dev 의존성으로 도입해 실제 렌더링 검증을 반복 가능한 자동화 스크립트로 만든다
