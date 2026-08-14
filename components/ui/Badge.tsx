import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

// docs/DESIGN_SYSTEM.md는 success/danger 색상만 정의한다 — "warning"은 문서에 없는 변형이라
// 이미 있는 accent-gold(행운/강조색)를 재사용했다(docs/PHASE3_UI_COMPONENT_REPORT.md
// "발견된 문제" 참조, 새 색상값을 만들지 않았다). 배경은 옅은 투명도로 낮춰 텍스트 대비를
// 지키고, 텍스트는 진한 색으로 WCAG AA 대비를 확보한다(docs/UI_UX_GUIDELINE.md §4).
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "bg-bg-subtle text-text-secondary",
  success: "bg-success/10 text-success",
  warning: "bg-accent-gold/20 text-text-primary",
  danger: "bg-danger/10 text-danger",
};

export default function Badge({ variant = "default", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium ${VARIANT_CLASSES[variant]} ${className ?? ""}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
}
