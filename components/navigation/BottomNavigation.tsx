"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

// docs/SITEMAP.md 기준 실제 경로만 사용한다. INFORMATION_ARCHITECTURE.md §1.2가 계획한
// "더보기" 탭은 SITEMAP에 대응하는 단일 URL이 없고 실제로는 3×3 그리드 오버레이(§1.3)라
// 여전히 제외한다(docs/PHASE3_BOTTOM_NAVIGATION_REPORT.md §6). 대신 꿈해몽(/dream)은 핵심
// 유입 채널(SEO 검색 진입점)인데도 하단 네비에 없어 재방문 동선이 끊겨 있었다 —
// claude-code-luck-platform-launch-prompt.md §17이 지적한 문제를 반영해 5탭으로 확장한다.
const NAV_ITEMS: NavItem[] = [
  { label: "홈", href: "/", icon: <HomeIcon /> },
  { label: "꿈해몽", href: "/dream", icon: <DreamIcon /> },
  { label: "번호생성", href: "/generate", icon: <GenerateIcon /> },
  { label: "운세", href: "/fortune", icon: <FortuneIcon /> },
  { label: "다이어리", href: "/my/journal", icon: <DiaryIcon /> },
];

// proxy.ts의 matchesPath()와 같은 판단 기준(정확히 일치 또는 그 하위 경로)을 쓴다 — 로직이
// 3줄뿐이라 별도 공용 유틸로 추출하지 않고 이 파일에만 두었다. "/"는 정확히 일치할 때만
// 활성 처리한다(모든 경로가 "/"로 시작하므로 하위 경로 매칭을 쓰면 항상 활성化된다).
function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

// docs/DESIGN_SYSTEM.md §4.6: 높이 64px, 활성 탭은 color-primary, 비활성은 color-text-secondary.
// 현재 경로를 알아야 활성 탭을 표시할 수 있는데, Root Layout(app/layout.tsx)은 Server
// Component라 요청 경로를 prop으로 받지 않는다 — Next.js가 이 문제를 위해 제공하는
// 공식 해법이 usePathname()이라 이 컴포넌트만 Client Component로 둔다(다른 대안 없음).
export default function BottomNavigation() {
  const pathname = usePathname();

  return (
    // Header(components/layout/Header.tsx)가 렌더링하는 GlobalNav(components/navigation/GlobalNav.tsx)도
    // aria-label="주요 메뉴"를 쓴다 — 이 컴포넌트까지 같은 라벨을 쓰면 스크린리더 랜드마크
    // 목록에 "주요 메뉴"가 두 번 뜬다(실제 렌더링 결과로 확인, docs/PHASE3_BOTTOM_NAVIGATION_REPORT.md
    // §4). 구분되는 라벨("하단 메뉴")로 바꿔 해결했다.
    <nav
      aria-label="하단 메뉴"
      className="fixed inset-x-0 bottom-0 z-10 h-16 border-t border-border bg-bg-base md:hidden"
    >
      <ul className="grid h-full grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 text-caption focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  active ? "text-primary" : "text-text-secondary"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// docs/DESIGN_SYSTEM.md §5: 라인 아이콘(2px stroke) 통일, 32px(탭바), 아이콘 매핑
// "번호생성(주사위/볼)"/"운세(별)"/"행운 다이어리(노트)" 그대로 반영. 프로젝트에 아이콘
// 라이브러리가 설치된 적이 없어(package.json 확인) 새 라이브러리 없이 인라인 SVG로
// 직접 그렸다 — 기존에 이미 쓰던 방식(아이콘 없이 유니코드 기호+aria-hidden)과 같은
// "새 의존성 없이 직접 그린다"는 원칙을 그대로 확장한 것이다.
function HomeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-8 w-8"
    >
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
    </svg>
  );
}

function DreamIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-8 w-8"
    >
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  );
}

function GenerateIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-8 w-8"
    >
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FortuneIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-8 w-8"
    >
      <path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6z" />
    </svg>
  );
}

function DiaryIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-8 w-8"
    >
      <path d="M4 5a2 2 0 0 1 2-2h4v18H6a2 2 0 0 1-2-2z" />
      <path d="M20 5a2 2 0 0 0-2-2h-4v18h4a2 2 0 0 0 2-2z" />
    </svg>
  );
}
