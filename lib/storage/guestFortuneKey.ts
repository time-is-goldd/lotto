// claude-code-luck-platform-daily-fortune-number-demo-prompt.md §4: 비회원 프로필을 식별하는
// 로컬 키를 만드는 순수 문자열 조립 로직만 이 파일에 둔다. 실제 해시(Web Crypto SHA-256)와
// localStorage 접근은 lib/storage/guestFortuneStore.ts가 담당한다 — 이 파일은 브라우저 API를
// 전혀 쓰지 않아 vitest(jsdom 없음, node 환경)로 그대로 테스트할 수 있다.

export const GUEST_FORTUNE_SCHEMA_VERSION = 1;

type NormalizableGender = string | null | undefined;

// lib/logic/dailyFortune.ts의 normalizeGenderForSeed()와 동일한 규칙("M"/"F"만 의미 있고
// 나머지는 전부 unknown)이지만, 그 파일을 import하지 않는다 — 저장 키 생성은 "브라우저에
// 무엇을 저장할지"를 결정하는 별개의 관심사라 운세 계산 로직과 결합시키지 않는다(계산 로직이
// 바뀌어도 이미 저장된 로컬 키의 의미가 바뀌지 않아야 한다).
export function normalizeGenderForKey(gender: NormalizableGender): "M" | "F" | "unknown" {
  return gender === "M" || gender === "F" ? gender : "unknown";
}

export function normalizeBirthTimeForKey(birthTime: string | null | undefined): string {
  return birthTime ? birthTime.slice(0, 5) : "unknown";
}

// crypto.subtle.digest("SHA-256", ...)에 그대로 넘길 입력 문자열. §4가 명시한 조합
// 순서(schemaVersion + deviceSalt + normalizedBirthDate + genderOrUnknown + birthTimeOrUnknown)를
// 그대로 따른다 — deviceSalt가 브라우저마다/재설치마다 달라지므로 같은 생년월일이라도 다른
// 브라우저에서는 다른 profile key가 나온다(레인보우 테이블 공격 표면을 줄이는 부수 효과가
// 있지만, §4 주석대로 이건 비밀번호 보안 기능이 아니라 로컬 저장소에 생년월일을 평문으로
// 남기지 않기 위한 최소 조치일 뿐이다).
export function buildProfileKeyMaterial(
  deviceSalt: string,
  birthDate: string,
  gender: NormalizableGender,
  birthTime: string | null | undefined
): string {
  return [
    GUEST_FORTUNE_SCHEMA_VERSION,
    deviceSalt,
    birthDate,
    normalizeGenderForKey(gender),
    normalizeBirthTimeForKey(birthTime),
  ].join("|");
}
