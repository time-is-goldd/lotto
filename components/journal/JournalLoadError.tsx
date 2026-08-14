import EmptyState from "@/components/ui/EmptyState";

// "조회 실패"를 표시할 때 다이어리 페이지들이 공통으로 쓰는 문구
// (docs/UI_UX_GUIDELINE.md §8 "기술 용어 노출 금지, 일상어 사용"). 실제 데이터가 없는
// EmptyState와는 항상 다른 문구를 써서 "빈 상태"와 "조회 실패"를 혼동하지 않게 한다
// (Phase4-2까지는 페이지마다 이 문구를 각자 복사해뒀다). EmptyState 자체를 대체하는
// 새 컴포넌트가 아니라, EmptyState에 고정된 에러 문구만 얹은 얇은 wrapper다.
export default function JournalLoadError() {
  return (
    <EmptyState
      title="불러오는 중 문제가 발생했어요"
      description="일시적으로 연결이 어려워요. 잠시 후 다시 시도해주세요."
    />
  );
}
