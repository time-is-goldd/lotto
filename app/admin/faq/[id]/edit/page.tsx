import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ContentForm from "@/components/admin/ContentForm";
import { getAdminContentEntryById } from "@/lib/api/admin/content";

export const metadata: Metadata = {
  title: "FAQ 수정",
  robots: { index: false, follow: false },
};

interface AdminEditFaqPageProps {
  params: Promise<{ id: string }>;
}

// content_entries.id는 bigint identity라 dreams.id와 동일한 형식(양의 정수)이다
// (app/admin/dreams/[id]/edit/page.tsx와 동일한 파싱 패턴).
export default async function AdminEditFaqPage({ params }: AdminEditFaqPageProps) {
  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  const entry = await getAdminContentEntryById(id);

  // /admin/faq/[id]/edit는 FAQ 전용 화면이다 — 존재하지 않거나 type이 guide인 항목은 이 화면의
  // 대상이 아니므로 동일하게 404로 처리한다(잘못된 화면에서 다른 type의 콘텐츠를 수정하는
  // 경로를 열어두지 않는다).
  if (!entry || entry.type !== "faq") {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/faq" className="text-body text-text-secondary hover:underline">
        ← FAQ 관리
      </Link>
      <h1 className="text-h1 font-bold text-text-primary">{entry.title} 수정</h1>
      <ContentForm
        mode="edit"
        type="faq"
        entryId={entry.id}
        initialValues={{ title: entry.title, body: entry.body, display_order: entry.display_order }}
      />
    </div>
  );
}
