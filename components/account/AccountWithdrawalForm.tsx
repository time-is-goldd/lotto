"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/ui/Button";

// LogoutButton.tsx(components/auth/)와 동일한 이유로 Client Component다 — 체크박스
// 상호작용 + fetch + 이동이 필요하다. 실수 방지 2단계(지시문 §6): 설명 텍스트는 항상
// 보이고, "삭제되는 내용을 확인했습니다" 체크 전에는 회원탈퇴 버튼이 비활성 상태다.
// 5단계 이상 복잡한 flow나 dark pattern(숨기기, 재입력 요구 등)을 추가하지 않는다.
type SubmitState = { status: "idle" | "submitting" } | { status: "error"; message: string };

export default function AccountWithdrawalForm() {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  async function handleWithdraw() {
    setState({ status: "submitting" });

    try {
      const response = await fetch("/api/account", { method: "DELETE" });

      if (response.ok) {
        // Header가 Root Layout의 Server Component라 push()만으로는 로그아웃 상태가
        // 반영되지 않는다 — LogoutButton.tsx와 동일한 이유로 refresh()를 함께 호출한다.
        router.push("/");
        router.refresh();
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setState({
        status: "error",
        message: body?.error?.message ?? "회원탈퇴 처리 중 오류가 발생했습니다.",
      });
    } catch {
      setState({ status: "error", message: "네트워크 오류로 회원탈퇴에 실패했습니다." });
    }
  }

  const isSubmitting = state.status === "submitting";

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-start gap-2 text-body text-text-primary">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          disabled={isSubmitting}
          className="mt-1"
        />
        <span>삭제되는 내용을 확인했습니다.</span>
      </label>

      {state.status === "error" && (
        <p role="alert" className="text-body text-danger">
          {state.message}
        </p>
      )}

      <Button
        type="button"
        variant="destructive"
        onClick={handleWithdraw}
        disabled={!confirmed || isSubmitting}
        loading={isSubmitting}
      >
        회원탈퇴
      </Button>
    </div>
  );
}
