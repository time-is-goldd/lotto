import Link from "next/link";

import Badge from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import type { Dream } from "@/lib/api/dreams";

interface DreamCardProps {
  dream: Dream;
}

// app/dream/page.tsx(전체 목록)과 app/dream/category/[category]/page.tsx(카테고리 필터
// 목록) 2곳에서 동일한 카드 마크업이 반복돼 공통 컴포넌트로 뺐다(components/dream/*
// 지시문 §9 "2개 이상에서 반복될 때만 추출"). 카드 전체가 클릭 가능해야 한다는 요구(§5)에
// 따라 Card 전체를 Link로 감쌌다 — Card 자신은 순수 wrapper 스타일 컴포넌트라 상태를
// 갖지 않으므로 Link로 감싸도 문제가 없다.
export default function DreamCard({ dream }: DreamCardProps) {
  return (
    <Link href={`/dream/${encodeURIComponent(dream.keyword)}`} className="block">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-h2 font-bold text-text-primary">{dream.keyword}</span>
          {dream.category && <Badge>{dream.category}</Badge>}
        </div>
        {/* line-clamp로 목록 카드의 해몽 본문을 2줄로 제한한다 — 전체 본문은 상세 페이지
            (app/dream/[keyword]/page.tsx)에서만 온전히 보여준다. */}
        <CardContent className="line-clamp-2">{dream.interpretation}</CardContent>
      </Card>
    </Link>
  );
}
