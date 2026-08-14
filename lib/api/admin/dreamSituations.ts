import { AdminDreamNotFoundError } from "@/lib/api/admin/dreams";
import {
  DREAM_SITUATION_BODY_MAX_LENGTH,
  DREAM_SITUATION_KEY_MEANING_MAX_LENGTH,
  DREAM_SITUATION_KEYWORD_MAX_LENGTH,
  DREAM_SITUATION_TITLE_MAX_LENGTH,
} from "@/lib/constants";
import { assertValidPartialNumberSet, WinningValidationError } from "@/lib/logic/matchNumbers";
import { createClient as createPublicClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service";
import type { Tables } from "@/lib/types/database";

// Phase10-4E 계약. lib/api/dreamSituations.ts(Phase10-4D, 무수정)는 공개 조회 전용 책임을
// 그대로 유지한다 — 이 파일은 그 책임과 겹치지 않는 "관리자 쓰기"만 담당한다
// (lib/api/admin/dreams.ts와 완전히 동일한 책임 분리 원칙). service_role은 INSERT/UPDATE/
// DELETE에서만 쓰고, 이 파일을 호출하는 상위 계층(Route Handler)이 반드시 관리자 인증을
// 통과시킨 뒤에만 이 함수들을 불러야 한다 — 이 함수 자체는 호출자가 관리자인지 검증하지
// 않는다.

export type DreamSituation = Tables<"dream_situations">;

export class AdminDreamSituationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminDreamSituationValidationError";
  }
}

// dreamId+situationId 조합이 실제로 일치하지 않으면(존재하지 않거나, 다른 Dream 소속이거나)
// 이 에러 하나로 통일한다 — "다른 Parent 소속"과 "아예 존재하지 않음"을 구분해 응답하면
// situationId가 다른 Dream에 존재한다는 사실을 노출하게 된다(지시문 §13 소유권 검증).
export class AdminDreamSituationNotFoundError extends Error {
  constructor(dreamId: number, situationId: number) {
    super(`존재하지 않는 상황입니다. (dreamId: ${dreamId}, situationId: ${situationId})`);
    this.name = "AdminDreamSituationNotFoundError";
  }
}

export class DuplicateSituationKeywordError extends Error {
  constructor(keyword: string) {
    super(`이미 사용 중인 keyword입니다: ${keyword}`);
    this.name = "DuplicateSituationKeywordError";
  }
}

export interface AdminDreamSituationInput {
  keyword: string;
  title: string;
  body: string;
  keyMeaning: string | null;
  numbers: number[]; // 항상 배열(0~6개) — DB 저장 직전에만 0개를 NULL로 변환한다.
  displayOrder: number;
}

function parseKeyword(record: Record<string, unknown>): string {
  const { keyword } = record;
  if (typeof keyword !== "string") {
    throw new AdminDreamSituationValidationError("keyword는 문자열이어야 합니다.");
  }
  const trimmed = keyword.trim();
  if (trimmed.length === 0) {
    throw new AdminDreamSituationValidationError("keyword를 입력해주세요.");
  }
  if (trimmed.length > DREAM_SITUATION_KEYWORD_MAX_LENGTH) {
    throw new AdminDreamSituationValidationError(
      `keyword는 ${DREAM_SITUATION_KEYWORD_MAX_LENGTH}자를 초과할 수 없습니다.`
    );
  }
  return trimmed;
}

function parseTitle(record: Record<string, unknown>): string {
  const { title } = record;
  if (typeof title !== "string") {
    throw new AdminDreamSituationValidationError("title은 문자열이어야 합니다.");
  }
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new AdminDreamSituationValidationError("title을 입력해주세요.");
  }
  if (trimmed.length > DREAM_SITUATION_TITLE_MAX_LENGTH) {
    throw new AdminDreamSituationValidationError(
      `title은 ${DREAM_SITUATION_TITLE_MAX_LENGTH}자를 초과할 수 없습니다.`
    );
  }
  return trimmed;
}

function parseBody(record: Record<string, unknown>): string {
  const { body } = record;
  if (typeof body !== "string") {
    throw new AdminDreamSituationValidationError("body는 문자열이어야 합니다.");
  }
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    throw new AdminDreamSituationValidationError("body를 입력해주세요.");
  }
  if (trimmed.length > DREAM_SITUATION_BODY_MAX_LENGTH) {
    throw new AdminDreamSituationValidationError(
      `body는 ${DREAM_SITUATION_BODY_MAX_LENGTH}자를 초과할 수 없습니다.`
    );
  }
  return trimmed;
}

