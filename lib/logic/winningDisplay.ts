// Phase10-4C(당첨확인) 화면 전용 표시 helper. lib/logic/matchNumbers.ts(Phase6, 등수/일치개수
// 판정의 유일한 source of truth)를 재구현하지 않는다 — 이 파일은 이미 matchNumbers()가
// 계산해 DB(user_numbers.match_count/win_rank/checked_at)에 저장해 둔 결과를 화면에 어떻게
// 보여줄지만 다룬다.

export type ResultDisplayStatus = "pending" | "lost" | "won";

// user_numbers 행이 "추첨/확인 전"인지, "확인은 됐지만 낙첨"인지, "당첨"인지 구분한다.
// checked_at이 비어 있으면 아직 어떤 회차와도 대조되지 않은 상태다(Phase6
// registerDrawAndMatchUserNumbers()가 다음 회차 등록 시 자동으로 채운다) — 이 함수는 그
// 저장된 필드를 해석만 할 뿐, 새로운 판정 기준을 만들지 않는다.
export function getResultDisplayStatus(entry: {
  checked_at: string | null;
  win_rank: number | null;
}): ResultDisplayStatus {
  if (!entry.checked_at) {
    return "pending";
  }
  return entry.win_rank !== null ? "won" : "lost";
}

// 사용자의 번호 6개 중 실제 당첨번호(draws.numbers)와 겹치는 값만 뽑아 하이라이트에 쓴다.
// matchNumbers()의 matchCount와 이 배열의 길이는 항상 같아야 한다(같은 두 배열의 교집합을
// 구하는 것뿐이므로) — 등수 판정 로직 자체를 복제하는 것이 아니라 "몇 개 맞았는지"가 아니라
// "어떤 번호가 맞았는지"를 화면에 보여주기 위한 순수 파생 계산이다.
export function getMatchedNumbers(userNumbers: number[], winningNumbers: number[]): number[] {
  const winningSet = new Set(winningNumbers);
  return userNumbers.filter((n) => winningSet.has(n));
}

// 사용자의 번호 6개 중 보너스 번호와 일치하는 값이 있는지 — matchNumbers()의 bonusMatched와
// 동일한 조건이지만, 화면에서는 "어떤 공이 보너스와 일치했는지"를 개별적으로 강조해야 해서
// (§6) 별도로 노출한다.
export function isBonusMatch(userNumbers: number[], bonusNumber: number): boolean {
  return userNumbers.includes(bonusNumber);
}
