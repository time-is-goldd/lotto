// claude-code-luck-platform-launch-prompt.md §13/§14: 로그인 후 원래 있던 화면으로 돌아가려면
// next 쿼리 파라미터를 신뢰해야 하는데, 검증 없이 그대로 리다이렉트하면 open redirect가 된다
// ("//evil.com", "https://evil.com", "/\evil.com" 같은 값도 브라우저가 외부 호스트로 취급할 수
// 있다). 이 서비스 내부 경로("/"로 시작하고, 프로토콜/호스트를 담을 수 있는 형태가 아닌 값)만
// 허용한다 — 화이트리스트 대신 구조적 검증을 쓰는 이유는 next를 쓰는 호출부가 이미 여러 곳
// (app/admin/layout.tsx, app/fortune/page.tsx, app/my/journal/** 등)이라 경로를 매번 늘리지
// 않아도 되게 하기 위함이다.
export function isSafeNextPath(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }
  if (!value.startsWith("/")) {
    return false;
  }
  // "//evil.com"이나 "/\evil.com"은 브라우저가 scheme-relative URL로 해석해 외부 호스트로
  // 이동시킬 수 있다 — 두 번째 문자가 "/" 또는 "\"이면 거부한다.
  if (value.startsWith("//") || value.startsWith("/\\")) {
    return false;
  }
  // "/next?x=https://evil.com" 자체는 안전하지만(경로만 봄), 값 안에 스킴 구분자가 있으면
  // 이 다음 단계에서 new URL(next, base)에 넘겼을 때 예상 밖의 파싱이 나올 수 있어 방어적으로
  // 막는다.
  if (value.includes("://")) {
    return false;
  }
  return true;
}
