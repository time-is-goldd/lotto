import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import Container from "@/components/layout/Container";
import { isAdmin } from "@/lib/auth/isAdmin";
import { getCurrentUser } from "@/lib/auth/session";

// docs/PHASE9_PRE_IMPLEMENTATION_AUDIT.md §4/§6: /admin/*는 noindex(공개 대상 아님) —
// app/my/journal/*.tsx가 이미 쓰는 것과 동일한 패턴.
export const metadata: Metadata = {
  title: "관리자",
  robots: { index: false, follow: false },
};

const ADMIN_HOME_PATH = "/admin";

// 이 프로젝트의 2계층 보안 원칙(docs/PHASE6_ADMIN_AUTH_DECISION.md §7/§8, 재확인만 함 —
// 이번 Task에서 새로 결정하지 않음)을 페이지 라우트에도 그대로 적용한다: proxy.ts는
// 이번 Task에서 수정하지 않으므로(범위 밖) 이 layout이 /admin/* 전체의 유일한 서버 측
// 보안 경계다. getCurrentUser()/isAdmin() 둘 다 기존 함수를 그대로 재사용하고, 새 인증
// 시스템(admin 세션/쿠키/JWT/profiles.is_admin 등)을 전혀 만들지 않는다.
//
// 클라이언트에서 관리자 여부를 판단하지 않는다 — 이 layout은 Server Component이고,
// children(하위 페이지)은 이 함수가 실제로 return한 뒤에만 렌더링되므로, 관리자가 아닌
// 요청은 애초에 관리자 페이지의 JSX 트리 자체가 만들어지지 않는다(클라이언트로 내려갈
// HTML/RSC payload 자체가 없음 — "버튼을 숨기는" 수준의 방어가 아니다).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(ADMIN_HOME_PATH)}`);
  }

  // 로그인은 했지만 관리자가 아닌 경우: 이 프로젝트에 기존 403/접근거부 UI 패턴이 없어
  // (전수 확인) 새로 만들지 않고 기존 notFound() 관례(app/dream/[keyword]/page.tsx가
  // 이미 쓰는 Next.js 기본 404)를 재사용한다 — 관리자 경로가 존재한다는 사실 자체를
  // 일반 사용자에게 노출하지 않는 부수효과도 있다(docs/PHASE6_ADMIN_AUTH_DECISION.md §7이
  // 이미 검토했던 방향과 일치).
  if (!(await isAdmin())) {
    notFound();
  }

  return <Container className="flex flex-col gap-6 py-10">{children}</Container>;
}
