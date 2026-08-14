import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import DreamSituationForm from "@/components/admin/DreamSituationForm";
import { getDreamById } from "@/lib/api/dreams";

export const metadata: Metadata = {
  title: "세부 상황 추가",
  robots: { index: false, follow: false },
};

interface AdminNewDreamSituationPageProps {
  params: Promise<{ id: string }>;
}

// getDreamById()(lib/api/dreams.ts, Phase7, 무수정)를 그대로 재사용해 부모 Dream이 실제로
// 존재하는지 먼저 확인한다 — 존재하지 않는 부모 밑에 세부 상황을 추가하는 화면 자체를
// 보여주지 않는다(app/admin/dreams/[id]/edit/page.tsx와 동일한 404 처리 원칙).
export default async function AdminNewDreamSituationPage({
  params,
}: AdminNewDreamSituationPageProps) {
  const { id: rawId } = await params;
  const dreamId = Number(rawId);

  if (!Number.isInteger(dreamId) || dreamId <= 0) {
    notFound();
  }

  const dream = await getDreamById(dreamId);
  if (!dream) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/admin/dreams/${dream.id}/edit`}
        className="text-body text-text-secondary hover:underline"
      >
        ← {dream.keyword} 수정으로 돌아가기
      </Link>
      <h1 className="text-h1 font-bold text-text-primary">{dream.keyword} — 세부 상황 추가</h1>
      <DreamSituationForm mode="create" dreamId={dream.id} dreamKeyword={dream.keyword} />
    </div>
  );
}
