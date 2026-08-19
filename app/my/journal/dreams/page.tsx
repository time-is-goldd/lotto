import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import JournalBackLink from "@/components/journal/JournalBackLink";
import JournalLoadError from "@/components/journal/JournalLoadError";
import Container from "@/components/layout/Container";
import { buttonClassName } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { getRecentDreamJournalEntries } from "@/lib/api/journal";
import { getProfile } from "@/lib/auth/profile";
import { getCurrentUser } from "@/lib/auth/session";

// docs/SITEMAP.md §4: /my/journal/* 전체 noindex, nofollow.
export const metadata: Metadata = {
  title: "꿈 기록",
  robots: { index: false, follow: false },
};

const DREAMS_PATH = "/my/journal/dreams";

// entry_date는 Postgres `date` 타입이라 Supabase가 "YYYY-MM-DD" 문자열 그대로 돌려준다
// (docs/PHASE4_DIARY_READ_SERVICE_REPORT.md §5) — Date 객체로 다시 파싱하지 않고 문자열을
// 그대로 자연스러운 한글 표기로만 바꾼다. Date 파싱을 거치면 서버 실행 타임존에 따라
// 하루 밀릴 수 있는 위험이 있어(lib/auth/profile.ts의 calculateAgeVerified와 동일한 이유로)
// 아예 그 경로를 타지 않는다.
function formatDateOnly(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

// docs/PHASE4_PROXY_IMPLEMENTATION_REPORT.md 실측 결과, 현재 proxy.ts는 /my/journal/*
// 전체를 예외로 통과시킨다 — 이 페이지도 history와 동일하게 로그인 확인을 직접 수행해
// 원래 의도(하위 경로는 로그인 필수)를 복원한다.
export default async function JournalDreamsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(DREAMS_PATH)}&reason=journal`);
  }

  const profile = await getProfile(user.id);
  if (!profile) {
    redirect("/onboarding");
  }

  let entries: Awaited<ReturnType<typeof getRecentDreamJournalEntries>> = [];
  let loadError = false;
  try {
    entries = await getRecentDreamJournalEntries();
  } catch {
    loadError = true;
  }

  return (
    <Container className="flex flex-col gap-6 py-10">
      <JournalBackLink />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1 font-bold text-text-primary">꿈 기록</h1>
        <Link href="/my/journal/dreams/new" className={buttonClassName("primary", "md")}>
          꿈 기록하기
        </Link>
      </div>

      {loadError ? (
        <JournalLoadError />
      ) : entries.length === 0 ? (
        <EmptyState
          title="아직 기록한 꿈이 없어요"
          description="첫 꿈을 기록하고 나만의 행운 다이어리를 시작해보세요."
          action={
            <Link href="/my/journal/dreams/new" className={buttonClassName("primary", "md")}>
              첫 꿈 기록하기
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Card>
                <div className="text-body font-medium text-text-primary">
                  {formatDateOnly(entry.entry_date)}
                </div>
                {/* 상세 페이지가 없어(SITEMAP에도 없음) 전체 텍스트를 여기서 그대로 보여준다 —
                    line-clamp로 자르면 더 읽을 방법이 없는 페이지가 된다. 줄바꿈만으로 충분히
                    375px에서도 가로 overflow 없이 세로로 자연스럽게 늘어난다. */}
                <CardContent className="whitespace-pre-wrap break-words">{entry.dream_text}</CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
