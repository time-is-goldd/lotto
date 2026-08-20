import { NextResponse } from "next/server";

import {
  DailyLimitReachedError,
  generateDailyNumber,
  getTodayDailyGenerations,
} from "@/lib/api/dailyNumbers";
import { DreamNotFoundError, parseDreamContext, parseNumbersInput, NumbersValidationError } from "@/lib/api/numbers";
import { getCurrentUser } from "@/lib/auth/session";

// claude-code-luck-platform-home-brand-daily-numbers-prompt.md §9.5: 회원의 "오늘의 세 조합"
// 전용 라우트. app/api/numbers/route.ts(기존 "저장 번호")와 별개다 — 이 라우트는 하루 최대
// 3개라는 quota만 다루고, 실제 "다이어리에 저장"은 여전히 기존 POST /api/numbers가 담당한다
// (§9.5 "생성됐다는 이유만으로 사용자의 저장 목록을 오염시키지 않는다").
type ErrorCode = "UNAUTHORIZED" | "VALIDATION_ERROR" | "DAILY_LIMIT_REACHED" | "INTERNAL_ERROR";

function errorResponse(status: number, code: ErrorCode, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// GET — 오늘(KST) 이미 만든 조합을 그대로 복원한다(§9.6/§9.1 "같은 날 다시 방문하면 이미
// 만든 세 조합을 다시 볼 수 있다"). app/generate/page.tsx가 Server Component에서 직접
// getTodayDailyGenerations()를 호출하므로 이 GET은 클라이언트가 재검증(포커스 복귀,
// 다른 탭에서 생성한 뒤 등)이 필요할 때만 쓰인다.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  try {
    const combos = await getTodayDailyGenerations(user.id);
    return NextResponse.json({ data: { combos } });
  } catch (error) {
    console.error("[GET /api/numbers/daily] 조회 실패", { userId: user.id, error });
    return errorResponse(500, "INTERNAL_ERROR", "오늘의 조합을 불러오지 못했습니다.");
  }
}

async function readJsonBody(
  request: Request
): Promise<{ body: unknown } | { errorResponse: NextResponse }> {
  try {
    return { body: await request.json() };
  } catch {
    return {
      errorResponse: errorResponse(400, "VALIDATION_ERROR", "요청 본문이 올바른 JSON이 아닙니다."),
    };
  }
}

// POST — 다음 slot(1~3)에 새 조합을 만든다. 4번째 시도는 DailyLimitReachedError → 409로
// 응답한다(HTTP 409 Conflict: "현재 서버 상태와 충돌" — 클라이언트가 이미 3/3인 걸 몰랐거나
// 다른 탭에서 먼저 생성한 경쟁 상황을 정확히 표현한다).
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  const jsonResult = await readJsonBody(request);
  if ("errorResponse" in jsonResult) {
    return jsonResult.errorResponse;
  }

  let numbers: number[];
  let dreamContext: ReturnType<typeof parseDreamContext>;
  try {
    numbers = parseNumbersInput(jsonResult.body);
    dreamContext = parseDreamContext(jsonResult.body);
  } catch (error) {
    if (error instanceof NumbersValidationError) {
      return errorResponse(400, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }

  // dreamNumbers는 선택적이다(꿈 CTA 경로에서만 의미가 있다) — lib/api/dailyNumbers.ts가
  // numbers의 부분집합인지 다시 검증하므로 여기서는 배열 형식만 확인한다.
  const rawDreamNumbers = (jsonResult.body as Record<string, unknown>).dreamNumbers;
  const dreamNumbers = Array.isArray(rawDreamNumbers)
    ? rawDreamNumbers.filter((n): n is number => typeof n === "number")
    : [];

  try {
    const entry = await generateDailyNumber(user.id, numbers, dreamContext, dreamNumbers);
    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (error) {
    if (error instanceof DailyLimitReachedError) {
      return errorResponse(409, "DAILY_LIMIT_REACHED", error.message);
    }
    if (error instanceof DreamNotFoundError) {
      return errorResponse(400, "VALIDATION_ERROR", error.message);
    }
    console.error("[POST /api/numbers/daily] 생성 실패", { userId: user.id, error });
    return errorResponse(500, "INTERNAL_ERROR", "번호 생성 중 오류가 발생했습니다.");
  }
}
