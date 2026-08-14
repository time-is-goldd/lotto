import type { Metadata } from "next";
import Link from "next/link";

import DeleteDreamButton from "@/components/admin/DeleteDreamButton";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { buttonClassName } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { getDreamIdsWithNumbers } from "@/lib/api/admin/dreams";
import { getDreamSituationCounts } from "@/lib/api/admin/dreamSituations";
import { getDreams } from "@/lib/api/dreams";

// app/admin/layout.tsx(Phase9-1)가 이미 이 경로 전체의 인증 게이트다. 이 페이지는
// getDreams()(lib/api/dreams.ts, Phase7, 무수정)를 그대로 재사용한다 — 공개 조회 서비스의
// 책임을 바꾸지 않고 그대로 가져다 쓴다(지시문 §4). 25건 규모라 페이지네이션은 넣지 않았다
// (lib/api/dreams.ts가 이미 같은 이유로 페이지네이션 없이 설계된 것과 동일한 판단).
export const metadata: Metadata = {
  title: "꿈해몽 관리",
  robots: { index: false, follow: false },
};

export default async function AdminDreamsPage() {
  const [dreams, dreamIdsWithNumbers, situationCounts] = await Promise.all([
    getDreams(),
    getDreamIdsWithNumbers(),
    getDreamSituationCounts(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin" className="text-body text-text-secondary hover:underline">
        ← 관리자 홈
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1 font-bold text-text-primary">꿈해몽 관리</h1>
        <Link href="/admin/dreams/new" className={buttonClassName("primary", "md")}>
          새 꿈 추가
        </Link>
      </div>

      {dreams.length === 0 ? (
        <EmptyState
          title="등록된 꿈이 없어요"
          description="새 꿈을 추가해 꿈해몽 콘텐츠를 시작해보세요."
          action={
            <Link href="/admin/dreams/new" className={buttonClassName("primary", "md")}>
              새 꿈 추가
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {dreams.map((dream) => (
            <li key={dream.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardHeader className="flex items-center gap-2">
                      {dream.keyword}
                      {dream.category && (
                        <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-caption text-text-secondary">
                          {dream.category}
                        </span>
                      )}
                    </CardHeader>
                    <CardContent className="line-clamp-2">{dream.interpretation}</CardContent>
                    <p className="mt-2 text-caption text-text-secondary">
                      추천 번호: {dreamIdsWithNumbers.has(dream.id) ? "있음" : "없음"} ·{" "}
                      {new Date(dream.created_at).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      href={`/admin/dreams/${dream.id}/edit`}
                      className={buttonClassName("secondary", "sm")}
                    >
                      수정
                    </Link>
                    <DeleteDreamButton
                      dreamId={dream.id}
                      keyword={dream.keyword}
                      situationCount={situationCounts.get(dream.id) ?? 0}
                    />
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
