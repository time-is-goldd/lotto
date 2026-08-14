"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";

import {
  validateContentForm,
  type ContentEntryType,
  type ContentFormValues,
  type ContentSubmitPayload,
} from "./contentFormValidation";

interface ContentFormProps {
  mode: "create" | "edit";
  type: ContentEntryType;
  entryId?: number;
  initialValues?: {
    title: string;
    body: string;
    display_order: number;
  };
}

type Status = "idle" | "saving" | "error";

const LIST_PATH: Record<ContentEntryType, string> = {
  faq: "/admin/faq",
  guide: "/admin/guides",
};

function toFormValues(initial: ContentFormProps["initialValues"]): ContentFormValues {
  return {
    title: initial?.title ?? "",
    body: initial?.body ?? "",
    displayOrder: initial ? String(initial.display_order) : "0",
  };
}

// components/admin/DreamForm.tsx(Phase9-3)와 동일한 원칙 — 오류가 나도 입력을 지우지 않고,
// 클라이언트 검증은 UX 편의일 뿐 최종 검증은 항상 서버(POST/PUT /api/admin/content)가 담당한다.
// type은 페이지(app/admin/faq/*, app/admin/guides/*)가 고정해서 넘겨주는 값이며, 이 폼에는 type을
// 사용자가 바꿀 수 있는 UI가 없다(지시문 §7 "사용자가 임의의 type을 변경할 수 있는 UI는 만들 필요
// 없다").
export default function ContentForm({ mode, type, entryId, initialValues }: ContentFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<ContentFormValues>(toFormValues(initialValues));
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "saving") {
      return;
    }

    let payload: ContentSubmitPayload;
    try {
      payload = validateContentForm(type, values);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "입력값을 확인해주세요.");
      setStatus("error");
      return;
    }

    setStatus("saving");
    setErrorMessage(null);

    try {
      const url = mode === "create" ? "/api/admin/content" : `/api/admin/content/${entryId}`;
      const response = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setErrorMessage(body?.error?.message ?? "저장하지 못했어요. 다시 시도해주세요.");
        setStatus("error");
        return;
      }

      router.push(LIST_PATH[type]);
      router.refresh();
    } catch {
      setErrorMessage("저장하지 못했어요. 다시 시도해주세요.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Input
        id="content-title"
        label="제목"
        type="text"
        value={values.title}
        onChange={(event) => setValues((prev) => ({ ...prev, title: event.target.value }))}
        placeholder={type === "faq" ? "예: 환불은 어떻게 하나요?" : "예: 번호 생성 방법 안내"}
      />

      <Textarea
        id="content-body"
        label="본문"
        rows={8}
        value={values.body}
        onChange={(event) => setValues((prev) => ({ ...prev, body: event.target.value }))}
        placeholder="본문 내용을 입력하세요."
      />

      <Input
        id="content-display-order"
        label="표시 순서"
        type="number"
        step={1}
        min={0}
        inputMode="numeric"
        value={values.displayOrder}
        onChange={(event) => setValues((prev) => ({ ...prev, displayOrder: event.target.value }))}
      />

      {errorMessage && (
        <p role="alert" className="text-body text-danger">
          {errorMessage}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          취소
        </Button>
        <Button type="submit" loading={status === "saving"}>
          {status === "saving" ? "저장 중..." : "저장하기"}
        </Button>
      </div>
    </form>
  );
}
