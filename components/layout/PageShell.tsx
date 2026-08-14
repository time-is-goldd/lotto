import type { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
}

// 페이지 전체를 감싸는 최상위 wrapper(app/layout.tsx에서 한 번만 사용). flex-col +
// min-h-screen으로 콘텐츠가 짧아도 Footer가 화면 하단에 고정되는 구조(sticky footer 패턴)를
// 지금 확정해둔다 — Header/Footer(Phase3-3)가 Main과 형제로 들어올 자리를 미리 만들어두는
// 목적이다(docs/PHASE3_UI_ARCHITECTURE_PLAN.md §2.3).
//
// pb-16(64px)은 BottomNavigation(Phase3-6, fixed 높이 64px, docs/DESIGN_SYSTEM.md §4.6)이
// 모바일에서 Footer 콘텐츠를 가리지 않도록 하는 최소 보정이다 — BottomNavigation이 md:hidden인
// 지점(768px)에서 md:pb-0으로 정확히 상쇄되어 데스크톱 레이아웃은 이전과 100% 동일하다
// (docs/PHASE3_BOTTOM_NAVIGATION_REPORT.md 참조).
export default function PageShell({ children }: PageShellProps) {
  return <div className="flex min-h-screen flex-col bg-bg-base pb-16 md:pb-0">{children}</div>;
}
