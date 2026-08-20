import type { Metadata } from "next";
import Link from "next/link";

import { buttonClassName } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import {
  DEMO_DREAM_JOURNAL_ENTRIES,
  DEMO_FORTUNE_RESULT,
  DEMO_JOURNAL_USER_NUMBERS,
} from "@/lib/demo/fixtures";

export const metadata: Metadata = { title: "데모 · 행운 다이어리" };

type JournalDemoState = "empty" | "populated";

interface DemoJournalPageProps {
  searchParams: Promise<{ state?: string }>;
}

function isValidState(value: string | undefined): value is JournalDemoState {
  return value === "empty" || value === "populated";
}

// app/my/journal/page.tsx와 같은 섹션 구조(번호/꿈/운세 3분할, 같은 className)를 그대로
// 옮겨왔다 — 그 페이지 자체를 import하지 않은 이유는 getCurrentUser()/getProfile()로 시작하는
// Server Component라 인증 우회 없이는 재사용할 수 없기 때문이다(§18 "실제 /my/* route의 auth
// guard에 예외 조건을 추가하지 않는다"). 대신 실제 UI 원형(EmptyState, Card 스타일 클래스)은
// 그대로 재사용해 시각적으로는 실제 화면과 동일하게 유지한다(§19).
export default async function DemoJournalPage({ searchParams }: DemoJournalPageProps) {
  const { state: rawState } = await searchParams;
  const state: JournalDemoState = isValidState(rawState) ? rawState : "populated";

  const numbers = state === "populated" ? DEMO_JOURNAL_USER_NUMBERS : [];
  const dreams = state === "populated" ? DEMO_DREAM_JOURNAL_ENTRIES : [];
  const hasFortune = state === "populated";

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-h1 font-bold text-text-primary">데모 · 행운 다이어리</h1>
        <p className="mt-2 text-body text-text-secondary">
          번호·꿈·운세 기록을 모아서 보여드려요.
        </p>
      </div>

      <nav aria-label="데모 상태 전환" className="flex flex-wrap gap-2">
        {(
          [
            ["empty", "빈 기록"],
            ["populated", "기록 있음"],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={`/demo/journal?state=${value}`}
            className={buttonClassName(state === value ? "primary" : "secondary", "sm")}
          >
            {label}
          </Link>
        ))}
      </nav>

      <section aria-labelledby="demo-numbers-heading" className="flex flex-col gap-3">
        <h2 id="demo-numbers-heading" className="text-h2 font-bold text-text-primary">
          번호 기록
        </h2>
        {numbers.length === 0 ? (
          <EmptyState
            title="아직 생성한 번호가 없어요"
            description="번호를 생성하면 여기에 자동으로 기록돼요."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {numbers.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-card bg-bg-subtle p-4 text-body text-text-primary shadow-card"
              >
                <span>{entry.numbers.join(", ")}</span>
                <span className="text-caption text-text-secondary">
                  {entry.generation_method === "dream" ? "꿈 연동" : "무작위"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {/* §20 "번호 저장 CTA와 상세 카드" — 데모에서는 실제 저장을 호출하지 않고 화면
            상태만 보여준다(§18 "데모의 버튼은 화면 상태만 바꾸거나 비활성화하고 DB에 쓰지
            않는다"). */}
        <div className="rounded-card border border-border p-4 text-center">
          <p className="text-body font-bold text-text-primary">이 번호를 저장해둘까요?</p>
          <p className="mt-1 text-caption text-text-secondary">
            (데모 화면 — 실제로는 로그인 시 자동 저장됩니다)
          </p>
        </div>
      </section>

      <section aria-labelledby="demo-dreams-heading" className="flex flex-col gap-3">
        <h2 id="demo-dreams-heading" className="text-h2 font-bold text-text-primary">
          꿈 기록
        </h2>
        {dreams.length === 0 ? (
          <EmptyState title="아직 기록한 꿈이 없어요" description="꿈을 기록하면 여기에 모여요." />
        ) : (
          <ul className="flex flex-col gap-2">
            {dreams.map((entry) => (
              <li
                key={entry.id}
                className="line-clamp-2 rounded-card bg-bg-subtle p-4 text-body text-text-primary shadow-card"
              >
                {entry.dream_text}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="demo-fortune-heading" className="flex flex-col gap-3">
        <h2 id="demo-fortune-heading" className="text-h2 font-bold text-text-primary">
          운세 기록
        </h2>
        {!hasFortune ? (
          <EmptyState title="아직 운세 기록이 없어요" description="오늘의 행운을 확인하면 여기에 모여요." />
        ) : (
          <div className="rounded-card bg-bg-subtle p-4 text-body text-text-primary shadow-card">
            {DEMO_FORTUNE_RESULT.resultDate} · {DEMO_FORTUNE_RESULT.zodiacSign} ·{" "}
            {DEMO_FORTUNE_RESULT.overallFortune}
          </div>
        )}
      </section>
    </div>
  );
}
