// claude-code-luck-platform-daily-fortune-number-demo-prompt.md §22: "가능하면
// ENABLE_PUBLIC_DEMO 환경변수로 켜고 끌 수 있게 한다. 꺼졌을 때는 404를 반환한다." 정확히
// 문자열 "true"일 때만 켜진다(그 외 값/미설정은 전부 꺼짐) — .env.example의
// LOTTO_SECONDARY_FALLBACK_ENABLED와 동일한 fail-closed 컨벤션을 그대로 따른다.
export function isPublicDemoEnabled(): boolean {
  return process.env.ENABLE_PUBLIC_DEMO === "true";
}
