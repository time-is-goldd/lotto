import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import DreamSearchInput from "@/components/dream/DreamSearchInput";
import Container from "@/components/layout/Container";
import { buttonClassName } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { SITE_NAME } from "@/lib/constants";

interface HomeProps {
  searchParams: Promise<{ profile?: string }>;
}

// claude-code-luck-platform-fortune-domain-followup-prompt.md §15: Home에 canonical이 아예
// 없었다 — 다른 공개 페이지들과 동일하게 self-referencing canonical을 추가한다.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

interface FeatureItem {
  title: string;
  description: string;
  href: string;
}

// §15 "기능 카드 순서를 꿈해몽 → 번호 생성 → 오늘의 행운 → 당첨확인 → 기록으로 조정한다".
// 설명 문구도 실제 동작 그대로로 고쳤다 — "AI가 추천하는"은 실제 AI를 쓰지 않아 삭제했다
// (§15, lib/logic/generateNumbers.ts는 Math.random() 기반 순수 무작위 생성).
const FEATURES: FeatureItem[] = [
  {
    title: "꿈해몽",
    description: "궁금한 꿈을 검색해 의미와 행운 숫자를 확인해보세요.",
    href: "/dream",
  },
  {
    title: "번호 생성",
    description: "꿈 숫자와 무작위 숫자로 나만의 번호를 만들어보세요.",
    href: "/generate",
  },
  {
    title: "오늘의 행운",
    description: "로그인 없이도 생년월일로 오늘의 운세를 바로 확인해보세요.",
    href: "/fortune",
  },
  {
    title: "당첨확인",
    description: "저장한 번호와 이번 회차 결과를 자동으로 비교해보세요.",
    href: "/my/journal/results",
  },
  {
    title: "기록",
    description: "번호와 운세, 꿈 기록을 한곳에 모아보세요.",
    href: "/my/journal",
  },
];

// §15: "관리 가능한 실제 주요 꿈 링크가 있다면 많이 찾는 꿈으로 대체한다" — 조회수 등 실제
// 인기도 추적 컬럼이 없어(dreams 테이블에 그런 컬럼 자체가 없음, supabase/migrations/0003) 임의로
// "인기"를 지어내지 않는다. 대신 supabase/migrations/0010_seed_data.sql에 실제로 존재하는
// Parent 키워드 중 잘 알려진 것만 골라 코드로 관리하는 정적 목록이다.
const POPULAR_DREAM_KEYWORDS = [
  "돼지꿈",
  "뱀꿈",
  "이빨 빠지는 꿈",
  "로또 당첨되는 꿈",
  "물에 빠지는 꿈",
  "돈을 줍는 꿈",
];

// docs/MASTER_PRD.md §5 핵심 가치 제안 표에 이미 승인된 문구를 그대로 가져왔다 — 새 마케팅
// 카피를 지어내지 않았다. §15: 구현되지 않은 "연말 결산 리포트" 약속은 삭제했다.
const VALUE_PROPS = [
  "번호를 뽑고, 운세를 보고, 그 기록이 전부 내 행운일기에 남아요",
  "글씨 크고 버튼 크고, 헷갈리지 않는 화면으로 만들었어요",
  "매주 행운일기를 열어보면 나의 행운 역사가 한눈에 보여요",
];

