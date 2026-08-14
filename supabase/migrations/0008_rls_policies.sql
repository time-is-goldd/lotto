-- 0008_rls_policies.sql
-- 0001~0007에서 생성된 13개 테이블 전체에 RLS를 활성화하고 정책을 적용한다.
-- 근거: docs/DATABASE_SCHEMA.md §6(RLS 정책 요약표), §9(Migration 순서 — 0008은 0001~0007 테이블
-- 전체 RLS 일괄 적용), docs/AI_ENGINEERING_CONSTITUTION.md §7 "RLS" Phase1 예외,
-- docs/PHASE1_RLS_PREPARATION_AUDIT.md(Decision 1/2 확정 사항).
--
-- 범위: 기존 테이블/컬럼/FK/INDEX를 변경하지 않는다. 새 함수/트리거를 만들지 않는다.
-- "service_role 전용"으로 표기된 연산은 정책을 아예 만들지 않는다 — Supabase의 service_role
-- Postgres 역할은 기본적으로 RLS를 우회(BYPASSRLS)하므로 별도 허용 정책이 필요 없다
-- (service_role 관련 우회 로직을 직접 작성하지 않는다는 이번 Task 원칙과 일치).
--
-- auth.uid() 호출은 Supabase 권장 성능 패턴에 따라 (select auth.uid())로 감싸
-- 문장당 한 번만 평가되도록 한다(docs/PHASE1_RLS_PREPARATION_AUDIT.md Task 2-B 권고 반영).

-- ============================================================
-- 1. RLS 활성화 (0001~0007 전체 13개 테이블)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.draws enable row level security;
alter table public.user_numbers enable row level security;
alter table public.dreams enable row level security;
alter table public.dream_number_mappings enable row level security;
alter table public.dream_journal_entries enable row level security;
alter table public.fortune_results enable row level security;
alter table public.user_period_stats enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.winning_cases enable row level security;
alter table public.stores enable row level security;
alter table public.store_win_records enable row level security;

-- ============================================================
-- 2. profiles — 본인만 SELECT/INSERT/UPDATE, DELETE 불허 (§3.1, §6)
-- ============================================================

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- 가입 시 본인 행 생성. Phase2 구현이 서비스 롤을 쓰든 사용자 세션을 쓰든 이 정책은
-- "본인 id로만 INSERT 가능"을 보장하며, service_role 경로는 RLS를 우회하므로 영향받지 않는다.
create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- DELETE 정책 없음 = 기본 차단(§7 A안 — 탈퇴는 UPDATE로 익명화, 실제 삭제는 하지 않음).

-- ============================================================
-- 3. draws — 전체 공개 SELECT, 쓰기는 service_role 전용 (§3.2, §6)
-- ============================================================

create policy draws_select_public
  on public.draws
  for select
  to anon, authenticated
  using (true);

-- INSERT/UPDATE/DELETE 정책 없음 = service_role만 쓰기 가능(관리자 정책 공통 원칙, §6).

-- ============================================================
-- 4. user_numbers — 본인만 SELECT/INSERT/UPDATE/DELETE (§3.3, §6)
-- ============================================================

create policy user_numbers_select_own
  on public.user_numbers
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy user_numbers_insert_own
  on public.user_numbers
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy user_numbers_update_own
  on public.user_numbers
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy user_numbers_delete_own
  on public.user_numbers
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ============================================================
-- 5. dreams / dream_number_mappings — 전체 공개 SELECT, 쓰기는 service_role 전용 (§3.4, §3.5, §6)
-- ============================================================

create policy dreams_select_public
  on public.dreams
  for select
  to anon, authenticated
  using (true);

create policy dream_number_mappings_select_public
  on public.dream_number_mappings
  for select
  to anon, authenticated
  using (true);

-- ============================================================
-- 6. dream_journal_entries — 본인만 SELECT/INSERT/UPDATE/DELETE, 완전 비공개 (§3.6, §6)
-- ============================================================

create policy dream_journal_entries_select_own
  on public.dream_journal_entries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy dream_journal_entries_insert_own
  on public.dream_journal_entries
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy dream_journal_entries_update_own
  on public.dream_journal_entries
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy dream_journal_entries_delete_own
  on public.dream_journal_entries
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ============================================================
-- 7. fortune_results — 본인 또는 share_id 익명 조회, INSERT/UPDATE/DELETE는 client 정책 없음
-- (§3.7, §6, PHASE1_RLS_PREPARATION_AUDIT Decision 1)
-- ============================================================

