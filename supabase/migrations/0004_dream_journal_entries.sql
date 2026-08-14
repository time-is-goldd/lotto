-- 0004_dream_journal_entries.sql
-- dream_journal_entries: 개인 꿈 기록(행운 다이어리 전용, 완전 비공개).
-- 근거: docs/DATABASE_SCHEMA.md §3.0(공통 규칙), §3.6(dream_journal_entries), §8(인덱스 전략), v2.4 기준.
-- [[EXECUTION_PLAN]] Phase1 구현순서 4번(profiles·dreams 참조, 완전 비공개 — 0003과 RLS 성격이
-- 정반대라 별도 파일로 분리)과 대응한다.
--
-- 범위: 테이블/인덱스만 포함한다. RLS는 0001~0003과 동일하게 이 파일에서 다루지 않고
-- 0008_rls_policies.sql에서 0001~0007 테이블 전체를 한 번에 적용한다
-- (docs/AI_ENGINEERING_CONSTITUTION.md §7 "RLS" Phase1 예외, docs/DATABASE_SCHEMA.md §9).

create table public.dream_journal_entries (
  id bigint generated always as identity primary key,
  -- 컬럼 정의 표(docs/DATABASE_SCHEMA.md §3.6)에 NULL 허용 표기가 없는 컬럼은 dreams.keyword(0003)와
  -- 동일한 관례로 NOT NULL로 둔다. RLS가 "본인만 CRUD"(auth.uid() = user_id)를 전제하므로
  -- user_id가 항상 존재해야 한다 — 비회원 기록 기능은 설계에 없다.
  user_id uuid not null references public.profiles (id),
  entry_date date not null,
  dream_text text not null,
  -- 사전(dreams) 키워드 매칭 시 연결하는 선택적 FK. dreams는 §3.0 원칙 1(NO ACTION 대상으로 명시된
  -- profiles/draws)에도, 원칙 2(CASCADE 대상으로 명시된 목록)에도 해당하지 않으므로 근거 없이
  -- CASCADE/SET NULL을 임의로 걸지 않고 Postgres 기본값(NO ACTION)을 그대로 둔다
  -- (docs/AI_ENGINEERING_CONSTITUTION.md §7 "FK 삭제 정책").
  linked_dream_id bigint references public.dreams (id),
  created_at timestamptz not null default now()
);

comment on table public.dream_journal_entries is
  '개인 꿈 기록(행운 다이어리 전용). 완전 비공개 — 본인만 CRUD, 절대 공개되지 않는다. updated_at 없음(§3.6에 명시되지 않음).';
comment on column public.dream_journal_entries.linked_dream_id is
  'dreams.id를 가리키는 선택적 FK(사전 키워드 매칭 시 연결). ON DELETE는 Postgres 기본값(NO ACTION)을 따른다.';

-- FK 컬럼 기본 인덱스 (docs/DATABASE_SCHEMA.md §8에 이 두 인덱스가 명시적으로 열거되어 있음).
create index dream_journal_entries_user_id_idx on public.dream_journal_entries (user_id);
create index dream_journal_entries_linked_dream_id_idx on public.dream_journal_entries (linked_dream_id);
