import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import DreamHubContent from "@/components/dream/DreamHubContent";
import DreamSituationCard from "@/components/dream/DreamSituationCard";
import Container from "@/components/layout/Container";
import Badge from "@/components/ui/Badge";
import { buttonClassName } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { getDreamSituations } from "@/lib/api/dreamSituations";
import { getDreamByKeyword, getDreamNumbers } from "@/lib/api/dreams";
import { SITE_NAME } from "@/lib/constants";
import { getSiteUrl } from "@/lib/utils/env";
import { buildExcerpt } from "@/lib/utils/excerpt";

interface DreamDetailPageProps {
  params: Promise<{ keyword: string }>;
}

// 실측으로 발견한 문제(docs/PHASE7_DREAM_BROWSE_UI_REPORT.md §9): 이 Next.js 버전은
// generateMetadata()의 params는 URL 디코딩된 값을 주지만, 페이지 컴포넌트의 params는
// 퍼센트 인코딩된 원본 문자열을 그대로 준다(예: "돼지꿈"이 아니라 "%EB%8F%BC%EC%A7%80%EA%BF%88").
// 두 진입점 모두 decodeURIComponent()를 직접 호출해 이 비대칭을 흡수한다 — 이미 디코딩된
// 문자열에 다시 호출해도 퍼센트 인코딩 패턴이 없으면 그대로 반환되어 안전하다(idempotent).
function decodeKeyword(rawKeyword: string): string {
  try {
    return decodeURIComponent(rawKeyword);
  } catch {
    return rawKeyword;
  }
}

// generateMetadata()와 페이지 본문이 둘 다 같은 keyword로 getDreamByKeyword()를 호출한다.
// lib/api/dreams.ts는 fetch()가 아니라 Supabase 호출이라 Next.js가 자동으로 중복 요청을
// 합쳐주지 않으므로, React의 cache()로 감싸 같은 렌더 요청 안에서 한 번만 조회되게 한다.
// lib/api/dreams.ts 자체는 수정하지 않는다(이번 Task 범위 제한) — 호출부에서만 감쌌다.
const getCachedDream = cache(getDreamByKeyword);

