import { afterEach, describe, expect, it, vi } from "vitest";

import { MAX_NUMBER, MIN_NUMBER, NUMBERS_PER_GAME, generateNumbers } from "./generateNumbers";

// 반복 실행 테스트는 "공정성/통계적 균등성"이 아니라 계약(길이/범위/중복없음/정렬) 위반이
// 우연히라도 한 번은 나타나는지를 확인하는 목적이다(docs/PHASE5_PRE_IMPLEMENTATION_AUDIT.md §7,
// "수십만~수백만 회의 성능/통계 테스트는 이번 범위가 아니다") — 200회면 충분하다.
const REPEAT_COUNT = 200;

function expectValidGame(numbers: number[]) {
  expect(numbers).toHaveLength(NUMBERS_PER_GAME);
  expect(new Set(numbers).size).toBe(NUMBERS_PER_GAME);
  for (const n of numbers) {
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThanOrEqual(MIN_NUMBER);
    expect(n).toBeLessThanOrEqual(MAX_NUMBER);
  }
  expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
}

describe("generateNumbers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns exactly 6 numbers", () => {
    expect(generateNumbers()).toHaveLength(NUMBERS_PER_GAME);
  });

  it("returns only integers within 1~45", () => {
    for (const n of generateNumbers()) {
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(MIN_NUMBER);
      expect(n).toBeLessThanOrEqual(MAX_NUMBER);
    }
  });

  it("contains no duplicates", () => {
    const numbers = generateNumbers();
    expect(new Set(numbers).size).toBe(NUMBERS_PER_GAME);
  });

  it("is sorted in ascending order", () => {
    const numbers = generateNumbers();
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  });

  // Math.random()의 실제 값에 우연히 의존하지 않는다 — 매 반복마다 "그 결과가 계약을 만족
  //하는가"만 검증하고, 특정 숫자가 나왔는지는 검증하지 않는다.
  it("satisfies the contract across many repeated calls", () => {
    for (let i = 0; i < REPEAT_COUNT; i++) {
      expectValidGame(generateNumbers());
    }
  });

  it("returns a new, independent array on every call", () => {
    const first = generateNumbers();
    const second = generateNumbers();

    expect(first).not.toBe(second);

    first.push(999);
    expect(second).not.toContain(999);
  });

  // Math.random()을 진짜 임의의 실제 값에 맡기지 않고 경계값(0과 1에 가장 가까운 값)을
  // 강제로 주입해 "0 → 1(최솟값)", "1에 가까운 값 → 45(최댓값)" 매핑이 실제로 성립하는지
  // 확인한다. 값 하나로 고정하면(예: 항상 0) Set이 서로 다른 6개를 절대 못 채워
  // while 루프가 끝나지 않으므로, 서로 다른 6개 값으로 매핑되는 시퀀스를 순환시킨다.
  it("maps Math.random() boundary values (0 and just under 1) to 1 and 45 without going out of range", () => {
    const sequence = [0, 0.999999999, 0.1, 0.3, 0.5, 0.7];
    let call = 0;
    vi.spyOn(Math, "random").mockImplementation(() => sequence[call++ % sequence.length]);

    const numbers = generateNumbers();

    expectValidGame(numbers);
    expect(numbers).toContain(MIN_NUMBER);
    expect(numbers).toContain(MAX_NUMBER);
  });
});
