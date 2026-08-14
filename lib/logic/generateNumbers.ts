// Phase5-1 계약(docs/PHASE5_GENERATE_LOGIC_REPORT.md): 로또 번호 생성 순수 함수.
// 외부 의존성(네트워크/브라우저/React/Supabase) 없음, side effect 없음, 입력 없음.
// EXECUTION_PLAN.md Phase5 "1~45 무작위 6개"(단수) 계약을 그대로 따른다 — 여러 게임 동시
// 생성은 어떤 문서에도 명시되어 있지 않아(docs/PHASE5_PRE_IMPLEMENTATION_AUDIT.md §16-2,
// Decision 필요 항목) 이번 Task 범위에서 임의로 확장하지 않았다.
export const MIN_NUMBER = 1;
export const MAX_NUMBER = 45;
export const NUMBERS_PER_GAME = 6;

// 실제 추첨이 아니라 "후보 번호 제안" 기능이라 암호학적으로 안전한 난수가 필요 없다
// (docs/PHASE5_PRE_IMPLEMENTATION_AUDIT.md §6) — Math.random() 기반 rejection sampling으로
// 충분하다. Set에 서로 다른 값이 6개 모일 때까지 후보를 뽑고 마지막에 오름차순 정렬한다.
export function generateNumbers(): number[] {
  const numbers = new Set<number>();

  while (numbers.size < NUMBERS_PER_GAME) {
    const candidate = Math.floor(Math.random() * MAX_NUMBER) + MIN_NUMBER;
    numbers.add(candidate);
  }

  return Array.from(numbers).sort((a, b) => a - b);
}
