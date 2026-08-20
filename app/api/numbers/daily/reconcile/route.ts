import { NextResponse } from "next/server";

import { reconcileGuestDailyCombos, type GuestComboInput } from "@/lib/api/dailyNumbers";
import { parseNumbersInput, NumbersValidationError } from "@/lib/api/numbers";
import { getCurrentUser } from "@/lib/auth/session";

// claude-code-luck-platform-home-brand-daily-numbers-prompt.md §9.7: 로그인 직후 클라이언트가
// (guestDailyNumbersStore.ts에서 읽은) 오늘의 guest 조합을 이 라우트로 보내 회원 기록으로
// 병합한다. 서버(Kakao OAuth 콜백)는 localStorage를 볼 수 없으므로 병합은 항상 클라이언트가
// 로그인 완료를 감지한 뒤 트리거한다 — 이 라우트는 그 병합 요청을 받는 쪽이다.

type ErrorCode = "UNAUTHORIZED" | "VALIDATION_ERROR" | "INTERNAL_ERROR";

function errorResponse(status: number, code: ErrorCode, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

interface RawGuestCombo {
  numbers?: unknown;
  source?: unknown;
  relatedDreamId?: unknown;
  dreamNumbers?: unknown;
}

// guest localStorage는 애초에 브라우저 devtools로 조작 가능한 신뢰할 수 없는 입력이다 —
// 형식이 잘못된 항목은 요청 전체를 실패시키지 않고 조용히 걸러낸다(개별 조합 하나가
// 손상됐다고 나머지 정상 조합까지 병합을 포기할 이유가 없다).
function parseGuestCombos(body: unknown): GuestComboInput[] {
  if (typeof body !== "object" || body === null) {
    return [];
  }
  const { combos } = body as Record<string, unknown>;
  if (!Array.isArray(combos)) {
    return [];
  }

  const parsed: GuestComboInput[] = [];
  for (const raw of combos as RawGuestCombo[]) {
    try {
      const numbers = parseNumbersInput({ numbers: raw.numbers });
      const source = raw.source === "dream" ? "dream" : "general";
      const relatedDreamId =
        typeof raw.relatedDreamId === "number" && Number.isInteger(raw.relatedDreamId) && raw.relatedDreamId > 0
          ? raw.relatedDreamId
          : null;
      const dreamNumbers = Array.isArray(raw.dreamNumbers)
        ? raw.dreamNumbers.filter((n): n is number => typeof n === "number")
        : [];
      parsed.push({ numbers, source, relatedDreamId, dreamNumbers });
    } catch (error) {
      if (error instanceof NumbersValidationError) {
        continue;
      }
      throw error;
    }
  }
  return parsed;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "VALIDATION_ERROR", "요청 본문이 올바른 JSON이 아닙니다.");
  }

  const guestCombos = parseGuestCombos(body);
  if (guestCombos.length === 0) {
    return NextResponse.json({ data: { merged: [], skipped: 0 } });
  }

  try {
    const result = await reconcileGuestDailyCombos(user.id, guestCombos);
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("[POST /api/numbers/daily/reconcile] 병합 실패", { userId: user.id, error });
    return errorResponse(500, "INTERNAL_ERROR", "오늘의 조합을 병합하지 못했습니다.");
  }
}
