"use client";

import { useState, type FormEvent } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import {
  isDrawFormFilled,
  validateDrawForm,
  type DrawFormValues,
  type DrawSubmitPayload,
} from "./drawFormValidation";

const EMPTY_VALUES: DrawFormValues = {
  round: "",
  numbers: ["", "", "", "", "", ""],
  bonusNumber: "",
  firstPrizeAmount: "",
  firstPrizeCount: "",
};

type Status = "idle" | "saving" | "success" | "error";

// 기존 API 응답(AdminDrawsResult, lib/api/admin/draws.ts)이 실제로 돌려주는 필드만 담는다 —
// winningNumbers/bonusNumber는 API 응답에 없으므로(판정 결과 요약만 반환) 클라이언트가
// 방금 제출한 값을 그대로 보여준다(서버를 다시 조회하지 않음, 지시문 §6).
interface SuccessResult extends DrawSubmitPayload {
  matchedCount: number;
  winnersCount: number;
  failedUpdateIds: number[];
}

// docs/PHASE9_DRAWS_ADMIN_UI_REPORT.md §4: 이 폼은 기존 POST /api/admin/draws(Phase6,
// 무수정)만 호출한다 — 새 Route/새 service 함수를 만들지 않는다. user_id/match_count/
// win_rank/checked_at/target_round 등은 이 폼이 전혀 다루지 않는다 — 그 값들은 서버
// (registerDrawAndMatchUserNumbers)가 전적으로 결정한다(지시문 §5).
export default function DrawRegistrationForm() {
  const [values, setValues] = useState<DrawFormValues>(EMPTY_VALUES);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<SuccessResult | null>(null);

  function updateNumber(index: number, value: string) {
    setValues((prev) => {
      const next = [...prev.numbers] as DrawFormValues["numbers"];
      next[index] = value;
      return { ...prev, numbers: next };
    });
  }

  // 오류가 나도 입력 내용을 지우지 않는다(Phase7-4 DreamJournalForm과 동일한 원칙) —
  // setValues를 오류 경로에서 호출하지 않으므로 입력값은 그대로 남는다.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "saving") {
      return;
    }

    let payload: DrawSubmitPayload;
    try {
      payload = validateDrawForm(values);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "입력값을 확인해주세요.");
      setStatus("error");
      return;
    }

    setStatus("saving");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/admin/draws", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        // 401/403/400/409/500 전부 이 프로젝트의 공통 {error:{code,message}} 컨벤션을
        // 따르고, 서버가 이미 사용자가 이해할 수 있는 한국어 메시지를 준다(예: 409는
        // "회차 N는 이미 등록되어 있습니다.") — 상태 코드별로 문구를 새로 짓지 않고
        // 그대로 표시한다(지시문 §4/§7 "기존 API 응답을 그대로 활용").
        setErrorMessage(body?.error?.message ?? "등록하지 못했어요. 다시 시도해주세요.");
        setStatus("error");
        return;
      }

      setResult({ ...payload, ...body.data });
      setStatus("success");
    } catch {
      setErrorMessage("등록하지 못했어요. 다시 시도해주세요.");
      setStatus("error");
    }
  }

  function handleReset() {
    setValues(EMPTY_VALUES);
    setResult(null);
    setStatus("idle");
    setErrorMessage(null);
  }

  if (status === "success" && result) {
    return (
      <div className="flex flex-col gap-4 rounded-card border border-border bg-bg-subtle p-4">
        <p className="text-body font-medium text-text-primary">
          {result.round}회차가 등록됐어요.
        </p>
        <dl className="grid grid-cols-1 gap-2 text-body text-text-primary sm:grid-cols-2">
          <div>
            <dt className="text-caption text-text-secondary">당첨번호</dt>
            <dd>{result.winningNumbers.join(", ")}</dd>
          </div>
          <div>
            <dt className="text-caption text-text-secondary">보너스 번호</dt>
            <dd>{result.bonusNumber}</dd>
          </div>
          <div>
            <dt className="text-caption text-text-secondary">대조한 번호 수</dt>
            <dd>{result.matchedCount}건</dd>
          </div>
          <div>
            <dt className="text-caption text-text-secondary">당첨자 수</dt>
            <dd>{result.winnersCount}명</dd>
          </div>
        </dl>
        {result.failedUpdateIds.length > 0 && (
          <p role="alert" className="text-caption text-text-secondary">
            일부 기록({result.failedUpdateIds.length}건)은 대조 처리에 실패했어요. 다음 회차
            등록 시 자동으로 재시도됩니다.
          </p>
        )}
        <Button type="button" variant="secondary" onClick={handleReset}>
          다른 회차 등록하기
        </Button>
      </div>
    );
  }

  const isValid = isDrawFormFilled(values);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Input
        id="round"
        label="회차"
        type="number"
        min={1}
        step={1}
        inputMode="numeric"
        value={values.round}
        onChange={(event) => setValues((prev) => ({ ...prev, round: event.target.value }))}
        placeholder="예: 1150"
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-body font-medium text-text-primary">당첨번호 6개</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {values.numbers.map((n, index) => (
            <Input
              key={index}
              id={`winning-number-${index + 1}`}
              label={`번호 ${index + 1}`}
              type="number"
              min={1}
              max={45}
              step={1}
              inputMode="numeric"
              value={n}
              onChange={(event) => updateNumber(index, event.target.value)}
            />
          ))}
        </div>
      </fieldset>

      <Input
        id="bonus-number"
        label="보너스 번호"
        type="number"
        min={1}
        max={45}
        step={1}
        inputMode="numeric"
        value={values.bonusNumber}
        onChange={(event) => setValues((prev) => ({ ...prev, bonusNumber: event.target.value }))}
      />

      <Input
        id="first-prize-amount"
        label="1등 당첨금"
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        value={values.firstPrizeAmount}
        onChange={(event) =>
          setValues((prev) => ({ ...prev, firstPrizeAmount: event.target.value }))
        }
        placeholder="원 단위"
      />

      <Input
        id="first-prize-count"
        label="1등 당첨자 수"
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        value={values.firstPrizeCount}
        onChange={(event) =>
          setValues((prev) => ({ ...prev, firstPrizeCount: event.target.value }))
        }
        placeholder="명"
      />

      {/* 색상이 아니라 문구+role="alert"로 오류를 전달한다(Phase7-4와 동일 원칙). */}
      {errorMessage && (
        <p role="alert" className="text-body text-danger">
          {errorMessage}
        </p>
      )}

      <Button type="submit" disabled={!isValid} loading={status === "saving"}>
        {status === "saving" ? "등록 중..." : "등록하기"}
      </Button>
    </form>
  );
}
