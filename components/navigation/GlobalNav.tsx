"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
}

// docs/SITEMAP.md 기준 실제 경로만 사용한다. INFORMATION_ARCHITECTURE.md §1.1의 데스크톱 GNB
// 5번째 항목("더보기")은 SITEMAP에 대응하는 단일 URL이 없고 실제로는 그리드 오버레이(§1.3)다 —
// docs/PHASE3_BOTTOM_NAVIGATION_REPORT.md §0-2에서 Bottom Navigation에 대해 이미 같은 문제를
// 발견해 사용자 확인을 거쳐 "제외" 결정을 확정해뒀다. GNB도 정확히 같은 문제라 다시 묻지 않고
// 그 선례를 그대로 적용해 4개 항목만 구현한다.
const NAV_ITEMS: NavItem[] = [
  { label: "번호생성", href: "/generate" },
  { label: "꿈해몽", href: "/dream" },
  { label: "운세", href: "/fortune" },
  { label: "다이어리", href: "/my/journal" },
];

// components/navigation/BottomNavigation.tsx의 isActive()와 동일한 판단 기준(정확히 일치
// 또는 그 하위 경로) — 로직이 2줄뿐이라 공용 유틸로 추출하지 않았다.
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// components/layout/Header.tsx는 getCurrentUser()/getProfile()을 쓰는 async Server
// Component로 유지해야 한다(이번 Task 요구사항 10 — 인증 로직 변경 금지). 활성 탭 표시에
// 필요한 현재 경로는 Server Component가 prop 없이 알 방법이 없어(Root Layout이라 route
// params도 없음), BottomNavigation과 똑같은 이유로 nav 부분만 별도 Client Component로
// 분리했다 — Header는 이 컴포넌트를 import해 렌더링만 한다.
//
// md:flex — 모바일에서는 숨긴다(요구사항 5, 이미 있는 components/navigation/BottomNavigation.tsx가
// 모바일 내비게이션을 전담하므로 GNB와 겹치면 안 된다). 768px 이상(태블릿/데스크톱)에서만
// 보인다 — BottomNavigation의 md:hidden과 정확히 반대 지점에서 서로 넘겨받는 구조.
export default function GlobalNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="주요 메뉴" className="hidden flex-1 items-center gap-6 md:flex">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`text-body font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              active ? "text-primary" : "text-text-secondary"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
