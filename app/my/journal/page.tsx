import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import JournalLoadError from "@/components/journal/JournalLoadError";
import Container from "@/components/layout/Container";
import { buttonClassName } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import {
  getRecentDreamJournalEntries,
  getRecentFortuneResults,
  getRecentUserNumbers,
} from "@/lib/api/journal";
import { getProfile } from "@/lib/auth/profile";
import { getCurrentUser } from "@/lib/auth/session";

// docs/SITEMAP.md §4: "/my/journal/*는 전체가 noindex, nofollow 처리한다" — 개인 기록
// 데이터라 검색 노출 대상이 아니다. 비로그인 방문자에게 보이는 가치설명 화면도 같은 URL이라
// 예외를 두지 않는다(문서가 URL 기준으로 규칙을 정의했지, 로그인 여부로 나누지 않았음).
export const metadata: Metadata = {
  title: "행운 다이어리",
  robots: { index: false, follow: false },
};

const JOURNAL_LOGIN_NEXT = `/login?next=${encodeURIComponent("/my/journal")}`;
// 허브 미리보기는 "일부"만 보여주고 전체는 하위 페이지로 보낸다(이번 지시문 §5
// "페이지 하나에 모든 데이터를 과도하게 보여주지 마라") — lib/api/journal.ts를 수정하지
// 않고 이미 지원하는 limit 옵션만 다르게 넘긴다.
const PREVIEW_LIMIT = 2;

async function loadPreview<T>(loader: () => Promise<T[]>): Promise<{ items: T[]; error: boolean }> {
  try {
    return { items: await loader(), error: false };
  } catch {
    return { items: [], error: true };
  }
}

// docs/PHASE4_ARCHITECTURE_DECISION.md §3 Option B: proxy.ts가 /my/journal(및 하위)의 진입
// 자체는 막지 않으므로, 비로그인 여부는 이 페이지가 직접 판단한다. Header.tsx가 이미 쓰는
// getCurrentUser()/getProfile() 순차 확인 패턴을 그대로 재사용했다(새 인증 로직 아님).
export default async function JournalHomePage() {
  const user = await getCurrentUser();

  if (!user) {
    return <JournalValueProp />;
  }

  const profile = await getProfile(user.id);
  if (!profile) {
    redirect("/onboarding");
  }

  const [numbers, dreams, fortunes] = await Promise.all([
    loadPreview(() => getRecentUserNumbers({ limit: PREVIEW_LIMIT })),
    loadPreview(() => getRecentDreamJournalEntries({ limit: PREVIEW_LIMIT })),
    loadPreview(() => getRecentFortuneResults({ limit: PREVIEW_LIMIT })),
  ]);

  return (
    <Container className="flex flex-col gap-10 py-10">
      <div>
        <h1 className="text-h1 font-bold text-text-primary">행운 다이어리</h1>
        <p className="mt-2 text-body text-text-secondary">
          번호·꿈·운세 기록을 모아서 보여드려요.
        </p>
      </div>

      <section aria-labelledby="numbers-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="numbers-heading" className="text-h2 font-bold text-text-primary">
            번호 기록
          </h2>
          <Link
            href="/my/journal/history"
            className="text-body text-text-secondary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            전체보기
          </Link>
        </div>
        {numbers.error ? (
          <JournalLoadError />
        ) : numbers.items.length === 0 ? (
          <EmptyState title="아직 생성한 번호가 없어요" description="번호를 생성하면 여기에 자동으로 기록돼요." />
        ) : (
          <ul className="flex flex-col gap-2">
            {numbers.items.map((entry) => (
              <li
                key={entry.id}
                className="rounded-card bg-bg-subtle p-4 text-body text-text-primary shadow-card"
              >
                {entry.numbers.join(", ")}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="dreams-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="dreams-heading" className="text-h2 font-bold text-text-primary">
            꿈 기록
          </h2>
          <Link
            href="/my/journal/dreams"
            className="text-body text-text-secondary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            전체보기
          </Link>
        </div>
        {dreams.error ? (
          <JournalLoadError />
        ) : dreams.items.length === 0 ? (
          <EmptyState title="아직 기록한 꿈이 없어요" description="꿈 기록 작성 기능은 곧 만나볼 수 있어요." />
        ) : (
          <ul className="flex flex-col gap-2">
            {dreams.items.map((entry) => (
              <li
                key={entry.id}
                className="line-clamp-2 rounded-card bg-bg-subtle p-4 text-body text-text-primary shadow-card"
              >
                {entry.dream_text}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="fortune-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="fortune-heading" className="text-h2 font-bold text-text-primary">
            운세 기록
          </h2>
          <Link
            href="/my/journal/fortune-history"
            className="text-body text-text-secondary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            전체보기
          </Link>
        </div>
        {fortunes.error ? (
          <JournalLoadError />
        ) : fortunes.items.length === 0 ? (
          <EmptyState title="아직 운세 기록이 없어요" description="운세 기능이 열리면 결과가 여기에 모여요." />
        ) : (
          <ul className="flex flex-col gap-2">
            {fortunes.items.map((entry) => (
              <li
                key={entry.id}
                className="line-clamp-2 rounded-card bg-bg-subtle p-4 text-body text-text-primary shadow-card"
              >
                {entry.overall_fortune}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Container>
  );
}

// 이 화면 하나에서만 쓰이는 뷰라 별도 컴포넌트 파일로 분리하지 않았다. docs/INFORMATION_ARCHITECTURE.md
// §1.2의 승인된 문구를 그대로 사용하고, 아직 구현되지 않은 자동분석/통계/알림/추천 같은 기능은
// 언급하지 않는다 — 실제로 되는 것(번호·꿈·운세 기록이 자동으로 모인다)만 안내한다.
function JournalValueProp() {
  return (
    <Container className="flex flex-col items-center gap-6 py-16 text-center">
      <h1 className="text-h1 font-bold text-text-primary">행운 다이어리</h1>
      <p className="max-w-md text-body-lg text-text-secondary">
        로그인하면 번호·운세·꿈 기록이 모두 여기 쌓여요.
      </p>
      <ul className="flex w-full max-w-sm flex-col gap-3 text-left">
        <li className="flex items-start gap-2 text-body text-text-primary">
          <span aria-hidden="true" className="text-primary">
            ✓
          </span>
          <span>번호를 생성하면 자동으로 기록돼요</span>
        </li>
        <li className="flex items-start gap-2 text-body text-text-primary">
          <span aria-hidden="true" className="text-primary">
            ✓
          </span>
          <span>꿈과 운세 기록도 함께 모여요</span>
        </li>
        <li className="flex items-start gap-2 text-body text-text-primary">
          <span aria-hidden="true" className="text-primary">
            ✓
          </span>
          <span>나중에 한눈에 다시 볼 수 있어요</span>
        </li>
      </ul>
      <Link href={JOURNAL_LOGIN_NEXT} className={buttonClassName("primary", "lg")}>
        로그인하고 시작하기
      </Link>
    </Container>
  );
}