-- "본인 또는 share_id 익명 조회"는 공유 링크 패턴(share_cards §3.18과 동일 성격)이라,
-- RLS는 행 내용이 아니라 "그 share_id를 아는지"로 접근을 제한할 수 없다(Postgres RLS는
-- 요청의 WHERE 조건이 아니라 행 자체의 가시성만 판단한다). 따라서 SELECT는 사실상 전체
-- 공개이며, 실제 프라이버시 보호는 share_id가 추측 불가능한 토큰이라는 점과 애플리케이션이
-- "전체 목록 조회" UI를 제공하지 않는다는 점에서 나온다 — 자세한 근거는 최종 보고서 참조.
create policy fortune_results_select_own_or_shared
  on public.fortune_results
  for select
  to anon, authenticated
  using (true);

-- Decision 1: client(authenticated/anon) 대상 INSERT 정책을 만들지 않는다. 운세 생성(회원/비회원
-- 모두)은 서버 API Route가 service_role로만 처리한다(auth.uid()=user_id 방식은 비회원 요청에서
-- 양쪽 다 NULL이 되어 매칭에 실패하는 문제가 있어 client 직접 INSERT 경로 자체를 두지 않는다).
-- UPDATE/DELETE도 client 정책 없음(§6: UPDATE 서버만, DELETE 불허 — 둘 다 service_role만 접근).

-- ============================================================
-- 8. user_period_stats — 본인만 SELECT, 쓰기는 service_role 전용 배치 (§3.8, §6)
-- ============================================================

create policy user_period_stats_select_own
  on public.user_period_stats
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- INSERT/UPDATE 정책 없음 = service_role 배치 전용. DELETE 정책 없음 = 불허.

-- ============================================================
-- 9. notifications — 본인만 SELECT, 본인만 UPDATE(is_read 목적), INSERT는 service_role,
-- DELETE 불허 (§3.16, §6)
-- ============================================================

create policy notifications_select_own
  on public.notifications
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- 주의: §6은 UPDATE를 "본인만(is_read만)"으로 규정하지만, Postgres RLS의 USING/WITH CHECK는
-- OLD/NEW 행을 동시에 비교할 수 없어(트리거 전용 기능) "is_read 외 컬럼은 변경 불가"를 정책
-- 수준에서 강제할 수 없다. 이번 Task는 신규 함수/트리거 생성을 금지하므로, 이 정책은 "본인
-- 소유 행"까지만 보장하고 "is_read만"은 애플리케이션 레벨 책임으로 남긴다 — 최종 보고서
-- "발견된 문제"에 상세 근거 기록.
create policy notifications_update_own
  on public.notifications
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- INSERT 정책 없음 = service_role 전용. DELETE 정책 없음 = 불허.

-- ============================================================
-- 10. notification_deliveries — 본인 소유 알림에 연결된 행만 SELECT, 나머지는 service_role
-- (§3.16, §6, PHASE1_RLS_PREPARATION_AUDIT Decision 2)
-- ============================================================

-- Decision 2: 부모(notifications)의 소유자를 기준으로 자식 행 접근을 판단하는 EXISTS 패턴.
-- notification_deliveries에는 user_id 컬럼이 없으므로(§3.16에 없음, 임의 추가 금지) 이 방식이
-- 유일한 구현 경로다. notifications 자신의 SELECT 정책과 조건이 겹치지만 순환 참조는 아니다
-- (notifications의 정책은 notification_deliveries를 참조하지 않는 단방향 관계).
create policy notification_deliveries_select_own_notification
  on public.notification_deliveries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.notifications
      where notifications.id = notification_deliveries.notification_id
        and notifications.user_id = (select auth.uid())
    )
  );

-- INSERT/UPDATE/DELETE 정책 없음 = service_role 전용.

-- ============================================================
-- 11. winning_cases / stores / store_win_records — 전체 공개 SELECT,
-- 쓰기는 service_role 전용 (§3.11, §3.12, §3.13, §6)
-- ============================================================

create policy winning_cases_select_public
  on public.winning_cases
  for select
  to anon, authenticated
  using (true);

create policy stores_select_public
  on public.stores
  for select
  to anon, authenticated
  using (true);

create policy store_win_records_select_public
  on public.store_win_records
  for select
  to anon, authenticated
  using (true);
