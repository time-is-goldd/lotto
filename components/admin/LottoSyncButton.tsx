"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/ui/Button";

type Status = "idle" | "syncing" | "error";

interface SyncResult {
  status: "synced" | "up-to-date" | "conflict" | "source-unavailable";
  syncedRounds: number[];
  conflictRound: number | null;
  message: string;
}

// 지시문 §21 "Admin Manual Sync" — Cron이 실패했거나 운영자가 즉시 확인하고 싶을 때 쓰는
// 안전한 fallback이다. POST /api/admin/draws/sync만 호출한다 — 이 컴포넌트는 회차 판단/
// 충돌 감지 로직을 전혀 갖지 않는다(서버의 syncOfficialLottoDraws()가 유일한 진실 소스,
// Cron과 완전히 동일한 함수).
export default function LottoSyncButton() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSync() {
    if (status === "syncing") {
      return;
    }
    setStatus("syncing");
    setErrorMessage(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/draws/sync", { method: "POST" });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setErrorMessage(body?.error?.message ?? "동기화하지 못했어요. 다시 시도해주세요.");
        setStatus("error");
        return;
      }

      setResult(body.data as SyncResult);
      setStatus("idle");
      // 새로 등록된 회차가 있으면 이 페이지 자체는 회차 목록을 보여주지 않지만, 다른 관리자
      // 화면(예: 향후 만들 회차 목록)이 최신 데이터를 보도록 router.refresh()로 서버
      // 컴포넌트 캐시를 갱신한다 — 기존 DrawRegistrationForm 제출 흐름과 동일한 관례다.
      router.refresh();
    } catch {
      setErrorMessage("동기화하지 못했어요. 다시 시도해주세요.");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-bg-subtle p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold text-text-primary">공식 당첨번호 동기화</p>
          <p className="text-caption text-text-secondary">
            동행복권 공식 데이터에서 새 회차를 가져와 등록합니다. 매주 자동으로도 실행돼요 — 자동
            동기화가 실패했거나 즉시 확인하고 싶을 때만 눌러주세요.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={status === "syncing"}
          onClick={handleSync}
        >
          {status === "syncing" ? "동기화 중..." : "지금 동기화"}
        </Button>
      </div>

      {result && (
        <p role="status" className="text-caption text-text-primary">
          {result.message}
        </p>
      )}
      {errorMessage && (
        <p role="alert" className="text-caption text-danger">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
