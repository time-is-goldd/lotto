"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";

type Status =
  | "official"
  | "official-round-not-found"
  | "official-parse-failure"
  | "fallback-consensus"
  | "fallback-disabled"
  | "source-disagreement"
  | "single-secondary-success"
  | "all-sources-unavailable"
  | "secondary-round-not-found"
  | "prize-info-unavailable";

interface HealthResult {
  round: number;
  result: {
    status: Status;
    message: string;
    provenance: { mode: "official" } | { mode: "secondary-consensus"; sources: string[] } | null;
  };
}

// 지시문 §21/§22: 지나치게 복잡한 monitoring dashboard를 만들지 않는다 — 상태 라벨 + 메시지
// 한 줄 정도의 단순한 표시로 충분하다. DB mutation이 전혀 없는 순수 조회 버튼이다(지시문
// §23) — POST /api/admin/draws/source-health만 호출하고, 그 아래 서비스는
// registerDrawAndMatchUserNumbers를 아예 import하지 않아 구조적으로 쓰기가 불가능하다.
const STATUS_LABELS: Record<Status, string> = {
  official: "공식 소스 정상",
  "official-round-not-found": "공식 소스 정상(아직 새 회차 없음)",
  "official-parse-failure": "공식 소스 응답 이상(파싱 실패)",
  "fallback-consensus": "공식 소스 접근 불가 — 보조 출처 2곳 일치",
  "fallback-disabled": "공식 소스 접근 불가 — 보조 출처 일치하지만 자동 등록 꺼짐",
  "source-disagreement": "공식 소스 접근 불가 — 보조 출처 불일치",
  "single-secondary-success": "공식 소스 접근 불가 — 보조 출처 한 곳만 성공",
  "all-sources-unavailable": "모든 출처 접근 불가",
  "secondary-round-not-found": "공식 소스 접근 불가 — 보조 출처로 확인 결과 아직 새 회차 없음",
  "prize-info-unavailable": "보조 출처 일치했으나 당첨금 정보 확인 불가",
};

export default function LottoSourceHealthButton() {
  const [status, setStatus] = useState<"idle" | "checking" | "error">("idle");
  const [result, setResult] = useState<HealthResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCheck() {
    if (status === "checking") {
      return;
    }
    setStatus("checking");
    setErrorMessage(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/draws/source-health", { method: "POST" });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setErrorMessage(body?.error?.message ?? "출처 상태를 확인하지 못했어요.");
        setStatus("error");
        return;
      }

      setResult(body.data as HealthResult);
      setStatus("idle");
    } catch {
      setErrorMessage("출처 상태를 확인하지 못했어요.");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-bg-subtle p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold text-text-primary">출처 상태 확인</p>
          <p className="text-caption text-text-secondary">
            DB를 변경하지 않고 공식/보조 출처 접근 가능 여부만 확인합니다.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          loading={status === "checking"}
          onClick={handleCheck}
        >
          {status === "checking" ? "확인 중..." : "출처 상태 확인"}
        </Button>
      </div>

      {result && (
        <div role="status" className="text-caption text-text-primary">
          <p className="font-bold">
            {result.round}회 — {STATUS_LABELS[result.result.status]}
          </p>
          <p className="text-text-secondary">{result.result.message}</p>
        </div>
      )}
      {errorMessage && (
        <p role="alert" className="text-caption text-danger">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
