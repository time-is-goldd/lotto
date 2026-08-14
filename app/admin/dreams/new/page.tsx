import type { Metadata } from "next";
import Link from "next/link";

import DreamForm from "@/components/admin/DreamForm";
import { getDreamCategories } from "@/lib/api/dreams";

export const metadata: Metadata = {
  title: "새 꿈 추가",
  robots: { index: false, follow: false },
};

export default async function AdminNewDreamPage() {
  // getDreamCategories()(lib/api/dreams.ts, Phase7-1, 무수정)를 그대로 재사용한다 —
  // "실제 DB에서 사용하는 카테고리"를 진실의 원천으로 삼는다(지시문 §5, 새 taxonomy
  // 하드코딩 금지).
  const categories = await getDreamCategories();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/dreams" className="text-body text-text-secondary hover:underline">
        ← 꿈해몽 관리
      </Link>
      <h1 className="text-h1 font-bold text-text-primary">새 꿈 추가</h1>
      <DreamForm mode="create" categories={categories} />
    </div>
  );
}
