-- 0012_admin_access.sql
-- admins: 관리자 권한 저장(Phase6-4-1). docs/PHASE6_ADMIN_AUTH_DECISION.md가 결정한
-- Option C(별도 admins 테이블)를 구현한다 — DATABASE_SCHEMA.md §3.23("admins" 설계),
-- §6(관리자 정책 공통 원칙)과 일치한다.
--
-- 범위: admins 테이블 + RLS만 포함한다. admin_audit_logs는 이번 migration에서 만들지 않는다
-- (docs/PHASE6_ADMIN_AUTH_IMPLEMENTATION_REPORT.md §4 "Option A 채택" 참조 — Phase6의 실제
-- 완료 기준에 감사로그가 요구되지 않고, 실제 관리자 액션이 회차 입력 하나뿐인 지금 시점에는
-- 감사 대상 자체가 빈약해 Phase9로 미룬다. 문서에 설계된 것보다 큰 범위를 임의로 구현하지
-- 않는다는 원칙에 따른 결정이다).
--
-- 0012는 EXECUTION_PLAN.md가 이미 "0012_admin_flag.sql"로 예약해 둔 번호다(0013_profiles_
-- status_default.sql 자체 주석 참조) — npx supabase migration list로 local/remote 둘 다
-- 0012가 비어있음을 재확인한 뒤 사용했다(추측하지 않음).

create type public.admin_role as enum ('super');

create table public.admins (
  id bigint generated always as identity primary key,
  -- auth.users(id)를 직접 참조한다(profiles.id와 동일한 FK 대상, 0001_profiles.sql). 관리자가
  -- 반드시 profiles(온보딩 완료) 행을 가질 필요는 없으므로 profiles가 아니라 auth.users를
  -- 참조 대상으로 삼는다. UNIQUE로 한 사용자가 중복 admin 행을 갖지 않도록 강제한다.
  user_id uuid not null unique references auth.users (id),
  role public.admin_role not null default 'super',
  created_at timestamptz not null default now()
);

comment on table public.admins is 'MVP 관리자 권한 저장(Phase6-4-1). client 대상 쓰기 정책이 없어 service_role만 행을 추가/삭제할 수 있다(관리자 정책 공통 원칙, DATABASE_SCHEMA.md §6). is_active 같은 활성/비활성 컬럼을 두지 않는다 — 행을 DELETE하는 것 자체가 즉시 효력을 갖는 비활성화이므로 별도 상태 컬럼이 불필요하다(docs/PHASE6_ADMIN_AUTH_IMPLEMENTATION_REPORT.md §3 참조).';

alter table public.admins enable row level security;

-- 본인이 자기 자신의 admins 행을 확인할 수 있어야 isAdmin()(lib/auth/isAdmin.ts)이
-- service_role 없이 동작한다(docs/PHASE6_ADMIN_AUTH_DECISION.md §7 proxy 설계와도 연동).
-- 이 정책은 admins를 다시 SELECT하는 EXISTS 서브쿼리가 아니라, 평가 대상 행 자신의
-- user_id 컬럼을 auth.uid()와 직접 비교할 뿐이다 — 정책을 평가하기 위해 admins를 다시
-- 조회할 필요가 없으므로 "infinite recursion detected in policy" 문제가 발생할 수 있는
-- 구조 자체가 아니다(실제 Supabase로 재귀 미발생을 실측 검증함, 보고서 §11 참조).
create policy admins_select_own
  on public.admins
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- INSERT/UPDATE/DELETE 정책 없음 = 일반 사용자는 자기 자신을 admin으로 만들거나
-- (self-promotion), 타인을 admin으로 만들거나(other-user promotion), 기존 admin 행을
-- 수정/삭제할 수 없다(정책 없음=기본 차단, 이 프로젝트 전역 컨벤션 — draws/dreams 등과 동일).
