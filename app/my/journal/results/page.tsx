import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import JournalBackLink from "@/components/journal/JournalBackLink";
import JournalLoadError from "@/components/journal/JournalLoadError";
import WinningResultCard from "@/components/journal/WinningResultCard";
import Container from "@/components/layout/Container";
import { buttonClassName } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { getDrawsByRounds, getRecentUserNumbers } from "@/lib/api/journal";
import { getProfile } from "@/lib/auth/profile";
import { getCurrentUser } from "@/lib/auth/session";
import type { DrawEntry } from "@/lib/types/journal";

// docs/SITEMAP.md §4: /my/journal/* 전체 noindex, nofollow. docs/SITEMAP.md §1과
// docs/USER_FLOW.md(§"당첨 알림 수신 → /my/journal/results 직행")가 이미 이 경로를
// "당첨확인" 전용 canonical route로 계획해뒀다 — lib/api/notifications.ts의
// RESULT_LINK_URL도 이 경로로 향하도록 이번 Task에서 맞췄다(그 파일 자체 주석이 "전용
// 결과 화면이 생기면 이 상수만 바꾸면 된다"고 이미 예고해둔 지점).
export const metadata: Metadata = {
  title: "당첨확인",
  robots: { index: false, follow: false },
};

const RESULTS_PATH = "/my/journal/results";

// docs/PHASE4_PROXY_IMPLEMENTATION_REPORT.md 실측 결과, 현재 proxy.ts는 /my/journal/* 전체를
// 예외로 통과시킨다 — 이 페이지도 history/dreams와 동일하게 로그인 확인을 직접 수행한다.
export default async function JournalResultsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(RESULTS_PATH)}&reason=check-result`);
  }

  const profile = await getProfile(user.id);
  if (!profile) {
    redirect("/onboarding");
  }

  // getRecentUserNumbers()는 이미 .eq("user_id", userId) + RLS(user_numbers_select_own,
  // auth.uid()=user_id) 이중으로 본인 데이터만 걸러준다 — 이 페이지는 그 함수만 호출할 뿐,
  // Supabase를 직접 호출하지 않는다(§23). 정렬은 created_at DESC(최신 생성 순) — target_round
  // 기준으로 정렬하면 NULL(대기 중) 행의 위치가 애매해지고, "방금 만든 번호가 위에 보인다"는
  // 사용자 기대에도 created_at DESC가 더 자연스럽다(§8).
  let entries: Awaited<ReturnType<typeof getRecentUserNumbers>> = [];
  let loadError = false;
  try {
    entries = await getRecentUserNumbers();
  } catch {
    loadError = true;
  }

  // target_round가 있는 행들만 실제 draws를 조회한다 — NULL(§11 "회차 배정 대기")은 그대로
  // 대기 상태로 표시하고 임의로 회차를 추정하지 않는다.
  const rounds = entries
    .map((entry) => entry.target_round)
    .filter((round): round is number => round !== null);

  let draws: DrawEntry[] = [];
  if (!loadError && rounds.length > 0) {
    try {
      draws = await getDrawsByRounds(rounds);
    } catch {
      loadError = true;
    }
  }
  const drawsByRound = new Map(draws.map((draw) => [draw.round, draw]));

  return (
    <Container className="flex flex-col gap-6 py-10">
      <JournalBackLink />
      <div>
        <h1 className="text-h1 font-bold text-text-primary">당첨확인</h1>
        <p className="mt-2 text-body text-text-secondary">
          저장한 번호가 실제 추첨 결과와 몇 개 일치하는지 자동으로 확인해드려요.
        </p>
      </div>

      {loadError ? (
        <JournalLoadError />
      ) : entries.length === 0 ? (
        <EmptyState
          title="아직 확인할 번호가 없어요"
          description="번호를 생성하면 여기에서 당첨 여부를 확인할 수 있어요."
          action={
            <Link href="/generate" className={buttonClassName("primary", "md")}>
              번호 생성하기
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {entries.map((entry) => (
            <li key={entry.id}>
              <WinningResultCard
                entry={entry}
                draw={entry.target_round ? (drawsByRound.get(entry.target_round) ?? null) : null}
              />
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
