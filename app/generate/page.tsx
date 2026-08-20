import type { Metadata } from "next";

import NumberGenerator from "@/components/generate/NumberGenerator";
import type { DailyComboView, GenerateAuthState } from "@/components/generate/generatorSaveLogic";
import Container from "@/components/layout/Container";
import { getTodayDailyGenerations } from "@/lib/api/dailyNumbers";
import { getDreamById, getDreamNumbers } from "@/lib/api/dreams";
import { getDreamSituationByKeyword } from "@/lib/api/dreamSituations";
import { getProfile } from "@/lib/auth/profile";
import { getCurrentUser } from "@/lib/auth/session";
import { buildDreamAwareNumbers, inheritParentNumbers } from "@/lib/logic/dreamNumbers";

// docs/PHASE5_PRE_IMPLEMENTATION_AUDIT.md §3: 실제 코드(Home/BottomNavigation/GlobalNav)가
// 이미 /generate로 통일되어 있어 그 결정을 그대로 따른다. SITEMAP.md §1의 /generate/auto는
// 실제로 구현된 적이 없어 이번에도 구현하지 않는다(Decision 필요 사항으로 남겨둔 것 재확인).
//
// SITEMAP.md §4는 /generate를 P0(최우선 SEO) 페이지로 분류한다 — /ui-preview 같은 noindex
// 처리를 붙이지 않는다.
//
// Phase8-1: alternates.canonical을 "/generate"로 고정한다. 이 페이지는 ?dream=<id> 쿼리로도
// 접근되지만(app/dream/[keyword]/page.tsx의 "이 꿈으로 번호 생성하기" CTA), 그 쿼리는 서버가
// 표시용으로만 쓰는 상태값이지(app/generate/page.tsx 자체 주석 참조) 별도 색인 대상 콘텐츠가
// 아니다 — canonical을 쿼리 없는 경로로 고정해 검색엔진이 두 URL을 같은 페이지로 인식하게 한다.
// claude-code-luck-platform-daily-fortune-number-demo-prompt.md §15: H1/설명을 "버튼을 눌러야
// 만들어진다"는 실제 동작에 맞춰 갱신한다(꿈 CTA로 들어온 경우는 예외적으로 자동 시작하지만,
// 페이지 자체의 제목은 한 페이지에 하나만 있어야 하므로 상태별로 나누지 않는다).
export const metadata: Metadata = {
  title: "오늘의 세 조합",
  description: "하루 최대 세 조합, 1부터 45까지 중복 없는 숫자 6개로 재미로 만들어보세요.",
  alternates: { canonical: "/generate" },
};

// docs/PHASE4_ARCHITECTURE_DECISION.md·components/layout/Header.tsx가 이미 쓰는
// getCurrentUser() → getProfile() 순차 확인 패턴을 그대로 재사용한다(새 인증 로직 아님).
// Server Component에서 인증 상태를 미리 판단해 Client Component에는 판단 결과(문자열
// 하나)만 내려준다 — Client Component가 다시 Supabase를 조회하지 않는다.
//
// 최초 번호도 여기(서버)에서 1회만 생성해 prop으로 내려준다 — generateNumbers()는
// Math.random() 기반이라, Client Component의 useState 초기값이나 useEffect에서 다시
// 계산하면 SSR 렌더링 결과와 클라이언트 하이드레이션 결과가 서로 달라 hydration mismatch가
// 발생한다. 서버에서 한 번만 계산해 그 값을 그대로 prop으로 전달하면 서버-클라이언트 간
// 값 불일치 자체가 구조적으로 생기지 않는다("다시 생성" 클릭 이후의 재생성은 순수하게
// 클라이언트 이벤트라 이 문제와 무관하다).
interface GeneratePageProps {
  searchParams: Promise<{ dream?: string; situation?: string }>;
}

// dream 쿼리파라미터는 app/dream/[keyword]/page.tsx·app/dream/[keyword]/[situation]/page.tsx의
// CTA가 붙여주는 선택적 표시용 정보일 뿐이다(docs/PHASE7_DREAM_NUMBER_INTEGRATION_REPORT.md §8)
// — 잘못됐거나 존재하지 않는 값이면 조용히 무시하고 일반 생성 흐름으로 폴백한다(§9 "일반
// /generate 사용자 경험을 깨뜨리지 않는다"). 최종 저장 시 relatedDreamId 검증은 POST
// /api/numbers가 서버에서 다시 하므로(lib/api/numbers.ts의 saveUserNumbers), 여기서 실패해도
// 데이터 무결성 문제가 아니라 표시 문제일 뿐이다.
function parseDreamId(rawDream: string | undefined): number | null {
  if (!rawDream) {
    return null;
  }
  const dreamId = Number(rawDream);
  return Number.isInteger(dreamId) && dreamId > 0 ? dreamId : null;
}

