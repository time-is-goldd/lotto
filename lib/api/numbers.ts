import { getDreamById } from "@/lib/api/dreams";
import { MAX_NUMBER, MIN_NUMBER, NUMBERS_PER_GAME } from "@/lib/logic/generateNumbers";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database";

// 별도 lib/types/numbers.ts를 만들지 않았다 — 이 파일 하나에서만 쓰이는 타입이라
// 파일을 분리할 만큼의 재사용 가치가 없다(과도한 abstraction 지양).
export type UserNumberEntry = Tables<"user_numbers">;

export class NumbersValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NumbersValidationError";
  }
}

export class DreamNotFoundError extends Error {
  constructor(dreamId: number) {
    super(`존재하지 않는 꿈입니다. (id: ${dreamId})`);
    this.name = "DreamNotFoundError";
  }
}

// Phase7-3 계약(docs/PHASE7_DREAM_NUMBER_INTEGRATION_REPORT.md). "auto"/"dream" 조합만
// 표현 가능한 판별 유니온으로 만들어, relatedDreamId가 null인데 generationMethod가 "dream"인
// 잘못된 상태 자체가 타입 레벨에서 만들어지지 않게 한다.
export type DreamContext =
  | { generationMethod: "auto"; relatedDreamId: null }
  | { generationMethod: "dream"; relatedDreamId: number };

const DEFAULT_DREAM_CONTEXT: DreamContext = { generationMethod: "auto", relatedDreamId: null };

