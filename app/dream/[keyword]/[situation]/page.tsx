import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import Container from "@/components/layout/Container";
import Badge from "@/components/ui/Badge";
import { buttonClassName } from "@/components/ui/Button";
import { getDreamSituationByKeyword } from "@/lib/api/dreamSituations";
import { getDreamByKeyword } from "@/lib/api/dreams";
import { SITE_NAME } from "@/lib/constants";
import { getEnv } from "@/lib/utils/env";

interface DreamSituationPageProps {
  params: Promise<{ keyword: string; situation: string }>;
}

// app/dream/[keyword]/page.tsx의 decodeKeyword()와 정확히 동일한 이유·동일한 구현이다
// (Next.js 이 버전 특유의 generateMetadata/페이지 컴포넌트 params 인코딩 비대칭, 실측으로
// 확인된 버그 — docs/PHASE7_DREAM_BROWSE_UI_REPORT.md §9). situation 세그먼트도 keyword와
// 똑같은 한글 텍스트 슬러그라 같은 처리가 필요해 이 라우트 전용으로 한 번 더 정의했다 —
// 기존 함수를 import해 재사용하지 않고 복제한 이유는, 그 함수가 정의된 파일이 페이지
// 컴포넌트 모듈이라 다른 라우트에서 import하면 그 파일의 나머지 export(generateMetadata 등)
// 까지 번들에 끌려 들어오는 결합을 만들기 때문이다 — 순수 유틸이라도 페이지 파일 밖으로
// 옮길 만큼의 재사용 가치(2곳뿐)는 아직 없다고 판단했다.
function decodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

// generateMetadata()와 페이지 본문이 같은 (keyword, situation) 쌍으로 두 번 조회한다 —
// app/dream/[keyword]/page.tsx의 getCachedDream과 동일한 이유로 React cache()를 쓴다.
const getCachedDream = cache(getDreamByKeyword);
const getCachedSituation = cache(getDreamSituationByKeyword);

async function resolveSituation(rawKeyword: string, rawSituation: string) {
  const dream = await getCachedDream(decodeSegment(rawKeyword));
  if (!dream) {
    return { dream: null, situation: null };
  }
  const situation = await getCachedSituation(dream.id, decodeSegment(rawSituation));
  return { dream, situation };
}

// 지시문 §23: 상황 상세 페이지는 부모 페이지와 별개로 자기만의 title/description/canonical/
// OG/Twitter를 가져야 한다(키워드 반복 없이). "{상황 title} 해몽 | 의미와 행운 숫자"는
// 지시문이 예시로 준 형태를 그대로 따랐다 — situation.title 자체가 이미 "~하는 꿈"으로
// 끝나는 자연스러운 한글 문장이라 뒤에 "해몽"만 붙여도 키워드 스터핑이 되지 않는다.
export async function generateMetadata({ params }: DreamSituationPageProps): Promise<Metadata> {
  const { keyword: rawKeyword, situation: rawSituation } = await params;
  const { dream, situation } = await resolveSituation(rawKeyword, rawSituation);

  if (!dream || !situation) {
    return { title: "꿈해몽" };
  }

  const title = `${situation.title} 해몽 | 의미와 행운 숫자`;
  const description = (situation.key_meaning ?? situation.body).slice(0, 100);
  const path = `/dream/${encodeURIComponent(dream.keyword)}/${encodeURIComponent(situation.keyword)}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: "article",
      // app/dream/[keyword]/page.tsx와 동일한 이유(페이지가 자신의 openGraph를 정의하면
      // 전역 값이 병합되지 않고 대체된다) — siteName/locale을 여기서도 다시 채운다.
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

// 지시문 §24: 4단계 BreadcrumbList — 홈 → 꿈해몽 → 부모 꿈 → 상황. app/dream/[keyword]/
// page.tsx의 buildBreadcrumbJsonLd()와 완전히 동일한 XSS 방어(</script> 조기 종료를 막기 위한
// "<" 유니코드 이스케이프)를 그대로 재사용한다 — dream.keyword와 situation.title 둘 다
// 관리자/시드가 입력한 신뢰할 수 없는 텍스트로 취급한다.
function buildBreadcrumbJsonLd(
  dream: { keyword: string },
  situation: { keyword: string; title: string }
) {
  const siteUrl = getEnv("NEXT_PUBLIC_SITE_URL");
  const dreamPath = `/dream/${encodeURIComponent(dream.keyword)}`;
  const situationPath = `${dreamPath}/${encodeURIComponent(situation.keyword)}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "꿈해몽", item: `${siteUrl}/dream` },
      { "@type": "ListItem", position: 3, name: dream.keyword, item: `${siteUrl}${dreamPath}` },
      {
        "@type": "ListItem",
        position: 4,
        name: situation.title,
        item: `${siteUrl}${situationPath}`,
      },
    ],
  };

  return JSON.stringify(jsonLd).replace(/</g, "\\u003c");
}

