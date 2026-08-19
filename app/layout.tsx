import type { Metadata } from "next";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import Main from "@/components/layout/Main";
import PageShell from "@/components/layout/PageShell";
import BottomNavigation from "@/components/navigation/BottomNavigation";
import { SITE_NAME } from "@/lib/constants";
import { getSiteUrl } from "@/lib/utils/env";

import "./globals.css";

const SITE_DESCRIPTION = "행운을 기록하고, 관리하고, 공유하는 플랫폼";

// lib/auth/kakao.ts(getKakaoRedirectUri)가 이미 쓰는 것과 동일한 기존 컨벤션(NEXT_PUBLIC_
// SITE_URL, .env.example)을 그대로 재사용한다 — SEO 전용 새 환경변수를 추가하지 않는다.
// metadataBase가 있어야 canonical/Open Graph의 상대 경로가 절대 URL로 해석된다(Phase8-0
// 감사가 확인한 "이미 존재하는 convention 우선 사용" 원칙).
const metadataBase = new URL(getSiteUrl());

// title template: 페이지가 자신의 title을 문자열로만 지정하면(예: app/dream/page.tsx의
// "꿈해몽") Next.js가 이 template에 꽂아 "꿈해몽 | Luck Platform"으로 렌더링한다. 페이지가
// title을 아예 지정하지 않으면(예: 홈, app/page.tsx) default 값만 그대로 쓰인다(template
// 미적용 — Next.js 기본 동작). 기존에 이미 title을 지정해 둔 페이지(Dream 상세/카테고리,
// /generate, /my/journal/*)의 콘텐츠 자체는 건드리지 않는다 — 사이트명이 뒤에 덧붙을 뿐이다.
export const metadata: Metadata = {
  metadataBase,
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  // 사이트 기본 정책은 "색인 허용"이다. 개인화·비공개 페이지(/my/*, /login 등)는 각 페이지가
  // 이미 개별적으로 robots: {index:false, follow:false}를 지정해 이 기본값을 덮어쓴다
  // (app/my/journal/*.tsx, app/ui-preview/page.tsx에 이미 존재하는 패턴).
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    locale: "ko_KR",
  },
  // 공유용 이미지 자산(public/ 아래 OG 이미지)이 아직 없어(전수 확인) images를 지정하지
  // 않는다 — 존재하지 않는 이미지 경로를 넣으면 공유 미리보기가 깨진 상태로 노출된다.
  // Phase8-2 후속 작업으로 남긴다(보고서 §17).
  twitter: {
    card: "summary",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

// Phase8-4: 사이트 전역 WebSite JSON-LD. name/url은 이 파일이 이미 계산해 둔 SITE_NAME/
// metadataBase를 그대로 재사용한다(§3 "새 상수/유틸을 만들지 않는다") — metadataBase가
// 이미 URL 인스턴스이므로 getSiteUrl()을 다시 호출하지 않고 .href만
// 꺼내 쓴다. 이 레이아웃은 모든 페이지가 공유하므로 여기 한 번만 두면 페이지마다 반복
// 추가할 필요가 없다(app/dream/[keyword]/page.tsx의 BreadcrumbList와 달리 페이지별 데이터가
// 필요 없어 RootLayout 밖으로 함수를 분리할 이유도 없다).
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: metadataBase.href,
};

// SITE_NAME/metadataBase 둘 다 이 파일 상단에서 상수/환경변수로만 계산되는 값이라(사용자
// 입력이 이 객체에 들어올 경로가 없음) 원칙적으로 "</script>" 조기 종료 위험이 없다. 그래도
// app/dream/[keyword]/page.tsx(Phase8-3)가 같은 JSON-LD 임베딩 지점에 적용한 것과 동일한
// 수준의 방어를 유지해, 이후 이 값들이 바뀌더라도(예: SITE_NAME이 관리자 설정값으로
// 바뀌는 경우) 안전장치가 이미 있는 상태를 그대로 지킨다.
const websiteJsonLdScript = JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c");

// 모든 페이지가 공유하는 레이아웃 기반. Header → Main → Footer → BottomNavigation 순서로
// PageShell 안에 형제로 쌓는다(Phase3-3, docs/PHASE3_HEADER_FOOTER_REPORT.md) — Phase3-2가
// 미리 만들어둔 PageShell/Main 구조를 그대로 재사용했다. BottomNavigation은 fixed 포지션이라
// DOM 순서가 화면 위치에 영향을 주지 않지만, 키보드 tab 순서상 페이지 콘텐츠 다음에 오는 것이
// 자연스러워 마지막에 둔다(docs/PHASE3_BOTTOM_NAVIGATION_REPORT.md).
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        {/* Phase8-4: 페이지 콘텐츠와 무관하게 항상 렌더링되는 사이트 전역 구조화 데이터라
            PageShell 밖, body의 첫 자식으로 둔다 — 'use client' 없이 서버 컴포넌트에서 그대로
            렌더링 가능한 정적 <script> 태그다(지시문 §3, 새 클라이언트 경계 불필요). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: websiteJsonLdScript }}
        />
        <PageShell>
          <Header />
          <Main>{children}</Main>
          <Footer />
          <BottomNavigation />
        </PageShell>
      </body>
    </html>
  );
}
