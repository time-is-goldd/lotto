-- 0014_content_entries.sql
-- content_entries: FAQ/가이드 통합 콘텐츠 테이블(관리자 CRUD 전용, Phase9-6).
-- 근거: docs/PHASE9_FAQ_GUIDE_DECISION.md §7(확정 스키마: bigint identity PK, type enum,
-- title/body/display_order/created_at/updated_at), §6(통합 테이블 채택 근거 — notifications.type/
-- admin_role과 동일한 "한 테이블 + type enum" 기존 패턴 재사용). enum 네이밍은 <table>_<column>
-- 컨벤션(0006_notifications.sql의 notifications_type, 0012_admin_access.sql의 admin_role)을 그대로
-- 따른다. updated_at 트리거는 0001에서 정의한 public.set_updated_at()을 재사용한다(새 함수 생성 금지).
--
-- 범위: 이번 Task 지시문에 따라 공개 SELECT 정책을 만들지 않는다 — Phase9은 관리자 CRUD까지만
-- 담당하고 공개 페이지(/faq, /guide/[topic])는 Phase10 소관이라 아직 소비자가 없다(관리자 정책
-- 공통 원칙, docs/DATABASE_SCHEMA.md §6 — "관리자만" 권한은 client 대상 RLS 정책을 아예 만들지
-- 않는 방식으로 구현하고 서버 API route가 service_role로 수행). 이 테이블은 SELECT/INSERT/UPDATE/
-- DELETE 전부 client 정책이 없어 service_role만 접근 가능하다 — dreams(전체 공개 SELECT)와 달리
-- Phase9 시점에는 완전히 비공개다.
-- slug/category/is_published/revision/image_url/scheduled publishing/view count/like/comment/
-- admin_audit_logs는 지시문 §2가 명시적으로 제외했으므로 추가하지 않는다.

create type public.content_entries_type as enum ('faq', 'guide');

create table public.content_entries (
  id bigint generated always as identity primary key,
  type public.content_entries_type not null,
  title varchar(200) not null,
  body text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_entries is
  'FAQ/가이드 통합 콘텐츠(Phase9-6, 관리자 CRUD 전용). client 대상 SELECT/INSERT/UPDATE/DELETE 정책이
  전부 없어 service_role만 접근 가능하다 — 공개 SELECT는 Phase10에서 공개 페이지가 추가될 때 별도
  정책으로 도입한다(docs/PHASE9_FAQ_GUIDE_DECISION.md §7 "공개 여부" 판단 방법 참조).';

-- 0001에서 정의한 공용 트리거 함수를 재사용한다(테이블마다 새 함수를 만들지 않음, §3.0 공통 규칙).
create trigger set_content_entries_updated_at
  before update on public.content_entries
  for each row
  execute function public.set_updated_at();

-- 관리자 목록 화면이 항상 type으로 필터링해 조회하므로(FAQ 목록/가이드 목록 분리 표시) 조회 조건
-- 컬럼에 인덱스를 둔다(docs/PHASE9_FAQ_GUIDE_DECISION.md §7 인덱스 근거, dream_number_mappings.dream_id
-- 등 기존 "FK/조회조건 컬럼 인덱스" 원칙과 동일).
create index content_entries_type_idx on public.content_entries (type);

alter table public.content_entries enable row level security;

-- SELECT/INSERT/UPDATE/DELETE 정책 없음 = 전부 service_role 전용(기본 차단, 이 프로젝트 전역
-- 컨벤션 — admins/draws/dreams 등과 동일). 일반 anon/authenticated 사용자는 어떤 방식으로도
-- content_entries를 직접 읽거나 쓸 수 없고, 관리자 CRUD는 Route Handler가 isAdmin() 확인 후
-- lib/supabase/service.ts(service_role)로만 수행한다.
