import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import DeleteDreamSituationButton from "@/components/admin/DeleteDreamSituationButton";
import DreamForm from "@/components/admin/DreamForm";
import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { getDreamSituations } from "@/lib/api/dreamSituations";
import { getDreamById, getDreamCategories, getDreamNumbers } from "@/lib/api/dreams";

export const metadata: Metadata = {
  title: "꿈 수정",
  robots: { index: false, follow: false },
};

interface AdminEditDreamPageProps {
  params: Promise<{ id: string }>;
}

// getDreamById()/getDreamNumbers()/getDreamCategories()(lib/api/dreams.ts, Phase7, 무수정)를
// 그대로 재사용한다 — 이 페이지는 조회만 하므로 새 admin 전용 조회 함수를 만들지 않았다
// (지시문 §4 "public 조회 서비스는 public 조회 책임 그대로 유지"). 존재하지 않는 id는
// app/dream/[keyword]/page.tsx가 이미 쓰는 것과 동일한 Next.js 기본 404로 처리한다.
//
// Phase10-4E: getDreamSituations()(lib/api/dreamSituations.ts, Phase10-4D, 무수정)도 그대로
// 재사용해 이 Dream의 세부 상황 목록을 함께 불러온다 — 지시문 §2 UX 방향("Parent Dream 수정
// 화면에서 Situation들을 함께 관리")에 따라 별도 최상위 목록 페이지를 만들지 않고 이 화면에
// 통합한다.
export default async function AdminEditDreamPage({ params }: AdminEditDreamPageProps) {
  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  const [dream, numbers, categories, situations] = await Promise.all([
    getDreamById(id),
    getDreamNumbers(id),
    getDreamCategories(),
    getDreamSituations(id),
  ]);

  if (!dream) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/dreams" className="text-body text-text-secondary hover:underline">
        ← 꿈해몽 관리
      </Link>
      <h1 className="text-h1 font-bold text-text-primary">{dream.keyword} 수정</h1>
      <DreamForm
        mode="edit"
        dreamId={dream.id}
        categories={categories}
        initialValues={{
          keyword: dream.keyword,
          category: dream.category,
          interpretation: dream.interpretation,
          numbers,
        }}
      />

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-h2 font-bold text-text-primary">
            세부 꿈 상황 {situations.length}개
          </h2>
          <Link
            href={`/admin/dreams/${dream.id}/situations/new`}
            className={buttonClassName("primary", "sm")}
          >
            세부 상황 추가
          </Link>
        </div>

        {situations.length === 0 ? (
          <EmptyState
            title="등록된 세부 상황이 없어요"
            description="이 꿈의 구체적인 상황을 추가해 콘텐츠를 확장해보세요."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {situations.map((situation) => (
              <li key={situation.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-text-primary">{situation.title}</p>
                      <p className="mt-1 text-caption text-text-secondary">
                        keyword: {situation.keyword} · 행운 숫자{" "}
                        {situation.numbers ? situation.numbers.length : 0}개 · 순서:{" "}
                        {situation.display_order}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Link
                        href={`/admin/dreams/${dream.id}/situations/${situation.id}/edit`}
                        className={buttonClassName("secondary", "sm")}
                      >
                        수정
                      </Link>
                      <DeleteDreamSituationButton
                        dreamId={dream.id}
                        situationId={situation.id}
                        title={situation.title}
                      />
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
