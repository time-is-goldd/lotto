// claude-code-luck-platform-home-brand-daily-numbers-prompt.md §9.4/docs/DESIGN_SYSTEM.md §4.9:
// 카드 3개 대신 구분선이 있는 결과 행. 꿈 숫자는 골드 채우기, 일반 숫자는 따뜻한 surface +
// 테두리로 구분한다(색만으로 구분하지 않는다 — aria-label로도 "꿈 숫자"를 알린다).
interface DailyComboRowProps {
  label: string;
  numbers: number[];
  dreamNumbers: number[];
  // 0~numbers.length. revealing 중에는 이 값이 시간에 따라 늘어나며, 이미 완성된 조합은
  // 항상 numbers.length를 넘긴다(모든 공이 즉시 확정 상태로 보인다).
  revealedCount: number;
  isFirst?: boolean;
}

export default function DailyComboRow({
  label,
  numbers,
  dreamNumbers,
  revealedCount,
  isFirst = false,
}: DailyComboRowProps) {
  return (
    <div className={`flex flex-col gap-2 py-4 ${isFirst ? "" : "border-t border-border"}`}>
      <p className="text-body font-medium text-text-primary">{label}</p>
      <ol aria-label={label} className="flex flex-wrap gap-2 md:gap-3">
        {numbers.map((n, index) => {
          const isPending = index >= revealedCount;
          const isDreamNumber = !isPending && dreamNumbers.includes(n);

          return (
            <li
              key={index}
              aria-hidden={isPending || undefined}
              aria-label={isDreamNumber ? `꿈 숫자 ${n}` : undefined}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-body font-bold transition-all duration-200 ease-out md:h-12 md:w-12 ${
                isPending
                  ? "scale-90 border-2 border-border bg-bg-subtle opacity-60"
                  : isDreamNumber
                    ? "scale-100 border-2 border-accent-gold bg-accent-gold text-text-primary opacity-100"
                    : "scale-100 border-2 border-border bg-bg-surface text-text-primary opacity-100"
              }`}
            >
              {isPending ? "" : n}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
