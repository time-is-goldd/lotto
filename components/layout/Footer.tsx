import Link from "next/link";

import { SITE_NAME } from "@/lib/constants";

import Container from "./Container";

// docs/PHASE3_UI_ARCHITECTURE_PLAN.md §6이 비워뒀던 nav 자리를 Phase10-3에서 채운다 —
// app/terms/page.tsx, app/privacy/page.tsx, app/about/page.tsx(전부 이번 Task에서 신규 구현)로
// 연결한다. Footer 레이아웃 자체(구조/스타일)는 변경하지 않았다.
const POLICY_LINKS = [
  { label: "서비스 소개", href: "/about" },
  { label: "이용약관", href: "/terms" },
  { label: "개인정보처리방침", href: "/privacy" },
] as const;

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-bg-base">
      <Container className="flex flex-col gap-2 py-8 text-sm text-text-secondary">
        <span className="font-medium text-text-primary">{SITE_NAME}</span>
        <nav aria-label="정책 및 안내" className="flex flex-wrap gap-4">
          {POLICY_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:underline">
              {link.label}
            </Link>
          ))}
        </nav>
        <p>
          &copy; {year} {SITE_NAME}. All rights reserved.
        </p>
      </Container>
    </footer>
  );
}
