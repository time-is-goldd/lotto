// DailyFortuneCard.tsx가 쓰는 순수 로직만 분리한 파일이다. 이 프로젝트의 vitest 설정
// (environment: "node")은 jsdom이 없어 컴포넌트를 렌더링해서 테스트할 수 없다
// (components/generate/generatorSaveLogic.ts와 동일한 이유로 분리) — reveal 애니메이션을
// "실행할지 말지" 판단하는 조건만 여기 있고, 실제 useLayoutEffect/setState 오케스트레이션은
// 컴포넌트에 남겨둔다.

// isNew가 아니거나(같은 날 재방문) prefers-reduced-motion이면 애니메이션을 재생하지 않는다
// (§3 "production animation 규칙"). DailyFortuneCard의 useLayoutEffect가 이 함수를 그대로
// 호출해, 여기서 테스트하는 조건이 실제 컴포넌트가 쓰는 조건과 항상 같도록 한다(따로
// 재구현해 로직이 갈라지는 것을 방지).
export function shouldAnimateReveal(isNew: boolean, prefersReducedMotion: boolean): boolean {
  return isNew && !prefersReducedMotion;
}