// key_meaning은 nullable 컬럼이다(0018_dream_situations.sql) — 빈 문자열/미입력은 "핵심 해석
// 없음"(NULL)으로 취급한다.
function parseKeyMeaning(record: Record<string, unknown>): string | null {
  const { keyMeaning } = record;
  if (keyMeaning === undefined || keyMeaning === null || keyMeaning === "") {
    return null;
  }
  if (typeof keyMeaning !== "string") {
    throw new AdminDreamSituationValidationError("keyMeaning은 문자열이어야 합니다.");
  }
  const trimmed = keyMeaning.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > DREAM_SITUATION_KEY_MEANING_MAX_LENGTH) {
    throw new AdminDreamSituationValidationError(
      `keyMeaning은 ${DREAM_SITUATION_KEY_MEANING_MAX_LENGTH}자를 초과할 수 없습니다.`
    );
  }
  return trimmed;
}

// numbers는 0~6개다(lib/api/dreams.ts 쪽 6개 고정과 다르게 assertValidNumberSet이 아니라
// assertValidPartialNumberSet을 쓴다 — lib/logic/matchNumbers.ts 참조). 미입력/누락은 "0개"로
// 취급한다(components/admin/DreamSituationForm.tsx가 빈 문자열을 빈 배열로 파싱해 보낸다는
// 전제). 오름차순으로 normalize해 저장한다(지시문 §7 "오름차순 normalization 가능").
function parseNumbers(record: Record<string, unknown>): number[] {
  const { numbers } = record;
  if (numbers === undefined || numbers === null) {
    return [];
  }
  try {
    assertValidPartialNumberSet(numbers, "numbers");
  } catch (error) {
    if (error instanceof WinningValidationError) {
      throw new AdminDreamSituationValidationError(error.message);
    }
    throw error;
  }
  return [...numbers].sort((a, b) => a - b);
}

// display_order는 0 이상의 정수만 허용한다 — DB 컬럼 자체는 부호를 제한하지 않지만
// (0018_dream_situations.sql `int not null default 0`), 화면 정렬 순서라는 개념상 음수는
// 의미가 없어 애플리케이션 레벨에서만 막는다(과도한 제한이 아니라 UX상 자연스러운 경계).
function parseDisplayOrder(record: Record<string, unknown>): number {
  const { displayOrder } = record;
  if (typeof displayOrder !== "number" || !Number.isInteger(displayOrder) || displayOrder < 0) {
    throw new AdminDreamSituationValidationError("displayOrder는 0 이상의 정수여야 합니다.");
  }
  return displayOrder;
}

// dream_id는 이 함수의 파라미터가 아니라 항상 호출부(Route Handler)가 URL 세그먼트에서 얻어
// createAdminDreamSituation()/updateAdminDreamSituation()에 별도로 전달한다 — 요청 본문에
// dream_id/dreamId 필드가 있어도 여기서는 아예 읽지 않는다(지시문 §4 "client에서 넘긴
// dream_id를 무조건 신뢰하지 않는다"를 "애초에 그 필드를 신뢰의 대상으로 삼지 않는다"로
// 구현했다).
export function parseAdminDreamSituationInput(rawInput: unknown): AdminDreamSituationInput {
  if (typeof rawInput !== "object" || rawInput === null) {
    throw new AdminDreamSituationValidationError("요청 본문이 올바른 JSON 객체가 아닙니다.");
  }
  const record = rawInput as Record<string, unknown>;

  return {
    keyword: parseKeyword(record),
    title: parseTitle(record),
    body: parseBody(record),
    keyMeaning: parseKeyMeaning(record),
    numbers: parseNumbers(record),
    displayOrder: parseDisplayOrder(record),
  };
}

// update도 create와 동일한 필드 화이트리스트를 쓴다 — lib/api/admin/dreams.ts의
// parseAdminDreamUpdateInput = parseAdminDreamCreateInput과 동일한 이유(항상 전체 필드를
// 다시 제출하는 단일 폼).
export const parseAdminDreamSituationCreateInput = parseAdminDreamSituationInput;
export const parseAdminDreamSituationUpdateInput = parseAdminDreamSituationInput;

// Postgres 에러 코드. lib/api/admin/draws.ts의 DuplicateRoundError 처리와 동일한 패턴 —
// 애플리케이션 레벨에서 사전 조회 후 판단하지 않고, DB의 UNIQUE 제약(dream_situations
// (dream_id, keyword), 0018)이 동시 요청까지 포함해 원천적으로 막아주는 결과를 그대로
// 해석한다.
const POSTGRES_UNIQUE_VIOLATION = "23505";
const POSTGRES_FOREIGN_KEY_VIOLATION = "23503";

function toStoredNumbers(numbers: number[]): number[] | null {
  return numbers.length === 0 ? null : numbers;
}

