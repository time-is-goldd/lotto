import type { ReactNode } from "react";

interface MainProps {
  children: ReactNode;
}

// 페이지의 실제 콘텐츠 영역(semantic <main>), app/layout.tsx에서 한 번만 사용된다.
// id="main-content"는 이후 Header(Phase3-3)가 추가할 "본문으로 바로가기" 스킵 링크의 대상이다
// (docs/UI_UX_GUIDELINE.md §11 키보드 접근성). flex-1은 PageShell의 flex-col 안에서
// Header/Footer를 뺀 나머지 높이를 채우고, flex-col은 각 페이지가 그 안에서 flex-1로
// 자기 콘텐츠를 세로로 채우거나 가운데 정렬할 수 있게 한다.
export default function Main({ children }: MainProps) {
  return <main id="main-content" className="flex flex-1 flex-col">{children}</main>;
}
