import Link from "next/link";

import LogoutButton from "./LogoutButton";

interface ProfileMenuProps {
  nickname: string;
}

// 최소 구현 — 실제 드롭다운(열기/닫기) 상호작용은 만들지 않는다. 라이브러리 설치가 금지되어
// 있고, 이번 Task 원칙("디자인보다 구조 우선", "디자인 고도화 금지")에 따라 항상 펼쳐진
// 가로 배치로 닉네임/마이페이지/로그아웃만 노출한다. 실제 열림/닫힘 상호작용은 디자인이
// 확정되는 이후 Task(docs/PHASE3_HEADER_FOOTER_REPORT.md "발견한 문제" 참조)에서 다룬다.
//
// 375px 모바일 오버플로우 대응(Phase3 Audit High): 닉네임은 최대 30자(PROFILE_NICKNAME_MAX_LENGTH)라
// 좁은 화면에서 "마이페이지"/"로그아웃"까지 밀어내 넘칠 수 있다. 닉네임 텍스트 내용은 그대로
// 유지하되(삭제/축약 없음) min-w-0 + flex-1 + truncate로 남는 공간만 차지하고 넘치면 말줄임표로
// "시각적으로만" 자르며, 두 액션(마이페이지/로그아웃)은 shrink-0으로 항상 완전한 형태로 남긴다.
export default function ProfileMenu({ nickname }: ProfileMenuProps) {
  return (
    <div className="flex min-w-0 items-center gap-3 text-sm">
      <span className="min-w-0 flex-1 truncate font-medium text-text-primary">{nickname}님</span>
      <Link href="/my/profile" className="shrink-0 text-text-secondary">
        마이페이지
      </Link>
      <Link href="/my/account" className="shrink-0 text-text-secondary">
        계정 설정
      </Link>
      <LogoutButton />
    </div>
  );
}
