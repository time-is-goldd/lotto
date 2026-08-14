import type { Metadata } from "next";
import Link from "next/link";

import ContentForm from "@/components/admin/ContentForm";

export const metadata: Metadata = {
  title: "새 가이드 추가",
  robots: { index: false, follow: false },
};

export default function AdminNewGuidePage() {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/guides" className="text-body text-text-secondary hover:underline">
        ← 가이드 관리
      </Link>
      <h1 className="text-h1 font-bold text-text-primary">새 가이드 추가</h1>
      <ContentForm mode="create" type="guide" />
    </div>
  );
}
