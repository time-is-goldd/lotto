-- 0005_fortune_results_user_period_stats.sql
-- fortune_results: AI 운세 결과(비회원도 이용 가능, share_id 공유 링크).
-- user_period_stats: 개인 월간/연간 통계 캐시(service_role 배치 전용).
-- 근거: docs/DATABASE_SCHEMA.md §3.0(공통 규칙), §3.7(fortune_results), §3.8(user_period_stats),
-- §8(인덱스 전략), v2.4 기준. [[EXECUTION_PLAN]] Phase1 구현순서 5번(profiles 참조,
-- (user_id, period_type, period_key) UNIQUE)과 대응한다.
--
-- 범위: 두 테이블과 인덱스만 포함한다. RLS는 0001~0004와 동일하게 이 파일에서 다루지 않고
-- 0008_rls_policies.sql에서 0001~0007 테이블 전체를 한 번에 적용한다
-- (docs/AI_ENGINEERING_CONSTITUTION.md §7 "RLS" Phase1 예외, docs/DATABASE_SCHEMA.md §9).
-- recommended_numbers CHECK는 0002에서 정의한 public.is_valid_lotto_numbers()를 재사용한다
-- (중복 CHECK 금지, docs/AI_ENGINEERING_CONSTITUTION.md §3) — 새 검증 함수를 만들지 않는다.

create table public.fortune_results (
  id bigint generated always as identity primary key,
  -- 비로그인도 이용 가능(FEATURE_SPEC §3.3)하므로 비회원은 NULL. user_numbers.user_id와 동일한 패턴.
  -- ON DELETE는 §3.0 원칙 1(profiles는 NO ACTION)을 따른다 — 별도 지정 없이 Postgres 기본값 사용.
  user_id uuid references public.profiles (id),
  -- 비회원도 이용 가능하므로 profiles.birth_date를 참조하지 않고 매 요청마다 독립 입력받아 저장한다.
  input_birth_date date not null,
  zodiac_sign varchar(10),
  overall_fortune text not null,
  luck_score smallint not null,
  recommended_numbers int[] not null check (public.is_valid_lotto_numbers(recommended_numbers)),
  -- Phase2 이후 채워지는 나머지 운세 항목(FEATURE_SPEC §3.2). 지금은 컬럼만 정의하고 NULL로 둔다.
  today_energy text,
  money_luck text,
  action_guide text,
  things_to_avoid text,
  lucky_color varchar(20),
  lucky_direction varchar(10),
  lucky_time varchar(20),
  -- 공유 링크(/share/[shareId]) 및 비회원 익명 조회 식별자.
  share_id varchar(20) not null unique,
  created_at timestamptz not null default now()
);

comment on table public.fortune_results is
  'AI 운세 결과. 비회원도 이용 가능(user_id NULL 허용). updated_at 없음(생성 후 수정되지 않는 스냅샷, §3.7).';

-- FK 컬럼 기본 인덱스 (docs/DATABASE_SCHEMA.md §8에 명시적으로 열거됨).
-- share_id는 위 UNIQUE 제약이 이미 고유 인덱스를 생성하므로 별도 인덱스를 추가하지 않는다
-- (중복 인덱스 방지, docs/AI_ENGINEERING_CONSTITUTION.md §7 "조기 최적화 금지").
create index fortune_results_user_id_idx on public.fortune_results (user_id);

-- user_period_stats.period_type
create type public.user_period_stats_period_type as enum ('monthly', 'yearly');

create table public.user_period_stats (
  id bigint generated always as identity primary key,
  -- 컬럼 정의 표(docs/DATABASE_SCHEMA.md §3.8)에 NULL 허용 표기가 없는 컬럼은 dreams.keyword(0003) 등과
  -- 동일한 관례로 NOT NULL로 둔다. "본인만 조회" RLS(§6)가 성립하려면 user_id가 항상 존재해야 한다.
  -- ON DELETE는 §3.0 원칙 1(profiles는 NO ACTION)을 따른다.
  user_id uuid not null references public.profiles (id),
  period_type public.user_period_stats_period_type not null,
  period_key varchar(10) not null,
  total_generated int not null,
  total_purchased_count int not null,
  total_purchase_amount int not null,
  best_win_rank smallint,
  most_frequent_numbers int[] not null,
  updated_at timestamptz not null default now(),
  -- 배치 upsert 시 중복 행 생성을 막기 위한 필수 제약(§3.8 "제약").
  unique (user_id, period_type, period_key)
);

comment on table public.user_period_stats is
  '개인 월간/연간 통계 캐시. service_role 배치 전용 쓰기. created_at 없음(§3.8에 명시되지 않음 — updated_at만 존재).';

-- 0001에서 정의한 공용 트리거 함수를 재사용한다(테이블마다 새 함수를 만들지 않음, §3.0 공통 규칙).
create trigger set_user_period_stats_updated_at
  before update on public.user_period_stats
  for each row
  execute function public.set_updated_at();

-- user_id는 (user_id, period_type, period_key) UNIQUE 제약이 만드는 복합 인덱스의 선행 컬럼이라
-- 이미 인덱스 효과를 가지므로 별도 단일 컬럼 인덱스를 추가하지 않는다(중복 인덱스 방지, §7).
