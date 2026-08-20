import { MAX_DAILY_GENERATIONS } from "@/lib/logic/dailyNumberPolicy";

// claude-code-luck-platform-home-brand-daily-numbers-prompt.md §9.6: 비회원은 localStorage
// 기반 soft limit을 쓴다 — "한 사람/한 컴퓨터에서 절대 3개"가 아니라 "동일 브라우저 프로필에서
// 한국 날짜 기준 3개"다. IP 제한/device fingerprinting/광고 식별자는 쓰지 않는다.
//
// lib/storage/guestFortuneStore.ts와 달리 생년월일 같은 개인정보가 전혀 없어(숫자 조합에는
// 민감정보가 없다, §9.6) device salt/해시가 필요 없다 — 프로필별로 나뉘는 fortune과 다르게
// "이 브라우저의 오늘"이라는 단일 상태만 있으면 되므로 storage key도 하나뿐이다. 오래된
// 날짜의 기록은 다음 날 최초 read 시점에 조용히 교체된다(§9.6 "오래된 guest 기록은 제한된
// 기간 뒤 정리한다") — 여러 날짜를 누적 보관할 필요가 원래 없다(guest는 "오늘"만 복원하면
// 된다, §9.6 "같은 날 재방문하면 저장된 조합과 0~3 남은 횟수를 복원한다").
const STORAGE_KEY = "luckplatform:dailyNumbers:v1";
export const GUEST_DAILY_SCHEMA_VERSION = 1;

export interface GuestDailyCombo {
  numbers: number[];
  source: "general" | "dream";
  // numbers의 부분집합 — 꿈에서 유래한 숫자만(lib/logic/dreamNumbers.ts buildDreamAwareNumbers()가
  // 이미 계산한 값을 그대로 저장한다). 빈 배열이면 골드 강조를 하지 않는다.
  dreamNumbers: number[];
  relatedDreamId: number | null;
  generatedAt: string; // ISO 8601
}

export interface GuestDailyState {
  schemaVersion: number;
  date: string; // KST "YYYY-MM-DD"
  combos: GuestDailyCombo[];
}

function emptyState(todayKst: string): GuestDailyState {
  return { schemaVersion: GUEST_DAILY_SCHEMA_VERSION, date: todayKst, combos: [] };
}

// lib/storage/guestFortuneStore.ts와 동일한 이유(localStorage가 막혀 있거나 quota 초과 시
// throw)로 메모리 fallback을 둔다 — §9.6 "localStorage가 차단되거나 quota 오류가 나도 화면이
// 깨지지 않게 in-memory fallback과 짧은 안내를 제공한다".
const memoryFallback = new Map<string, string>();
let usingMemoryFallback = false;

export function isUsingGuestMemoryFallback(): boolean {
  return usingMemoryFallback;
}

function safeGetItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    usingMemoryFallback = true;
    return memoryFallback.get(key) ?? null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    usingMemoryFallback = true;
    memoryFallback.set(key, value);
  }
}

function safeRemoveItem(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    memoryFallback.delete(key);
  }
}

function isValidCombo(value: unknown): value is GuestDailyCombo {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.numbers) &&
    record.numbers.length === 6 &&
    record.numbers.every((n) => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 45) &&
    (record.source === "general" || record.source === "dream") &&
    Array.isArray(record.dreamNumbers) &&
    record.dreamNumbers.every((n) => typeof n === "number") &&
    (record.relatedDreamId === null || typeof record.relatedDreamId === "number") &&
    typeof record.generatedAt === "string"
  );
}

// schemaVersion이 다르거나 JSON이 깨졌거나 날짜가 오늘(KST)이 아니면 폐기하고 오늘의 빈
// 상태를 돌려준다 — 호출부는 이 반환값을 "지금 이 순간의 진짜 상태"로 그대로 믿으면 된다
// (guestFortuneStore.ts readEntry()와 동일한 "안전하게 폐기" 원칙, §9.6).
export function readGuestDailyState(todayKst: string): GuestDailyState {
  const raw = safeGetItem(STORAGE_KEY);
  if (!raw) {
    return emptyState(todayKst);
  }

  try {
    const parsed = JSON.parse(raw) as Partial<GuestDailyState>;
    if (
      parsed.schemaVersion !== GUEST_DAILY_SCHEMA_VERSION ||
      typeof parsed.date !== "string" ||
      parsed.date !== todayKst ||
      !Array.isArray(parsed.combos) ||
      !parsed.combos.every(isValidCombo)
    ) {
      safeRemoveItem(STORAGE_KEY);
      return emptyState(todayKst);
    }
    return { schemaVersion: parsed.schemaVersion, date: parsed.date, combos: parsed.combos };
  } catch {
    safeRemoveItem(STORAGE_KEY);
    return emptyState(todayKst);
  }
}

// 호출부(NumberGenerator)가 "생성 전 quota를 반드시 다시 확인"해야 하는 책임을 지므로, 이
// 함수는 3개 초과를 막는 방어적 guard만 두고 그 이상의 판단은 하지 않는다(단일 책임 —
// lib/logic/dailyNumberPolicy.ts의 isDailyLimitReached()가 판단, 이 함수는 저장만).
export function appendGuestDailyCombo(todayKst: string, combo: GuestDailyCombo): GuestDailyState {
  const current = readGuestDailyState(todayKst);
  if (current.combos.length >= MAX_DAILY_GENERATIONS) {
    return current;
  }

  const next: GuestDailyState = {
    schemaVersion: GUEST_DAILY_SCHEMA_VERSION,
    date: todayKst,
    combos: [...current.combos, combo],
  };
  safeSetItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

// §9.7 로그인 시 guest → member 병합이 성공(부분 성공 포함)한 뒤 호출한다 — 병합된 조합을
// guest 상태로 계속 들고 있으면 다음 방문 때 회원 기록과 별개로 다시 보여 혼란을 준다.
export function clearGuestDailyState(): void {
  safeRemoveItem(STORAGE_KEY);
}
