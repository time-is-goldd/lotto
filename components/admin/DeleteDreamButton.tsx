"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/ui/Button";

interface DeleteDreamButtonProps {
  dreamId: number;
  keyword: string;
  situationCount?: number;
}

// ADMIN_REQUIREMENTS.md §9 "파괴적 액션 2단계 확인"을 새 확인 모달 컴포넌트 없이 가장
// 단순하게 만족시킨다 — 브라우저 기본 confirm()으로 1차 확인, 실제 삭제는 여전히 서버
// (DELETE /api/admin/dreams/[id])의 isAdmin() 재검증을 통과해야 한다(클라이언트 확인은
// 실수 방지용 UX일 뿐 보안 경계가 아님).
//
// Phase10-4E §17: dream_situations.dream_id도 dreams(id)를 ON DELETE CASCADE로 참조한다
// (0018_dream_situations.sql) — 부모 삭제 시 세부 상황도 실제로 함께 사라진다. situationCount가
// 실제로 0보다 클 때만("실제 cascade가 존재할 때만 표시") 경고 문구를 덧붙인다 — 세부 상황이
// 없는 Dream까지 불필요한 문구로 헷갈리게 하지 않는다.
export default function DeleteDreamButton({
  dreamId,
  keyword,
  situationCount = 0,
}: DeleteDreamButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDelete() {
    if (isDeleting) {
      return;
    }
    const situationWarning =
      situationCount > 0 ? ` 이 꿈의 세부 상황 ${situationCount}개도 함께 삭제됩니다.` : "";
    const confirmed = window.confirm(
      `"${keyword}"을(를) 삭제할까요? 관련 추천 번호도 함께 삭제됩니다.${situationWarning}`
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/admin/dreams/${dreamId}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setErrorMessage(body?.error?.message ?? "삭제하지 못했어요. 다시 시도해주세요.");
        setIsDeleting(false);
        return;
      }
      router.refresh();
    } catch {
      setErrorMessage("삭제하지 못했어요. 다시 시도해주세요.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        loading={isDeleting}
        onClick={handleDelete}
      >
        {isDeleting ? "삭제 중..." : "삭제"}
      </Button>
      {errorMessage && (
        <p role="alert" className="text-caption text-danger">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
