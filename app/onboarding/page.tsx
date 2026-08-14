import { redirect } from "next/navigation";

import Container from "@/components/layout/Container";
import { getProfile } from "@/lib/auth/profile";
import { getCurrentUser } from "@/lib/auth/session";

import OnboardingForm from "./OnboardingForm";

// 로그인 안 됨 → 홈(로그인 진입점, docs/PHASE2_ONBOARDING_REPORT.md §4 참조).
// profile 이미 존재 → 홈. profile 없음 → 이 페이지가 온보딩 폼을 렌더링한다
// (docs/PHASE2_AUTH_DECISION.md Decision 1 "로그인했지만 profile 없음 = 정상 온보딩 대기").
export default async function OnboardingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const profile = await getProfile(user.id);

  if (profile) {
    redirect("/");
  }

  const kakaoNickname = user.user_metadata?.nickname;
  const defaultNickname = typeof kakaoNickname === "string" ? kakaoNickname : "";

  return (
    <Container className="flex flex-1 flex-col items-center justify-center py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-neutral-900">프로필 설정</h1>
        <p className="mt-2 text-sm text-neutral-500">
          서비스 이용을 위해 생년월일을 입력해주세요.
        </p>
        <OnboardingForm defaultNickname={defaultNickname} />
      </div>
    </Container>
  );
}
