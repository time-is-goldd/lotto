import type { Metadata } from "next";
import { redirect } from "next/navigation";

import DreamJournalForm from "@/components/journal/DreamJournalForm";
import JournalBackLink from "@/components/journal/JournalBackLink";
import Container from "@/components/layout/Container";
import { getDreamById } from "@/lib/api/dreams";
import { getProfile } from "@/lib/auth/profile";
import { getCurrentUser } from "@/lib/auth/session";

// docs/SITEMAP.md §4: /my/journal/* 전체 noindex, nofollow(개인 기록 페이지).
export const metadata: Metadata = {
  title: "꿈 기록하기",
  robots: { index: false, follow: false },
};

const NEW_ENTRY_PATH = "/my/journal/dreams/new";

interface DreamJournalNewPageProps {
  searchParams: Promise<{ dream?: string }>;
}

// app/my/journal/dreams/page.tsx(Phase4)와 완전히 동일한 인증 패턴이다 — proxy.ts는
// /my/journal/* 전체를 예외로 통과시키므로(docs/PHASE4_PROXY_IMPLEMENTATION_REPORT.md 실측),
// 하위 페이지가 각자 로그인을 확인해 원래 의도(하위 경로는 로그인 필수)를 복원한다. 이번
// Task에서 proxy.ts를 수정하지 않는다(지시문 §8) — 기존 페이지 레벨 패턴을 그대로 재사용했다.
export default async function DreamJournalNewPage({ searchParams }: DreamJournalNewPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(NEW_ENTRY_PATH)}&reason=journal`);
  }

  const profile = await getProfile(user.id);
  if (!profile) {
    redirect("/onboarding");
  }

  // dream 쿼리파라미터는 app/dream/[keyword]/page.tsx의 "이 꿈 기록하기" CTA가 붙여주는
  // 선택적 표시/연결용 정보다(§6-A). 형식이 잘못됐거나 존재하지 않는 값이면 조용히 무시하고
  // "특정 꿈을 선택하지 않은 자유 기록"(§6-B)으로 폴백한다 — 최종 저장 시 linkedDreamId
  // 검증은 POST /api/journal/dreams가 서버에서 다시 한다(lib/api/journal.ts).
  const { dream: rawDream } = await searchParams;
  const dreamId = rawDream ? Number(rawDream) : null;
  const dream = dreamId && Number.isInteger(dreamId) && dreamId > 0 ? await getDreamById(dreamId) : null;

  return (
    <Container className="flex flex-col gap-6 py-10">
      <JournalBackLink />
      <h1 className="text-h1 font-bold text-text-primary">꿈 기록하기</h1>

      <DreamJournalForm linkedDreamId={dream?.id ?? null} dreamKeyword={dream?.keyword ?? null} />
    </Container>
  );
}