// 카카오 콜백(app/api/auth/kakao/callback/route.ts)이 profile 없는 사용자를
// /?login=success&profile=pending 으로 보낸다(docs/PHASE2_KAKAO_E2E_REPORT.md) —
// 이 쿼리를 감지해 온보딩으로 안내한다. OAuth 콜백 자체는 수정하지 않는다.
export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;

  if (params.profile === "pending") {
    redirect("/onboarding");
  }

  return (
    <>
      {/* 1. Hero — §15 권장 문구. 꿈 검색이 가장 강한 행동이라 DreamSearchInput을 여기서도
          재사용한다(components/dream/DreamSearchInput.tsx, 지금까지 /dream에서만 쓰였다).
          location="home"으로 넘겨 dream_search_submitted 이벤트가 어디서 검색했는지 구분한다. */}
      <section aria-labelledby="hero-heading" className="bg-bg-base py-16">
        <Container className="flex flex-col items-center gap-4 text-center">
          <h1 id="hero-heading" className="text-display font-bold text-text-primary">
            어젯밤 꿈, 무슨 뜻일까요?
          </h1>
          <p className="max-w-md text-body-lg text-text-secondary">
            꿈의 의미를 확인하고, 꿈에서 얻은 행운 숫자로 이번 주 번호까지 만들어보세요.
          </p>
          <div className="w-full max-w-sm text-left">
            <DreamSearchInput location="home" />
          </div>

          {/* §15: "검색창 아래에는 많이 찾는 꿈 4~6개를 짧은 링크로 제공" */}
          <ul className="flex flex-wrap justify-center gap-2">
            {POPULAR_DREAM_KEYWORDS.map((keyword) => (
              <li key={keyword}>
                <Link
                  href={`/dream/${encodeURIComponent(keyword)}`}
                  className="rounded-full border border-border px-3 py-1 text-caption text-text-secondary hover:border-primary hover:text-primary"
                >
                  {keyword}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/dream" className={buttonClassName("primary", "lg")}>
              꿈 해몽 찾기
            </Link>
            <Link href="/generate" className={buttonClassName("secondary", "lg")}>
              바로 번호 생성
            </Link>
          </div>
        </Container>
      </section>

      {/* 2. 주요 기능 — GENERATE_HOME_UX_FIX Task §L/M: 카드 5개를 grid-cols-4로 배치하면
          4+1(마지막 한 장이 혼자 다음 줄에 왼쪽 정렬로 떨어짐)이 된다. Container의
          max-w-content(1200px, docs/DESIGN_SYSTEM.md §7)가 뷰포트가 아무리 넓어도 콘텐츠
          영역을 1200px로 고정하므로, 1280px/1440px에서도 실제 렌더 폭은 동일하다 — "아주
          넓은 desktop에서 5개 한 줄"이 이 사이트에서는 실질적으로 발생하지 않는다고 판단해
          3열을 상한으로 정했다. CSS Grid 대신 Flexbox(flex-wrap + justify-center)를 쓴 이유는
          Grid로는 "마지막 줄에 남는 카드들을 가운데 정렬"하는 것이 nth-child 트릭 없이는
          어렵지만, flex-wrap은 justify-center 하나로 마지막 줄이 몇 개가 남든 자동으로
          가운데 정렬되기 때문이다(1024px 이상에서 3+2 배치 시 2번째 줄이 자동으로 가운데로
          옴). 각 카드 너비는 gap(1rem)을 감안한 calc()로 지정한다.
          375px: 1열 / 640px~: 2열 / 1024px~: 3열(마지막 줄 자동 중앙 정렬). 5개 전부
          실제로 구현·연결되어 있어(Phase10-4C 이후) "준비 중" Badge 분기를 더 이상 쓰지 않는다. */}
      <section aria-labelledby="features-heading" className="bg-bg-subtle py-16">
        <Container>
          <h2 id="features-heading" className="text-h2 font-bold text-text-primary">
            주요 기능
          </h2>
          <nav aria-label="주요 기능" className="mt-6 flex flex-wrap justify-center gap-4">
            {FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)]"
              >
                <Link href={feature.href} className="block h-full">
                  <Card className="flex h-full flex-col">
                    <CardHeader>
                      <h3 className="text-h2 font-bold text-text-primary">{feature.title}</h3>
                    </CardHeader>
                    <CardContent className="flex-1">{feature.description}</CardContent>
                  </Card>
                </Link>
              </article>
            ))}
          </nav>
        </Container>
      </section>

      {/* 3. 서비스 소개 — §15: 데이터가 없는 "이번 주 인기" 빈 섹션을 제거했다(EmptyState
          렌더링 자체를 없앰). "많이 찾는 꿈"이 Hero에서 그 역할(검색어를 몰라도 시작할 수
          있는 진입점)을 대신한다. */}
      <section aria-labelledby="why-heading" className="bg-bg-base py-16">
        <Container>
          <h2 id="why-heading" className="text-h2 font-bold text-text-primary">
            왜 {SITE_NAME}인가요?
          </h2>
          <ul className="mt-6 flex flex-col gap-3">
            {VALUE_PROPS.map((text) => (
              <li key={text} className="flex items-start gap-2 text-body text-text-primary">
                <span aria-hidden="true" className="text-primary">
                  ✓
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* 4. Footer 위 CTA */}
      <section aria-labelledby="cta-heading" className="bg-bg-subtle py-16">
        <Container className="flex flex-col items-center gap-4 text-center">
          <h2 id="cta-heading" className="text-h2 font-bold text-text-primary">
            지금 바로 행운일기를 시작해보세요
          </h2>
          <Link href="/login" className={buttonClassName("primary", "lg")}>
            지금 시작하기
          </Link>
        </Container>
      </section>
    </>
  );
}
