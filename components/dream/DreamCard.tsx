import Link from "next/link";

import Badge from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import type { Dream } from "@/lib/api/dreams";
import { buildExcerpt } from "@/lib/utils/excerpt";

interface DreamCardProps {
  dream: Dream;
}

// claude-code-luck-platform-fortune-domain-followup-prompt.md §16: line-clamp는 CSS로 화면만
// 2줄로 "가릴" 뿐, dream.interpretation 전체(마크업 기호 "##" 포함)가 여전히 DOM/accessible
// name에 그대로 남아 스크린리더가 수백 자를 통째로 읽고, "##"가 잠깐이라도 화면에 노출될 수
// 있었다. buildExcerpt()로 실제 텍스트 자체를 80~140자(§16 권장 범위)로 자른 뒤에만 렌더링한다.
const CARD_EXCERPT_MAX_LENGTH = 120;

// app/dream/page.tsx(전체 목록)과 app/dream/category/[category]/page.tsx(카테고리 필터
// 목록) 2곳에서 동일한 카드 마크업이 반복돼 공통 컴포넌트로 뺐다(components/dream/*
// 지시문 §9 "2개 이상에서 반복될 때만 추출"). 카드 전체가 클릭 가능해야 한다는 요구(§5)에
// 따라 Card 전체를 Link로 감쌌다 — Card 자신은 순수 wrapper 스타일 컴포넌트라 상태를
// 갖지 않으므로 Link로 감싸도 문제가 없다.
export default function DreamCard({ dream }: DreamCardProps) {
  const excerpt = buildExcerpt(dream.interpretation, CARD_EXCERPT_MAX_LENGTH);

  return (
    <Link href={`/dream/${encodeURIComponent(dream.keyword)}`} className="block">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-h2 font-bold text-text-primary">{dream.keyword}</span>
          {dream.category && <Badge>{dream.category}</Badge>}
        </div>
        {/* line-clamp는 그대로 두되(비정상적으로 긴 excerpt에 대한 2차 방어선), 실제 텍스트
            자체가 이미 짧은 완결 문장이라 평소에는 line-clamp가 잘라낼 것이 거의 없다. */}
        <CardContent className="line-clamp-2">{excerpt}</CardContent>
      </Card>
    </Link>
  );
}
