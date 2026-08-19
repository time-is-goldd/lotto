import { NextResponse } from "next/server";

import { deleteAccount, AdminAccountProtectedError } from "@/lib/api/account/deleteAccount";
import { getCurrentUser } from "@/lib/auth/session";
import { logout } from "@/lib/auth/logout";

// DELETE /api/account — 회원탈퇴(Phase10-8, docs/ACCOUNT_WITHDRAWAL_REPORT.md).
// app/api/profile/route.ts와 동일한 에러 응답 관례를 따른다. request body를 전혀 읽지
// 않는다 — 삭제 대상 userId는 오직 getCurrentUser()가 재검증한 현재 세션에서만 얻는다
// (지시문 §8/§29 "client-provided user_id 금지" — 애초에 클라이언트 입력을 파싱하지
// 않으므로 위조된 값이 도달할 경로 자체가 없다).
type ErrorCode = "UNAUTHORIZED" | "ADMIN_ACCOUNT_CANNOT_SELF_DELETE" | "INTERNAL_ERROR";

function errorResponse(status: number, code: ErrorCode, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function DELETE() {
  const user = await getCurrentUser();

  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  try {
    await deleteAccount(user.id);
  } catch (error) {
    if (error instanceof AdminAccountProtectedError) {
      return errorResponse(
        403,
        "ADMIN_ACCOUNT_CANNOT_SELF_DELETE",
        "관리자 계정은 이 화면에서 탈퇴할 수 없습니다."
      );
    }
    console.error("[DELETE /api/account] 회원탈퇴 처리 실패", { userId: user.id, error });
    return errorResponse(500, "INTERNAL_ERROR", "회원탈퇴 처리 중 오류가 발생했습니다.");
  }

  try {
    // 계정은 이미 삭제되었다 — 쿠키 정리가 실패해도 치명적이지 않다(다음 요청에서
    // getCurrentUser()의 getUser() 재검증이 어차피 삭제된 사용자를 무효 세션으로 판정한다,
    // lib/auth/session.ts 주석 참조). 그래도 즉시 로그아웃 상태로 보이도록 시도한다.
    await logout();
  } catch (error) {
    console.error("[DELETE /api/account] 탈퇴 후 세션 정리 실패(계정 삭제 자체는 완료됨)", {
      userId: user.id,
      error,
    });
  }

  return NextResponse.json({ success: true });
}
