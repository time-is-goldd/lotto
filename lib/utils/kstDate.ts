// 오늘의 행운(Phase10-4A)은 "한국 시간 기준 하루"를 기준으로 결과를 고정해야 한다.
// lib/api/journal.ts의 todayDateString()은 UTC 기준이라(new Date().getUTCFullYear() 등)
// 이 기능에는 쓸 수 없다 — 예를 들어 한국시간 2026-08-12 00:30(=UTC 2026-08-11 15:30)에는
// UTC 기준 날짜가 아직 08-11이라 하루 앞선 날짜로 계산돼버린다. Intl.DateTimeFormat에
// timeZone: "Asia/Seoul"을 지정하면 서버가 어느 타임존에서 실행되든(Vercel은 보통 UTC)
// 항상 KST 벽시계 기준 날짜를 얻을 수 있다. formatToParts()로 연/월/일을 개별 추출해
// locale의 구분자/순서 관례에 의존하지 않는다.
const KST_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getKstDateString(date: Date = new Date()): string {
  const parts = KST_DATE_FORMATTER.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("KST 날짜 계산에 실패했습니다.");
  }

  return `${year}-${month}-${day}`;
}
