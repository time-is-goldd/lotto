"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import DailyFortuneCard, { type DailyFortuneCardProps } from "@/components/fortune/DailyFortuneCard";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { trackProductEvent } from "@/lib/analytics/trackProductEvent";

type MemberFortuneRevealProps = Omit<DailyFortuneCardProps, "isNew" | "onRevealComplete"> & {
  // app/fortune/page.tsx가 lib/api/fortune.ts(getOrCreateTodayFortune)에서 이미 계산해 내려주는
  // 값 — 오늘 처음 생성된 결과인지(true) 이미 있던 결과를 재조회한 것인지(false)를 그대로
  // 재사용한다. 이 컴포넌트 자신의 reveal 애니메이션 길이(§13: 첫 확인 1.2~1.8초, 재확인
  // 0.6~1.0초)와 버튼 문구를 여기서 분기하는 데 쓴다 — DailyFortuneCard에는 항상 isNew=false로
  // 넘겨 그쪽 내부 reveal 로직과 이중으로 겹치지 않게 한다.
  isNew: boolean;
};

type Stage = "ready" | "revealing" | "result";

const FRESH_REVEAL_DELAY_MS = 1500; // §12: 첫 공개 1.2~1.8초
const REPEAT_REVEAL_DELAY_MS = 800; // §13: 재확인 0.6~1.0초, 반복 방문을 방해하지 않는다
const REDUCED_MOTION_DELAY_MS = 50; // 정보 구조(클릭→결과)는 유지하되 대기 시간만 없앤다

// claude-code-luck-platform-fortune-domain-followup-prompt.md §10/§11: 로그인 사용자가
// /fortune에 들어오면 프로필이 완성돼 있어도 결과가 즉시 노출되면 안 된다 — 이 컴포넌트가
// "ready"(버튼만 보임) 상태로 항상 시작해, 실제 클릭이 있어야만 "revealing"을 거쳐
// "result"로 넘어간다. app/fortune/page.tsx는 이미 서버에서 오늘의 결과를 확정해 놨으므로
// (idempotent) 여기서는 새 네트워크 요청 없이 순수하게 "언제 보여줄지"만 관리한다.
export default function MemberFortuneReveal({ isNew, ...cardProps }: MemberFortuneRevealProps) {
  const [stage, setStage] = useState<Stage>("ready");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // components/generate/NumberGenerator.tsx와 동일한 패턴 — ref는 react-hooks/set-state-in-effect
  // 대상이 아니고, 렌더링에 쓰이지 않고 handleReveal 안에서 한 번 읽기만 하면 된다.
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (stage !== "result") {
      return;
    }
    document.getElementById("fortune-result-heading")?.focus();
  }, [stage]);

  function handleReveal() {
    if (stage !== "ready") {
      return; // 중복 클릭 방지 — 버튼도 disabled로 막지만 한 번 더 확인한다.
    }
    setStage("revealing");
    // claude-code-luck-platform-daily-fortune-number-demo-prompt.md §6: "결과를 다시 보는
    // 행위를 신규 생성으로 집계하지 않는다" — isNew(오늘 이미 DB row가 있었는지)로
    // generation/reopen 이벤트 자체를 분기한다(is_repeat_view 같은 부가 속성이 아니라 이벤트
    // 이름 자체가 구분되어야 집계 쿼리가 단순해진다).
    trackProductEvent(
      isNew ? "fortune_generation_started" : "fortune_result_reopened",
      { auth_state: "member" }
    );

    const delay = reducedMotionRef.current
      ? REDUCED_MOTION_DELAY_MS
      : isNew
        ? FRESH_REVEAL_DELAY_MS
        : REPEAT_REVEAL_DELAY_MS;

    timeoutRef.current = setTimeout(() => {
      setStage("result");
      if (isNew) {
        trackProductEvent("fortune_generated", { auth_state: "member" });
      }
    }, delay);
  }

  if (stage === "result") {
    return <DailyFortuneCard {...cardProps} isNew={false} />;
  }

  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      {stage === "revealing" ? (
        <>
          <Spinner />
          <p role="status" aria-live="polite" className="text-body text-text-secondary">
            오늘의 행운 카드를 준비하고 있어요
          </p>
        </>
      ) : (
        <>
          <div>
            <h1 className="text-h1 font-bold text-text-primary">오늘의 행운</h1>
            <p className="mt-2 text-body text-text-secondary">
              {isNew
                ? "저장된 생년월일을 바탕으로 오늘의 행운을 준비했어요."
                : "오늘의 운세는 이미 정해졌어요. 같은 결과를 다시 볼 수 있어요."}
            </p>
          </div>
          <Button type="button" variant="primary" size="lg" onClick={handleReveal}>
            {isNew ? "오늘의 맞춤 운세 보기" : "오늘의 운세 다시 보기"}
          </Button>
          <Link href="/my/account" className="text-caption text-text-secondary underline">
            내 정보 수정
          </Link>
        </>
      )}
    </div>
  );
}
