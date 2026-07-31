// DB 스키마 기반 타입은 Phase 1에서 `supabase gen types typescript`로 생성되어
// lib/types/database.ts에 추가된다. 이 파일은 DB와 무관한 범용 타입만 둔다.
export type Nullable<T> = T | null;
