import type { Metadata } from "next";
import Link from "next/link";

import DreamCard from "@/components/dream/DreamCard";
import DreamCategoryNav from "@/components/dream/DreamCategoryNav";
import Container from "@/components/layout/Container";
import EmptyState from "@/components/ui/EmptyState";
import { getDreamCategories, getDreams } from "@/lib/api/dreams";

interface DreamCategoryPageProps {
  params: Promise<{ category: string }>;
}

// 실측으로 발견한 문제(docs/PHASE7_DREAM_BROWSE_UI_REPORT.md §9): 이 Next.js 버전은
// generateMetadata()의 params는 URL 디코딩된 값을 주지만, 페이지 컴포넌트의 params는
// 퍼센트 인코딩된 원본 문자열을 그대로 준다(예: "동물"이 아니라 "%EB%8F%99%EB%AC%BC"). 두
// 진입점 모두 decodeURIComponent()를 직접 호출해 이 비대칭을 흡수한다 — 이미 디코딩된
// 문자열에 다시 호출해도 퍼센트 인코딩 패턴이 없으면 그대로 반환되어 안전하다(idempotent).
function decodeCategory(rawCategory: string): string {
  try {
    return decodeURIComponent(rawCategory);
  } catch {
    return rawCategory;
  }
}

// category는 실제 DB 값(동물/신체/인물/상황/자연/행동/사물)을 그대로 URL 세그먼트로 쓴다 —
// 별도 slug 매핑이 없다.
export async function generateMetadata({ params }: DreamCategoryPageProps): Promise<Metadata> {
  const { category: rawCategory } = await params;
  const category = decodeCategory(rawCategory);

  return {
    title: `${category} 꿈해몽`,
    description: `${category} 관련 꿈풀이 모음. 궁금한 꿈 키워드를 눌러 해몽과 추천 번호를 확인해보세요.`,
    alternates: { canonical: `/dream/category/${encodeURIComponent(category)}` },
  };
}

// DB에 실제로 존재하는 category 값 목록을 고정 상수로 두지 않고 getDreams({ category })를
// 그대로 호출한다 — 존재하지 않거나 오타인 카테고리 값이 와도 에러가 아니라 빈 배열이
// 반환되므로(lib/api/dreams.ts 계약) 아래에서 EmptyState로 자연스럽게 처리된다. 별도로
// notFound()를 걸지 않은 이유: category는 keyword와 달리 애초에 "이 값이 존재해야만 유효한
// 리소스"가 아니라 자유 텍스트 필터라, 결과가 없다는 것 자체가 정상적인 상태이기 때문이다.
export default async function DreamCategoryPage({ params }: DreamCategoryPageProps) {
  const { category: rawCategory } = await params;
  const category = decodeCategory(rawCategory);
  const [categories, dreams] = await Promise.all([getDreamCategories(), getDreams({ category })]);

  return (
    <Container className="flex flex-col gap-8 py-10">
      <div>
        <Link href="/dream" className="text-body text-text-secondary hover:underline">
          ← 전체 꿈해몽 보기
        </Link>
        <h1 className="mt-2 text-h1 font-bold text-text-primary">{category} 꿈해몽</h1>
      </div>

      <DreamCategoryNav categories={categories} activeCategory={category} />

      {dreams.length === 0 ? (
        <EmptyState
          title={`아직 등록된 ${category} 꿈해몽이 없어요`}
          description="다른 카테고리를 확인해보세요."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {dreams.map((dream) => (
            <li key={dream.id}>
              <DreamCard dream={dream} />
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
