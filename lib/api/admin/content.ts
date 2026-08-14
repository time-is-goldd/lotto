import { CONTENT_TITLE_MAX_LENGTH } from "@/lib/constants";
import { createClient as createServiceClient } from "@/lib/supabase/service";
import type { Tables } from "@/lib/types/database";

// Phase9-6 계약(docs/PHASE9_FAQ_GUIDE_DECISION.md). lib/api/admin/dreams.ts(Phase9-3)와 동일한
// 구조/에러 처리 컨벤션을 그대로 재사용한다: service_role은 INSERT/UPDATE/DELETE에서만 쓰고, 이
// 파일을 호출하는 상위 계층(Route Handler / 관리자 페이지)이 반드시 관리자 인증을 통과시킨 뒤에만
// 이 함수들을 불러야 한다 — 이 함수 자체는 호출자가 관리자인지 검증하지 않는다.
//
// content_entries는 dreams와 달리 공개 SELECT RLS 정책이 없다(0014_content_entries.sql — Phase9은
// 관리자 CRUD까지만 담당하고 공개 페이지는 Phase10 소관이라 아직 소비자가 없음). 그래서
// getAdminContentEntries()도 service_role을 쓴다 — lib/api/dreams.ts처럼 anon 세션 클라이언트로
// 조회할 수 있는 공개 데이터가 아니다.

export type ContentEntry = Tables<"content_entries">;
export type ContentEntryType = ContentEntry["type"];

const CONTENT_TYPES: readonly ContentEntryType[] = ["faq", "guide"];

export class AdminContentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminContentValidationError";
  }
}

export class AdminContentNotFoundError extends Error {
  constructor(id: number) {
    super(`존재하지 않는 콘텐츠입니다. (id: ${id})`);
    this.name = "AdminContentNotFoundError";
  }
}

// Phase10-1(docs/PHASE10_RELEASE_GATE.md §16)이 추가한 content_entries_guide_title_idx
// (0015_content_entries_public_read.sql, type='guide' 대상 partial UNIQUE)에 대한 회귀 대응.
// lib/api/admin/draws.ts의 DuplicateRoundError와 동일한 패턴 — Postgres unique violation을
// 잡아 도메인 에러로 변환하고, Route Handler가 409로 매핑한다. 사전 SELECT로 중복을 미리
// 확인하지 않는다 — DB UNIQUE 제약을 최종 진실의 원천으로 유지해 race condition을 피한다.
export class DuplicateGuideTitleError extends Error {
  constructor(title: string) {
    super(`동일한 제목의 가이드가 이미 존재합니다. (title: ${title})`);
    this.name = "DuplicateGuideTitleError";
  }
}

// Postgres unique violation code(lib/api/admin/draws.ts의 POSTGRES_UNIQUE_VIOLATION과 동일).
const POSTGRES_UNIQUE_VIOLATION = "23505";

export interface AdminContentInput {
  type: ContentEntryType;
  title: string;
  body: string;
  display_order: number;
}

function isContentEntryType(value: unknown): value is ContentEntryType {
  return typeof value === "string" && (CONTENT_TYPES as readonly string[]).includes(value);
}

function parseType(body: Record<string, unknown>): ContentEntryType {
  const { type } = body;
  if (!isContentEntryType(type)) {
    throw new AdminContentValidationError(`type은 다음 중 하나여야 합니다: ${CONTENT_TYPES.join(", ")}`);
  }
  return type;
}

function parseTitleAndBody(body: Record<string, unknown>): { title: string; body: string } {
  const { title, body: contentBody } = body;

  if (typeof title !== "string") {
    throw new AdminContentValidationError("title은 문자열이어야 합니다.");
  }
  const trimmedTitle = title.trim();
  if (trimmedTitle.length === 0) {
    throw new AdminContentValidationError("title을 입력해주세요.");
  }
  if (trimmedTitle.length > CONTENT_TITLE_MAX_LENGTH) {
    throw new AdminContentValidationError(`title은 ${CONTENT_TITLE_MAX_LENGTH}자를 초과할 수 없습니다.`);
  }

  if (typeof contentBody !== "string") {
    throw new AdminContentValidationError("body는 문자열이어야 합니다.");
  }
  const trimmedBody = contentBody.trim();
  if (trimmedBody.length === 0) {
    throw new AdminContentValidationError("body를 입력해주세요.");
  }

  return { title: trimmedTitle, body: trimmedBody };
}

