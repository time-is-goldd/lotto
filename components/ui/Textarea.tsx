import type { TextareaHTMLAttributes } from "react";

import Label from "./Label";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

// Input.tsx와 동일한 규칙(레이블 연결 방식, error 처리)을 공유한다 — 높이만 다르다
// (여러 줄 입력이라 고정 높이(52px)가 아니라 rows 기반 가변 높이를 그대로 둔다,
// docs/DESIGN_SYSTEM.md에 Textarea 전용 규격이 없어 Input의 규칙을 그대로 확장했다).
export default function Textarea({ label, error, id, className, ...props }: TextareaProps) {
  const errorId = error && id ? `${id}-error` : undefined;

  return (
    <div>
      {label && (
        <Label htmlFor={id} className="mb-1 block">
          {label}
        </Label>
      )}
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`w-full rounded-input border px-3 py-2 text-body text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-text-secondary ${
          error ? "border-danger" : "border-border"
        } ${className ?? ""}`.trim()}
        {...props}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
