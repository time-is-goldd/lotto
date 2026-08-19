import type { Metadata } from "next";
import Link from "next/link";

import Container from "@/components/layout/Container";
import { isSafeNextPath } from "@/lib/utils/safeNext";

// docs/SITEMAP.md §4: /login은 P3(noindex) 페이지다. 다른 P3 페이지(/my/journal/*,
// /ui-preview)와 다르게 이 페이지는 로그인 여부와 무관하게 누구에게나(크롤러 포함) 그대로
// 렌더링된다(getCurrentUser() 확인이나 redirect가 없음, 코드 직접 확인) — 검색엔진이 실제로
// 색인할 수 있는 콘텐츠가 있는 유일한 P3 경로라 명시적으로 noindex를 지정한다.
export const metadata: Metadata = {
  title: "로그인",
  robots: { index: false, follow: false },
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string; reason?: string }>;
}

// claude-code-luck-platform-launch-prompt.md §14: reason= 값에 따라 헤드라인/첫 benefit/CTA
// 문구만 바꾸고, 나머지 benefit 목록·약관 동의 문구는 공유한다. 인식하지 못하는 reason 값은
// 조용히 기본 문구로 폴백한다(잘못된 값이 화면을 깨뜨리지 않게).
const REASON_COPY: Record<string, { heading: string; description: string; cta: string }> = {
  "save-number": {
    heading: "이 번호를 저장해둘까요?",
    description: "로그인하면 번호를 보관하고, 토요일 추첨 결과와 비교할 수 있어요.",
    cta: "카카오로 번호 저장하기",
  },
  fortune: {
    heading: "오늘의 행운은 매일 자정 이후 새로 열려요.",
    description: "로그인하면 생년월일을 바탕으로 오늘의 행운을 확인할 수 있어요.",
    cta: "로그인하고 오늘의 행운 보기",
  },
  "check-result": {
    heading: "저장한 번호와 이번 회차 결과를 비교해보세요.",
    description: "카카오로 로그인하면 숫자를 다시 입력하지 않아도 됩니다.",
    cta: "카카오로 당첨 결과 확인하기",
  },
  journal: {
    heading: "꿈·번호·당첨 결과를 한곳에 기록해요.",
    description: "로그인하면 지금까지 만든 번호와 꿈 기록을 이어서 볼 수 있어요.",
    cta: "카카오로 계속하기",
  },
};

const DEFAULT_COPY = {
  heading: "카카오로 간편하게 시작하세요",
  description: "로그인하면 만든 번호를 저장하고, 토요일 추첨 결과와 비교할 수 있어요.",
  cta: "카카오로 계속하기",
};

const BENEFITS = [
  "생성한 번호 한곳에 보관",
  "오늘의 행운 하루 한 번 확인",
  "꿈·번호·당첨 결과를 함께 기록",
  "다음 회차 결과 간편 확인",
];

// proxy.ts와 여러 페이지(app/fortune/page.tsx, app/my/journal/** 등)가 비로그인 사용자를
// 여기로 보낸다(?next=<원래 경로>&reason=<맥락>). next는 /api/auth/kakao/login이 검증해
// 쿠키에 저장하고 콜백이 그 값으로 되돌린다(lib/auth/kakao.ts KAKAO_OAUTH_NEXT_COOKIE) —
// 이 페이지는 next를 그대로 로그인 시작 링크에 실어 보내기만 하면 된다. 여기서도 한 번 더
// isSafeNextPath로 걸러 안전하지 않은 값이 링크에 노출되지 않게 한다(방어적 이중 검증).
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const copy = (params.reason && REASON_COPY[params.reason]) || DEFAULT_COPY;
  const safeNext = isSafeNextPath(params.next) ? params.next : null;

  const loginHref = safeNext
    ? `/api/auth/kakao/login?next=${encodeURIComponent(safeNext)}`
    : "/api/auth/kakao/login";
  const backHref = safeNext ?? "/";

  return (
    <Container className="flex flex-1 flex-col items-center justify-center gap-8 py-16 text-center">
      <div>
        <h1 className="text-h1 font-bold text-text-primary">{copy.heading}</h1>
        <p className="mt-2 text-body text-text-secondary">{copy.description}</p>
      </div>

      <ul className="flex flex-col gap-2 text-body text-text-secondary">
        {BENEFITS.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>

      <div className="flex flex-col items-center gap-3">
        <a
          href={loginHref}
          className="rounded-md bg-[#FEE500] px-6 py-3 text-body font-medium text-[#191919]"
        >
          {copy.cta}
        </a>
        <p className="text-caption text-text-secondary">
          계속하면{" "}
          <Link href="/terms" className="underline">
            이용약관
          </Link>
          과{" "}
          <Link href="/privacy" className="underline">
            개인정보처리방침
          </Link>
          에 동의하게 됩니다.
        </p>
      </div>

      <Link href={backHref} className="text-caption text-text-secondary underline">
        나중에 할게요
      </Link>
    </Container>
  );
}
