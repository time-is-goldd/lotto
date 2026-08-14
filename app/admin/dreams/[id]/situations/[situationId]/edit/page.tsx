import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import DreamSituationForm from "@/components/admin/DreamSituationForm";
import { getDreamSituationById } from "@/lib/api/dreamSituations";
import { getDreamById } from "@/lib/api/dreams";

export const metadata: Metadata = {
  title: "세부 상황 수정",
  robots: { index: false, follow: false },
};

interface AdminEditDreamSituationPageProps {
  params: Promise<{ id: string; situationId: string }>;
}

// getDreamById()/getDreamSituationById()(둘 다 공개 조회 서비스, 무수정)를 그대로 재사용한다.
// 소유권 검증(지시문 §13)을 여기서도 한 번 더 한다 — situation.dream_id가 URL의 id와
// 다르면(다른 Dream 소속 situationId를 URL만 바꿔 직접 접근한 경우) 404로 처리한다. 실제
// 저장(PUT)은 lib/api/admin/dreamSituations.ts의 WHERE id + dream_id 조합이 서버 쪽에서
// 다시 한번 독립적으로 검증하므로, 이 페이지의 확인은 "잘못된 화면을 아예 보여주지 않는다"는
// UX 방어이지 유일한 보안 경계가 아니다.
export default async function AdminEditDreamSituationPage({
  params,
}: AdminEditDreamSituationPageProps) {
  const { id: rawId, situationId: rawSituationId } = await params;
  const dreamId = Number(rawId);
  const situationId = Number(rawSituationId);

  if (
    !Number.isInteger(dreamId) ||
    dreamId <= 0 ||
    !Number.isInteger(situationId) ||
    situationId <= 0
  ) {
    notFound();
  }

  const [dream, situation] = await Promise.all([
    getDreamById(dreamId),
    getDreamSituationById(situationId),
  ]);

  if (!dream || !situation || situation.dream_id !== dream.id) {
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
      <h1 className="text-h1 font-bold text-text-primary">
        {dream.keyword} — {situation.title} 수정
      </h1>
      <DreamSituationForm
        mode="edit"
        dreamId={dream.id}
        dreamKeyword={dream.keyword}
        situationId={situation.id}
        initialValues={{
          keyword: situation.keyword,
          title: situation.title,
          body: situation.body,
          keyMeaning: situation.key_meaning,
          numbers: situation.numbers,
          displayOrder: situation.display_order,
        }}
      />
    </div>
  );
}
