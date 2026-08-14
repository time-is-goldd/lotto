import Link from "next/link";

import LoginButton, { PRIMARY_LINK_BUTTON_CLASSNAME } from "@/components/auth/LoginButton";
import ProfileMenu from "@/components/auth/ProfileMenu";
import GlobalNav from "@/components/navigation/GlobalNav";
import { getProfile } from "@/lib/auth/profile";
import { getCurrentUser } from "@/lib/auth/session";
import { SITE_NAME } from "@/lib/constants";

import Container from "./Container";

// 로고 / Navigation(GlobalNav, Phase3-7) / 인증 영역 3개 구조(docs/PHASE3_UI_ARCHITECTURE_PLAN.md
// §6). getCurrentUser()/getProfile()을 서버에서 직접 호출하는 async Server Component다 —
// Client Component 최소화 원칙 때문에 상호작용이 필요한 LogoutButton/GlobalNav(현재 경로 필요)
// 만 각각 별도 Client Component로 분리했다. proxy.ts/기존 인증 로직은 그대로 재사용만 한다.
//
// justify-between: GlobalNav가 모바일에서 hidden(display:none)이 되면 flex-1 spacer 역할이
// 사라져 로고와 인증 영역이 붙어버린다 — justify-between이 그 상황에서도 두 영역을 양 끝으로
// 밀어준다(GlobalNav가 보이는 데스크톱에서는 GlobalNav의 flex-1이 이미 여유 공간을 다 차지해
// justify-between이 별다른 영향을 주지 않는다).
export default async function Header() {
  const user = await getCurrentUser();
  const profile = user ? await getProfile(user.id) : null;

  return (
    <header className="border-b border-border bg-bg-base">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="text-lg font-bold text-text-primary">
          {SITE_NAME}
        </Link>

        <GlobalNav />

        <div className="flex min-w-0 items-center gap-4">
          {!user && <LoginButton />}
          {user && !profile && (
            <Link href="/onboarding" className={PRIMARY_LINK_BUTTON_CLASSNAME}>
              온보딩 계속하기
            </Link>
          )}
          {user && profile && <ProfileMenu nickname={profile.nickname} />}
        </div>
      </Container>
    </header>
  );
}
