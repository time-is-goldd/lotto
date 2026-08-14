import type { Metadata } from "next";

import Container from "@/components/layout/Container";
import { SITE_NAME } from "@/lib/constants";

// docs/SITEMAP.md §4: /login은 P3(noindex) 페이지다. 다른 P3 페이지(/my/journal/*,
// /ui-preview)와 다르게 이 페이지는 로그인 여부와 무관하게 누구에게나(크롤러 포함) 그대로
// 렌더링된다(getCurrentUser() 확인이나 redirect가 없음, 코드 직접 확인) — 검색엔진이 실제로
// 색인할 수 있는 콘텐츠가 있는 유일한 P3 경로라 명시적으로 noindex를 지정한다.
export const metadata: Metadata = {
  title: "로그인",
  robots: { index: false, follow: false },
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

// proxy.ts가 비로그인 사용자를 여기로 보낸다(?next=<원래 경로>). 로그인 완료 후 next로
// 되돌아가는 것은 app/api/auth/kakao/login·callback(OAuth 라우트)이 이 파라미터를 받아야
// 가능한데, 이번 Task는 OAuth 수정을 금지하므로 next는 안내 문구에만 쓰고 실제 이동에는
// 반영하지 않는다(docs/PHASE2_PROXY_REPORT.md §5 "해결하지 않은 문제").
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <Container className="flex flex-1 flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-bold text-neutral-900">{SITE_NAME}</h1>
      <p className="mt-2 text-base text-neutral-500">
        {params.next
          ? "계속하려면 로그인이 필요합니다."
          : "카카오 계정으로 로그인해주세요."}
      </p>
      <a
        href="/api/auth/kakao/login"
        className="mt-8 rounded-md bg-[#FEE500] px-6 py-3 text-base font-medium text-[#191919]"
      >
        카카오로 로그인
      </a>
    </Container>
  );
}
