import type { Metadata } from "next";
import { redirect } from "next/navigation";

import Link from "next/link";

import JournalBackLink from "@/components/journal/JournalBackLink";
import JournalLoadError from "@/components/journal/JournalLoadError";
import Container from "@/components/layout/Container";
import { buttonClassName } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { getRecentFortuneResults } from "@/lib/api/journal";
import { getProfile } from "@/lib/auth/profile";
import { getCurrentUser } from "@/lib/auth/session";

// docs/SITEMAP.md §4: /my/journal/* 전체 noindex, nofollow.
export const metadata: Metadata = {
  title: "운세 기록",
  robots: { index: false, follow: false },
};

// docs/SITEMAP.md §1은 이 경로를 "/my/journal/fortune-history"로 정의한다 — Phase4-2에서
// 이미 확인한 대로, 문서에 없는 이름을 임의로 새로 만들지 않고 그대로 유지한다.
const FORTUNE_HISTORY_PATH = "/my/journal/fortune-history";

function formatDateTimeKst(isoString: string): string {
  return new Date(isoString).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// docs/PHASE4_PROXY_IMPLEMENTATION_REPORT.md 실측 결과, 현재 proxy.ts는 /my/journal/* 전체를
// 예외로 통과시킨다 — 이 페이지도 history/dreams와 동일하게 로그인 확인을 직접 수행한다.
export default async function JournalFortuneHistoryPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(FORTUNE_HISTORY_PATH)}&reason=journal`);
  }

  const profile = await getProfile(user.id);
  if (!profile) {
    redirect("/onboarding");
  }

  // getRecentFortuneResults()가 .eq("user_id", ...)와 RLS(0017, auth.uid()=user_id) 둘 다로
  // 본인 데이터만 걸러준다(lib/api/journal.ts 주석 참조) — 이 페이지는 그 함수만 호출할 뿐,
  // Supabase를 직접 호출하지 않는다.
  let entries: Awaited<ReturnType<typeof getRecentFortuneResults>> = [];
  let loadError = false;
  try {
    entries = await getRecentFortuneResults();
  } catch {
    loadError = true;
  }

  return (
    <Container className="flex flex-col gap-6 py-10">
      <JournalBackLink />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1 font-bold text-text-primary">운세 기록</h1>
        {/* Phase10-4A: 오늘의 행운(/fortune)이 이 테이블에 쓰기 시작하면서 "준비 중" 문구가
            더 이상 사실이 아니게 됐다 — 다른 journal 목록 페이지(예: /my/journal/dreams)와
            동일하게 생성 화면으로 가는 CTA로 바꿨다. */}
        <Link href="/fortune" className={buttonClassName("primary", "md")}>
          오늘의 행운 확인하기
        </Link>
      </div>

      {loadError ? (
        <JournalLoadError />
      ) : entries.length === 0 ? (
        <EmptyState
          title="아직 운세 기록이 없어요"
          description="오늘의 행운을 확인하면 결과가 여기에 모여요."
          action={
            <Link href="/fortune" className={buttonClassName("primary", "md")}>
              오늘의 행운 확인하기
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2 text-body font-medium text-text-primary">
                  <span>{formatDateTimeKst(entry.created_at)}</span>
                  <span className="text-caption text-text-secondary">행운지수 {entry.luck_score}</span>
                </div>
                <CardContent className="whitespace-pre-wrap break-words">{entry.overall_fortune}</CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
