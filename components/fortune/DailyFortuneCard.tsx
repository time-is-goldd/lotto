"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import Button from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import { getColorSwatch } from "@/lib/data/fortune/colorSwatches";
import { luckScoreLabel } from "@/lib/data/fortune/tiers";
import { getZodiacSymbol } from "@/lib/data/fortune/zodiacSymbols";

import { buildShareText } from "./dailyFortuneShareLogic";
import { shouldAnimateReveal } from "./dailyFortuneRevealLogic";

export interface DailyFortuneCardProps {
  resultDate: string;
  zodiacSign: string | null;
  overallFortune: string;
  luckScore: number;
  moneyLuck: string | null;
  moneyLuckScore: number;
  actionGuide: string | null;
  thingsToAvoid: string | null;
  luckyColor: string | null;
  luckyTime: string | null;
  luckyNumbers: number[];
  recommendedNumbers: number[];
  // 오늘 처음 생성된 결과인지 여부(app/api/fortune/today, lib/api/fortune.ts의 isNew) —
  // true일 때만 짧은 reveal 연출을 보여준다(§20). 새로고침/재방문(isNew=false)에는 연출 없이
  // 바로 보여준다 — 매번 다른 결과가 나오는 것처럼 오해하지 않도록.
  isNew: boolean;
  // Daily Fortune UX Polish Task §1: /dev/fortune-preview가 "언제 reveal이 완전히 끝났는지"
  // 알아야 "애니메이션 다시 보기" 버튼을 그 시점에만 보여줄 수 있다. 실제 /fortune
  // (app/fortune/page.tsx)은 이 prop을 전달하지 않는다 — production 화면 동작에는 아무
  // 영향이 없다(선택적 콜백, 옵셔널 체이닝으로만 호출).
  onRevealComplete?: () => void;
}

// §20: 첫 확인 시 1~2초 정도의 짧은 reveal 연출. components/generate/NumberGenerator.tsx와
// 동일하게 prefers-reduced-motion을 존중하고, 하이드레이션 불일치를 피하기 위해 서버와
// 클라이언트 첫 렌더가 항상 같은 상태("연출 없이 보이는 상태")로 시작한 뒤 마운트 후에만
// 연출을 시작한다.
const REVEAL_DELAY_MS = 1300;
// UX_VISUAL_VERIFICATION Task: 번호가 "그냥 즉시 등장"하던 것을 NumberGenerator.tsx와 동일한
// per-index transitionDelay 기법으로 순차 등장시킨다(80~150ms 범위 안의 값).
const NUMBER_REVEAL_STEP_MS = 120;

type ShareStatus = "idle" | "copied" | "error";

