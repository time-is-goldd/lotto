-- 0015_content_entries_public_read.sql
-- Phase10-1(docs/PHASE10_RELEASE_GATE.md §16)이 확정한 두 가지 변경만 포함한다:
-- (A) content_entries 공개 SELECT RLS, (B) guide title partial UNIQUE 인덱스.
-- 0014_content_entries.sql(Schema Freeze 대상, Phase9-6)은 절대 수정하지 않는다 — 새 migration으로만
-- 확장한다(DATABASE_SCHEMA.md §10 Schema Freeze 규칙).

-- ============================================================
-- A. 공개 SELECT RLS
-- ============================================================
-- dreams_select_public(0008_rls_policies.sql)과 완전히 동일한 패턴 — anon/authenticated 모두
-- SELECT 허용, INSERT/UPDATE/DELETE 정책은 추가하지 않는다(그대로 없음 = service_role 전용 유지,
-- 관리자 CRUD는 지금처럼 lib/supabase/service.ts로만 수행된다). content_entries는 이제 FAQ/가이드
-- 공개 콘텐츠라는 데이터 성격에 맞게 dreams와 동일한 "전체 공개 SELECT, 쓰기는 service_role 전용"
-- 원칙을 따른다(docs/PHASE10_RELEASE_GATE.md §5 권고안 A).
create policy content_entries_select_public
  on public.content_entries
  for select
  to anon, authenticated
  using (true);

-- ============================================================
-- B. guide title partial UNIQUE 인덱스
-- ============================================================
-- /guide/[topic]가 title을 그대로 URL 세그먼트로 쓰므로(docs/PHASE9_FAQ_GUIDE_DECISION.md §8-A,
-- slug 컬럼을 추가하지 않기로 이미 확정), type='guide'인 행끼리 title이 중복되면 단건 조회
-- (.eq("type","guide").eq("title", topic))가 2행 이상을 만나 깨진다(docs/PHASE10_RELEASE_GATE.md
-- §6). FAQ는 같은 질문이 여러 번 있어도 URL 충돌이 없으므로 이 제약에서 제외해야 한다 — 전체
-- content_entries.title에 UNIQUE를 걸지 않고, type='guide' 행만 대상으로 하는 partial UNIQUE
-- 인덱스로 최소 범위만 제약한다. 새 컬럼(slug 등)을 추가하지 않는다 — 기존 Decision을 그대로 유지.
create unique index content_entries_guide_title_idx
  on public.content_entries (title)
  where type = 'guide';
