-- 0016_fortune_results_daily.sql
-- fortune_results에 result_date(오늘의 행운이 적용되는 KST 날짜)를 추가하고
-- (user_id, result_date) UNIQUE 제약을 건다.
-- 근거: docs/PRODUCT_EXPANSION_PLAN.md(Phase10-4A) — "같은 사용자 + 같은 날짜 = 항상 같은 결과"를
-- DB 레벨에서 보장해야 하는 요구사항. Phase10-4A 투입 시점에 fortune_results 실제 row 수를
-- service_role로 직접 조회해 0건임을 확인했다(0005 이후 이 테이블에 쓰는 기능이 아직 없었음) —
-- 따라서 NOT NULL 추가에 기존 데이터 backfill 문제가 없다.
--
-- fortune_results는 이미 0005에서 생성되어 있으므로 Schema Freeze 규칙(docs/DATABASE_SCHEMA.md
-- §10-1)에 따라 0005를 직접 수정하지 않고 새 마이그레이션으로만 컬럼을 추가한다. 0015가 최신
-- 적용 마이그레이션이라 다음 번호 0016을 사용한다(npx supabase migration list로 확인).
--
-- result_date 하나만 추가하면 충분하다는 결론(PRODUCT_EXPANSION_PLAN.md)을 실제 스키마
-- 재확인 후에도 유지한다 — 금전운/행동지침/행운요소/추천번호 7개 항목은 모두 기존 컬럼
-- (money_luck, action_guide, things_to_avoid, lucky_color, lucky_time, recommended_numbers,
-- overall_fortune)에 그대로 매핑되고, 행운 숫자(1~3개)는 recommended_numbers에서 파생해
-- 표시하므로 별도 컬럼이 필요 없다(lib/logic/dailyFortune.ts에서 판단).
--
-- user_id는 0005에서 nullable(비회원 이용 설계)이라 UNIQUE(user_id, result_date)는 Postgres의
-- "NULL은 서로 다른 값으로 취급" 규칙상 user_id가 NULL인 행끼리는 같은 result_date라도 충돌하지
-- 않는다. 이 Task는 로그인 사용자만 대상으로 하므로 실제로는 문제되지 않는다(비회원 운세 생성은
-- 이 Task 범위 밖 — §36 명시 금지 목록에는 없지만 성공 조건 자체가 "로그인 사용자" 한정).
alter table public.fortune_results
  add column result_date date not null;

comment on column public.fortune_results.result_date is
  '오늘의 행운이 적용되는 날짜(Asia/Seoul 기준, YYYY-MM-DD). 같은 user_id+result_date는 하루 동안 항상 동일한 결과를 반환하기 위한 키.';

alter table public.fortune_results
  add constraint fortune_results_user_id_result_date_key unique (user_id, result_date);
