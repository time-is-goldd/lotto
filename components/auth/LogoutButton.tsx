"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// 이 트리에서 유일하게 상호작용(클릭 → fetch → 이동)이 필요해 Client Component로 분리했다
// (이번 Task 구현 원칙 "Client Component 최소화") — lib/auth/logout.ts를 직접 호출하지 않고
// 항상 POST /api/auth/logout을 거친다(Client Component는 서버 전용 lib/supabase/server.ts를
// import할 수 없고, 그래야만 하지도 않는다 — docs/PHASE2_LOGOUT_IMPLEMENTATION_REPORT.md).
// router.refresh()가 필요한 이유: Header는 Root Layout에서 렌더되는 Server Component라
// router.push()만으로는 다시 실행되지 않는다 — refresh()로 서버 트리를 강제로 다시 그려야
// 로그아웃 후 Header가 실제로 "로그인" 상태로 바뀐다.
export default function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="shrink-0 whitespace-nowrap text-text-secondary disabled:opacity-50"
    >
      {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
    </button>
  );
}
