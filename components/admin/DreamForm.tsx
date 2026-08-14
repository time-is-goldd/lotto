"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Label from "@/components/ui/Label";
import { DREAM_INTERPRETATION_MAX_LENGTH } from "@/lib/constants";

import { validateDreamForm, type DreamFormValues, type DreamSubmitPayload } from "./dreamFormValidation";

interface DreamFormProps {
  mode: "create" | "edit";
  dreamId?: number;
  categories: string[];
  initialValues?: {
    keyword: string;
    category: string | null;
    interpretation: string;
    numbers: number[] | null;
  };
}

type Status = "idle" | "saving" | "error";

const EMPTY_NUMBERS: DreamFormValues["numbers"] = ["", "", "", "", "", ""];

function toFormValues(initial: DreamFormProps["initialValues"]): DreamFormValues {
  return {
    keyword: initial?.keyword ?? "",
    category: initial?.category ?? "",
    interpretation: initial?.interpretation ?? "",
    numbers: initial?.numbers ? (initial.numbers.map(String) as DreamFormValues["numbers"]) : null,
  };
}

// components/journal/DreamJournalForm.tsx(Phase7-4)/components/admin/DrawRegistrationForm.tsx
// (Phase9-2)와 동일한 원칙 — 오류가 나도 입력을 지우지 않고, 클라이언트 검증은 UX 편의일
// 뿐 최종 검증은 항상 서버(POST/PUT /api/admin/dreams)가 담당한다.
export default function DreamForm({ mode, dreamId, categories, initialValues }: DreamFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<DreamFormValues>(toFormValues(initialValues));
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function updateNumber(index: number, value: string) {
    setValues((prev) => {
      if (prev.numbers === null) {
        return prev;
      }
      const next = [...prev.numbers] as NonNullable<DreamFormValues["numbers"]>;
      next[index] = value;
      return { ...prev, numbers: next };
    });
  }

  function toggleNumbers(enabled: boolean) {
    setValues((prev) => ({ ...prev, numbers: enabled ? (prev.numbers ?? EMPTY_NUMBERS) : null }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "saving") {
      return;
    }

    let payload: DreamSubmitPayload;
    try {
      payload = validateDreamForm(values);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "입력값을 확인해주세요.");
      setStatus("error");
      return;
    }

    setStatus("saving");
    setErrorMessage(null);

    try {
      const url = mode === "create" ? "/api/admin/dreams" : `/api/admin/dreams/${dreamId}`;
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

      // 지시문 §2: 생성/수정 모두 저장 후 목록으로 이동한다. 별도의 성공 상태 화면을
      // 새로 만들지 않는다(회차 등록과 달리 "방금 등록한 값 요약"을 보여줄 필요가
      // 없다 — 목록에서 바로 확인 가능).
      router.push("/admin/dreams");
      router.refresh();
    } catch {
      setErrorMessage("저장하지 못했어요. 다시 시도해주세요.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Input
        id="dream-keyword"
        label="키워드"
        type="text"
        value={values.keyword}
        onChange={(event) => setValues((prev) => ({ ...prev, keyword: event.target.value }))}
        placeholder="예: 돼지꿈"
      />

      <div>
        <Label htmlFor="dream-category" className="mb-1 block">
          카테고리
        </Label>
        <select
          id="dream-category"
          value={values.category}
          onChange={(event) => setValues((prev) => ({ ...prev, category: event.target.value }))}
          className="h-13 w-full rounded-input border border-border px-3 text-body text-text-primary focus:border-primary focus:outline-none"
        >
          <option value="">미지정</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="dream-interpretation">해몽 본문</Label>
        <textarea
          id="dream-interpretation"
          rows={8}
          value={values.interpretation}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, interpretation: event.target.value }))
          }
          placeholder="이 꿈에 대한 해몽 내용을 입력하세요."
          className="w-full resize-none rounded-card border border-border bg-bg-base p-4 text-body text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
        <span className="self-end text-caption text-text-secondary">
          {values.interpretation.length} / {DREAM_INTERPRETATION_MAX_LENGTH}자
        </span>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="flex items-center gap-2 text-body font-medium text-text-primary">
          <input
            type="checkbox"
            id="dream-numbers-toggle"
            checked={values.numbers !== null}
            onChange={(event) => toggleNumbers(event.target.checked)}
          />
          <Label htmlFor="dream-numbers-toggle" className="mb-0">
            추천 번호 설정(선택)
          </Label>
        </legend>
        {values.numbers !== null && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {values.numbers.map((n, index) => (
              <Input
                key={index}
                id={`dream-number-${index + 1}`}
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
        )}
      </fieldset>

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
