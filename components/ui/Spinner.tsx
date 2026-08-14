interface SpinnerProps {
  className?: string;
  label?: string;
}

// docs/UI_UX_GUIDELINE.md §8: 로딩 상태는 스피너 + 텍스트 동반. role="status"+aria-label로
// 스크린리더에도 "로딩 중"임을 알린다. motion-reduce:animate-none은 Tailwind가 기본으로
// 처리해주지 않아(직접 확인, node_modules/tailwindcss에 prefers-reduced-motion 처리 없음)
// 명시적으로 붙였다 — docs/UI_UX_GUIDELINE.md §11 "prefers-reduced-motion 존중" 요구사항.
export default function Spinner({ className, label = "로딩 중" }: SpinnerProps) {
  return (
    <svg
      role="status"
      aria-label={label}
      className={`h-5 w-5 animate-spin motion-reduce:animate-none ${className ?? ""}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
