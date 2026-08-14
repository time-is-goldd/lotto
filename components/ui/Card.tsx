import type { HTMLAttributes } from "react";

type DivProps = HTMLAttributes<HTMLDivElement>;

// docs/DESIGN_SYSTEM.md §4.3: bg-subtle 배경, radius-card(16px), shadow-card, 내부는
// 제목(18px Bold)+본문(16px)+CTA 구조. Header/Content/Footer는 서로 상태를 공유하지 않는
// 독립적인 스타일 wrapper일 뿐이다 — Context나 강제된 부모-자식 관계가 없어 "compound
// component" 패턴이 아니다(이번 Task 원칙 "과도한 추상화 금지"). Card 하나만 쓸 수도 있고
// 셋을 조합할 수도 있다.
export function Card({ className, children, ...props }: DivProps) {
  return (
    <div className={`rounded-card bg-bg-subtle p-4 shadow-card ${className ?? ""}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: DivProps) {
  return (
    <div className={`text-h2 font-bold text-text-primary ${className ?? ""}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ className, children, ...props }: DivProps) {
  return (
    <div className={`mt-2 text-body text-text-primary ${className ?? ""}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: DivProps) {
  return (
    <div className={`mt-4 flex items-center gap-2 ${className ?? ""}`.trim()} {...props}>
      {children}
    </div>
  );
}
