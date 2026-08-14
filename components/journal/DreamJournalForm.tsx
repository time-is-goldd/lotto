"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import Button from "@/components/ui/Button";
import { DREAM_JOURNAL_TEXT_MAX_LENGTH } from "@/lib/constants";

interface DreamJournalFormProps {
  // app/dream/[keyword]/page.tsx의 "이 꿈 기록하기" CTA를 거쳐 들어왔을 때만 채워진다
  // (docs/PHASE7_DREAM_JOURNAL_CREATE_REPORT.md §6-A). /my/journal/dreams에서 직접 진입하면
  // 둘 다 없고, 특정 공개 꿈을 선택하지 않은 자유 기록이 된다(§6-B, dream_journal_entries.
  // linked_dream_id가 NULL 허용이라 가능).
  linkedDreamId?: number | null;
  dreamKeyword?: string | null;
}

type SaveStatus = "idle" | "saving" | "error";

// EXECUTION_PLAN.md Phase7이 이미 이 파일명/위치를 계획해 뒀다(components/journal/
// DreamJournalForm.tsx) — 그대로 따랐다. Phase5의 NumberGenerator.tsx와 동일한 패턴
// (Server Component가 인증/context를 미리 판단해 내려주고, 이 Client Component는 실제
// fetch/상태만 다룬다)을 재사용한다.
export default function DreamJournalForm({ linkedDreamId = null, dreamKeyword = null }: DreamJournalFormProps) {
  const router = useRouter();
  const [dreamText, setDreamText] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmedLength = dreamText.trim().length;
  const isValid = trimmedLength > 0 && dreamText.length <= DREAM_JOURNAL_TEXT_MAX_LENGTH;

  // 오류가 나도 입력 내용을 지우지 않는다(지시문 §15 "오류 발생 시 입력 내용 유지") — setDreamText를
  // 호출하지 않고 errorMessage/status만 갱신하므로 textarea 값은 그대로 남는다.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid || status === "saving") {
      return;
    }

    setStatus("saving");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/journal/dreams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dreamText,
          ...(linkedDreamId ? { linkedDreamId } : {}),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setErrorMessage(body?.error?.message ?? "저장하지 못했어요. 다시 시도해주세요.");
        setStatus("error");
        return;
      }

      router.push("/my/journal/dreams");
    } catch {
      setErrorMessage("저장하지 못했어요. 다시 시도해주세요.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {dreamKeyword && (
        <p className="text-body text-text-secondary">&ldquo;{dreamKeyword}&rdquo; 꿈과 연결해서 기록해요.</p>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="dream-text" className="text-body font-medium text-text-primary">
          꿈 내용
        </label>
        <textarea
          id="dream-text"
          autoFocus
          rows={8}
          value={dreamText}
          onChange={(event) => setDreamText(event.target.value)}
          placeholder="어떤 꿈을 꾸셨나요? 자유롭게 기록해보세요."
          maxLength={DREAM_JOURNAL_TEXT_MAX_LENGTH}
          className="w-full resize-none rounded-card border border-border bg-bg-base p-4 text-body text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
        <span className="self-end text-caption text-text-secondary">
          {dreamText.length} / {DREAM_JOURNAL_TEXT_MAX_LENGTH}자
        </span>
      </div>

      {/* 색상이 아니라 문구로만 오류를 전달한다(danger 미사용, 기존 원칙과 동일). */}
      {errorMessage && (
        <p role="alert" className="text-body text-text-secondary">
          {errorMessage}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          취소
        </Button>
        <Button type="submit" disabled={!isValid} loading={status === "saving"}>
          저장하기
        </Button>
      </div>
    </form>
  );
}
