import type { ButtonHTMLAttributes, ReactNode } from "react";

import Spinner from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

// docs/DESIGN_SYSTEM.md §4.1은 Primary/Secondary/Kakao/Disabled만 정의한다. ghost/destructive는
// 문서에 없는 variant라 새 색상을 만들지 않고 이미 있는 토큰만 재사용해 구성했다 — ghost는
// text-primary+bg-subtle 호버(문서에 다른 곳에서 이미 쓰이는 조합), destructive는 color-danger
// (문서가 "오류" 강조용으로 이미 정의)를 그대로 썼다(docs/PHASE3_UI_COMPONENT_REPORT.md
// "발견된 문제" 참조). disabled는 variant와 무관하게 문서의 Disabled 규격(bg-border/text-secondary)
// 으로 강제 통일한다.
// secondary 호버(Phase3 Audit Medium): DESIGN_SYSTEM.md에 secondary 전용 호버 색이 없어 ghost와
// 동일한 bg-subtle 톤(이미 있는 토큰)을 재사용했다 — 새 색상 없음. destructive는 color-danger의
// "-dark" 톤이 문서에 아예 정의돼 있지 않아(primary만 primary-dark가 있음) 임의로 만들지 않고
// 호버 없이 남겨둔다 — docs/PHASE3_MAINTENANCE_REPORT.md에 보고.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-dark",
  secondary: "border border-primary bg-transparent text-primary hover:bg-bg-subtle",
  ghost: "bg-transparent text-text-primary hover:bg-bg-subtle",
  destructive: "bg-danger text-white",
};

// size는 문서가 명시한 lg(56px=h-14) 하나뿐이라, sm/md는 같은 비율감으로 확장했다.
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-caption",
  md: "h-11 px-4 text-body",
  lg: "h-14 px-6 text-button",
};

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-button font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

// <a>(Link)로 "버튼처럼 보이는 네비게이션"을 만들 때 재사용한다 — <button> 안에는 <a>를 넣을
// 수 없어(중첩 인터랙티브 콘텐츠 금지) 이동이 필요한 CTA는 Button 컴포넌트 자체를 쓸 수 없다.
// components/auth/LoginButton.tsx가 이미 이 스타일을 직접 문자열로 중복해뒀던 것과 같은
// 문제를 겪지 않도록, 기존 스타일 맵을 그대로 내보내기만 했다(새 컴포넌트 생성 아님).
export function buttonClassName(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  return `${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]}`;
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  iconLeft,
  iconRight,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`${BASE_CLASSES} disabled:cursor-not-allowed disabled:border-transparent disabled:bg-border disabled:text-text-secondary disabled:hover:bg-border ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className ?? ""}`.trim()}
      {...props}
    >
      {loading ? <Spinner className="text-current" /> : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  );
}
