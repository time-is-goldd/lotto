import Link from "next/link";

// docs/UI_UX_GUIDELINE.md §9 "현재 위치를 항상 표시"의 최소 구현 — 다이어리 하위 3개
// 페이지(history/dreams/fortune-history)가 동일한 마크업을 각자 갖고 있던 것을 하나로
// 모았다(Phase4-2에서는 페이지마다 복사돼 있었음). 새로운 상호작용은 없다.
export default function JournalBackLink() {
  return (
    <Link
      href="/my/journal"
      className="text-body text-text-secondary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      ← 다이어리 홈
    </Link>
  );
}
