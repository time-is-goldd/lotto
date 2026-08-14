import Link from "next/link";

import type { DreamSituation } from "@/lib/api/dreamSituations";

interface DreamSituationCardProps {
  dreamKeyword: string;
  situation: DreamSituation;
}

// components/dream/DreamCard.tsx(부모 꿈 카드)와 의도적으로 다른, 더 작은 카드다 — 지시문
// §28 "상황 목록 카드는 화면을 꽉 채우는 큰 카드가 아니라 컴팩트해야 한다"에 따라 Card 컴포넌트
// 대신 얇은 테두리 한 줄짜리 링크로 만들었다. key_meaning(핵심 해석 한 줄)이 있으면 그것을,
// 없으면 body 앞부분을 1~2줄 요약으로 보여준다 — 상세 페이지와 달리 목록에서는 항상 뭔가
// 요약 텍스트가 보여야 하기 때문(key_meaning은 nullable 컬럼).
export default function DreamSituationCard({ dreamKeyword, situation }: DreamSituationCardProps) {
  const summary = situation.key_meaning ?? situation.body;

  return (
    <Link
      href={`/dream/${encodeURIComponent(dreamKeyword)}/${encodeURIComponent(situation.keyword)}`}
      className="flex items-center justify-between gap-3 rounded-card border border-border bg-bg-subtle px-4 py-3 hover:border-primary"
    >
      <div className="min-w-0">
        <p className="text-body font-bold text-text-primary">{situation.title}</p>
        <p className="line-clamp-2 text-caption text-text-secondary">{summary}</p>
      </div>
      <span aria-hidden="true" className="shrink-0 text-text-secondary">
        →
      </span>
    </Link>
  );
}
