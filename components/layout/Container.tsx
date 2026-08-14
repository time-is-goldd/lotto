import type { ReactNode } from "react";

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

// 모든 페이지가 공통으로 쓰는 가로 폭 제한 + 좌우 여백(docs/DESIGN_SYSTEM.md §7 "데스크톱
// 최대 콘텐츠 폭 1200px 중앙 정렬"). px-6(24px)는 기존 3개 페이지가 이미 쓰던 값을 그대로
// 표준화한 것이다 — 새 값이 아니라 중복되던 값을 하나로 모았다. className으로 페이지별
// flex 정렬(가운데 정렬 등)을 얹을 수 있게 열어둔다 — 정렬 자체는 페이지마다 다르므로
// Container가 강제하지 않는다.
export default function Container({ children, className }: ContainerProps) {
  return (
    <div className={`mx-auto w-full max-w-content px-6 ${className ?? ""}`.trim()}>
      {children}
    </div>
  );
}
