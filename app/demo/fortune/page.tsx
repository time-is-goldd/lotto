import type { Metadata } from "next";
import Link from "next/link";

import DailyFortuneCard from "@/components/fortune/DailyFortuneCard";
import { buttonClassName } from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { DEMO_FORTUNE_RESULT } from "@/lib/demo/fixtures";

export const metadata: Metadata = { title: "데모 · 오늘의 행운" };

type FortuneDemoState = "ready" | "revealing" | "result" | "repeat";

interface DemoFortunePageProps {
  searchParams: Promise<{ state?: string }>;
}

function isValidState(value: string | undefined): value is FortuneDemoState {
  return value === "ready" || value === "revealing" || value === "result" || value === "repeat";
}

// claude-code-luck-platform-daily-fortune-number-demo-prompt.md §20/§21: 실제
// components/fortune/MemberFortuneReveal.tsx는 클릭으로만 상태가 바뀌는 Client Component라
// 데모가 요구하는 "URL만으로 각 상태를 바로 재현"(§21)과는 다른 상호작용 모델이다 — 그래도
// 실제 결과 카드(DailyFortuneCard)는 그대로 재사용해 "같은 UI 컴포넌트를 재사용한다"(§19)는
// 원칙을 지킨다. 상태 전환 자체는 서버 렌더링 Link(`?state=`)만으로 충분해 별도 Client
// Component/JS 상태 관리를 새로 만들지 않는다 — 모바일에서도 그대로 동작한다(§21).
export default async function DemoFortunePage({ searchParams }: DemoFortunePageProps) {
  const { state: rawState } = await searchParams;
  const state: FortuneDemoState = isValidState(rawState) ? rawState : "ready";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h1 font-bold text-text-primary">데모 · 오늘의 행운</h1>
        <p className="mt-2 text-body text-text-secondary">
          실제 화면(<code>/fortune</code>)이 로그인 회원에게 보여주는 4가지 상태를 그대로
          재현합니다.
        </p>
      </div>

      <nav aria-label="데모 상태 전환" className="flex flex-wrap gap-2">
        {(
          [
            ["ready", "보기 전 (ready)"],
            ["revealing", "공개 중 (revealing)"],
            ["result", "결과 (result)"],
            ["repeat", "같은 날 재확인 (repeat result)"],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={`/demo/fortune?state=${value}`}
            className={buttonClassName(state === value ? "primary" : "secondary", "sm")}
          >
            {label}
          </Link>
        ))}
      </nav>

      {state === "ready" && (
        <div className="flex flex-col items-center gap-6 py-16 text-center">
          <div>
            <h2 className="text-h2 font-bold text-text-primary">오늘의 행운</h2>
            <p className="mt-2 text-body text-text-secondary">
              저장된 생년월일을 바탕으로 오늘의 행운을 준비했어요.
            </p>
          </div>
          <Link href="/demo/fortune?state=revealing" className={buttonClassName("primary", "lg")}>
            오늘의 맞춤 운세 보기
          </Link>
        </div>
      )}

      {state === "revealing" && (
        <div className="flex flex-col items-center gap-6 py-16 text-center">
          <Spinner />
          <p role="status" className="text-body text-text-secondary">
            오늘의 행운 카드를 준비하고 있어요
          </p>
        </div>
      )}

      {(state === "result" || state === "repeat") && (
        <div className="flex flex-col gap-4">
          {state === "repeat" && (
            <p className="text-center text-caption text-text-secondary">
              오늘 이미 확인한 운세예요. 내일 새 운세를 만들 수 있어요.
            </p>
          )}
          <DailyFortuneCard
            resultDate={DEMO_FORTUNE_RESULT.resultDate}
            zodiacSign={DEMO_FORTUNE_RESULT.zodiacSign}
            overallFortune={DEMO_FORTUNE_RESULT.overallFortune}
            luckScore={DEMO_FORTUNE_RESULT.luckScore}
            moneyLuck={DEMO_FORTUNE_RESULT.moneyLuck}
            moneyLuckScore={DEMO_FORTUNE_RESULT.moneyLuckScore}
            actionGuide={DEMO_FORTUNE_RESULT.actionGuide}
            thingsToAvoid={DEMO_FORTUNE_RESULT.thingsToAvoid}
            luckyColor={DEMO_FORTUNE_RESULT.luckyColor}
            luckyTime={DEMO_FORTUNE_RESULT.luckyTime}
            luckyNumbers={DEMO_FORTUNE_RESULT.luckyNumbers}
            recommendedNumbers={DEMO_FORTUNE_RESULT.recommendedNumbers}
            isNew={false}
          />
        </div>
      )}
    </div>
  );
}
