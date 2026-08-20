import type { DailyFortune } from "@/lib/logic/dailyFortune";

import { GUEST_FORTUNE_SCHEMA_VERSION, buildProfileKeyMaterial } from "./guestFortuneKey";

// claude-code-luck-platform-daily-fortune-number-demo-prompt.md §4: 비회원 결과를 "같은 날
// 다시 보여주려면" 브라우저에 뭔가는 저장해야 한다 — 이 파일이 그 유일한 장소다. 서버로는
// 이 파일의 어떤 값도 전송되지 않는다(fetch 호출이 이 파일에 전혀 없음). Client Component만
// import한다는 전제로 작성했다 — window/localStorage/crypto.subtle을 모듈 최상위에서
// 참조하지 않고 함수 호출 시점에만 접근해, 실수로 서버 번들에 섞여도 즉시 에러 대신 빌드는
// 통과하게 한다(어차피 이 파일은 클라이언트 컴포넌트에서만 import된다).
const SALT_STORAGE_KEY = "luckplatform:fortune:salt:v1";
const ENTRY_KEY_PREFIX = "luckplatform:fortune:entry:v1:";
const INDEX_STORAGE_KEY = "luckplatform:fortune:index:v1";
const RETENTION_DAYS = 7; // §4 "최근 7일 정도까지만... 무기한 누적하지 않는다"

export interface StoredFortuneEntry {
  schemaVersion: number;
  date: string; // KST "YYYY-MM-DD"
  result: DailyFortune;
  generatedAt: string; // ISO 8601
}

interface IndexEntry {
  profileKey: string;
  date: string;
  generatedAt: string;
}

// localStorage가 막혀 있거나(Safari 강화 개인정보 보호 모드 등) quota를 초과하면 setItem이
// throw한다 — 그 경우 이번 페이지 세션 동안만 유지되는 메모리 Map으로 조용히 대체한다(§4
// "사이트가 깨지지 않게"). 새로고침하면 사라지지만, 최소한 이번 방문에서는 정상 동작한다.
const memoryFallback = new Map<string, string>();
let usingMemoryFallback = false;

export function isUsingMemoryFallback(): boolean {
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

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// crypto.getRandomValues 기반 device salt — §4 "브라우저 최초 사용 시 crypto.getRandomValues()로
// device salt를 하나 만들고". 비밀번호 보안 기능이 아니라 로컬 저장소에 생년월일을 평문으로
// 남기지 않기 위한 최소 조치다(같은 salt를 아는 사람은 여전히 생년월일 후보를 brute-force로
// 맞춰볼 수 있다 — 이 파일이 지키려는 것은 "우연히 localStorage를 들여다본 사람에게 생년월일이
// 그대로 읽히지 않는 것"뿐이다).
function getOrCreateDeviceSalt(): string {
  const existing = safeGetItem(SALT_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const salt = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  safeSetItem(SALT_STORAGE_KEY, salt);
  return salt;
}

// device salt와 profile key는 이 함수 밖으로(네트워크로) 전송되지 않는다 — 호출부는 반환된
// 문자열을 localStorage 키로만 쓴다.
export async function computeProfileKey(
  birthDate: string,
  gender: string | null | undefined,
  birthTime: string | null | undefined
): Promise<string> {
  const salt = getOrCreateDeviceSalt();
  const material = buildProfileKeyMaterial(salt, birthDate, gender, birthTime);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return toHex(digest);
}

function entryStorageKey(profileKey: string): string {
  return `${ENTRY_KEY_PREFIX}${profileKey}`;
}

function isIndexEntry(value: unknown): value is IndexEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.profileKey === "string" &&
    typeof record.date === "string" &&
    typeof record.generatedAt === "string"
  );
}

function readIndex(): IndexEntry[] {
  const raw = safeGetItem(INDEX_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isIndexEntry) : [];
  } catch {
    return [];
  }
}

function writeIndex(index: IndexEntry[]): void {
  safeSetItem(INDEX_STORAGE_KEY, JSON.stringify(index));
}

// "YYYY-MM-DD" 고정폭 문자열의 날짜 차이(일 단위) — Date.UTC로 로컬 타임존 영향 없이 계산한다.
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

// §4 "무기한 누적하지 않는다" — todayKst 기준 7일보다 오래된 항목은 entry/index 양쪽에서
// 제거한다. 호출부(컴포넌트 mount 시 1회)가 매번 이 함수를 불러도 안전하도록 멱등적이다.
export function pruneOldEntries(todayKst: string): void {
  const index = readIndex();
  const kept: IndexEntry[] = [];

  for (const item of index) {
    if (Math.abs(daysBetween(item.date, todayKst)) > RETENTION_DAYS) {
      safeRemoveItem(entryStorageKey(item.profileKey));
    } else {
      kept.push(item);
    }
  }

  writeIndex(kept);
}

// schemaVersion이 다르거나 JSON이 깨졌으면 조용히 폐기하고 null을 반환한다(§4 "schema
// version을 두고 깨진 값·오래된 값·다른 버전은 안전하게 폐기한다") — 호출부는 null을 "새로
// 생성해야 함"으로 취급하면 된다.
export function readEntry(profileKey: string): StoredFortuneEntry | null {
  const raw = safeGetItem(entryStorageKey(profileKey));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredFortuneEntry>;
    if (
      parsed.schemaVersion !== GUEST_FORTUNE_SCHEMA_VERSION ||
      typeof parsed.date !== "string" ||
      typeof parsed.generatedAt !== "string" ||
      !parsed.result
    ) {
      safeRemoveItem(entryStorageKey(profileKey));
      return null;
    }
    return parsed as StoredFortuneEntry;
  } catch {
    safeRemoveItem(entryStorageKey(profileKey));
    return null;
  }
}

export function writeEntry(profileKey: string, date: string, result: DailyFortune): StoredFortuneEntry {
  const entry: StoredFortuneEntry = {
    schemaVersion: GUEST_FORTUNE_SCHEMA_VERSION,
    date,
    result,
    generatedAt: new Date().toISOString(),
  };
  safeSetItem(entryStorageKey(profileKey), JSON.stringify(entry));

  const index = readIndex().filter((item) => item.profileKey !== profileKey);
  index.push({ profileKey, date, generatedAt: entry.generatedAt });
  writeIndex(index);

  return entry;
}

export interface TodayEntrySummary {
  profileKey: string;
  generatedAt: string;
}

// §5 "여러 프로필 결과가 있으면 생년월일을 화면에 나열하지 말고 확인 시각 기준의 비식별
// 목록... 으로 구분한다" — 반환값에 생년월일/성별/태어난시각이 전혀 없다. profileKey는
// 해시값이라 그 자체로는 원래 생년월일을 복원할 수 없다.
export function listTodayEntries(todayKst: string): TodayEntrySummary[] {
  return readIndex()
    .filter((item) => item.date === todayKst)
    .map((item) => ({ profileKey: item.profileKey, generatedAt: item.generatedAt }));
}
