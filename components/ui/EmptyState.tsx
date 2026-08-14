import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

// docs/USER_FLOW.md §4 "다이어리 첫 진입(빈 상태)... 첫 기록을 남겨보세요 CTA" 같은 빈 상태
// 화면에서 반복될 패턴을 미리 재사용 가능한 형태로 만들었다(Divider는 지금 쓸 곳이 없어
// 만들지 않았다 — docs/PHASE3_UI_COMPONENT_REPORT.md 참조). action은 임의 ReactNode를 그대로
// 받는다 — EmptyState가 Button을 직접 import해 강제하지 않는다(결합도를 낮춘다).
export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="text-h2 font-bold text-text-primary">{title}</p>
      {description && <p className="text-body text-text-secondary">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
