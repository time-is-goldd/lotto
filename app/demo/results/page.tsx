import type { Metadata } from "next";
import Link from "next/link";

import WinningResultCard from "@/components/journal/WinningResultCard";
import { buttonClassName } from "@/components/ui/Button";
import {
  DEMO_DRAW,
  DEMO_USER_NUMBERS_NO_MATCH,
  DEMO_USER_NUMBERS_PARTIAL_MATCH,
  DEMO_USER_NUMBERS_WAITING,
} from "@/lib/demo/fixtures";

export const metadata: Metadata = { title: "데모 · 당첨확인" };

type ResultsDemoState = "waiting" | "no-match" | "partial-match";

interface DemoResultsPageProps {
  searchParams: Promise<{ state?: string }>;
}

function isValidState(value: string | undefined): value is ResultsDemoState {
  return value === "waiting" || value === "no-match" || value === "partial-match";
}

// components/journal/WinningResultCard.tsx를 그대로 재사용한다(§19) — 실제 /my/journal/results
// 페이지와 정확히 같은 컴포넌트라, 그 컴포넌트가 바뀌면 이 데모도 자동으로 함께 바뀐다.
export default async function DemoResultsPage({ searchParams }: DemoResultsPageProps) {
  const { state: rawState } = await searchParams;
  const state: ResultsDemoState = isValidState(rawState) ? rawState : "waiting";

  const entry =
    state === "waiting"
      ? DEMO_USER_NUMBERS_WAITING
      : state === "no-match"
        ? DEMO_USER_NUMBERS_NO_MATCH
        : DEMO_USER_NUMBERS_PARTIAL_MATCH;
  const draw = state === "waiting" ? null : DEMO_DRAW;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h1 font-bold text-text-primary">데모 · 당첨확인</h1>
        <p className="mt-2 text-body text-text-secondary">
          실제 화면(<code>/my/journal/results</code>)이 저장 번호 상태별로 보여주는 카드를
          그대로 재현합니다. 데이터 출처는 <code>{DEMO_DRAW.source}</code>, 기준 시각은
          제{DEMO_DRAW.round}회 등록 시각입니다(둘 다 예시 값).
        </p>
      </div>

      <nav aria-label="데모 상태 전환" className="flex flex-wrap gap-2">
        {(
          [
            ["waiting", "추첨 전 대기"],
            ["no-match", "일치 없음"],
            ["partial-match", "일부 숫자 일치"],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={`/demo/results?state=${value}`}
            className={buttonClassName(state === value ? "primary" : "secondary", "sm")}
          >
            {label}
          </Link>
        ))}
      </nav>

      <WinningResultCard entry={entry} draw={draw} />
    </div>
  );
}
