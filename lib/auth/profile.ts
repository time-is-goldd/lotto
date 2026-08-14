import { PROFILE_MIN_AGE, PROFILE_NICKNAME_MAX_LENGTH } from "@/lib/constants";
import { createClient } from "@/lib/supabase/service";
import { Constants } from "@/lib/types/database";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/types/database";

export type Profile = Tables<"profiles">;

export class ProfileNotFoundError extends Error {
  constructor() {
    super("profile을 찾을 수 없습니다.");
    this.name = "ProfileNotFoundError";
  }
}

export class ProfileAlreadyExistsError extends Error {
  constructor() {
    super("profile이 이미 존재합니다.");
    this.name = "ProfileAlreadyExistsError";
  }
}

export class ProfileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileValidationError";
  }
}

const BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BIRTH_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

function assertIsRecord(body: unknown): asserts body is Record<string, unknown> {
  if (typeof body !== "object" || body === null) {
    throw new ProfileValidationError("요청 본문이 올바른 JSON 객체가 아닙니다.");
  }
}

function parseNickname(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > PROFILE_NICKNAME_MAX_LENGTH
  ) {
    throw new ProfileValidationError(
      `nickname은 1~${PROFILE_NICKNAME_MAX_LENGTH}자 문자열이어야 합니다.`
    );
  }

  return value.trim();
}

function parseBirthDate(value: unknown): string {
  if (
    typeof value !== "string" ||
    !BIRTH_DATE_PATTERN.test(value) ||
    Number.isNaN(new Date(value).getTime())
  ) {
    throw new ProfileValidationError("birth_date는 YYYY-MM-DD 형식이어야 합니다.");
  }

  if (new Date(value).getTime() > Date.now()) {
    throw new ProfileValidationError("birth_date는 미래 날짜일 수 없습니다.");
  }

  return value;
}

function parseGender(value: unknown): Profile["gender"] {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value !== "string" ||
    !(Constants.public.Enums.profile_gender as readonly string[]).includes(value)
  ) {
    throw new ProfileValidationError("gender는 M/F/N 중 하나여야 합니다.");
  }

  return value as Profile["gender"];
}

function parseBirthTime(value: unknown): Profile["birth_time"] {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string" || !BIRTH_TIME_PATTERN.test(value)) {
    throw new ProfileValidationError("birth_time은 HH:MM 또는 HH:MM:SS 형식이어야 합니다.");
  }

  return value;
}

function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new ProfileValidationError(`${field}은 boolean이어야 합니다.`);
  }

  return value;
}

type ProfileCreatableFields = Pick<
  TablesInsert<"profiles">,
  | "nickname"
  | "birth_date"
  | "gender"
  | "birth_time"
  | "marketing_opt_in"
  | "privacy_public_default"
>;

// docs/PHASE2_AUTH_DECISION.md Decision 3: provider/status/age_verified/id 등은 이 함수가
// 아예 읽지 않는다 — 클라이언트가 body에 무엇을 담아 보내든 여기 나열되지 않은 키는
// 존재하지 않는 것처럼 취급된다(명시적 화이트리스트).
export function parseProfileCreateInput(body: unknown): ProfileCreatableFields {
  assertIsRecord(body);

  return {
    nickname: parseNickname(body.nickname),
    birth_date: parseBirthDate(body.birth_date),
    gender: parseGender(body.gender),
    birth_time: parseBirthTime(body.birth_time),
    marketing_opt_in:
      body.marketing_opt_in === undefined
        ? false
        : parseBoolean(body.marketing_opt_in, "marketing_opt_in"),
    privacy_public_default:
      body.privacy_public_default === undefined
        ? true
        : parseBoolean(body.privacy_public_default, "privacy_public_default"),
  };
}