// claude-code-luck-platform-launch-prompt.md §12: Situation 자신의 numbers를 우선 쓰고, 없으면
// Parent의 numbers 중 최대 3개를 상속한다. situation 쿼리파라미터가 없거나(Parent 페이지의
// CTA) 그 situation을 못 찾으면 Parent 상속 경로로 조용히 폴백한다 — dream 자체와 마찬가지로
// "표시용 힌트가 잘못돼도 일반 생성 흐름은 깨지지 않는다"는 원칙을 그대로 따른다.
async function resolveDreamNumberCandidates(
  dreamId: number,
  situationKeyword: string | undefined
): Promise<number[]> {
  if (situationKeyword) {
    const situation = await getDreamSituationByKeyword(dreamId, situationKeyword);
    if (situation?.numbers && situation.numbers.length > 0) {
      return situation.numbers;
    }
  }

  const parentNumbers = await getDreamNumbers(dreamId);
  return inheritParentNumbers(parentNumbers);
}

export default async function GeneratePage({ searchParams }: GeneratePageProps) {
  const { dream: rawDream, situation: rawSituation } = await searchParams;

  const user = await getCurrentUser();
  const profile = user ? await getProfile(user.id) : null;

  const authState: GenerateAuthState = !user
    ? "anonymous"
    : !profile
      ? "profile-pending"
      : "ready";

  const dreamId = parseDreamId(rawDream);
  const dream = dreamId ? await getDreamById(dreamId) : null;

  const dreamNumberCandidates = dream
    ? await resolveDreamNumberCandidates(dream.id, rawSituation)
    : null;
  // claude-code-luck-platform-home-brand-daily-numbers-prompt.md §9: 실제 6개 조합은 이제
  // 사용자가 버튼을 누른 시점에 클라이언트(NumberGenerator)가 만든다 — 서버는 더 이상 "첫
  // 조합"을 미리 계산해 내려주지 않는다(hydration mismatch 방지용 사전 계산이 필요했던 이유
  // 자체가 사라졌다: 이전에는 꿈 CTA가 마운트 즉시 그 값을 그려야 했지만, 지금은 마운트 후
  // effect에서 생성을 "시작"하므로 첫 렌더는 항상 combos=[]로 SSR과 일치한다). 여기서는
  // dreamNumberCandidates를 정제(중복 제거·1~45 범위 검증·최대 6개)한 dreamNumbers만
  // 뽑아 dreamContext로 넘긴다 — numbers(완성된 6개)는 버려도 된다.
  const { dreamNumbers } = buildDreamAwareNumbers(dreamNumberCandidates);

  // 회원의 "오늘의 세 조합"은 DB가 유일한 진실이다 — 비회원/profile-pending은 서버가
  // localStorage를 볼 수 없어 항상 빈 배열로 시작하고, 클라이언트가 마운트 후 직접 채운다
  // (components/generate/NumberGenerator.tsx의 hydrated 처리 참조).
  const initialCombos =
    authState === "ready" && user
      ? (await getTodayDailyGenerations(user.id)).map((row) => ({
          slotIndex: row.slot_index,
          numbers: row.numbers,
          dreamNumbers: row.dream_numbers ?? [],
        }))
      : [];

  return (
    <Container className="flex flex-col gap-8 py-10">
      <div>
        <h1 className="text-h1 font-bold text-text-primary">오늘의 세 조합</h1>
        <p className="mt-2 text-body text-text-secondary">
          하루에 세 조합만 만들 수 있어요. 버튼을 누를 때마다 새로운 조합이 하나씩 기록됩니다.
        </p>
        {/* claude-code-luck-platform-home-brand-daily-numbers-prompt.md §10 고지 문구. */}
        <p className="mt-1 text-caption text-text-secondary">
          번호는 재미를 위한 조합이며 당첨을 보장하거나 확률을 높이지 않습니다. 복권은 만 19세
          이상만 구매할 수 있습니다.
        </p>
      </div>

      <NumberGenerator
        authState={authState}
        initialCombos={initialCombos as DailyComboView[]}
        dreamContext={dream ? { id: dream.id, keyword: dream.keyword, dreamNumbers } : null}
      />
    </Container>
  );
}