// Phase8-2: title/description은 Phase7-2가 이미 정한 값(해몽 본문 앞 100자를 description으로
// 사용)을 그대로 재사용한다 — 25개 페이지 각각 실제 콘텐츠에서 뽑은 문구라 페이지마다 자연히
// 달라지고, 템플릿 문장으로 바꾸면 오히려 25개 페이지가 거의 같은 문구를 반복하는 결과가 된다
// (지시문 §5 "동일 keyword 반복"/"검색엔진만을 위한 부자연스러운 문장" 금지와 반대 방향).
// Open Graph/Twitter에도 같은 title/description을 재사용해 세 곳에 서로 다른 문구를 새로
// 짓지 않는다(허위/과장 표현을 만들 여지 자체를 없앰).
export async function generateMetadata({ params }: DreamDetailPageProps): Promise<Metadata> {
  const { keyword: rawKeyword } = await params;
  const dream = await getCachedDream(decodeKeyword(rawKeyword));

  if (!dream) {
    // 존재하지 않는 keyword는 페이지 본문에서 notFound()로 404 처리된다(§4, 무변경). 여기서는
    // canonical/OG 같은 "정상 페이지처럼 보이는" 필드를 채우지 않고 title만 반환한다 — 실제
    // Next.js 동작상 이 메타데이터는 404 응답에 쓰이지 않지만(HEAD 요청 등 generateMetadata가
    // notFound() 이전에 먼저 실행될 수 있는 경로 대비), 존재하지 않는 꿈을 가리키는 canonical/
    // OG url을 만들어내지 않기 위한 안전장치다.
    return { title: "꿈해몽" };
  }

  const title = `${dream.keyword} 해몽`;
  // claude-code-luck-platform-fortune-domain-followup-prompt.md §17: 기존에는 "## " 줄만
  // 걸러내고 나머지는 100자에서 그대로 slice해, 문장 중간(예: "...돼지가 직접 다")에서 끊기는
  // 사례가 실제 배포본에서 확인됐다. buildExcerpt()가 heading 제거 + 문장 경계 보존을 함께
  // 처리한다 — 레거시 Parent(헤딩 없는 한 문단)에서는 기존과 동일하게 동작한다.
  const description = buildExcerpt(dream.interpretation, 100);
  // 기존 DreamCard.tsx(components/dream/DreamCard.tsx:18)가 이미 쓰는 것과 동일한 인코딩
  // 규칙 — 이 페이지로 들어오는 실제 링크와 canonical/OG url이 항상 같은 형태를 갖는다.
  const path = `/dream/${encodeURIComponent(dream.keyword)}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: "article",
      // 페이지가 자신의 openGraph 객체를 정의하면 Next.js는 app/layout.tsx의 전역 openGraph를
      // 필드 단위로 병합하지 않고 이 객체로 완전히 대체한다(실측으로 확인, 병합되지 않으면
      // og:site_name이 사라짐) — siteName/locale을 여기서 다시 채워 전역 값을 그대로 재사용한다
      // (지시문 §2 "siteName이 이미 전역 설정되어 있다면... 기존 설정을 재사용", 문자열을 새로
      // 짓지 않고 SITE_NAME 상수를 그대로 가져다 씀).
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

// Phase8-3: 홈/꿈해몽 페이지가 실제 UI에서 이미 쓰고 있는 문구를 그대로 재사용한다 — "홈"은
// components/navigation/BottomNavigation.tsx의 label, "꿈해몽"은 components/navigation/
// GlobalNav.tsx의 label과 동일하다(§7 "재사용", 새 문구를 짓지 않음). 절대 URL은
// app/layout.tsx의 metadataBase와 동일한 환경변수(getSiteUrl())로 만든다 —
// 새 상수/유틸을 추가하지 않는다. 마지막 항목의 경로는 generateMetadata()의 path와 동일하게
// components/dream/DreamCard.tsx가 쓰는 encodeURIComponent() 규칙을 그대로 따른다.
function buildBreadcrumbJsonLd(dream: { keyword: string }) {
  const siteUrl = getSiteUrl();
  const path = `/dream/${encodeURIComponent(dream.keyword)}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "꿈해몽", item: `${siteUrl}/dream` },
      { "@type": "ListItem", position: 3, name: dream.keyword, item: `${siteUrl}${path}` },
    ],
  };

  // dream.keyword는 관리자가 입력하는 값이라(현재는 seed, Phase9에서 CRUD 예정) 원천적으로
  // 신뢰할 수 없는 입력으로 취급한다. JSON.stringify()는 따옴표는 이스케이프하지만
  // "</script>" 시퀀스는 그대로 두므로, 이 문자열이 keyword에 들어있으면 <script> 태그가
  // 조기 종료되는 well-known JSON-LD XSS 벡터가 된다 — "<"만 유니코드 이스케이프해 태그
  // 조기 종료 자체를 원천 차단한다(공개 콘텐츠 외에는 아무 것도 담지 않음, user_id/세션/
  // DB 원본 등은 애초에 이 객체에 존재하지 않는다).
  return JSON.stringify(jsonLd).replace(/</g, "\\u003c");
}

