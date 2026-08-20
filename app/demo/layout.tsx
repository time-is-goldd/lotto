import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Container from "@/components/layout/Container";
import { isPublicDemoEnabled } from "@/lib/demo/isDemoEnabled";

// claude-code-luck-platform-daily-fortune-number-demo-prompt.md §22: 모든 /demo/* route에
// noindex,nofollow를 적용한다 — 이 레이아웃 하나에서 한 번만 지정하면 하위 페이지가 각자
// 반복하지 않아도 된다(Next.js는 layout과 page의 metadata를 병합한다).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// §18: 인증 우회·실제 auth guard 예외를 만들지 않는다 — 이 레이아웃은 getCurrentUser()나
// Supabase를 전혀 부르지 않는다. §22 "ENABLE_PUBLIC_DEMO 환경변수로 켜고 끌 수 있게 한다.
// 꺼졌을 때는 404를 반환한다" — /demo/* 전체가 이 레이아웃 하나를 거치므로 게이트도 여기
// 한 곳에서만 확인한다.
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  if (!isPublicDemoEnabled()) {
    notFound();
  }

  return (
    <div className="flex flex-col">
      {/* §20: 각 데모 페이지 상단에 고정하는 배너 — 정확히 지정된 문구를 그대로 쓴다. */}
      <div className="bg-accent-gold/20 py-2 text-center text-caption font-medium text-text-primary">
        데모 화면 · 실제 사용자 정보가 아닌 검토용 예시 데이터입니다.
      </div>
      <Container className="py-10">{children}</Container>
    </div>
  );
}
