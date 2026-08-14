import Link from "next/link";

interface DreamCategoryNavProps {
  categories: string[];
  activeCategory?: string;
}

// app/dream/page.tsx와 app/dream/category/[category]/page.tsx 2곳에서 동일한 카테고리 목록
// 내비게이션이 반복돼 공통 컴포넌트로 뺐다. 카테고리 값은 lib/api/dreams.ts의
// getDreamCategories()가 반환하는 실제 DB 값을 그대로 받는다 — 7개 목록을 이 컴포넌트
// 안에 하드코딩하지 않는다(docs/PHASE7_DREAM_READ_SERVICE_REPORT.md §3 "DB가 유일한 진실
// 소스" 결정을 그대로 따름). 영문 slug 없이 한글 값을 그대로 URL 세그먼트로 쓴다(기존
// [keyword] 라우트 컨벤션과 동일, encodeURIComponent로 공백/특수문자만 안전하게 처리).
export default function DreamCategoryNav({ categories, activeCategory }: DreamCategoryNavProps) {
  return (
    <nav aria-label="꿈해몽 카테고리" className="flex flex-wrap gap-2">
      {categories.map((category) => {
        const isActive = category === activeCategory;
        return (
          <Link
            key={category}
            href={`/dream/category/${encodeURIComponent(category)}`}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-body font-medium ${
              isActive ? "bg-primary text-white" : "bg-bg-subtle text-text-secondary"
            }`}
          >
            {category}
          </Link>
        );
      })}
    </nav>
  );
}
