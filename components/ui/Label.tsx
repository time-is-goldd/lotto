import type { LabelHTMLAttributes } from "react";

// docs/DESIGN_SYSTEM.md §7 입력 폼 원칙(레이블은 항상 명확한 텍스트로 필드와 연결)을
// 만족시키는 최소 wrapper. htmlFor는 호출부가 그대로 넘긴다 — 자동 id 생성(useId 등)을
// 쓰지 않아 이 컴포넌트가 훅 없이 순수 함수로 남고, Server/Client 어디서든 그대로 쓰인다.
export default function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={`text-body font-medium text-text-primary ${className ?? ""}`.trim()} {...props} />
  );
}
