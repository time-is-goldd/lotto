-- 0013_profiles_status_default.sql
-- profiles.status에 DEFAULT 'active'를 추가한다.
-- 근거: docs/DATABASE_SCHEMA.md §3.1(v2.3), §11 "0002 착수 전 필수 조치".
--
-- 번호가 0002 직후가 아니라 0013인 이유: 0001_profiles.sql은 이미 적용되어 있어
-- Schema Freeze 규칙(docs/DATABASE_SCHEMA.md §10-1)에 따라 직접 수정할 수 없고,
-- 새 마이그레이션으로만 반영해야 한다. Supabase CLI는 순수 숫자 접두사만 마이그레이션으로
-- 인식하므로(예: "0002a"는 인식하지 못하고 건너뜀 — 직접 확인함) 알파벳 접미사를 쓸 수 없고,
-- 0003~0012는 이미 docs/DATABASE_SCHEMA.md §9와 docs/EXECUTION_PLAN.md에 다른 테이블/기능
-- 이름으로 확정되어 있어 재번호를 매기면 그 문서들을 전부 다시 고쳐야 한다. 따라서 현재
-- 예약되지 않은 가장 빠른 번호(0013, Phase9의 0012_admin_flag.sql 다음)를 사용한다.
-- profiles는 0001에서 이미 생성되어 있으므로 실행 순서상 아무 문제가 없다.

alter table public.profiles
  alter column status set default 'active';
