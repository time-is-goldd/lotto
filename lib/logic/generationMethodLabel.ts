import type { Enums } from "@/lib/types/database";

// user_numbers.generation_method(supabase/migrations/0002_draws_user_numbers.sql의 enum)에
// 대응하는 한글 라벨. 원래 app/my/journal/history/page.tsx에만 있던 지역 상수였는데,
// Phase10-4C(당첨확인)가 같은 라벨을 다시 필요로 해 공용 위치로 옮겼다 — 두 화면이 같은
// generation_method 값을 서로 다른 문구로 표시하는 것을 막기 위함이다(중복 로직 금지).
// enum이 정의하는 4개 값(auto/custom/dream/fortune)만 사용한다 — 존재하지 않는 source를
// 추측해서 추가하지 않는다.
const GENERATION_METHOD_LABEL: Record<Enums<"user_numbers_generation_method">, string> = {
  auto: "자동 생성",
  custom: "직접 지정",
  dream: "꿈 연동",
  fortune: "운세 연동",
};

export function getGenerationMethodLabel(method: string): string {
  return (
    GENERATION_METHOD_LABEL[method as Enums<"user_numbers_generation_method">] ?? method
  );
}
