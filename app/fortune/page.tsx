import type { Metadata } from "next";

import GuestFortuneForm from "@/components/fortune/GuestFortuneForm";
import MemberFortuneReveal from "@/components/fortune/MemberFortuneReveal";
import Container from "@/components/layout/Container";
import { getDerivedFortuneFields, getOrCreateTodayFortune } from "@/lib/api/fortune";
import { getProfile } from "@/lib/auth/profile";
import { getCurrentUser } from "@/lib/auth/session";

// docs/SITEMAP.md §4: /fortune는 P0(최우선 SEO) 페이지다 — app/generate/page.tsx와 동일하게
// noindex 처리를 붙이지 않는다. 외부 AI API를 쓰지 않는 기능이라(Phase10-4A 지시문 §36 명시
// 금지) description에 "AI"라는 표현을 넣지 않는다 — SITEMAP.md 원문의 "[Fortune] AI 운세 입력"
// 표기는 이 기능이 실제로 구현되기 전 초기 기획 문서의 표현이라 실제 구현과 다르다(보고서에 기록).
//
// claude-code-luck-platform-fortune-domain-followup-prompt.md §5: description을 "로그인
// 없이도 확인 가능"으로 갱신한다 — 이전 문구는 로그인 필수처럼 읽혔다.
export const metadata: Metadata = {
  title: "오늘의 행운",
  description:
    "로그인 없이도 생년월일을 입력해 오늘 하루의 금전운·행동 지침·행운 요소·추천 번호를 확인해보세요.",
  alternates: { canonical: "/fortune" },
};

// app/generate/page.tsx와 동일한 getCurrentUser() → getProfile() 순차 확인 패턴을 그대로
// 재사용한다(새 인증 로직 아님). §19: 비로그인도 이 페이지 자체는 볼 수 있어야 하므로
// /my/journal/* 페이지들과 달리 redirect()하지 않고 상태별로 다른 화면을 보여준다.
//
// §14: 로그인했지만 profile이 없으면(생년월일 미입력) 결과를 만들지 않고 비회원과 같은 입력
// 폼을 보여준다 — GuestFortuneForm을 그대로 재사용하고 authState만 다르게 넘긴다.
export default async function FortunePage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Container className="py-10">
        <GuestFortuneForm authState="anonymous" />
      </Container>
    );
  }

  const profile = await getProfile(user.id);
  if (!profile) {
    return (
      <Container className="py-10">
        <GuestFortuneForm authState="profile-pending" />
      </Container>
    );
  }

  // idempotent(같은 한국 날짜 재호출 시 기존 행 재사용) — 여기서 매번 호출해도 새 행이
  // 여러 개 생기지 않는다(lib/api/fortune.ts 계약, 무변경).
  const { entry, isNew } = await getOrCreateTodayFortune(
    user.id,
    profile.birth_date,
    profile.gender,
    profile.birth_time
  );
  const { luckyNumbers, moneyLuckScore } = getDerivedFortuneFields(
    entry,
    profile.birth_date,
    profile.gender,
    profile.birth_time
  );

  return (
    <Container className="py-10">
      <MemberFortuneReveal
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
