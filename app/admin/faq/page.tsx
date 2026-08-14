import type { Metadata } from "next";
import Link from "next/link";

import DeleteContentButton from "@/components/admin/DeleteContentButton";
import { buttonClassName } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { getAdminContentEntries } from "@/lib/api/admin/content";

// app/admin/layout.tsx(Phase9-1)가 이미 이 경로 전체의 인증 게이트다. content_entries는 공개
// SELECT RLS 정책이 없어(0014_content_entries.sql) getAdminContentEntries()(service_role)를
// 직접 호출한다 — app/admin/dreams/page.tsx가 공개 조회 서비스를 재사용하는 것과 달리, 여기는
// 애초에 공개로 조회할 수 있는 데이터가 아니다.
export const metadata: Metadata = {
  title: "FAQ 관리",
  robots: { index: false, follow: false },
};

export default async function AdminFaqListPage() {
  const entries = await getAdminContentEntries("faq");

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin" className="text-body text-text-secondary hover:underline">
        ← 관리자 홈
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1 font-bold text-text-primary">FAQ 관리</h1>
        <Link href="/admin/faq/new" className={buttonClassName("primary", "md")}>
          새 FAQ 추가
        </Link>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title="등록된 FAQ가 없어요"
          description="새 FAQ를 추가해보세요."
          action={
            <Link href="/admin/faq/new" className={buttonClassName("primary", "md")}>
              새 FAQ 추가
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardHeader>{entry.title}</CardHeader>
                    <CardContent className="line-clamp-2">{entry.body}</CardContent>
                    <p className="mt-2 text-caption text-text-secondary">
                      표시 순서: {entry.display_order} ·{" "}
                      {new Date(entry.created_at).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      href={`/admin/faq/${entry.id}/edit`}
                      className={buttonClassName("secondary", "sm")}
                    >
                      수정
                    </Link>
                    <DeleteContentButton entryId={entry.id} title={entry.title} />
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
