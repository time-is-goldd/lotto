export const SITE_NAME = "Luck Platform";

// profiles 관련 상수. docs/DATABASE_SCHEMA.md §3.1(nickname VARCHAR(30))과
// [[FEATURE_SPEC]] §9.3(만 19세 미만 이용제한)의 값을 그대로 반영한다.
export const PROFILE_NICKNAME_MAX_LENGTH = 30;
export const PROFILE_MIN_AGE = 19;

// dream_journal_entries.dream_text는 text 컬럼이라 DB 레벨 길이 제한이 없다
// (supabase/migrations/0004_dream_journal_entries.sql). 이 값은 순수 애플리케이션 레벨
// 상한이다 — Client Component(components/journal/DreamJournalForm.tsx, 글자 수 표시/제출
// 버튼 비활성화)와 서버(lib/api/journal.ts, 최종 검증)가 같은 값을 공유해야 해서
// lib/api/journal.ts가 아니라 여기(client-safe, next/headers 의존 없음)에 둔다
// (docs/PHASE7_DREAM_JOURNAL_CREATE_REPORT.md §2 참조).
export const DREAM_JOURNAL_TEXT_MAX_LENGTH = 2000;

// dreams.keyword는 varchar(50)이다(supabase/migrations/0003_dreams.sql) — DB 제약을
// 그대로 반영한 값(추측 아님). dreams.interpretation은 text 컬럼이라 DB 레벨 길이 제한이
// 없어 DREAM_JOURNAL_TEXT_MAX_LENGTH와 동일한 이유로 순수 애플리케이션 레벨 상한을 둔다 —
// 관리자가 작성하는 해몽 본문은 개인 다이어리 기록보다 더 긴 편집 콘텐츠일 수 있어 여유
// 있게 잡았다. 둘 다 lib/api/admin/dreams.ts(서버 검증)와 components/admin/DreamForm.tsx
// (클라이언트 UX)가 값을 공유해야 해서 client-safe한 이 파일에 둔다
// (docs/PHASE9_DREAMS_ADMIN_CRUD_REPORT.md 참조).
export const DREAM_KEYWORD_MAX_LENGTH = 50;
export const DREAM_INTERPRETATION_MAX_LENGTH = 5000;

// content_entries.title은 varchar(200)이다(supabase/migrations/0014_content_entries.sql) — DB
// 제약을 그대로 반영한 값(추측 아님). lib/api/admin/content.ts(서버 검증)와
// components/admin/ContentForm.tsx(클라이언트 UX)가 값을 공유해야 해서 client-safe한 이 파일에
// 둔다(DREAM_KEYWORD_MAX_LENGTH와 동일한 이유). body는 text 컬럼이라 DB 레벨 길이 제한이 없고
// 지시문이 별도 상한을 요구하지 않아 애플리케이션 레벨 상한도 두지 않는다(빈 문자열 금지만 검증).
export const CONTENT_TITLE_MAX_LENGTH = 200;

// dream_situations.keyword/title/key_meaning는 각각 varchar(50)/varchar(100)/varchar(200)이다
// (supabase/migrations/0018_dream_situations.sql) — DB 제약을 그대로 반영한 값(추측 아님).
// body는 text 컬럼이라 DB 레벨 길이 제한이 없어 DREAM_INTERPRETATION_MAX_LENGTH와 동일한
// 이유로 순수 애플리케이션 레벨 상한을 둔다(관리자가 쓰는 2~4문단 분량 콘텐츠라 같은 값을
// 그대로 재사용해도 충분하다 — 임의로 더 작게 잡지 않는다, Phase10-4E 지시문 §21 "임의로
// 과도한 제한 추가하지 않는다"). 전부 lib/api/admin/dreamSituations.ts(서버 검증)와
// components/admin/DreamSituationForm.tsx(클라이언트 UX)가 값을 공유해야 해서 client-safe한
// 이 파일에 둔다(DREAM_KEYWORD_MAX_LENGTH와 동일한 이유).
export const DREAM_SITUATION_KEYWORD_MAX_LENGTH = 50;
export const DREAM_SITUATION_TITLE_MAX_LENGTH = 100;
export const DREAM_SITUATION_KEY_MEANING_MAX_LENGTH = 200;
export const DREAM_SITUATION_BODY_MAX_LENGTH = DREAM_INTERPRETATION_MAX_LENGTH;
