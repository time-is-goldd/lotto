-- 0017_fortune_results_privacy.sql
-- fortune_results의 SELECT RLS를 "전체 공개"에서 "본인만"으로 좁힌다.
-- 근거: docs/DAILY_FORTUNE_PRIVACY_FIX_REPORT.md(Phase10-4B). 0008_rls_policies.sql의
-- fortune_results_select_own_or_shared(using(true))는 Phase1 설계 당시 "미래에 만들 share-link
-- 공개 조회"를 위해 anon/authenticated 모두에게 열어뒀던 정책이다. Phase10-4A가 이 테이블에
-- 처음으로 실제 개인정보(input_birth_date, 실제 생년월일)를 채우기 시작하면서 실질적 위험이
-- 됐고, Phase10-4B가 실제 코드를 전수 확인한 결과:
--   1) share_cards 테이블(0009_share_cards_storage.sql)이 이미 별도의 공개 공유 메커니즘으로
--      설계돼 있다(content_ref_id로 fortune_results.id를 참조하되 FK 없이 애플리케이션
--      레벨에서만 연결 — fortune_results 원본 행을 직접 노출하지 않는 구조) — 하지만 실제
--      애플리케이션 코드 어디에서도 share_cards를 쓰지 않는다(전수 grep, lib/types/database.ts의
--      생성된 타입 정의 외 참조 0건).
--   2) fortune_results.share_id도 INSERT 시 NOT NULL UNIQUE 제약을 만족시키기 위해 무작위
--      값을 채울 뿐, 이 값으로 조회하는 라우트(/fortune/[shareId])나 API가 코드에 존재하지
--      않는다(전수 확인).
--   3) 현재 실제 "공유하기" 기능(components/fortune/dailyFortuneShareLogic.ts)은 Web Share
--      API/클립보드로 텍스트만 공유하며, DB에서 공개 조회 가능한 URL을 전혀 쓰지 않는다.
-- 즉 이 공개 SELECT 정책이 실제로 지탱하는 기능이 현재 코드베이스에 하나도 없다 — 사용되지
-- 않는 공개 정책을 유지하지 않는다(지시문 Phase10-4B D-1).
--
-- fortune_results는 0005에서 이미 생성되어 있으므로 Schema Freeze 규칙(docs/DATABASE_SCHEMA.md
-- §10-1)에 따라 0008을 직접 수정하지 않고 새 마이그레이션으로만 정책을 교체한다. 0016이 최신
-- 적용 마이그레이션이라 다음 번호 0017을 사용한다(npx supabase migration list로 확인).
--
-- 다른 테이블의 RLS는 건드리지 않는다(share_cards_select_public 등은 이번 Task 범위 밖 —
-- share_cards 자체가 코드에서 전혀 쓰이지 않는 것과 별개로, "실제 사용되지 않는 공개 정책을
-- 전부 정리"하는 것은 이번 Task(fortune_results 개인정보 노출 제거)의 범위를 벗어난다).

drop policy fortune_results_select_own_or_shared on public.fortune_results;

-- anon 역할에는 정책을 아예 주지 않는다(정책 없음 = 기본 거부) — user_numbers/dream_journal_entries
-- 등 기존 "본인 소유" 테이블(0008)과 동일한 패턴. user_id가 NULL인 행(비회원 설계의 흔적,
-- 실제로 쓰인 적 없음 — 0001~0016 어떤 코드도 비회원 운세를 생성하지 않는다)은 auth.uid()가
-- 항상 non-null인 로그인 사용자와 매칭될 수 없어 이 정책으로는 조회되지 않는다. 그런 행이
-- 실제로 존재하지도 않으므로(전수 확인, 지금까지 이 테이블에 쓰는 코드는 로그인 전용
-- lib/api/fortune.ts뿐이다) 영향이 없다.
create policy fortune_results_select_own
  on public.fortune_results
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- INSERT/UPDATE/DELETE 정책은 0008에서 이미 "client 정책 없음(service_role 전용)"으로
-- 결정된 상태이고 이번 변경과 무관해 그대로 둔다(Decision 1, 0008_rls_policies.sql 148행 부근).
