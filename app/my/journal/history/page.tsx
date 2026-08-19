import type { Metadata } from "next";
import { redirect } from "next/navigation";

import JournalBackLink from "@/components/journal/JournalBackLink";
import JournalLoadError from "@/components/journal/JournalLoadError";
import Container from "@/components/layout/Container";
import Badge from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { getRecentUserNumbers } from "@/lib/api/journal";
import { getProfile } from "@/lib/auth/profile";
import { getCurrentUser } from "@/lib/auth/session";
import { getGenerationMethodLabel } from "@/lib/logic/generationMethodLabel";

// docs/SITEMAP.md §4: /my/journal/* 전체 noindex, nofollow.
export const metadata: Metadata = {
  title: "번호 기록",
  robots: { index: false, follow: false },
};

const HISTORY_PATH = "/my/journal/history";

function formatDateTimeKst(isoString: string): string {
  return new Date(isoString).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// docs/PHASE4_ARCHITECTURE_DECISION.md §3 Option B는 /my/journal(허브)만 proxy 예외로
// 두기로 결정했지만, 실제 proxy.ts 구현(matchesPath의 접두사 매칭)은 /my/journal/* 전체를
// 예외로 처리한다(docs/PHASE4_PROXY_IMPLEMENTATION_REPORT.md 실측 결과) — 이번 Phase4-3도
// proxy.ts를 수정하지 않으므로, 이 하위 페이지는 원래 의도(하위 경로는 로그인 필수)를
// 페이지 자신의 로그인 확인으로 그대로 복원한다(Phase4-2와 동일한 패턴 유지).
export default async function JournalHistoryPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(HISTORY_PATH)}&reason=journal`);
  }

  const profile = await getProfile(user.id);
  if (!profile) {
    redirect("/onboarding");
  }

  let entries: Awaited<ReturnType<typeof getRecentUserNumbers>> = [];
  let loadError = false;
  try {
    entries = await getRecentUserNumbers();
  } catch {
    loadError = true;
  }

  return (
    <Container className="flex flex-col gap-6 py-10">
      <JournalBackLink />
      <h1 className="text-h1 font-bold text-text-primary">번호 기록</h1>

      {loadError ? (
        <JournalLoadError />
      ) : entries.length === 0 ? (
        <EmptyState title="아직 생성한 번호가 없어요" description="번호를 생성하면 여기에 자동으로 기록돼요." />
      ) : (
        <ul className="flex flex-col gap-4">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Card>
                {/* CardHeader/CardContent는 각각 text-h2/text-body 크기를 고정 강제하는 컴포넌트라
                    (components/ui/Card.tsx), 목록 항목의 작은 메타 행(날짜+뱃지)에는 어울리지
                    않는다 — 두 컴포넌트를 그 용도가 맞는 CardContent에만 쓰고, 메타 행은 Card의
                    순수 wrapper 스타일(배경/radius/그림자/padding)만 빌려 직접 마크업했다. */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-body font-medium text-text-primary">
                  <span>{formatDateTimeKst(entry.created_at)}</span>
                  <Badge>{getGenerationMethodLabel(entry.generation_method)}</Badge>
                </div>
                <CardContent>{entry.numbers.join(", ")}</CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
