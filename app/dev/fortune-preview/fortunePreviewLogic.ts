// FortunePreviewClient.tsx가 쓰는 순수 상태 전이 로직만 분리한 파일이다 — 이 프로젝트의
// vitest 설정(environment: "node")은 jsdom이 없어 컴포넌트를 렌더링해서 테스트할 수 없다
// (components/generate/generatorSaveLogic.ts와 동일한 이유).
//
// idle(초기, "애니메이션 시작" 버튼만 보임) → revealing(DailyFortuneCard가 마운트되어 자체
// reveal 연출을 재생 중) → done(연출 완료, "애니메이션 다시 보기" 버튼 노출) → replay 클릭 시
// 다시 revealing으로. 이 3단계 명시적 상태 기계는 "진입 즉시 애니메이션이 이미 끝난 것처럼
// 보이고, 다시 보기를 눌러도 반응이 없어 보인다"는 실제 버그 리포트에 대한 구조적 해결책이다
// — 이전에는 DailyFortuneCard가 마운트 즉시(운영자가 화면을 보기도 전에) 자체적으로
// reveal을 시작해버려 관찰 시점과 애니메이션 시작 시점이 어긋났었다. 이제는 명시적 클릭
// 전까지 DailyFortuneCard 자체를 마운트하지 않는다.
export type PreviewPhase = "idle" | "revealing" | "done";
export type PreviewAction = "start" | "complete" | "replay";

export function reducePreviewPhase(phase: PreviewPhase, action: PreviewAction): PreviewPhase {
  switch (action) {
    case "start":
      return "revealing";
    case "complete":
      return "done";
    case "replay":
      return "revealing";
    default:
      return phase;
  }
}

// key를 바꿔야 DailyFortuneCard가 완전히 새로 마운트되어 reveal이 처음부터 재생된다 —
// "revealing"으로만 phase를 되돌리는 것으로는 이미 마운트된 인스턴스가 재사용되어 아무
// 일도 일어나지 않는다(리마운트 없이는 useLayoutEffect가 다시 실행되지 않음).
export function nextReplayKey(currentKey: number): number {
  return currentKey + 1;
}
