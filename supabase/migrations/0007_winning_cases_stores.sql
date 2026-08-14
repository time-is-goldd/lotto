-- 0007_winning_cases_stores.sql
-- winning_cases: 실제 당첨 사례. stores: 로또 명당(판매점). store_win_records: 판매점별 당첨 이력.
-- 근거: docs/DATABASE_SCHEMA.md §3.0(공통 규칙), §3.11(winning_cases), §3.12(stores),
-- §3.13(store_win_records), §8(인덱스 전략), v2.4 기준. [[EXECUTION_PLAN]] Phase1 구현순서 7번
-- (Should, 지금 미리 생성해두어 나중에 마이그레이션 파일을 또 만드는 수고를 던다)와 대응한다.
--
-- 범위: 세 테이블과 명확히 근거가 있는 인덱스만 포함한다. RLS는 0001~0006과 동일하게 이 파일에서
-- 다루지 않고 0008_rls_policies.sql에서 0001~0007 테이블 전체를 한 번에 적용한다
-- (docs/AI_ENGINEERING_CONSTITUTION.md §7 "RLS" Phase1 예외, docs/DATABASE_SCHEMA.md §9).
-- numbers 배열/CHECK가 필요한 컬럼이 없어 public.is_valid_lotto_numbers() 재사용 대상이 없고,
-- updated_at 컬럼이 없어 public.set_updated_at() 트리거 재사용 대상도 없다(§3.11~§3.13 어디에도
-- updated_at이 정의되지 않음) — 신규 함수/트리거도 만들지 않았다.

create table public.winning_cases (
  id bigint generated always as identity primary key,
  -- 관련 회차(선택). §3.11에 NULL 명시 → nullable. draws.round는 UNIQUE 컬럼(0002)이라 여기를 참조한다.
  -- ON DELETE는 §3.0 원칙 1(draws는 NO ACTION 대상으로 명시)을 따른다 — 별도 지정 없이 기본값 사용.
  round int references public.draws (round),
  -- 컬럼 정의 표(§3.11)에 NULL 허용 표기가 없는 컬럼은 dreams.keyword(0003) 등과 동일한 관례로 NOT NULL로 둔다.
  title varchar(100) not null,
  story_text text not null,
  -- boolean+DEFAULT 컬럼은 profiles.marketing_opt_in 등과 동일하게 NOT NULL로 둔다.
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.winning_cases is
  '실제 당첨 사례. 전체 공개 SELECT, INSERT/UPDATE는 service_role 전용. updated_at 없음(§3.11에 명시되지 않음).';

-- FK 컬럼 기본 인덱스 (docs/AI_ENGINEERING_CONSTITUTION.md §7 "외래키 컬럼에는 기본적으로 인덱스를 건다").
-- §8에 winning_cases(round)가 명시적으로 열거되어 있지는 않지만, dream_number_mappings.dream_id(0003)와
-- 동일한 논리로 FK 컬럼 인덱스 일반 원칙을 적용한다.
create index winning_cases_round_idx on public.winning_cases (round);

create table public.stores (
  id bigint generated always as identity primary key,
  -- 컬럼 정의 표(§3.12)에 NULL 허용 표기가 없어 관례대로 NOT NULL로 둔다.
  name varchar(100) not null,
  address varchar(200) not null,
  region_sido varchar(20) not null,
  region_sigungu varchar(20) not null,
  -- 정밀도/scale이 문서에 명시되지 않아 임의로 지정하지 않고 unconstrained numeric을 그대로 쓴다.
  lat numeric not null,
  lng numeric not null,
  total_first_prize_count int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.stores is
  '로또 명당(판매점). 전체 공개 SELECT, INSERT/UPDATE는 service_role 전용. updated_at 없음(§3.12에 명시되지 않음).';

create table public.store_win_records (
  id bigint generated always as identity primary key,
  -- 부모(stores) 행이 없으면 당첨 이력 자체가 존재할 이유가 없는 자식 행이므로 CASCADE
  -- (docs/DATABASE_SCHEMA.md §3.0 원칙 2에 명시된 예시 그대로: "store_win_records.store_id → stores").
  store_id bigint not null references public.stores (id) on delete cascade,
  -- draws.round 참조. §3.13에 NULL 명시가 없어 NOT NULL. ON DELETE는 §3.0 원칙 1(draws는 NO ACTION)을 따른다.
  round int not null references public.draws (round),
  prize_rank smallint not null,
  created_at timestamptz not null default now()
);

comment on table public.store_win_records is
  '판매점별 당첨 이력. 전체 공개 SELECT, INSERT/UPDATE는 service_role 전용. updated_at 없음(§3.13에 명시되지 않음).';

-- FK 컬럼 기본 인덱스 (docs/DATABASE_SCHEMA.md §8에 store_win_records(store_id), store_win_records(round)가
-- 명시적으로 열거되어 있음).
create index store_win_records_store_id_idx on public.store_win_records (store_id);
create index store_win_records_round_idx on public.store_win_records (round);