function formatResultDateLabel(resultDate: string): string {
  // resultDate는 항상 lib/utils/kstDate.ts가 만든 "YYYY-MM-DD" 문자열이라 Date 파싱 없이
  // 문자열 그대로 잘라 쓴다 — Date로 파싱하면 로컬 타임존에 따라 하루 밀릴 수 있다.
  const [year, month, day] = resultDate.split("-");
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

export default function DailyFortuneCard({
  resultDate,
  zodiacSign,
  overallFortune,
  luckScore,
  moneyLuck,
  moneyLuckScore,
  actionGuide,
  thingsToAvoid,
  luckyColor,
  luckyTime,
  luckyNumbers,
  recommendedNumbers,
  isNew,
  onRevealComplete,
}: DailyFortuneCardProps) {
  // 기본값 true(연출 없이 즉시 보임) — 서버 렌더링과 첫 하이드레이션 렌더를 항상 동일하게
  // 유지한다(NumberGenerator.tsx와 동일한 이유). isNew가 아니거나 reduced-motion이면 이
  // 값들을 절대 false로 바꾸지 않는다.
  const [revealed, setRevealed] = useState(true);
  const [numbersRevealed, setNumbersRevealed] = useState(true);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UX_VISUAL_VERIFICATION Task에서 실제 브라우저 기준으로 발견한 버그: useEffect는 브라우저가
  // 이미 페인트한 뒤에 실행되므로, 기본값(revealed=true)으로 완성된 카드가 SSR에서부터 그대로
  // 내려와 화면에 한 프레임 그려진 뒤에야 스피너로 바뀌는 "깜빡임"이 실제로 발생했다.
  // useLayoutEffect는 DOM 커밋 직후·페인트 직전에 동기적으로 실행되므로 이 문제를 구조적으로
  // 막을 수 있다 — NumberGenerator.tsx의 "rAF로 한 박자 늦춰서 보여주는" 문제와는 정반대로,
  // 여기서는 "너무 늦게 숨기는" 문제라 반대 방향의 타이밍이 필요했다. setState를 이펙트
  // 본문에서 직접 부르지 않고 rAF 콜백으로 감싸는 것은 react-hooks/set-state-in-effect
  // 규칙(NumberGenerator.tsx가 이미 따르는 것과 동일한 관례)을 지키기 위함이다 — 아직
  // 페인트 전이므로 이 rAF는 여전히 같은 프레임 안에서 실행되어 깜빡임 방지 효과가 유지된다.
  //
  // 이 effect의 가드(shouldAnimateReveal)는 components/fortune/dailyFortuneRevealLogic.ts의
  // 순수 함수를 그대로 호출한다 — production 규칙(§3: isNew=true일 때만 애니메이션)이 실제로
  // 이 컴포넌트에서 쓰는 조건과 정확히 같음을 단위 테스트로 보장하기 위함이다.
  useLayoutEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!shouldAnimateReveal(isNew, mediaQuery.matches)) {
      return;
    }

    const rafId = requestAnimationFrame(() => {
      setRevealed(false);
      setNumbersRevealed(false);
    });

    timeoutRef.current = setTimeout(() => {
      setRevealed(true);
      // 카드가 먼저 나타난 뒤 번호가 순차로 등장해야 하므로, 번호 reveal은 이중 rAF로 한
      // 박자 늦춘다(components/generate/NumberGenerator.tsx와 동일한 이유 — 단일 rAF는
      // 브라우저가 시작 상태를 페인트하지 못하고 곧바로 끝 상태로 넘어갈 수 있다).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setNumbersRevealed(true));
      });
    }, REVEAL_DELAY_MS);

    return () => {
      cancelAnimationFrame(rafId);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isNew]);

  // onRevealComplete는 "카드+번호가 모두 실제로 보이는 상태가 된 시점"에 정확히 한 번만
  // 호출한다 — isNew=false(같은 날 재방문)나 reduced-motion처럼 애니메이션이 아예 재생되지
  // 않는 경우에도(둘 다 시작부터 revealed/numbersRevealed=true) 곧바로 호출된다. ref로
  // 중복 호출을 막는다(예: 리렌더로 effect가 다시 실행되어도 두 번 호출되지 않음).
  const hasFiredRevealCompleteRef = useRef(false);
  useEffect(() => {
    if (revealed && numbersRevealed && !hasFiredRevealCompleteRef.current) {
      hasFiredRevealCompleteRef.current = true;
      onRevealComplete?.();
    }
  }, [revealed, numbersRevealed, onRevealComplete]);

  async function handleShare() {
    const shareText = buildShareText(
      {
        overallFortune,
        luckyColor: luckyColor ?? "",
        luckyTime: luckyTime ?? "",
        luckyNumbers,
        recommendedNumbers,
      },
      window.location.origin + "/fortune"
    );

    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
      } catch {
        // 사용자가 공유 시트를 취소한 경우도 reject되므로 별도 에러 처리를 하지 않는다.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setShareStatus("copied");
    } catch {
      setShareStatus("error");
    }
  }

  if (!revealed) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Spinner />
        <p role="status" className="text-body text-text-secondary">
          오늘의 행운을 살펴보고 있어요 ✨
        </p>
      </div>
    );
  }

  const zodiacSymbol = getZodiacSymbol(zodiacSign);

  return (
    <div className="flex flex-col gap-6">
      <div>
        {/* claude-code-luck-platform-fortune-domain-followup-prompt.md §12: 결과가 나타나면
            결과 heading으로 focus를 이동해야 한다 — id+tabIndex를 항상 갖고 있으면 호출부
            (GuestFortuneForm.tsx/MemberFortuneReveal.tsx)가 조건 없이 document.getElementById로
            포커스만 옮기면 된다. tabIndex=-1은 마우스 클릭으로는 여전히 포커스되지 않고
            프로그램적 focus()만 허용한다. */}
        <h1 id="fortune-result-heading" tabIndex={-1} className="text-h1 font-bold text-text-primary">
          오늘의 행운
        </h1>
        <p className="mt-1 text-body text-text-secondary">{formatResultDateLabel(resultDate)}</p>
      </div>

      {/* §5/§6/§7/§8: 별자리 + 행운지수를 우측 상단의 작은 텍스트가 아니라 별도의 Hero
          영역으로 강조한다. 원형 배경 + 유니코드 zodiac 기호(새 이미지/아이콘 라이브러리
          없음), 큰 숫자 + progress bar + 해석 문구로 구성한다. */}
      <Card className="flex flex-col items-center gap-1 py-6 text-center">
        <div
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-h1 text-white"
        >
          {zodiacSymbol}
        </div>
        <p className="mt-2 text-h2 font-bold text-text-primary">{zodiacSign ?? "오늘의 운세"}</p>

        <div className="mt-4 flex flex-col items-center gap-1">
          <p className="text-caption text-text-secondary">오늘의 행운지수</p>
          <p className="text-display font-bold text-primary">
            {luckScore}
            <span className="text-body-lg font-normal text-text-secondary"> / 100</span>
          </p>
          <div
            role="progressbar"
            aria-valuenow={luckScore}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="오늘의 행운지수"
            className="mt-1 h-2 w-40 overflow-hidden rounded-full bg-border"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${luckScore}%` }} />
          </div>
          <p className="mt-1 text-caption text-text-secondary">{luckScoreLabel(luckScore)}</p>
        </div>
      </Card>

      <Card>
        <CardHeader>✨ 오늘의 총평</CardHeader>
        <CardContent>{overallFortune}</CardContent>
      </Card>

      <Card>
        <div className="flex items-baseline justify-between gap-2">
          <CardHeader>💰 금전운</CardHeader>
          <span className="text-body font-bold text-text-primary">
            {moneyLuckScore}
            <span className="text-caption font-normal text-text-secondary"> / 100</span>
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={moneyLuckScore}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="금전운 지수"
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border"
        >
          <div className="h-full rounded-full bg-accent-gold" style={{ width: `${moneyLuckScore}%` }} />
        </div>
        <CardContent>{moneyLuck}</CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>✅ 좋은 행동</CardHeader>
          <CardContent>{actionGuide}</CardContent>
        </Card>
        <Card>
          <CardHeader>⚠️ 피할 행동</CardHeader>
          <CardContent>{thingsToAvoid}</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>🎨 행운의 색</CardHeader>
          <CardContent className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-5 w-5 flex-shrink-0 rounded-full border border-border"
              style={{ backgroundColor: getColorSwatch(luckyColor) }}
            />
            {/* §16: 색상만으로 정보를 전달하지 않는다 — 텍스트 이름을 항상 함께 표시한다. */}
            <span>{luckyColor}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>⏰ 행운의 시간</CardHeader>
          <CardContent>{luckyTime}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>🍀 행운의 숫자</CardHeader>
        <CardContent>
          <ol aria-label="행운의 숫자" className="flex flex-wrap gap-3">
            {luckyNumbers.map((n, index) => (
              <li
                key={n}
                style={{ transitionDelay: `${index * NUMBER_REVEAL_STEP_MS}ms` }}
                className={`flex h-12 w-12 items-center justify-center rounded-full bg-accent-gold text-button font-bold text-text-primary transition-all duration-300 ease-out ${
                  numbersRevealed ? "scale-100 opacity-100" : "scale-50 opacity-0"
                }`}
              >
                {n}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>🎱 오늘의 추천 번호</CardHeader>
        <CardContent>
          <ol aria-label="오늘의 추천 번호" className="flex flex-wrap gap-3">
            {recommendedNumbers.map((n, index) => (
              <li
                key={n}
                style={{ transitionDelay: `${index * NUMBER_REVEAL_STEP_MS}ms` }}
                className={`flex h-12 w-12 items-center justify-center rounded-full bg-primary text-button font-bold text-white transition-all duration-300 ease-out ${
                  numbersRevealed ? "scale-100 opacity-100" : "scale-50 opacity-0"
                }`}
              >
                {n}
              </li>
            ))}
          </ol>
          {/* §13: 이 번호가 당첨 확률을 올려준다는 뜻이 아님을 명확히 한다. */}
          <p className="mt-3 text-caption text-text-secondary">
            오락·참고용으로 제공되는 오늘의 행운 번호입니다. 당첨 확률을 보장하지 않아요.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <p className="text-body text-text-secondary">내일 새로운 행운이 찾아와요.</p>
        <Button type="button" variant="secondary" onClick={handleShare}>
          공유하기
        </Button>
        {shareStatus === "copied" && (
          <p role="status" className="text-caption text-text-secondary">
            공유 문구를 복사했어요.
          </p>
        )}
        {shareStatus === "error" && (
          <p role="status" className="text-caption text-text-secondary">
            복사하지 못했어요. 다시 시도해주세요.
          </p>
        )}
      </div>
    </div>
  );
}
