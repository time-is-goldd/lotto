"use client";

import { useState } from "react";

import DailyFortuneCard from "@/components/fortune/DailyFortuneCard";
import Button from "@/components/ui/Button";
import { getKstDateString } from "@/lib/utils/kstDate";

import { nextReplayKey, reducePreviewPhase } from "./fortunePreviewLogic";

// PART G 고정 fixture — 실제 DB(fortune_results)를 조회하지 않고, 실제 사람의 birth_date/
// user_id/profile도 쓰지 않는다. resultDate만 lib/utils/kstDate.ts(순수 함수, DB/auth 호출
// 아님)로 "오늘" 날짜를 계산해 실제 화면과 더 가깝게 보여준다 — 그 외 전부 고정 값이다.
// moneyLuckScore는 실제 production처럼 engine에서 파생되는 값이라, 시각 검수가 쉽도록
// overallFortune의 luckScore(78)와 크게 다르지 않은 값(74)을 골랐다(UX Polish Task §19 —
// production result type과 동일한 shape를 그대로 쓴다, 별도 preview 전용 모델 없음).
const FIXTURE = {
  zodiacSign: "쌍둥이자리",
  overallFortune: "전반적으로 마음이 가벼워지는 하루가 될 거예요.",
  luckScore: 78,
  moneyLuck: "작은 기회를 놓치지 않는 것이 좋은 날이에요.",
  moneyLuckScore: 74,
  actionGuide: "미뤄두었던 일을 하나 끝내보세요.",
  thingsToAvoid: "충동적인 소비는 한 번 더 생각해보세요.",
  luckyColor: "네이비",
  luckyTime: "오후 3시~5시",
  luckyNumbers: [7, 21],
  recommendedNumbers: [4, 7, 16, 21, 32, 41],
};

// UX Polish Task §1/§2: 이전에는 DailyFortuneCard가 마운트 즉시 자체 reveal을 시작해버려
// 운영자가 화면을 보기 전에 애니메이션이 이미 끝나 있었고, "다시 보기"를 눌러도 반응이
// 없는 것처럼 보였다. 이제 명시적으로 "애니메이션 시작"을 누르기 전까지 DailyFortuneCard
// 자체를 마운트하지 않는다 — idle 상태에는 카드가 DOM에 존재조차 하지 않는다.
//
// app/fortune의 실제 결과/reveal Client Component(components/fortune/DailyFortuneCard.tsx)를
// 그대로 재사용한다 — 복제하지 않는다(PART H/§20). "애니메이션 시작"/"다시 보기"는
// DailyFortuneCard 내부에 넣지 않고, 이 wrapper가 key를 바꿔 컴포넌트를 통째로
// 재마운트시키는 방식으로만 구현한다 — DailyFortuneCard 자체는 실제 /fortune과 완전히
// 동일한 코드 그대로 유지되고, 실제 /fortune에는 이 버튼들이 존재하지 않는다.
export default function FortunePreviewClient() {
  const [resultDate] = useState(() => getKstDateString());
  const [replayKey, setReplayKey] = useState(0);
  const [phase, setPhase] = useState<"idle" | "revealing" | "done">("idle");

  function handleStart() {
    setPhase(reducePreviewPhase(phase, "start"));
  }

  function handleReplay() {
    setReplayKey((key) => nextReplayKey(key));
    setPhase(reducePreviewPhase(phase, "replay"));
  }

  function handleRevealComplete() {
    setPhase((current) => reducePreviewPhase(current, "complete"));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-card border border-dashed border-border bg-bg-subtle p-4 text-caption text-text-secondary">
        <p className="font-bold text-text-primary">Development Preview</p>
        <p className="mt-1">
          고정 fixture 데이터입니다. 실제 로그인 사용자·DB 데이터를 전혀 사용하지 않습니다.
          production에서는 이 페이지 자체가 404입니다.
        </p>
      </div>

      {phase === "idle" && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-h2 font-bold text-text-primary">오늘의 행운 미리보기</p>
          <p className="text-body text-text-secondary">
            버튼을 누르면 실제 /fortune과 동일한 reveal 연출이 재생됩니다.
          </p>
          <Button type="button" onClick={handleStart}>
            애니메이션 시작
          </Button>
        </div>
      )}

      {phase !== "idle" && (
        <>
          <DailyFortuneCard
            key={replayKey}
            resultDate={resultDate}
            isNew
            onRevealComplete={handleRevealComplete}
            {...FIXTURE}
          />
          {phase === "done" && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleReplay}
              className="self-center"
            >
              애니메이션 다시 보기
            </Button>
          )}
        </>
      )}
    </div>
  );
}
