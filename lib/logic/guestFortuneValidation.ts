// claude-code-luck-platform-daily-fortune-number-demo-prompt.md §6/§7/§9/§10/§22가 공유하는
// 순수 검증 함수. components/fortune/GuestFortuneForm.tsx가 제출 시 이 함수로 필드 옆 에러를
// 표시한다 — §13에 따라 비회원 운세는 서버 API를 거치지 않고 브라우저에서 직접 계산하므로
// (더 이상 app/api/fortune/guest 라우트가 없다), 이 파일이 사실상 유일한 신뢰 경계다.
//
// §10: "비회원 운세 폼에서 isAtLeast19, 미성년 차단, 19세 경고 오류를 제거한다" — 이 파일은
// 만 나이를 전혀 계산하지 않는다(예전 버전에 있던 calculateAgeAt/isOldEnough/too_young을
// 완전히 제거했다). 계정 가입(19세 이상)의 연령 검증은 lib/auth/profile.ts의
// calculateAgeVerified()가 별도로 담당하며 이 파일과는 무관하다 — 공개 운세 열람 제한 해제와
// 회원가입 연령 정책은 서로 다른 파일, 다른 함수로 완전히 분리되어 있다(§12).

const BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BIRTH_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
export const GUEST_FORTUNE_GENDERS = ["M", "F", "N"] as const;
export type GuestFortuneGender = (typeof GUEST_FORTUNE_GENDERS)[number];

// "YYYY-MM-DD" 형식이면서 실제 존재하는 달력 날짜인지(예: "2024-02-30" 거부) 확인한다. UTC로
// 구성해 서버 실행 타임존과 무관하게 항상 같은 결과를 낸다.
export function isValidCalendarDate(value: string): boolean {
  if (!BIRTH_DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12) {
    return false;
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

// 문자열(YYYY-MM-DD) 사전식 비교 = 날짜 비교와 동일하다 — 두 값이 같은 포맷일 때만 성립한다.
export function isFutureDate(value: string, todayKst: string): boolean {
  return value > todayKst;
}

// §7 "지나치게 비현실적인 날짜를 명확히 안내한다" — 연령 제한이 아니라 순수 입력 실수
// 방지용 상한이다(예: "1899-01-01"처럼 실수로 연도를 잘못 입력한 경우). 130년은 실제 최고
// 기대수명을 넉넉히 웃도는 값으로 임의로 정했다 — 이 상수를 age-gate 목적으로 재사용하지
// 않는다(§10 "연령 제한을 위한 검증은 하지 않는다"와 구분하기 위해 이름도 age가 아니라
// unrealistic으로 짓는다).
const UNREALISTIC_YEARS_AGO = 130;

export function isUnrealisticallyOldDate(birthDate: string, todayKst: string): boolean {
  const birthYear = Number(birthDate.slice(0, 4));
  const todayYear = Number(todayKst.slice(0, 4));
  return todayYear - birthYear > UNREALISTIC_YEARS_AGO;
}

export interface GuestFortuneInput {
  birthDate: string;
  gender?: string | null;
  birthTime?: string | null;
}

export interface GuestFortuneValidationResult {
  ok: boolean;
  // 화면에 그대로 표시 가능한 한국어 메시지 — §9 "오류가 나면 어느 값이 잘못됐는지 구체적으로
  // 알린다. 예: 2월 30일은 존재하지 않는 날짜예요." 코드가 아니라 완성된 문장을 반환해,
  // 클라이언트가 코드→문구 매핑 테이블을 따로 유지하지 않아도 된다.
  errors: {
    birthDate?: string;
    gender?: string;
    birthTime?: string;
  };
}

// gender/birthTime은 선택 입력이라 비어있으면 에러 없이 통과한다.
export function validateGuestFortuneInput(
  input: GuestFortuneInput,
  todayKst: string
): GuestFortuneValidationResult {
  const errors: GuestFortuneValidationResult["errors"] = {};

  if (!input.birthDate) {
    errors.birthDate = "생년월일을 입력해주세요.";
  } else if (!BIRTH_DATE_PATTERN.test(input.birthDate)) {
    errors.birthDate = "생년월일 형식이 올바르지 않아요.";
  } else if (!isValidCalendarDate(input.birthDate)) {
    const [, monthStr, dayStr] = input.birthDate.split("-");
    errors.birthDate = `${Number(monthStr)}월 ${Number(dayStr)}일은 존재하지 않는 날짜예요.`;
  } else if (isFutureDate(input.birthDate, todayKst)) {
    errors.birthDate = "미래 날짜는 입력할 수 없어요.";
  } else if (isUnrealisticallyOldDate(input.birthDate, todayKst)) {
    errors.birthDate = "생년월일을 다시 확인해주세요.";
  }

  if (
    input.gender != null &&
    input.gender !== "" &&
    !GUEST_FORTUNE_GENDERS.includes(input.gender as GuestFortuneGender)
  ) {
    errors.gender = "성별 값이 올바르지 않아요.";
  }

  if (input.birthTime != null && input.birthTime !== "" && !BIRTH_TIME_PATTERN.test(input.birthTime)) {
    errors.birthTime = "태어난 시각 형식이 올바르지 않아요.";
  }

  return { ok: Object.keys(errors).length === 0, errors };
}
