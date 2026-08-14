"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Label from "@/components/ui/Label";
import {
  DREAM_SITUATION_BODY_MAX_LENGTH,
  DREAM_SITUATION_KEY_MEANING_MAX_LENGTH,
  DREAM_SITUATION_TITLE_MAX_LENGTH,
} from "@/lib/constants";

import {
  validateDreamSituationForm,
  type DreamSituationFormValues,
  type DreamSituationSubmitPayload,
} from "./dreamSituationFormValidation";

interface DreamSituationFormProps {
  mode: "create" | "edit";
  dreamId: number;
  dreamKeyword: string;
  situationId?: number;
  initialValues?: {
    keyword: string;
    title: string;
    body: string;
    keyMeaning: string | null;
    numbers: number[] | null;
    displayOrder: number;
  };
}

type Status = "idle" | "saving" | "error";

function toFormValues(initial: DreamSituationFormProps["initialValues"]): DreamSituationFormValues {
  return {
    keyword: initial?.keyword ?? "",
    title: initial?.title ?? "",
    body: initial?.body ?? "",
    keyMeaning: initial?.keyMeaning ?? "",
    numbersText: initial?.numbers ? initial.numbers.join(", ") : "",
    displayOrder: initial ? String(initial.displayOrder) : "0",
  };
}

// components/admin/DreamForm.tsx와 동일한 원칙 — 오류가 나도 입력을 지우지 않고, 클라이언트
// 검증은 UX 편의일 뿐 최종 검증은 항상 서버(POST/PUT /api/admin/dreams/[id]/situations[/[situationId]])가
// 담당한다. 저장 성공 후에는 목록(별도 최상위 페이지)이 아니라 부모 Dream 수정 화면으로
// 돌아간다 — Situation은 Parent Dream 하위 개념으로 유지한다(지시문 §3).
export default function DreamSituationForm({
  mode,
  dreamId,
  dreamKeyword,
  situationId,
  initialValues,
}: DreamSituationFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<DreamSituationFormValues>(toFormValues(initialValues));
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parentEditPath = `/admin/dreams/${dreamId}/edit`;
  // 지시문 §19: 새 preview system을 만들지 않고 실제 public URL로 새 탭 링크만 제공한다.
  // 편집 중인(아직 저장하지 않은) keyword가 아니라 initialValues.keyword(현재 실제로
  // 게시돼 있는 값)로 링크를 만든다 — "지금 공개 페이지에 뭐가 떠 있는지"를 보여주는
  // 링크이지, 저장하면 이렇게 될 거라는 예측 링크가 아니다. create 모드는 아직 게시된
  // situation이 없어 링크 자체를 보여주지 않는다.
  const previewHref =
    mode === "edit" && initialValues
      ? `/dream/${encodeURIComponent(dreamKeyword)}/${encodeURIComponent(initialValues.keyword)}`
      : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "saving") {
      return;
    }

    let payload: DreamSituationSubmitPayload;
    try {
      payload = validateDreamSituationForm(values);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "입력값을 확인해주세요.");
      setStatus("error");
      return;
    }

    setStatus("saving");
    setErrorMessage(null);

    try {
      const url =
        mode === "create"
          ? `/api/admin/dreams/${dreamId}/situations`
          : `/api/admin/dreams/${dreamId}/situations/${situationId}`;
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

      router.push(parentEditPath);
      router.refresh();
    } catch {
      setErrorMessage("저장하지 못했어요. 다시 시도해주세요.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {previewHref && (
        <Link
          href={previewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start text-caption text-primary hover:underline"
        >
          공개 페이지 보기 ↗
        </Link>
      )}

      <Input
        id="situation-keyword"
        label="keyword (URL)"
        type="text"
        value={values.keyword}
        onChange={(event) => setValues((prev) => ({ ...prev, keyword: event.target.value }))}
        placeholder="예: 돼지를-잡는-꿈"
      />
      <p className="-mt-4 text-caption text-text-secondary">
        공개 URL(/dream/{dreamKeyword}/[keyword])에 그대로 쓰입니다. title을 바꿔도 keyword는
        자동으로 바뀌지 않아요 — URL이 갑자기 깨지는 걸 막기 위해서예요.
      </p>

      <Input
        id="situation-title"
        label="title"
        type="text"
        maxLength={DREAM_SITUATION_TITLE_MAX_LENGTH}
        value={values.title}
        onChange={(event) => setValues((prev) => ({ ...prev, title: event.target.value }))}
        placeholder="예: 돼지를 잡는 꿈"
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="situation-body">본문</Label>
        <textarea
          id="situation-body"
          rows={8}
          value={values.body}
          onChange={(event) => setValues((prev) => ({ ...prev, body: event.target.value }))}
          placeholder="이 상황에 대한 상세 해석을 입력하세요."
          className="w-full resize-none rounded-card border border-border bg-bg-base p-4 text-body text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
        <span className="self-end text-caption text-text-secondary">
          {values.body.length} / {DREAM_SITUATION_BODY_MAX_LENGTH}자
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="situation-key-meaning">핵심 해석(선택)</Label>
        <textarea
          id="situation-key-meaning"
          rows={2}
          value={values.keyMeaning}
          onChange={(event) => setValues((prev) => ({ ...prev, keyMeaning: event.target.value }))}
          placeholder="한 줄 요약(비워두면 공개 페이지에 이 섹션이 표시되지 않아요)."
          className="w-full resize-none rounded-card border border-border bg-bg-base p-4 text-body text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
        <span className="self-end text-caption text-text-secondary">
          {values.keyMeaning.length} / {DREAM_SITUATION_KEY_MEANING_MAX_LENGTH}자
        </span>
      </div>

      <Input
        id="situation-numbers"
        label="행운 숫자(선택, 0~6개)"
        type="text"
        value={values.numbersText}
        onChange={(event) => setValues((prev) => ({ ...prev, numbersText: event.target.value }))}
        placeholder="예: 3, 17 (쉼표 또는 공백으로 구분, 비워두면 0개)"
      />

      <Input
        id="situation-display-order"
        label="표시 순서"
        type="number"
        min={0}
        step={1}
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
