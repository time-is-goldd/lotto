import type { Metadata } from "next";

import Container from "@/components/layout/Container";
import EmptyState from "@/components/ui/EmptyState";
import { getFaqEntries, type PublicContentEntry } from "@/lib/api/content";
import { SITE_NAME } from "@/lib/constants";

// docs/PHASE10_RELEASE_GATE.md §3/§16이 이미 확정한 대로 /faq는 단일 목록 페이지다 —
// EXECUTION_PLAN.md Phase10 §3에 상세 라우트(예: /faq/[id])는 없다. app/dream/page.tsx와
// 동일하게 정적 export const metadata를 쓴다(페이지 텍스트 자체는 FAQ 콘텐츠와 무관 —
// title/description이 요청마다 달라질 이유가 없다).
const TITLE = "자주 묻는 질문";
const DESCRIPTION = "Luck Platform 이용에 대해 자주 묻는 질문과 답변을 확인해보세요.";
const PATH = "/faq";

// app/dream/[keyword]/page.tsx(Phase8-2)가 이미 겪은 함정(페이지가 자신의 openGraph를
// 정의하면 app/layout.tsx의 전역 openGraph를 필드 단위로 병합하지 않고 완전히 대체한다)을
// 반복하지 않기 위해 siteName/locale을 여기서도 다시 채운다.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PATH,
    type: "website",
    siteName: SITE_NAME,
    locale: "ko_KR",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// 실제 화면에 그대로 표시되는 질문/답변만 mainEntity에 담는다(지시문 §6) — DB에 없는 내용을
// 만들어내지 않는다. 호출부(FaqPage)가 entries.length === 0일 때는 이 함수 자체를 호출하지
// 않아 EmptyState 상태에서 FAQPage JSON-LD가 출력되지 않는다.
function buildFaqPageJsonLd(entries: PublicContentEntry[]): string {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.title,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.body,
      },
    })),
  };

  // title/body는 관리자가 입력하는 값이라(Phase9-6 관리자 CRUD) 신뢰할 수 없는 입력으로
  // 취급한다. app/dream/[keyword]/page.tsx(Phase8-3)/app/layout.tsx(Phase8-4)와 동일하게
  // "<"만 유니코드 이스케이프해 "</script>" 조기 종료를 원천 차단한다.
  return JSON.stringify(jsonLd).replace(/</g, "\\u003c");
}

// getFaqEntries()(lib/api/content.ts, Phase10-1)를 그대로 재사용한다 — 여기서 새 Supabase
// query를 작성하지 않는다. 정렬(display_order asc → id asc)은 그 함수의 계약을 그대로 신뢰한다.
export default async function FaqPage() {
  const entries = await getFaqEntries();

  return (
    <Container className="flex flex-col gap-8 py-10">
      {entries.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: buildFaqPageJsonLd(entries) }}
        />
      )}

      <div>
        <h1 className="text-h1 font-bold text-text-primary">{TITLE}</h1>
        <p className="mt-2 text-body text-text-secondary">{DESCRIPTION}</p>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title="아직 등록된 FAQ가 없어요"
          description="곧 자주 묻는 질문을 만나보실 수 있어요."
        />
      ) : (
        // <details>/<summary> — 접근성 기본 제공(키보드 토글, 스크린리더 expanded 상태)에
        // JavaScript가 전혀 필요 없고, 질문/답변 텍스트가 항상 SSR HTML에 그대로 존재해
        // 검색엔진이 실제 내용을 읽을 수 있다(지시문 §4). 외부 accordion 라이브러리나 새
        // Client Component를 추가하지 않는다. 시각 스타일은 components/ui/Card.tsx가 이미
        // 쓰는 값(rounded-card bg-bg-subtle p-4 shadow-card)을 그대로 재사용한다 — <details>가
        // 그 컴포넌트의 <div> 래퍼를 대체할 수 없어 클래스만 가져다 쓴다.
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <details key={entry.id} className="rounded-card bg-bg-subtle p-4 shadow-card">
              <summary className="cursor-pointer text-h2 font-bold text-text-primary">
                {entry.title}
              </summary>
              <p className="mt-2 whitespace-pre-wrap break-words text-body text-text-primary">
                {entry.body}
              </p>
            </details>
          ))}
        </div>
      )}
    </Container>
  );
}
