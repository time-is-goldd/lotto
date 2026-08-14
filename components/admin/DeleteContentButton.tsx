"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/ui/Button";

interface DeleteContentButtonProps {
  entryId: number;
  title: string;
}

// components/admin/DeleteDreamButton.tsx(Phase9-3)와 동일한 패턴 — ADMIN_REQUIREMENTS.md §9
// "파괴적 액션 2단계 확인"을 새 확인 모달 컴포넌트 없이 브라우저 기본 confirm()으로 만족시킨다.
// 실제 삭제는 여전히 서버(DELETE /api/admin/content/[id])의 isAdmin() 재검증을 통과해야 한다.
export default function DeleteContentButton({ entryId, title }: DeleteContentButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDelete() {
    if (isDeleting) {
      return;
    }
    const confirmed = window.confirm(`"${title}"을(를) 삭제할까요?`);
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/admin/content/${entryId}`, { method: "DELETE" });
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
      <Button type="button" variant="destructive" size="sm" loading={isDeleting} onClick={handleDelete}>
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
