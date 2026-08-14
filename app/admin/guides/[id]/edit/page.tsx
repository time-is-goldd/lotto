import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ContentForm from "@/components/admin/ContentForm";
import { getAdminContentEntryById } from "@/lib/api/admin/content";

export const metadata: Metadata = {
  title: "가이드 수정",
  robots: { index: false, follow: false },
};

interface AdminEditGuidePageProps {
  params: Promise<{ id: string }>;
}

// app/admin/faq/[id]/edit/page.tsx와 동일한 파싱/404 패턴.
export default async function AdminEditGuidePage({ params }: AdminEditGuidePageProps) {
  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  const entry = await getAdminContentEntryById(id);

  if (!entry || entry.type !== "guide") {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/guides" className="text-body text-text-secondary hover:underline">
        ← 가이드 관리
      </Link>
      <h1 className="text-h1 font-bold text-text-primary">{entry.title} 수정</h1>
      <ContentForm
        mode="edit"
        type="guide"
        entryId={entry.id}
        initialValues={{ title: entry.title, body: entry.body, display_order: entry.display_order }}
      />
    </div>
  );
}