// 존재하지 않는 keyword는 notFound()로 처리한다 — 이 프로젝트에 커스텀 app/not-found.tsx가
// 없어(전수 확인) Next.js 기본 404를 그대로 쓰는 것이 "기존 방식"이다. 새 404 화면을 만들지
// 않는다.
export default async function DreamDetailPage({ params }: DreamDetailPageProps) {
  const { keyword: rawKeyword } = await params;
  const dream = await getCachedDream(decodeKeyword(rawKeyword));

  if (!dream) {
    notFound();
  }

  const [numbers, situations] = await Promise.all([
    getDreamNumbers(dream.id),
    getDreamSituations(dream.id),
  ]);

  return (
    <Container className="flex flex-col gap-8 py-10">
      {/* Phase8-3: BreadcrumbList JSON-LD. notFound()가 이미 위에서 함수를 끝냈으므로 이
          아래 코드는 실제로 존재하는 꿈에서만 실행된다 — 존재하지 않는 keyword에 대해
          BreadcrumbList가 생성될 경로 자체가 없다. 'use client' 없이 서버 컴포넌트에서
          그대로 렌더링 가능한 정적 <script> 태그다(지시문 §5, 새 클라이언트 경계 불필요). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildBreadcrumbJsonLd(dream) }}
      />
      <div>
        <Link href="/dream" className="text-body text-text-secondary hover:underline">
          ← 전체 꿈해몽 보기
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-h1 font-bold text-text-primary">{dream.keyword}</h1>
          {dream.category && <Badge>{dream.category}</Badge>}
        </div>
      </div>

      <Card>
        {/* Phase10-9 §11/§12: interpretation이 "## 소제목" 섹션을 담고 있으면 DreamHubContent가
            실제 <h2>로 나눠 렌더링하고("이 꿈은 보통 어떻게 해석할까?" 등 Parent hub 구조), 없으면
            기존처럼 한 문단으로 보여준다(하위 호환 — 레거시 25개 Parent는 지금과 동일하게 보인다). */}
        <CardContent>
          <DreamHubContent interpretation={dream.interpretation} />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-h2 font-bold text-text-primary">이 꿈의 추천 번호</h2>
        {numbers ? (
          <ol aria-label="추천 번호" className="flex flex-wrap justify-center gap-3">
            {numbers.map((n) => (
              <li
                key={n}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-button font-bold text-white"
              >
                {n}
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState
            title="아직 추천 번호가 없어요"
            description="이 꿈에 대한 추천 번호는 준비 중이에요."
          />
        )}
      </section>

      {/* Phase10-4D §9: 부모 꿈의 기존 설명/추천번호/CTA는 전혀 건드리지 않고, 세부 상황
          목록만 추가 섹션으로 얹는다. situations가 0건이면 섹션 자체를 렌더링하지 않는다 —
          "이 꿈에는 이런 상황도 있어요"라는 문구가 상황이 하나도 없을 때 나타나면 오히려
          어색하다(§28 컴팩트 카드, SSR로 JS 없이도 raw HTML에 존재해야 한다는 §22 요구는
          이 페이지 자체가 서버 컴포넌트라 자동으로 만족된다). */}
      {situations.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-h2 font-bold text-text-primary">이 꿈에는 이런 상황도 있어요</h2>
          <ul className="flex flex-col gap-2">
            {situations.map((situation) => (
              <li key={situation.id}>
                <DreamSituationCard dreamKeyword={dream.keyword} situation={situation} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Phase7-3: 이 꿈의 dream.id를 /generate로 전달한다(쿼리파라미터, docs/PHASE7_DREAM_
          NUMBER_INTEGRATION_REPORT.md §7) — 위 추천번호를 그대로 저장하는 것이 아니라,
          /generate가 매번 그렇듯 generateNumbers()로 새로 생성한 번호를 이 꿈과 연결해
          저장한다(§8 "꿈의 추천번호를 그대로 user_numbers에 저장하지 않는다"). 최종 저장
          검증은 서버(POST /api/numbers)가 다시 하므로 이 링크의 dream id는 참고용일 뿐이다. */}
      <Link
        href={`/generate?dream=${dream.id}`}
        className={`${buttonClassName("primary", "lg")} self-center`}
      >
        이 꿈으로 번호 생성하기
      </Link>

      {/* Phase7-4: /generate 링크와 동일하게 dream.id를 쿼리파라미터로 넘긴다. 비로그인
          사용자가 눌러도 이 페이지 자체는 로그인 필수로 만들지 않는다(지시문 §11) — 이동한
          app/my/journal/dreams/new/page.tsx가 기존 /my/journal/* 인증 패턴대로 미로그인이면
          /login?next=...으로 보낸다. */}
      <Link
        href={`/my/journal/dreams/new?dream=${dream.id}`}
        className={`${buttonClassName("secondary", "lg")} self-center`}
      >
        이 꿈 기록하기
      </Link>
    </Container>
  );
}
