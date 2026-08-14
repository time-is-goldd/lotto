import Link from "next/link";

// Header의 인증 영역에서 <button>이 아닌 <a>(Link)로 "버튼처럼 보이는" 링크를 만들 때 쓰는
// 클래스. Header.tsx의 "온보딩 계속하기" 링크가 동일한 스타일을 필요로 해 문자열을 각자
// 중복 정의하던 것(Phase3 Audit High/Medium)을 이 상수 하나로 모았다 — 새 컴포넌트를 만들지
// 않고 기존 파일의 export만 늘렸다. hover:bg-primary-dark는 DESIGN_SYSTEM.md §1.1에 이미
// 정의된 토큰(Primary 호버/프레스 상태)이라 새 색상이 아니다.
export const PRIMARY_LINK_BUTTON_CLASSNAME =
  "rounded-button bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark";

// 카카오 로그인 진입점(/login, docs/PHASE2_PROXY_REPORT.md)으로 보내는 순수 네비게이션
// 링크다. /api/auth/kakao/login으로 곧장 보내지 않는 이유는 /login 페이지가 이미 그 진입을
// 담당하고 있어(중복 구현 금지) 여기서 또 만들 필요가 없기 때문이다.
export default function LoginButton() {
  return (
    <Link href="/login" className={PRIMARY_LINK_BUTTON_CLASSNAME}>
      로그인
    </Link>
  );
}
