import Link from "next/link";
import { redirect } from "next/navigation";

import Container from "@/components/layout/Container";
import Badge from "@/components/ui/Badge";
import { buttonClassName } from "@/components/ui/Button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { SITE_NAME } from "@/lib/constants";

interface HomeProps {
  searchParams: Promise<{ profile?: string }>;
}

interface FeatureItem {
  title: string;
  description: string;
  href: string;
  // GENERATE_HOME_UX_FIX Task §O가 실제 route/구현 상태를 전수 확인해 4개는 ready:true,
  // "당첨확인"만 미구현이라 ready:false(준비 중)로 남겨뒀었다. Phase10-4C가
  // app/my/journal/results/page.tsx를 실제 당첨확인 화면으로 완성해 이제 5개 전부
  // ready:true다.
  ready?: boolean;
}

// Placeholder 데이터 — 실제 기능은 이번 Task 범위 밖이다. href는 docs/SITEMAP.md가 이미
// 확정한 실제 경로를 그대로 가리킨다 — 해당 Phase(4/5/7)가 그 페이지를 만들면 이 홈 화면은
// 수정 없이 그대로 연결된다(이번 Task 원칙 8 "추후 기능 연결이 쉬운 구조").
const FEATURES: FeatureItem[] = [
  {
    title: "번호 생성",
    description: "AI가 추천하는 번호로 오늘의 행운을 시작해보세요.",
    href: "/generate",
    ready: true,
  },
  {
    title: "꿈해몽",
    description: "꿈풀이로 나만의 행운번호를 찾아보세요.",
    href: "/dream",
    ready: true,
  },
  {
    title: "오늘의 행운",
    description: "생년월일로 나만의 오늘의 금전운과 추천 번호를 확인해보세요.",
    href: "/fortune",
    ready: true,
  },
  {
    title: "행운일기",
    description: "번호와 운세, 꿈 기록을 한곳에 모아보세요.",
    href: "/my/journal",
    ready: true,
  },
  {
    title: "당첨확인",
    description: "이번 회차 당첨 여부를 바로 확인해보세요.",
    href: "/my/journal/results",
    ready: true,
  },
];

// docs/MASTER_PRD.md §5 핵심 가치 제안 표에 이미 승인된 문구를 그대로 가져왔다 — 새 마케팅
// 카피를 지어내지 않았다.
const VALUE_PROPS = [
  "번호를 뽑고, 운세를 보고, 그 기록이 전부 내 행운일기에 남아요",
  "글씨 크고 버튼 크고, 헷갈리지 않는 화면으로 만들었어요",
  "매주 행운일기를 열어보면 나의 행운 역사가 한눈에 보여요",
  "1년치 행운 기록을 연말 결산 리포트로 받아볼 수 있어요",
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
      {/* 1. Hero */}
      <section aria-labelledby="hero-heading" className="bg-bg-base py-16">
        <Container className="flex flex-col items-center gap-4 text-center">
          <h1 id="hero-heading" className="text-display font-bold text-text-primary">
            {SITE_NAME}
          </h1>
          <p className="max-w-md text-body-lg text-text-secondary">
            번호를 뽑고, 운세를 보고, 꿈을 기록하며 매주 돌아오는 행운을 경험하는 곳.
          </p>
          <Link href="/generate" className={buttonClassName("primary", "lg")}>
            번호 생성하기
          </Link>
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
          375px: 1열 / 640px~: 2열 / 1024px~: 3열(마지막 줄 자동 중앙 정렬). */}
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
                    {!feature.ready && (
                      <CardFooter>
                        <Badge variant="default">준비 중</Badge>
                      </CardFooter>
                    )}
                  </Card>
                </Link>
              </article>
            ))}
          </nav>
        </Container>
      </section>

      {/* 3. 이번 주 인기 */}
      <section aria-labelledby="popular-heading" className="bg-bg-base py-16">
        <Container>
          <h2 id="popular-heading" className="text-h2 font-bold text-text-primary">
            이번 주 인기
          </h2>
          <Card className="mt-6">
            <EmptyState
              title="아직 인기 콘텐츠가 없어요"
              description="서비스가 시작되면 이번 주 인기 번호와 꿈풀이가 여기에 표시돼요."
            />
          </Card>
        </Container>
      </section>

      {/* 4. 서비스 소개 */}
      <section aria-labelledby="why-heading" className="bg-bg-subtle py-16">
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

      {/* 5. Footer 위 CTA */}
      <section aria-labelledby="cta-heading" className="bg-bg-base py-16">
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