// display_order는 DEFAULT 0(0014_content_entries.sql)이라 생략/undefined/null은 0으로 취급한다.
// 값이 주어지면 lib/api/admin/draws.ts의 firstPrizeAmount/firstPrizeCount와 동일한 검증 패턴
// ("0 이상의 정수")을 그대로 재사용한다 — 새 숫자 검증 규칙을 발명하지 않는다.
function parseDisplayOrder(body: Record<string, unknown>): number {
  const { display_order: displayOrder } = body;
  if (displayOrder === undefined || displayOrder === null) {
    return 0;
  }
  if (typeof displayOrder !== "number" || !Number.isInteger(displayOrder) || displayOrder < 0) {
    throw new AdminContentValidationError("display_order는 0 이상의 정수여야 합니다.");
  }
  return displayOrder;
}

export function parseAdminContentCreateInput(body: unknown): AdminContentInput {
  if (typeof body !== "object" || body === null) {
    throw new AdminContentValidationError("요청 본문이 올바른 JSON 객체가 아닙니다.");
  }
  const record = body as Record<string, unknown>;
  const type = parseType(record);
  const { title, body: contentBody } = parseTitleAndBody(record);
  const display_order = parseDisplayOrder(record);

  return { type, title, body: contentBody, display_order };
}

// update도 create와 동일한 필드 화이트리스트를 쓴다 — components/admin/ContentForm.tsx가 dreams와
// 동일하게 항상 전체 필드를 다시 제출하는 단일 폼이라 부분 업데이트 개념이 없다
// (lib/api/admin/dreams.ts의 parseAdminDreamUpdateInput과 동일한 결정).
export const parseAdminContentUpdateInput = parseAdminContentCreateInput;

// 관리자 목록 화면 전용 조회. type을 주면 FAQ/가이드 목록을 분리해서 보여준다(FAQ 목록/가이드
// 목록 페이지가 동일한 함수를 type 인자만 다르게 호출, docs/PHASE9_FAQ_GUIDE_DECISION.md §9).
// display_order 우선, 동일 순서면 id(생성 순서)로 안정적인 2차 정렬을 한다.
export async function getAdminContentEntries(type?: ContentEntryType): Promise<ContentEntry[]> {
  const supabase = createServiceClient();
  let query = supabase
    .from("content_entries")
    .select()
    .order("display_order", { ascending: true })
    .order("id", { ascending: true });

  if (type !== undefined) {
    query = query.eq("type", type);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data;
}

export async function getAdminContentEntryById(id: number): Promise<ContentEntry | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("content_entries").select().eq("id", id).maybeSingle();
  if (error) {
    throw error;
  }
  return data;
}

export async function createContentEntry(input: AdminContentInput): Promise<ContentEntry> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("content_entries")
    .insert({
      type: input.type,
      title: input.title,
      body: input.body,
      display_order: input.display_order,
    })
    .select()
    .single();

  if (error) {
    if (input.type === "guide" && error.code === POSTGRES_UNIQUE_VIOLATION) {
      throw new DuplicateGuideTitleError(input.title);
    }
    throw error;
  }
  return data;
}

export async function updateContentEntry(id: number, input: AdminContentInput): Promise<ContentEntry> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("content_entries")
    .update({
      type: input.type,
      title: input.title,
      body: input.body,
      display_order: input.display_order,
    })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    if (input.type === "guide" && error.code === POSTGRES_UNIQUE_VIOLATION) {
      throw new DuplicateGuideTitleError(input.title);
    }
    throw error;
  }
  if (!data) {
    throw new AdminContentNotFoundError(id);
  }
  return data;
}

export async function deleteContentEntry(id: number): Promise<void> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("content_entries")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new AdminContentNotFoundError(id);
  }
}
