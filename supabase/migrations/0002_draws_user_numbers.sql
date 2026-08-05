-- 0002_draws_user_numbers.sql
-- draws: 회차/추첨 결과. user_numbers: 생성/저장 번호(행운 다이어리 핵심 테이블).
-- 근거: docs/DATABASE_SCHEMA.md §3.0(공통 규칙), §3.2(draws), §3.3(user_numbers), 전부 v2.3(Task 1-0.6) 기준.
--
-- 범위: 두 테이블만 포함한다. RLS·Storage·다른 테이블·Seed는 이후 마이그레이션에서 다룬다
-- (docs/DATABASE_SCHEMA.md §9 Migration 순서). profiles.status DEFAULT 보완은 별도
-- 0013_profiles_status_default.sql에서 처리한다(0001은 Schema Freeze로 수정하지 않음).

-- "6개, 1~45 범위, 중복 없음" 검증. draws.numbers, user_numbers.numbers뿐 아니라
-- 이후 0003(dream_number_mappings.numbers), 0005(fortune_results.recommended_numbers)에서도
-- 동일 규칙이 필요하므로(docs/DATABASE_SCHEMA.md 전반) 재사용 가능한 함수로 분리한다
-- (중복 CHECK 표현 금지, docs/AI_ENGINEERING_CONSTITUTION.md §3).
create or replace function public.is_valid_lotto_numbers(numbers int[])
returns boolean
language sql
immutable
as $$
  select
    array_length(numbers, 1) = 6
    and (select bool_and(n between 1 and 45) from unnest(numbers) as n)
    and (select count(distinct n) from unnest(numbers) as n) = 6;
$$;

create table public.draws (
  id bigint generated always as identity primary key,
  round int not null unique,
  numbers int[] not null check (public.is_valid_lotto_numbers(numbers)),
  bonus_number int not null check (bonus_number between 1 and 45),
  first_prize_amount bigint not null,
  first_prize_count int not null,
  -- MVP는 관리자 수동 입력만 존재한다(docs/ROADMAP.md §11) — Phase8 자동수집 도입 시 그 경로에서 다른 값을 명시한다.
  source varchar(50) not null default 'manual',
  created_at timestamptz not null default now()
);

comment on table public.draws is
  '회차별 공식 추첨 결과. 공개 데이터이며 관리자(service_role)만 쓸 수 있다. updated_at 없음(append-only).';

-- user_numbers.generation_method
create type public.user_numbers_generation_method as enum ('auto', 'custom', 'dream', 'fortune');

create table public.user_numbers (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id),
  session_id varchar(64),
  numbers int[] not null check (public.is_valid_lotto_numbers(numbers)),
  generation_method public.user_numbers_generation_method not null,
  -- dreams.id / fortune_results.id를 가리키는 참조이지만 FK 제약을 걸지 않는다.
  -- 이유: (1) user_numbers(0002)가 dreams(0003)·fortune_results(0005)보다 먼저 생성되어
  -- FK 대상 테이블이 아직 없다. (2) 콘텐츠가 삭제되어도 사용자의 저장된 번호 기록은 보존돼야
  -- 하므로, FK가 있었다면 필요했을 CASCADE/SET NULL 정책 자체를 원천적으로 피한다.
  -- (docs/DATABASE_SCHEMA.md §3.0 원칙 3, §3.3)
  related_dream_id bigint,
  related_fortune_id bigint,
  recommendation_reason text,
  is_purchased boolean not null default false,
  purchase_amount int not null default 0,
  memo text,
  target_round int references public.draws (round),
  is_public boolean not null default true,
  match_count smallint,
  win_rank smallint,
  checked_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.user_numbers is
  '행운 다이어리 핵심 테이블 — 번호 생성/저장/당첨확인. updated_at 없음(checked_at이 대조 시점을 별도로 기록).';
comment on column public.user_numbers.related_dream_id is
  'dreams.id를 가리키는 애플리케이션 레벨 참조. FK 제약 없음(사유는 컬럼 정의 위 주석 참조).';
comment on column public.user_numbers.related_fortune_id is
  'fortune_results.id를 가리키는 애플리케이션 레벨 참조. FK 제약 없음(사유는 related_dream_id와 동일).';

-- 조회 패턴별 인덱스 (docs/DATABASE_SCHEMA.md §8)
create index user_numbers_user_id_target_round_idx on public.user_numbers (user_id, target_round);
create index user_numbers_target_round_is_public_idx on public.user_numbers (target_round, is_public);
create index user_numbers_created_at_idx on public.user_numbers (created_at);
create index user_numbers_related_dream_id_idx on public.user_numbers (related_dream_id);
create index user_numbers_related_fortune_id_idx on public.user_numbers (related_fortune_id);