// 이 파일에서만 service_role(lib/supabase/service.ts)을 쓴다 — dream_situations INSERT/
// UPDATE/DELETE는 client 대상 RLS 정책이 없어(dream_situations_select_public은 SELECT
// 전용, 0018_dream_situations.sql) service_role만 쓸 수 있다(관리자 정책 공통 원칙). 새 RLS
// 정책을 추가하지 않는다.
export async function createAdminDreamSituation(
  dreamId: number,
  input: AdminDreamSituationInput
): Promise<DreamSituation> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("dream_situations")
    .insert({
      dream_id: dreamId,
      keyword: input.keyword,
      title: input.title,
      body: input.body,
      key_meaning: input.keyMeaning,
      numbers: toStoredNumbers(input.numbers),
      display_order: input.displayOrder,
    })
    .select()
    .single();

  if (error) {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) {
      throw new DuplicateSituationKeywordError(input.keyword);
    }
    // dreamId가 실제 존재하지 않는 dreams.id를 가리키면 FK 제약 위반이다 — 이 Route는 항상
    // 존재하는 부모 페이지(/admin/dreams/[id]/situations/new)에서만 호출되지만, URL을 직접
    // 조작해 없는 id를 보낼 수 있으므로 여기서도 방어한다. lib/api/admin/dreams.ts가 이미
    // 정의한 "존재하지 않는 꿈입니다" 에러를 그대로 재사용한다(중복 타입을 새로 만들지 않음).
    if (error.code === POSTGRES_FOREIGN_KEY_VIOLATION) {
      throw new AdminDreamNotFoundError(dreamId);
    }
    throw error;
  }

  return data;
}

// 소유권 검증(지시문 §13): .eq("id", situationId)뿐 아니라 .eq("dream_id", dreamId)까지
// WHERE 조건에 함께 건다 — situationId는 실재하지만 dreamId가 다른 Dream 소속이면 이
// UPDATE는 0행에 적용되고(에러 없음), 아래 data 없음 분기에서 AdminDreamSituationNotFoundError로
// 처리된다. "존재하지 않음"과 "다른 Dream 소속"을 응답에서 구분하지 않아, 다른 Dream 밑에
// 어떤 situationId가 존재하는지 자체를 노출하지 않는다.
export async function updateAdminDreamSituation(
  dreamId: number,
  situationId: number,
  input: AdminDreamSituationInput
): Promise<DreamSituation> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("dream_situations")
    .update({
      keyword: input.keyword,
      title: input.title,
      body: input.body,
      key_meaning: input.keyMeaning,
      numbers: toStoredNumbers(input.numbers),
      display_order: input.displayOrder,
    })
    .eq("id", situationId)
    .eq("dream_id", dreamId)
    .select()
    .maybeSingle();

  if (error) {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) {
      throw new DuplicateSituationKeywordError(input.keyword);
    }
    throw error;
  }
  if (!data) {
    throw new AdminDreamSituationNotFoundError(dreamId, situationId);
  }

  return data;
}

// 삭제도 update와 동일한 소유권 검증 방식(WHERE id + dream_id)을 쓴다. dream_situations는
// 자식 행이 없어(FK cascade 대상이 아니라 대상 그 자체) 이 함수가 별도로 정리할 관련 테이블이
// 없다.
export async function deleteAdminDreamSituation(
  dreamId: number,
  situationId: number
): Promise<void> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("dream_situations")
    .delete()
    .eq("id", situationId)
    .eq("dream_id", dreamId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new AdminDreamSituationNotFoundError(dreamId, situationId);
  }
}

// lib/api/admin/dreams.ts의 getDreamIdsWithNumbers()와 동일한 이유·동일한 패턴 — dream_situations는
// 공개 데이터라(dream_situations_select_public) service_role이 필요 없어 여기서도 anon 세션
// 클라이언트만 쓴다. 관리자 목록 화면(app/admin/dreams/page.tsx)의 "부모 Dream 삭제 시 세부
// 상황 N개도 함께 삭제됩니다" 안내(지시문 §17)에만 쓰이는 admin 전용 집계라 공개 조회 서비스
// (lib/api/dreamSituations.ts)의 책임에 넣지 않았다.
export async function getDreamSituationCounts(): Promise<Map<number, number>> {
  const supabase = await createPublicClient();
  const { data, error } = await supabase.from("dream_situations").select("dream_id");

  if (error) {
    throw error;
  }

  const counts = new Map<number, number>();
  for (const row of data ?? []) {
    counts.set(row.dream_id, (counts.get(row.dream_id) ?? 0) + 1);
  }
  return counts;
}
