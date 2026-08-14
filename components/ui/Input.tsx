import type { InputHTMLAttributes } from "react";

import Label from "./Label";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

// docs/DESIGN_SYSTEM.md §4.5: 높이 52px, radius-input(8px), 포커스 시 primary 테두리 강조.
// label을 넘기면 Label과 htmlFor/id로 자동 연결한다 — 단, id는 호출부가 직접 넘겨야 한다
// (useId() 같은 훅으로 자동 생성하지 않는다. 이 컴포넌트를 훅 없는 순수 함수로 유지해
// Server/Client 컴포넌트 어디서든 그대로 쓸 수 있게 한다 — "props는 단순하고 명확하게").
// error가 있으면 테두리를 danger로 바꾸고 aria-invalid/aria-describedby로 스크린리더에도 알린다.
export default function Input({ label, error, id, className, ...props }: InputProps) {
  const errorId = error && id ? `${id}-error` : undefined;

  return (
    <div>
      {label && (
        <Label htmlFor={id} className="mb-1 block">
          {label}
        </Label>
      )}
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`h-13 w-full rounded-input border px-3 text-body text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-text-secondary ${
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
