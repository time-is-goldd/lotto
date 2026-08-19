import type { Metadata } from "next";
import Link from "next/link";

import DailyFortuneCard from "@/components/fortune/DailyFortuneCard";
import Container from "@/components/layout/Container";
import { buttonClassName } from "@/components/ui/Button";
import { getDerivedFortuneFields, getOrCreateTodayFortune } from "@/lib/api/fortune";
import { getProfile } from "@/lib/auth/profile";
import { getCurrentUser } from "@/lib/auth/session";

// docs/SITEMAP.md §4: /fortune는 P0(최우선 SEO) 페이지다 — app/generate/page.tsx와 동일하게
// noindex 처리를 붙이지 않는다. 외부 AI API를 쓰지 않는 기능이라(Phase10-4A 지시문 §36 명시
// 금지) description에 "AI"라는 표현을 넣지 않는다 — SITEMAP.md 원문의 "[Fortune] AI 운세 입력"
// 표기는 이 기능이 실제로 구현되기 전 초기 기획 문서의 표현이라 실제 구현과 다르다(보고서에 기록).
export const metadata: Metadata = {
  title: "오늘의 행운",
  description: "생년월일을 바탕으로 오늘 하루의 금전운·행동 지침·행운 요소·추천 번호를 확인해보세요.",
  alternates: { canonical: "/fortune" },
};

function SignedOutOrPendingView({ authState }: { authState: "anonymous" | "profile-pending" }) {
  return (
    <Container className="flex flex-col items-center gap-6 py-16 text-center">
      <div>
        <h1 className="text-h1 font-bold text-text-primary">오늘의 행운</h1>
        <p className="mt-2 text-body text-text-secondary">
          {authState === "anonymous"
            ? "로그인하면 생년월일을 바탕으로 오늘의 행운을 확인할 수 있어요."
            : "온보딩을 마치면 오늘의 행운을 확인할 수 있어요."}
        </p>
      </div>
      <Link
        href={
          authState === "anonymous"
            ? `/login?next=${encodeURIComponent("/fortune")}&reason=fortune`
            : "/onboarding"
        }
        className={buttonClassName("primary", "lg")}
      >
        {authState === "anonymous" ? "로그인하고 확인하기" : "온보딩 계속하기"}
      </Link>
    </Container>
  );
}

// app/generate/page.tsx와 동일한 getCurrentUser() → getProfile() 순차 확인 패턴을 그대로
// 재사용한다(새 인증 로직 아님). §19: 비로그인도 이 페이지 자체는 볼 수 있어야 하므로
// /my/journal/* 페이지들과 달리 redirect()하지 않고 상태별로 다른 화면을 보여준다.
export default async function FortunePage() {
  const user = await getCurrentUser();
  if (!user) {
    return <SignedOutOrPendingView authState="anonymous" />;
  }

  const profile = await getProfile(user.id);
  if (!profile) {
    return <SignedOutOrPendingView authState="profile-pending" />;
  }

  const { entry, isNew } = await getOrCreateTodayFortune(user.id, profile.birth_date);
  const { luckyNumbers, moneyLuckScore } = getDerivedFortuneFields(entry, user.id, profile.birth_date);

  return (
    <Container className="py-10">
      <DailyFortuneCard
        resultDate={entry.result_date}
        zodiacSign={entry.zodiac_sign}
        overallFortune={entry.overall_fortune}
        luckScore={entry.luck_score}
        moneyLuck={entry.money_luck}
        moneyLuckScore={moneyLuckScore}
        actionGuide={entry.action_guide}
        thingsToAvoid={entry.things_to_avoid}
        luckyColor={entry.lucky_color}
        luckyTime={entry.lucky_time}
        luckyNumbers={luckyNumbers}
        recommendedNumbers={entry.recommended_numbers}
        isNew={isNew}
      />
    </Container>
  );
}
