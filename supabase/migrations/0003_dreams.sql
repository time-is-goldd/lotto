-- 0003_dreams.sql
-- dreams: 꿈해몽 사전(전체 공개, service_role만 쓰기). dream_number_mappings: 꿈별 추천번호 매핑.
-- 근거: docs/DATABASE_SCHEMA.md §3.0(공통 규칙), §3.4(dreams), §3.5(dream_number_mappings),
-- §8(인덱스 전략), 전부 v2.3 기준. [[EXECUTION_PLAN]] Phase1 구현순서 3번(dreams, dream_number_mappings,
-- 독립 콘텐츠 테이블, 전체공개·service_role 쓰기)과 대응한다.
--
-- 범위: 두 테이블과 검색용 인덱스만 포함한다. RLS는 0001/0002와 동일하게 이 파일에서 다루지 않고
-- 0008_rls_policies.sql에서 0001~0007 테이블 전체를 한 번에 적용한다(docs/DATABASE_SCHEMA.md §9).
-- numbers CHECK는 0002에서 정의한 public.is_valid_lotto_numbers()를 재사용한다(중복 CHECK 금지,
-- docs/AI_ENGINEERING_CONSTITUTION.md §3) — 새 검증 함수를 만들지 않는다.

create table public.dreams (
  id bigint generated always as identity primary key,
  -- 컬럼 정의 표(docs/DATABASE_SCHEMA.md §3.4)에 NULL 허용 표기가 없는 컬럼은 profiles.nickname(0001)과
  -- 동일한 관례에 따라 NOT NULL로 둔다(사전 항목에 키워드/해몽 본문이 없으면 콘텐츠로서 의미가 없다).
  keyword varchar(50) not null,
  category varchar(30),
  interpretation text not null,
  image_url varchar(255),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.dreams is
  '꿈해몽 사전. 전체 공개 SELECT, INSERT/UPDATE는 service_role 전용(관리자 콘텐츠). RLS는 0008에서 적용.';

-- 0001에서 정의한 공용 트리거 함수를 재사용한다(테이블마다 새 함수를 만들지 않음, §3.0 공통 규칙).
create trigger set_dreams_updated_at
  before update on public.dreams
  for each row
  execute function public.set_updated_at();

-- 꿈 검색(키워드/본문) 지원용 트라이그램 인덱스 (docs/DATABASE_SCHEMA.md §8, [[INFORMATION_ARCHITECTURE]] 검색 기능).
-- Supabase 컨벤션에 따라 extensions 스키마에 설치하고 연산자 클래스를 명시적으로 참조한다
-- (세션 search_path에 의존하지 않기 위함).
create extension if not exists pg_trgm with schema extensions;

create index dreams_keyword_trgm_idx on public.dreams using gin (keyword extensions.gin_trgm_ops);
create index dreams_interpretation_trgm_idx on public.dreams using gin (interpretation extensions.gin_trgm_ops);

create table public.dream_number_mappings (
  id bigint generated always as identity primary key,
  -- 부모(dreams) 행이 없으면 매핑 자체가 존재할 이유가 없는 자식 행이므로 CASCADE
  -- (docs/DATABASE_SCHEMA.md §3.0 원칙 2에 명시된 예시 그대로).
  dream_id bigint not null references public.dreams (id) on delete cascade,
  -- "6개, 1~45 범위, 중복 없음" 검증은 0002에서 정의한 공용 함수를 그대로 재사용한다.
  -- 별도 CHECK 로직을 복붙하거나 새 검증 함수를 만들지 않는다(docs/AI_ENGINEERING_CONSTITUTION.md §3).
  numbers int[] not null check (public.is_valid_lotto_numbers(numbers)),
  created_at timestamptz not null default now()
);

comment on table public.dream_number_mappings is
  '꿈 키워드별 추천번호 매핑. 전체 공개 SELECT, INSERT/UPDATE는 service_role 전용. updated_at 없음(§3.5에 명시되지 않음).';

-- FK 컬럼 기본 인덱스 원칙 (docs/AI_ENGINEERING_CONSTITUTION.md §7 "외래키 컬럼에는 기본적으로 인덱스를 건다").
create index dream_number_mappings_dream_id_idx on public.dream_number_mappings (dream_id);
