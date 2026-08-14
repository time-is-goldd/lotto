import { getDreamCategories } from "@/lib/api/dreams";
import { DREAM_INTERPRETATION_MAX_LENGTH, DREAM_KEYWORD_MAX_LENGTH } from "@/lib/constants";
import { assertValidNumberSet, WinningValidationError } from "@/lib/logic/matchNumbers";
import { createClient as createPublicClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service";
import type { Tables } from "@/lib/types/database";

// Phase9-3 계약(docs/PHASE9_DREAMS_ADMIN_CRUD_REPORT.md). lib/api/dreams.ts(Phase7, 무수정)는
// 공개 조회 전용 책임을 그대로 유지한다 — 이 파일은 그 책임과 겹치지 않는 "관리자 쓰기"만
// 담당한다(지시문 §4 "public 조회 서비스는 public 조회 책임 그대로 유지, 관리자 mutation을
// public service에 억지로 넣지 않는다"). lib/api/admin/draws.ts(Phase9-2)와 동일한 패턴:
// service_role은 INSERT/UPDATE/DELETE에서만 쓰고, 이 파일을 호출하는 상위 계층(Route Handler)이
// 반드시 관리자 인증을 통과시킨 뒤에만 이 함수들을 불러야 한다 — 이 함수 자체는 호출자가
// 관리자인지 검증하지 않는다(lib/api/admin/draws.ts와 동일한 책임 분리).

export type Dream = Tables<"dreams">;

export class AdminDreamValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminDreamValidationError";
  }
}

export class AdminDreamNotFoundError extends Error {
  constructor(id: number) {
    super(`존재하지 않는 꿈입니다. (id: ${id})`);
    this.name = "AdminDreamNotFoundError";
  }
}

export interface AdminDreamInput {
  keyword: string;
  category: string | null;
  interpretation: string;
  numbers: number[] | null;
}

// keyword/interpretation은 dreams 테이블의 실제 NOT NULL 컬럼만 다룬다(0003_dreams.sql) —
// image_url은 지시문 §2가 "실제 dreams 테이블에 존재하는 필수 컬럼만"으로 범위를 명시했고
// image_url은 NULL 허용(선택) 컬럼이라 이번 MVP 폼에 포함하지 않았다(보고서 §2에 결정 기록).
//
// category는 하드코딩된 taxonomy를 쓰지 않는다 — getDreamCategories()(lib/api/dreams.ts,
// Phase7-1, 무수정)가 반환하는 "실제 DB에 이미 존재하는 값"만 허용해, 오타로 8번째 카테고리가
// 조용히 생기는 것을 막는다(지시문 §5 "실제 DB에서 사용하는 category를 기준으로").
// dreams.category는 NULL을 허용하므로(varchar(30), NOT NULL 표기 없음) category를 안 보내는
// 것도 유효하다.
async function assertKnownCategory(category: string | null): Promise<void> {
  if (category === null) {
    return;
  }
  const known = await getDreamCategories();
  if (!known.includes(category)) {
    throw new AdminDreamValidationError(
      `category는 다음 중 하나여야 합니다: ${known.join(", ")} (또는 미지정)`
    );
  }
}

function parseKeywordAndInterpretation(body: Record<string, unknown>): {
  keyword: string;
  interpretation: string;
} {
  const { keyword, interpretation } = body;

  if (typeof keyword !== "string") {
    throw new AdminDreamValidationError("keyword는 문자열이어야 합니다.");
  }
  const trimmedKeyword = keyword.trim();
  if (trimmedKeyword.length === 0) {
    throw new AdminDreamValidationError("keyword를 입력해주세요.");
  }
  if (trimmedKeyword.length > DREAM_KEYWORD_MAX_LENGTH) {
    throw new AdminDreamValidationError(`keyword는 ${DREAM_KEYWORD_MAX_LENGTH}자를 초과할 수 없습니다.`);
  }

  if (typeof interpretation !== "string") {
    throw new AdminDreamValidationError("interpretation은 문자열이어야 합니다.");
  }
  const trimmedInterpretation = interpretation.trim();
  if (trimmedInterpretation.length === 0) {
    throw new AdminDreamValidationError("interpretation을 입력해주세요.");
  }
  if (trimmedInterpretation.length > DREAM_INTERPRETATION_MAX_LENGTH) {
    throw new AdminDreamValidationError(
      `interpretation은 ${DREAM_INTERPRETATION_MAX_LENGTH}자를 초과할 수 없습니다.`
    );
  }

  return { keyword: trimmedKeyword, interpretation: trimmedInterpretation };
}

function parseCategory(body: Record<string, unknown>): string | null {
  const { category } = body;
  if (category === undefined || category === null || category === "") {
    return null;
  }
  if (typeof category !== "string") {
    throw new AdminDreamValidationError("category는 문자열이어야 합니다.");
  }
  return category;
}

// numbers는 선택 항목이다 — dream_number_mappings.dream_id가 NULL 허용 관계가 아니라
// "매핑 행 자체가 없을 수 있는" 구조이므로(0003_dreams.sql, 25:25 중에도 1:1이 강제되지
// 않음, Phase7-1이 이미 확인), 꿈 콘텐츠만 먼저 만들고 번호는 나중에 채우는 흐름을 막지
// 않는다. 값 검증 규칙은 새로 만들지 않고 lib/logic/matchNumbers.ts(Phase6-1)의
// assertValidNumberSet을 그대로 재사용한다(판정 로직 복제 금지 원칙).
function parseNumbers(body: Record<string, unknown>): number[] | null {
  const { numbers } = body;
  if (numbers === undefined || numbers === null) {
    return null;
  }
  try {
    assertValidNumberSet(numbers, "numbers");
  } catch (error) {
    if (error instanceof WinningValidationError) {
      throw new AdminDreamValidationError(error.message);
    }
    throw error;
  }
  return numbers;
}