// 존재하지 않는 keyword/situation 조합은 notFound()로 처리한다 — app/dream/[keyword]/
// page.tsx와 동일하게 커스텀 404 화면을 새로 만들지 않는다.
export default async function DreamSituationPage({ params }: DreamSituationPageProps) {
  const { keyword: rawKeyword, situation: rawSituation } = await params;
  const { dream, situation } = await resolveSituation(rawKeyword, rawSituation);

  if (!dream || !situation) {
    notFound();
  }

  const numbers = situation.numbers ?? [];

  return (
    <Container className="flex flex-col gap-8 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildBreadcrumbJsonLd(dream, situation) }}
      />

      {/* 지시문 §10 예시 레이아웃: 홈 → 꿈해몽 → 부모 꿈 → 상황 title 순서의 breadcrumb를
          화면에도 그대로 노출한다(위 JSON-LD는 검색엔진용, 이 nav는 실제 사용자용). */}
      <nav
        aria-label="breadcrumb"
        className="flex flex-wrap items-center gap-1 text-caption text-text-secondary"
      >
        <Link href="/" className="hover:underline">
          홈
        </Link>
        <span aria-hidden="true">›</span>
        <Link href="/dream" className="hover:underline">
          꿈해몽
        </Link>
        <span aria-hidden="true">›</span>
        <Link href={`/dream/${encodeURIComponent(dream.keyword)}`} className="hover:underline">
          {dream.keyword}
        </Link>
        <span aria-hidden="true">›</span>
        <span className="text-text-primary">{situation.title}</span>
      </nav>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-h1 font-bold text-text-primary">{situation.title}</h1>
          <Badge>{dream.keyword}</Badge>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-h2 font-bold text-text-primary">꿈의 의미</h2>
        {/* situation.body는 2~4 문단 분량의 긴 텍스트라 app/dream/[keyword]/page.tsx의 해몽
            본문과 동일하게 whitespace-pre-wrap + break-words로 렌더링한다(모바일 375px 폭에서도
            가로 overflow 없이 자연스럽게 줄바꿈). dangerouslySetInnerHTML을 쓰지 않는 순수
            React 텍스트 렌더링이다(지시문 §33). */}
        <p className="whitespace-pre-wrap break-words text-body text-text-primary">
          {situation.body}
        </p>
      </section>

      {situation.key_meaning && (
        <section className="flex flex-col gap-2">
          <h2 className="text-h2 font-bold text-text-primary">핵심 해석</h2>
          <p className="text-body text-text-primary">{situation.key_meaning}</p>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-h2 font-bold text-text-primary">행운 숫자</h2>
        {/* 지시문 §11(매우 중요): 0~6개 중 실제로 존재하는 개수만 그대로 렌더링한다. 6개를
            채우기 위한 "?" placeholder를 만들지 않는다 — numbers 배열 길이만큼만 <li>가
            생긴다. "추천 로또 6개"가 아니라 "행운 숫자"라고만 라벨링해(§29) 완전한 로또
            번호 세트처럼 보이지 않게 한다. */}
        {numbers.length > 0 ? (
          <ol aria-label="행운 숫자" className="flex flex-wrap justify-center gap-3">
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
          <p className="text-center text-body text-text-secondary">
            이 꿈은 특정 숫자보다 상황 자체의 의미를 중심으로 해석해보세요.
          </p>
        )}
      </section>

      {/* 지시문 §12: 상황 전용 자동 번호 생성/저장 기능은 이번 Task 범위가 아니다. 기존
          /generate?dream= 계약(app/dream/[keyword]/page.tsx와 동일)을 그대로 재사용해 부모
          꿈 id만 넘긴다 — 이 상황을 "기억"해서 실제로 저장하거나 이후 페이지에 전달하는 기능은
          없으므로, 없는 기능을 있는 것처럼 암시하지 않기 위해 문구도 "이 꿈을 기억하며"로
          한정했다(실제로 서버에 저장되는 것은 dream.id뿐, situation은 URL/화면 표시에만 쓰인다). */}
      <Link
        href={`/generate?dream=${dream.id}`}
        className={`${buttonClassName("primary", "lg")} self-center`}
      >
        이 꿈을 기억하며 번호 생성하기
      </Link>

      {/* 지시문 §25: 부모↔상황 내부 링크 강화. 상세 페이지 하단에 "다른 [부모꿈] 해몽 보기"로
          부모 페이지로 돌아가는 링크를 둔다(위 breadcrumb의 부모 링크와는 별개로, footer
          위치에 한 번 더 자연스러운 내부 링크를 추가하라는 요구). */}
      <Link
        href={`/dream/${encodeURIComponent(dream.keyword)}`}
        className="self-center text-body text-text-secondary hover:underline"
      >
        다른 {dream.keyword} 해몽 보기
      </Link>
    </Container>
  );
}