// docs/PHASE2_AUTH_DECISION.md Decision 3: 수정 가능한 컬럼을 nickname/gender/birth_time/
// marketing_opt_in/privacy_public_default로 명시적으로 한정한다. provider/birth_date/
// age_verified/status/id/created_at/updated_at은 이 함수가 절대 읽지 않으므로, body에
// 포함되어 있어도 조용히 무시된다(에러가 아니라 화이트리스트 밖이라 애초에 접근하지 않음).
export function parseProfileUpdateInput(body: unknown): TablesUpdate<"profiles"> {
  assertIsRecord(body);

  const input: TablesUpdate<"profiles"> = {};

  if (body.nickname !== undefined) {
    input.nickname = parseNickname(body.nickname);
  }
  if (body.gender !== undefined) {
    input.gender = parseGender(body.gender);
  }
  if (body.birth_time !== undefined) {
    input.birth_time = parseBirthTime(body.birth_time);
  }
  if (body.marketing_opt_in !== undefined) {
    input.marketing_opt_in = parseBoolean(body.marketing_opt_in, "marketing_opt_in");
  }
  if (body.privacy_public_default !== undefined) {
    input.privacy_public_default = parseBoolean(
      body.privacy_public_default,
      "privacy_public_default"
    );
  }

  if (Object.keys(input).length === 0) {
    throw new ProfileValidationError("수정 가능한 필드가 없습니다.");
  }

  return input;
}

// 만 19세 이상 여부를 서버가 직접 계산한다 — 클라이언트가 보낸 age_verified 값은 어떤
// 경로로도 읽지 않는다(docs/PHASE2_AUTH_ARCHITECTURE_AUDIT.md §3.3-A, Decision 3).
//
// birthDate("YYYY-MM-DD")를 Date로 파싱하지 않고 문자열에서 정수를 직접 뽑아 비교한다 —
// "YYYY-MM-DD" 형식은 Date 생성자가 UTC 자정으로 해석하는데, 그 뒤 getMonth()/getDate()
// 같은 로컬 getter로 다시 읽으면 서버 실행 타임존에 따라 날짜가 하루 밀릴 수 있다(음의
// UTC 오프셋 지역에서 특히). "오늘"도 UTC 기준으로 통일해 서버 타임존과 무관하게 항상
// 같은 결과가 나오도록 한다.
export function calculateAgeVerified(birthDate: string): boolean {
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);

  const today = new Date();
  const todayYear = today.getUTCFullYear();
  const todayMonth = today.getUTCMonth() + 1;
  const todayDay = today.getUTCDate();

  let age = todayYear - birthYear;
  const hasHadBirthdayThisYear =
    todayMonth > birthMonth || (todayMonth === birthMonth && todayDay >= birthDay);

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age >= PROFILE_MIN_AGE;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

// proxy.ts의 "로그인했지만 profile 없음 → /onboarding" 판단(docs/PHASE2_AUTH_DECISION.md
// Decision 1) 등, 행 전체가 필요 없는 호출처를 위한 존재 확인 전용 함수.
export async function profileExists(userId: string): Promise<boolean> {
  return (await getProfile(userId)) !== null;
}

export async function createProfile(
  userId: string,
  provider: Profile["provider"],
  input: ProfileCreatableFields
): Promise<Profile> {
  const supabase = createClient();

  const payload: TablesInsert<"profiles"> = {
    id: userId,
    provider,
    age_verified: calculateAgeVerified(input.birth_date),
    ...input,
  };

  const { data, error } = await supabase.from("profiles").insert(payload).select().single();

  if (error) {
    // 23505 = Postgres unique_violation. profiles.id는 PK라 동시 요청이 겹쳐도 DB가
    // 최종적으로 중복을 막아준다 — 여기서는 그 결과를 명확한 도메인 에러로 변환만 한다.
    if (error.code === "23505") {
      throw new ProfileAlreadyExistsError();
    }
    throw error;
  }

  return data;
}

export async function updateProfile(
  userId: string,
  input: TablesUpdate<"profiles">
): Promise<Profile> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("profiles")
    .update(input)
    .eq("id", userId)
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ProfileNotFoundError();
  }

  return data;
}
