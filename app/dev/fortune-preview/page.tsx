import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Container from "@/components/layout/Container";

import FortunePreviewClient from "./FortunePreviewClient";

// PART F/K 핵심 조건: production에서는 반드시 404. 이 검사는 요청마다 서버에서 실행되고,
// next build 자체도 NODE_ENV=production으로 실행되므로 프로덕션 배포본에서는 이 페이지
// 요청이 항상 notFound()로 귀결된다 — 실제로 production build를 만들어 이 라우트를 직접
// 요청해 404를 확인했다. DB 조회·인증 세션 확인·service_role 사용이 전혀 없다 — 그 아래
// FortunePreviewClient도 고정 fixture만 쓴다(PART G).
//
// 알려진 한계(docs/UX_VISUAL_VERIFICATION_REPORT.md에 기록): 이 "페이지"가 production에서
// 404가 되는 것과, FortunePreviewClient의 JS 청크 자체가 production 빌드 산출물
// (/_next/static/chunks/*)에서 완전히 제거되는 것은 별개다 — 동적 import로 바꿔도 Next.js가
// 청크를 미리 생성해두는 것을 실제 빌드로 확인해, 코드 복잡도만 늘리는 정적 import를
// 그대로 유지하기로 했다. 그 청크 안의 문자열은 전부 PART G의 고정 fixture이며 실제
// 사용자 데이터가 전혀 없어(§K "실제 user data 0" 충족) 그 청크가 만에 하나 직접
// 조회되어도 개인정보 노출은 아니다 — 다만 청크 파일명은 매 빌드마다 바뀌는 해시이고
// 어떤 production 페이지의 HTML/sitemap/robots에서도 링크되지 않아 실질적으로 발견
// 가능성이 매우 낮다.
export const metadata: Metadata = {
  title: "Fortune Preview (Dev Only)",
  robots: { index: false, follow: false },
};

export default function FortunePreviewPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <Container className="py-10">
      <FortunePreviewClient />
    </Container>
  );
}
