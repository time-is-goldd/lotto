import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AccountWithdrawalForm from "@/components/account/AccountWithdrawalForm";
import ProfileFortuneFieldsForm from "@/components/account/ProfileFortuneFieldsForm";
import Container from "@/components/layout/Container";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/isAdmin";
import { getProfile } from "@/lib/auth/profile";

// proxy.ts의 "/my" 접두사 보호(config.matcher)가 이미 비로그인 접근을 /login으로 리다이렉트
// 하므로, 이 페이지 자체는 app/my/journal/page.tsx처럼 "비로그인이면 가치설명 화면"을 만들
// 필요가 없다 — /my/journal의 PUBLIC_EXCEPTIONS과 달리 이 경로는 proxy 예외 목록에 없다.
// 그래도 서버에서 다시 한번 확인한다(단일 장애점 방지 — 이 프로젝트 전역 관례).
//
// 개인 기록 페이지(/my/journal/*)와 동일하게 noindex — sitemap에도 포함하지 않는다
// (지시문 §37 "필요한 metadata: noindex, sitemap에 포함 금지").
export const metadata: Metadata = {
  title: "계정 설정",
  robots: { index: false, follow: false },
};

export default async function AccountSettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/my/account")}`);
  }

  const profile = await getProfile(user.id);
  if (!profile) {
    redirect("/onboarding");
  }

  // API(app/api/account/route.ts)가 최종 보안 경계이지만, 관리자 본인에게 애초에 탈퇴
  // 버튼을 보여주지 않는 것이 UX상 자연스럽다(지시문 §28 "UI만 막는 것으로 끝내지 않는다" —
  // 여기서는 반대로 "API guard가 source of truth이고, UI는 추가로 숨기기만 한다"는 뜻이다).
  const adminAccount = await isAdmin();

  return (
    <Container className="flex flex-col gap-8 py-10">
      <div>
        <h1 className="text-h1 font-bold text-text-primary">계정 설정</h1>
        <p className="mt-2 text-body text-text-secondary">{profile.nickname}님의 계정 정보입니다.</p>
      </div>

      {/* claude-code-luck-platform-fortune-domain-followup-prompt.md §11 "내 정보 수정"의 실제
          목적지. birth_date는 수정 대상이 아니다(lib/auth/profile.ts Decision 3) — 오늘의
          행운 개인화에 쓰이는 성별·태어난 시각만 여기서 바꿀 수 있다. */}
      <Card className="max-w-[560px]">
        <CardHeader>오늘의 행운 정보</CardHeader>
        <CardContent>
          <ProfileFortuneFieldsForm
            initialGender={profile.gender}
            initialBirthTime={profile.birth_time}
          />
        </CardContent>
      </Card>

      <Card className="max-w-[560px]">
        <CardHeader>회원탈퇴</CardHeader>
        <CardContent>
          {adminAccount ? (
            <p className="text-body text-text-secondary">
              관리자 계정은 여기서 탈퇴할 수 없습니다.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <p>Luck Platform 계정을 삭제합니다.</p>
              <p>
                탈퇴하면 저장한 번호, 꿈 기록, 오늘의 행운 등 계정과 연결된 정보가 삭제됩니다.
                탈퇴 후 저장된 개인 기록은 복구할 수 없습니다.
              </p>
              <AccountWithdrawalForm />
            </div>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