// docs/PHASE5_GENERATE_LOGIC_REPORT.md §8: 서버는 번호를 다시 생성하지 않는다 — 클라이언트가
// lib/logic/generateNumbers()로 이미 화면에 보여준 값을 그대로 검증해서 저장한다("화면에
// 보인 번호"와 "저장된 번호"가 항상 같아야 하므로). MIN_NUMBER/MAX_NUMBER/NUMBERS_PER_GAME은
// Phase5-1이 export한 상수를 그대로 재사용하며 여기서 다시 정의하지 않는다 — DB CHECK
// (is_valid_lotto_numbers, supabase/migrations/0002_draws_user_numbers.sql)와 동일한 규칙을
// 애플리케이션 레벨에서도 강제해 DB 원시 에러(23514)를 사용자에게 그대로 노출하지 않는다.
//
// body에 numbers 외의 필드(예: user_id)가 있어도 이 함수는 그 필드를 아예 읽지 않는다 —
// docs/PHASE2_AUTH_DECISION.md Decision 3이 profile 입력에 쓴 것과 동일한 "명시적
// 화이트리스트" 원칙(존재해도 조용히 무시, 에러 아님).
export function parseNumbersInput(body: unknown): number[] {
  if (typeof body !== "object" || body === null) {
    throw new NumbersValidationError("요청 본문이 올바른 JSON 객체가 아닙니다.");
  }

  const { numbers } = body as Record<string, unknown>;

  if (!Array.isArray(numbers)) {
    throw new NumbersValidationError("numbers는 배열이어야 합니다.");
  }

  if (numbers.length !== NUMBERS_PER_GAME) {
    throw new NumbersValidationError(`numbers는 정확히 ${NUMBERS_PER_GAME}개여야 합니다.`);
  }

  if (!numbers.every((n): n is number => typeof n === "number" && Number.isInteger(n))) {
    throw new NumbersValidationError("numbers는 전부 정수여야 합니다.");
  }

  if (!numbers.every((n) => n >= MIN_NUMBER && n <= MAX_NUMBER)) {
    throw new NumbersValidationError(`numbers는 ${MIN_NUMBER}~${MAX_NUMBER} 범위여야 합니다.`);
  }

  if (new Set(numbers).size !== NUMBERS_PER_GAME) {
    throw new NumbersValidationError("numbers에 중복된 값이 있습니다.");
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  if (!numbers.every((n, i) => n === sorted[i])) {
    throw new NumbersValidationError("numbers는 오름차순으로 정렬되어야 합니다.");
  }

  return numbers;
}

// Phase7-3 계약. parseNumbersInput()의 기존 반환 타입(number[])을 그대로 유지하기 위해
// 이 필드들을 그 함수에 합치지 않고 별도 함수로 분리했다(기존 numbers.test.ts 무변경 원칙,
// docs/PHASE7_DREAM_NUMBER_INTEGRATION_REPORT.md §2 참조).
//
// generationMethod가 없으면 기존과 동일하게 "auto"(꿈 연동 없음)로 취급한다 — 기존 클라이언트
// (app/generate/page.tsx가 dream 쿼리파라미터 없이 호출하는 경우)는 이 필드를 아예 보내지
// 않으므로 동작이 전혀 바뀌지 않는다. relatedDreamId는 이 시점에서 "형식"만 검증한다(양의
// 정수) — 그 id가 실제 존재하는 꿈인지는 DB 조회가 필요해 saveUserNumbers()에서 검증한다.
export function parseDreamContext(body: unknown): DreamContext {
  if (typeof body !== "object" || body === null) {
    return DEFAULT_DREAM_CONTEXT;
  }

  const { generationMethod, relatedDreamId } = body as Record<string, unknown>;

  if (generationMethod === undefined) {
    return DEFAULT_DREAM_CONTEXT;
  }

  if (generationMethod !== "dream") {
    throw new NumbersValidationError("generationMethod는 'dream'만 지정할 수 있습니다.");
  }

  // relatedDreamId는 /generate?dream=<id> 쿼리파라미터에서 나온 문자열일 수도 있어 문자열/숫자
  // 둘 다 받아들이되, 최종적으로는 반드시 양의 정수여야 한다.
  const normalizedId = typeof relatedDreamId === "string" ? Number(relatedDreamId) : relatedDreamId;

  if (typeof normalizedId !== "number" || !Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw new NumbersValidationError(
      "generationMethod가 'dream'이면 relatedDreamId(양의 정수)가 필요합니다."
    );
  }

  return { generationMethod: "dream", relatedDreamId: normalizedId };
}

// user_id는 파라미터로 명시적으로 받는다(내부에서 getCurrentUser()를 다시 호출하지 않음) —
// app/api/profile/route.ts의 createProfile(userId, ...)과 동일한 패턴이다: 이 함수를 호출하는
// Route Handler가 이미 getCurrentUser()로 인증을 확인했고, 그 결과(user.id)만 신뢰해 전달한다.
// 클라이언트 요청 본문의 user_id는 이 함수에도, 호출부에도 전혀 등장하지 않는다.
//
// dreamContext를 생략하면 기존과 완전히 동일하게 동작한다(generation_method: 'auto',
// related_dream_id 없음) — 기존 호출부(app/api/numbers/route.ts가 dream 없이 부를 때와
// 동일한 시나리오)는 코드를 바꾸지 않아도 그대로 동작한다.
//
// generationMethod가 'dream'이면 INSERT 전에 getDreamById()로 실제 존재하는 꿈인지 검증한다
// (lib/api/dreams.ts 재사용, 새 조회 로직을 복제하지 않음) — 존재하지 않으면 DreamNotFoundError를
// 던져 위조된/삭제된 dreamId로 저장이 조용히 성공하는 것을 막는다.
//
// service_role은 쓰지 않는다 — RLS(supabase/migrations/0008_rls_policies.sql,
// auth.uid() = user_id)가 이미 본인 INSERT만 허용하므로 인증된 세션 클라이언트로 충분하다.
export async function saveUserNumbers(
  userId: string,
  numbers: number[],
  dreamContext: DreamContext = DEFAULT_DREAM_CONTEXT
): Promise<UserNumberEntry> {
  if (dreamContext.generationMethod === "dream") {
    const dream = await getDreamById(dreamContext.relatedDreamId);
    if (!dream) {
      throw new DreamNotFoundError(dreamContext.relatedDreamId);
    }
  }

  const supabase = await createClient();

  // related_dream_id는 dreamContext가 "dream"일 때만 payload에 포함한다 — 기존(auto) 경로의
  // INSERT 객체 모양을 그대로 유지해(3개 키 그대로) 기존 saveUserNumbers 테스트를 깨뜨리지
  // 않는다. 컬럼 자체는 NULL 허용이라 생략과 명시적 null 지정은 DB 레벨에서 동일하다.
  const { data, error } = await supabase
    .from("user_numbers")
    .insert({
      user_id: userId,
      numbers,
      generation_method: dreamContext.generationMethod,
      ...(dreamContext.generationMethod === "dream"
        ? { related_dream_id: dreamContext.relatedDreamId }
        : {}),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
