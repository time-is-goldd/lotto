import type { Metadata } from "next";

import DreamCard from "@/components/dream/DreamCard";
import DreamCategoryNav from "@/components/dream/DreamCategoryNav";
import DreamSearchInput from "@/components/dream/DreamSearchInput";
import Container from "@/components/layout/Container";
import EmptyState from "@/components/ui/EmptyState";
import { getDreamCategories, getDreams } from "@/lib/api/dreams";

// docs/SITEMAP.md §4: /dream/*는 P0(최우선 SEO) 공개 콘텐츠라 noindex를 붙이지 않는다
// (app/generate/page.tsx와 동일한 원칙, /my/journal/*의 noindex와는 다름).
export const metadata: Metadata = {
  title: "꿈해몽",
  description: "동물, 자연, 사물 등 다양한 꿈풀이로 나만의 행운번호를 찾아보세요.",
};

// 완전히 공개된 콘텐츠 목록이라 getCurrentUser()를 호출하지 않는다(docs/PHASE7_PRE_IMPLEMENTATION_
// AUDIT.md §4/§5, lib/api/dreams.ts 자체도 인증을 요구하지 않도록 설계됨). "인기/대표" 개념은
// 스키마에 없어(조회수 등 트래킹 컬럼 없음) 임의로 만들지 않고 전체 목록을 그대로 보여준다
// (25건 규모라 별도 축약이 필요 없음, Phase7-1이 이미 페이지네이션을 만들지 않기로 결정한 것과
// 같은 이유).
export default async function DreamHubPage() {
  const [categories, dreams] = await Promise.all([getDreamCategories(), getDreams()]);

  return (
    <Container className="flex flex-col gap-8 py-10">
      <div>
        <h1 className="text-h1 font-bold text-text-primary">꿈해몽</h1>
        <p className="mt-2 text-body text-text-secondary">
          꿈풀이로 나만의 행운번호를 찾아보세요. 궁금한 꿈 키워드를 눌러 해몽과 추천 번호를 확인해보세요.
        </p>
      </div>

      {/* Phase10-9 §29/§30: Parent가 45개로 늘어나면서 카드 그리드만으로는 원하는 꿈을 바로
          찾기 어려울 수 있어 검색 입력을 추가했다 — 새 검색 결과 페이지를 만들지 않고
          입력창 아래 드롭다운으로 몇 개만 보여주는 최소 구현이다(DreamSearchInput.tsx). */}
      <DreamSearchInput />

      {categories.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-h2 font-bold text-text-primary">카테고리</h2>
          <DreamCategoryNav categories={categories} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-h2 font-bold text-text-primary">꿈 키워드</h2>
        {dreams.length === 0 ? (
          <EmptyState
            title="아직 등록된 꿈해몽이 없어요"
            description="곧 다양한 꿈풀이를 만나보실 수 있어요."
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
      </section>
    </Container>
  );
}
