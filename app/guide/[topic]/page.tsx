import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import Container from "@/components/layout/Container";
import Badge from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { getGuideByTopic } from "@/lib/api/content";
import { SITE_NAME } from "@/lib/constants";
import { getEnv } from "@/lib/utils/env";

interface GuideDetailPageProps {
  params: Promise<{ topic: string }>;
}

// app/dream/[keyword]/page.tsx(Phase8-2/8-3)와 완전히 동일한 이유/패턴 — 이 Next.js 버전은
// generateMetadata()의 params는 URL 디코딩된 값을 주지만 페이지 컴포넌트의 params는 퍼센트
// 인코딩된 원본 문자열을 그대로 준다. 두 진입점 모두 decodeURIComponent()를 직접 호출해 이
// 비대칭을 흡수한다 — 이미 디코딩된 문자열에 다시 호출해도 퍼센트 인코딩 패턴이 없으면
// 그대로 반환되어 안전하다(idempotent, 중복 decode로 값이 손상되지 않음). 실제 동작은
// docs/PHASE10_PUBLIC_CONTENT_UI_REPORT.md §16 Test C(한글 topic)로 재검증했다.
function decodeTopic(rawTopic: string): string {
  try {
    return decodeURIComponent(rawTopic);
  } catch {
    return rawTopic;
  }
}

// generateMetadata()와 페이지 본문이 같은 topic으로 getGuideByTopic()을 호출한다 —
// app/dream/[keyword]/page.tsx가 cache()로 감싸는 것과 동일한 이유(같은 렌더 요청 안에서
// 한 번만 조회). lib/api/content.ts 자체는 수정하지 않는다(Phase10-1 계약 재사용, 이번
// Task 범위 제한) — 호출부에서만 감쌌다.
const getCachedGuide = cache(getGuideByTopic);

// meta description은 body(plain text, 관리자가 자유롭게 작성)에서 안전하게 뽑는다 — 줄바꿈/
// 연속 공백을 하나의 공백으로 정리한 뒤 적절한 길이로 자른다. HTML 파싱은 하지 않는다
// (body 자체가 plain text 컬럼이라 파싱할 마크업이 없음).
function buildDescription(body: string): string {
  return body.replace(/\s+/g, " ").trim().slice(0, 100);
}

// content_entries_guide_title_idx(0015, Phase10-1)가 type='guide' 행끼리 title 중복을
// DB 레벨에서 막아주므로 getGuideByTopic()의 결과는 항상 0건 또는 1건이다 — 여러 Guide 중
// 임의로 하나를 고르는 fallback을 만들 필요가 없다.
export async function generateMetadata({ params }: GuideDetailPageProps): Promise<Metadata> {
  const { topic: rawTopic } = await params;
  const guide = await getCachedGuide(decodeTopic(rawTopic));

  if (!guide) {
    // 존재하지 않는 topic은 페이지 본문에서 notFound()로 404 처리된다(§ 아래, 무변경 대상).
    // 여기서는 canonical/OG 같은 "정상 페이지처럼 보이는" 필드를 채우지 않는다
    // (app/dream/[keyword]/page.tsx의 동일한 안전장치와 같은 이유).
    return { title: "가이드" };
  }

  const title = guide.title;
  const description = buildDescription(guide.body);
  // components/dream/DreamCard.tsx/app/dream/[keyword]/page.tsx와 동일한 인코딩 규칙 —
  // sitemap.ts의 guide URL 생성과도 동일해야 canonical/sitemap/실제 링크가 항상 같은 형태를 갖는다.
  const path = `/guide/${encodeURIComponent(guide.title)}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: "article",
      // Phase8-2가 실측으로 발견한 함정(페이지가 자신의 openGraph를 정의하면 전역 openGraph를
      // 필드 단위로 병합하지 않고 완전히 대체) — siteName/locale을 여기서도 다시 채운다.
      siteName: SITE_NAME,
      locale: "ko_KR",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

// docs/PHASE10_RELEASE_GATE.md §4/§11이 이미 확정한 대로 이 프로젝트에는 /guide 목록
// route가 없다(EXECUTION_PLAN.md Phase10 §3에 app/guide/page.tsx가 없음, SITEMAP.md도
// 개별 목록 route를 명시하지 않음) — 존재하지 않는 가상 URL을 breadcrumb에 넣지 않고
// "홈 → 현재 Guide" 2단계로만 구성한다(지시문 §11 "실제 navigable page만 사용"). 마지막
// 항목의 URL은 generateMetadata()의 canonical과 동일한 encodeURIComponent(guide.title) 규칙을
// 쓴다.
function buildBreadcrumbJsonLd(guide: { title: string }): string {
  const siteUrl = getEnv("NEXT_PUBLIC_SITE_URL");
  const path = `/guide/${encodeURIComponent(guide.title)}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: siteUrl },
      { "@type": "ListItem", position: 2, name: guide.title, item: `${siteUrl}${path}` },
    ],
  };

  // guide.title은 관리자 입력 값이라(Phase9-6 관리자 CRUD) 신뢰할 수 없는 입력으로 취급한다 —
  // app/dream/[keyword]/page.tsx와 동일한 방어("<"만 유니코드 이스케이프).
  return JSON.stringify(jsonLd).replace(/</g, "\\u003c");
}

// 존재하지 않는 topic은 notFound()로 처리한다 — 빈 200 페이지나 다른 Guide로의 fallback을
// 만들지 않는다(지시문 §8). 이 프로젝트에 커스텀 app/not-found.tsx가 없어(전수 확인) Next.js
// 기본 404를 그대로 쓴다(app/dream/[keyword]/page.tsx와 동일한 기존 방식).
export default async function GuideDetailPage({ params }: GuideDetailPageProps) {
  const { topic: rawTopic } = await params;
  const guide = await getCachedGuide(decodeTopic(rawTopic));

  if (!guide) {
    notFound();
  }

  return (
    <Container className="flex flex-col gap-8 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildBreadcrumbJsonLd(guide) }}
      />
      <div>
        <Link href="/" className="text-body text-text-secondary hover:underline">
          ← 홈으로
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge>가이드</Badge>
        </div>
        <h1 className="mt-1 text-h1 font-bold text-text-primary">{guide.title}</h1>
      </div>

      <Card>
        {/* body는 관리자가 자유롭게 작성한 plain text다(content_entries.body, text 컬럼) —
            임의의 Markdown/rich text 렌더러를 추가하지 않고 줄바꿈만 보존한다
            (app/dream/[keyword]/page.tsx의 해몽 본문과 동일한 whitespace-pre-wrap 패턴).
            사용자가 저장한 값을 dangerouslySetInnerHTML로 출력하지 않는다 — React가 텍스트
            노드로 그대로 이스케이프해 렌더링한다. */}
        <CardContent className="whitespace-pre-wrap break-words">{guide.body}</CardContent>
      </Card>

      <p className="text-caption text-text-secondary">
        최종 수정: {new Date(guide.updated_at).toLocaleDateString("ko-KR")}
      </p>
    </Container>
  );
}
