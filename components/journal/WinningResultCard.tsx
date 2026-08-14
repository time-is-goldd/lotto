import Badge from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { getGenerationMethodLabel } from "@/lib/logic/generationMethodLabel";
import type { DrawEntry, UserNumberEntry } from "@/lib/types/journal";
import { getMatchedNumbers, getResultDisplayStatus, isBonusMatch } from "@/lib/logic/winningDisplay";

export interface WinningResultCardProps {
  entry: UserNumberEntry;
  // target_round가 있으면 항상 대응하는 draws 행이 존재한다(target_round는 실제 DB FK,
  // supabase/migrations/0002_draws_user_numbers.sql) — null은 "아직 대조 전"인 경우와
  // 이론상의 데이터 누락 방어 둘 다를 포함한다.
  draw: DrawEntry | null;
}

function formatDateKst(isoString: string): string {
  return new Date(isoString).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// §6: 색상만으로 정보를 전달하지 않는다 — matched 볼은 border/배경 변화에 더해 우측 상단에
// 작은 체크 배지(아이콘 텍스트 "✓")를 얹고, aria-label로 "n번, 일치"를 명시한다. isBonusBall은
// 당첨번호 줄의 보너스 공에만 쓰고, matchesBonus는 내 번호 중 보너스와 같은 값에만 쓴다 —
// 서로 다른 줄에서 서로 다른 의미이므로 시각적으로도 구분한다(보너스 공 자체는 금색 테두리,
// 내 번호 중 보너스 일치는 별도 캡션).
function NumberBall({
  number,
  matched = false,
  isBonusBall = false,
}: {
  number: number;
  matched?: boolean;
  isBonusBall?: boolean;
}) {
  const label = isBonusBall ? `보너스 번호 ${number}번` : matched ? `${number}번, 일치` : `${number}번`;

  return (
    <span className="relative inline-flex">
      <span
        aria-label={label}
        className={`flex h-10 w-10 items-center justify-center rounded-full text-body font-bold ${
          isBonusBall
            ? "border-2 border-accent-gold bg-bg-subtle text-text-primary"
            : matched
              ? "border-2 border-success bg-success/10 text-success"
              : "bg-primary text-white"
        }`}
      >
        {number}
      </span>
      {matched && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-success text-[10px] text-white"
        >
          ✓
        </span>
      )}
    </span>
  );
}

export default function WinningResultCard({ entry, draw }: WinningResultCardProps) {
  const status = getResultDisplayStatus(entry);
  const matchedNumbers = draw ? new Set(getMatchedNumbers(entry.numbers, draw.numbers)) : new Set<number>();
  const myBonusMatch = draw ? isBonusMatch(entry.numbers, draw.bonus_number) : false;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 text-body font-medium text-text-primary">
        <span>
          {entry.target_round ? `제${entry.target_round}회` : formatDateKst(entry.created_at)}
        </span>
        <Badge>{getGenerationMethodLabel(entry.generation_method)}</Badge>
      </div>

      {draw && (
        <CardContent className="flex flex-col gap-2">
          <div>
            <p className="mb-1 text-caption text-text-secondary">당첨번호</p>
            <div className="flex flex-wrap items-center gap-2">
              {[...draw.numbers]
                .sort((a, b) => a - b)
                .map((n) => (
                  <NumberBall key={n} number={n} />
                ))}
              <span aria-hidden="true" className="text-text-secondary">
                +
              </span>
              <NumberBall number={draw.bonus_number} isBonusBall />
            </div>
          </div>
        </CardContent>
      )}

      <CardContent className="flex flex-col gap-2">
        <p className="mb-1 text-caption text-text-secondary">내 번호</p>
        <div className="flex flex-wrap gap-2">
          {entry.numbers.map((n) => (
            <NumberBall key={n} number={n} matched={matchedNumbers.has(n)} />
          ))}
        </div>
        {draw && myBonusMatch && (
          <p className="text-caption text-text-secondary">보너스 번호와도 일치했어요.</p>
        )}
      </CardContent>

      <CardContent>
        {status === "pending" && (
          <div>
            <p className="font-medium text-text-primary">추첨 결과 확인 대기 중</p>
            <p className="mt-1 text-caption text-text-secondary">
              다음 회차가 등록되면 자동으로 결과를 확인해드려요.
            </p>
          </div>
        )}
        {status === "lost" && (
          <div>
            <p className="font-medium text-text-primary">{entry.match_count}개 일치</p>
            <p className="mt-1 text-caption text-text-secondary">
              아쉽게도 이번 회차는 당첨되지 않았어요.
            </p>
          </div>
        )}
        {status === "won" && entry.win_rank !== null && (
          <div>
            <p className="text-caption text-text-secondary">{entry.match_count}개 일치</p>
            <p
              className={`font-bold ${
                entry.win_rank <= 2 ? "text-h2 text-primary" : "text-body text-success"
              }`}
            >
              🎉 {entry.win_rank}등 당첨
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