export async function parseAdminDreamCreateInput(body: unknown): Promise<AdminDreamInput> {
  if (typeof body !== "object" || body === null) {
    throw new AdminDreamValidationError("요청 본문이 올바른 JSON 객체가 아닙니다.");
  }
  const record = body as Record<string, unknown>;
  const { keyword, interpretation } = parseKeywordAndInterpretation(record);
  const category = parseCategory(record);
  await assertKnownCategory(category);
  const numbers = parseNumbers(record);

  return { keyword, category, interpretation, numbers };
}

// update는 create와 동일한 필드 화이트리스트를 쓴다 — lib/auth/profile.ts의
// parseProfileCreateInput/parseProfileUpdateInput 분리 패턴과 다르게, 이 폼은 항상 전체
// 필드를 다시 제출하는 단일 폼(components/admin/DreamForm.tsx)이라 부분 업데이트 개념이
// 없다(지시문 §2 "수정: 기존 데이터 불러오기 → 수정" — 편집 화면이 항상 전체 값을 채워서
// 보여주고 그대로 다시 제출하는 구조).
export const parseAdminDreamUpdateInput = parseAdminDreamCreateInput;

// dream_number_mappings에 이미 행이 있으면 UPDATE, 없으면 INSERT한다("upsert") — dream_id가
// UNIQUE가 아니라 여러 행이 있을 수 있는 스키마이므로(위 주석), 첫 번째 행만 대상으로 삼는다
// (lib/api/dreams.ts의 getDreamNumbers()가 이미 같은 전제로 .limit(1)을 쓰는 것과 동일한
// 방식 — 새 가정을 추가하지 않는다).
async function upsertDreamNumbers(
  supabase: ReturnType<typeof createServiceClient>,
  dreamId: number,
  numbers: number[]
): Promise<void> {
  const { data: existing, error: selectError } = await supabase
    .from("dream_number_mappings")
    .select("id")
    .eq("dream_id", dreamId)
    .limit(1)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    const { error } = await supabase
      .from("dream_number_mappings")
      .update({ numbers })
      .eq("id", existing.id);
    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await supabase.from("dream_number_mappings").insert({ dream_id: dreamId, numbers });
  if (error) {
    throw error;
  }
}

// 이 파일에서만 service_role(lib/supabase/service.ts)을 쓴다 — dreams/dream_number_mappings
// INSERT/UPDATE/DELETE는 client 대상 RLS 정책이 없어(dreams_select_public 등은 SELECT 전용,
// 0008_rls_policies.sql) service_role만 쓸 수 있다(관리자 정책 공통 원칙,
// docs/DATABASE_SCHEMA.md §6). 새 RLS 정책을 추가하지 않는다 — 기존 원칙을 그대로 따른다.
export async function createAdminDream(input: AdminDreamInput): Promise<Dream> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("dreams")
    .insert({ keyword: input.keyword, category: input.category, interpretation: input.interpretation })
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (input.numbers !== null) {
    await upsertDreamNumbers(supabase, data.id, input.numbers);
  }

  return data;
}

// numbers가 null이면(폼에서 비워둔 경우) 기존 매핑을 건드리지 않는다 — "빈 값 제출 = 삭제"로
// 해석하면 실수로 매핑을 지우는 사고가 생길 수 있어, 매핑을 지우는 것은 이번 MVP 범위에
// 넣지 않았다(지시문 §2 "필요하지 않다면... 보고서에 명확히 기록"에 따른 결정, 보고서 §8).
export async function updateAdminDream(id: number, input: AdminDreamInput): Promise<Dream> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("dreams")
    .update({ keyword: input.keyword, category: input.category, interpretation: input.interpretation })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new AdminDreamNotFoundError(id);
  }

  if (input.numbers !== null) {
    await upsertDreamNumbers(supabase, id, input.numbers);
  }

  return data;
}

// dream_number_mappings.dream_id는 dreams(id)를 ON DELETE CASCADE로 참조한다
// (0003_dreams.sql 원문 확인, 추측 아님) — dreams 행을 지우면 관련 매핑 행이 DB
// 레벨에서 자동으로 함께 삭제되므로, 이 함수가 매핑을 별도로 지울 필요가 없다. 고아
// 데이터가 남는 구조가 아님을 실제 migration으로 확인했다(보고서 §8).
export async function deleteAdminDream(id: number): Promise<void> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.from("dreams").delete().eq("id", id).select("id").maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new AdminDreamNotFoundError(id);
  }
}

// 관리자 목록 화면 전용 조회. dreams는 공개 데이터라(dreams_select_public) service_role이
// 필요 없다 — lib/api/dreams.ts와 동일하게 anon 세션 클라이언트만 쓴다. lib/api/dreams.ts에
// "관리자용 hasNumberMapping 플래그"를 억지로 추가하지 않기 위해(공개 조회 서비스의 책임을
// 그대로 유지, 지시문 §4) 여기서 별도로 조회한다. 25건 규모라 페이지네이션은 넣지 않았다
// (lib/api/dreams.ts의 getDreams()가 이미 같은 이유로 페이지네이션을 넣지 않은 것과 동일한
// 판단, 새 가정 추가 아님).
export async function getDreamIdsWithNumbers(): Promise<Set<number>> {
  const supabase = await createPublicClient();
  const { data, error } = await supabase.from("dream_number_mappings").select("dream_id");

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.dream_id));
}
