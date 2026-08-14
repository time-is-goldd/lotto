-- 0018_dream_situations.sql
-- Phase10-4D(꿈해몽 세분화) — docs/PRODUCT_EXPANSION_PLAN.md §3/§5/§8이 권고한 신규
-- dream_situations 하위 테이블(권고안 B)을 실제로 만든다. 기존 dreams(0003_dreams.sql)의
-- 25건과 dream_number_mappings는 전혀 건드리지 않는다 — 순수 additive 확장이다.
--
-- 권고안과의 차이(§2 "권고와 현재 지시문이 충돌하는 경우에만 최소 조정"에 따른 조정):
-- PRODUCT_EXPANSION_PLAN.md §4는 "1단계는 별도 URL을 만들지 않고 부모 페이지 안에서만
-- 섹션으로 보여준다"를 권고했지만, 이번 Task(Phase10-4D) 지시문 §8/§23/§24가 상황별
-- 전용 URL(`/dream/[keyword]/[situation]`)과 그 URL마다 독립된 metadata/breadcrumb를
-- 명시적으로 요구한다 — 더 최신이고 더 구체적인 지시를 따른다. 그 결과 권고 스키마에는
-- 없던 `keyword`(URL 세그먼트용 안정적 슬러그) 컬럼이 필요해져 추가했다: title은 관리자가
-- 나중에 자유롭게 다듬을 수 있어야 하지만(§8 "title 변경 때문에 URL이 쉽게 깨지지 않게
-- 한다"), keyword는 URL에 박혀 절대 조용히 바뀌면 안 되는 값이라 서로 다른 컬럼으로
-- 분리했다. 권고안의 나머지(body/numbers/display_order/created_at/updated_at, dream_id FK
-- cascade)는 그대로 따랐다.

-- ============================================================
-- A. is_valid_partial_lotto_numbers() — 0~6개 가변 번호 검증
-- ============================================================
-- 기존 public.is_valid_lotto_numbers()(0002_draws_user_numbers.sql)는 "정확히 6개"를
-- 강제하는 함수라 draws/user_numbers/dream_number_mappings/fortune_results.recommended_numbers
-- 전부가 그 불변식에 의존한다 — 그 함수를 완화하면 이 테이블들의 무결성이 함께 느슨해지는
-- 회귀 위험이 있어 절대 공유하지 않는다(PRODUCT_EXPANSION_PLAN.md §5, 기존 함수 무수정).
-- 대신 별도 함수를 새로 만든다. NULL은 "행운 숫자 없음(0개)"으로 취급한다 — 빈 배열(array[])
-- 대신 NULL을 쓰는 이유: int[] NOT NULL 배열 컬럼에 빈 배열을 넣는 것보다 컬럼 자체를
-- nullable로 두고 "값 없음"을 NULL로 표현하는 편이 "추천 번호가 없는 상황도 정상"이라는
-- 의미를 스키마 레벨에서 더 명확하게 드러낸다(지시문 §11 "억지로 채우지 않는다").
create or replace function public.is_valid_partial_lotto_numbers(numbers int[])
returns boolean
language sql
immutable
as $$
  select numbers is null
    or (
      array_length(numbers, 1) between 1 and 6
      and (select bool_and(n between 1 and 45) from unnest(numbers) as n)
      and (select count(distinct n) from unnest(numbers) as n) = array_length(numbers, 1)
    );
$$;

-- ============================================================
-- B. dream_situations 테이블
-- ============================================================
create table public.dream_situations (
  id bigint generated always as identity primary key,
  -- 부모(dreams) 행이 없으면 상황 자체가 존재할 이유가 없는 자식 행이므로 CASCADE
  -- (dream_number_mappings와 동일한 기존 패턴, 0003_dreams.sql).
  dream_id bigint not null references public.dreams (id) on delete cascade,
  -- URL 세그먼트 전용 안정적 슬러그. 위 설계 메모 참조 — title과 분리해 title 편집이 URL을
  -- 깨뜨리지 않게 한다. dreams.keyword와 동일하게 순수 텍스트(한글 포함)이고 별도 slug
  -- 정규화(영문화 등)를 하지 않는다 — 기존 dreams.keyword 컨벤션을 그대로 따른다.
  keyword varchar(50) not null,
  title varchar(100) not null,
  body text not null,
  -- "핵심 해석" 한 줄 — PRODUCT_EXPANSION_PLAN.md 권고 스키마에는 없던 선택 필드지만
  -- 지시문 §10이 "핵심 해석: 짧은 한 줄"을 상세 페이지 최소 구성으로 명시해 추가했다.
  key_meaning varchar(200),
  numbers int[] check (public.is_valid_partial_lotto_numbers(numbers)),
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 같은 부모 꿈 안에서 URL 슬러그 중복을 막는다(지시문 §8 "중복 URL 금지"). 전역 UNIQUE가
  -- 아니라 dream_id 범위로 한정한 이유: 서로 다른 부모 꿈이 우연히 같은 상황 슬러그를 쓸 수
  -- 있어도(예: 두 동물 꿈이 각각 "쫓기는 꿈"을 가질 수 있음) URL 자체는 부모 keyword가
  -- 앞에 붙어 항상 고유하므로 전역 제약이 필요 없다.
  unique (dream_id, keyword)
);

comment on table public.dream_situations is
  '부모 꿈(dreams) 하위 세부 상황. 전체 공개 SELECT, INSERT/UPDATE/DELETE는 service_role 전용(관리자 콘텐츠, 이번 Task는 CRUD UI를 만들지 않고 migration seed로만 채운다).';
comment on column public.dream_situations.keyword is
  'URL 세그먼트(/dream/[keyword]/[situation]) 전용 안정적 슬러그. title과 독립적으로 유지되어 title 편집이 URL을 깨뜨리지 않는다.';
comment on column public.dream_situations.numbers is
  '0~6개 가변 행운 숫자(NULL=0개). is_valid_partial_lotto_numbers()로 검증 — 항상 정확히 6개를 요구하는 public.is_valid_lotto_numbers()와는 별개 함수.';

-- 0001에서 정의한 공용 트리거 함수를 재사용한다(테이블마다 새 함수를 만들지 않음).
create trigger set_dream_situations_updated_at
  before update on public.dream_situations
  for each row
  execute function public.set_updated_at();

-- FK 컬럼 기본 인덱스 원칙(dream_number_mappings_dream_id_idx와 동일한 패턴).
create index dream_situations_dream_id_idx on public.dream_situations (dream_id);

-- ============================================================
-- C. RLS — 전체 공개 SELECT, 쓰기는 service_role 전용
-- ============================================================
-- dreams_select_public(0008_rls_policies.sql)/content_entries_select_public(0015)와 완전히
-- 동일한 패턴이다 — 0009부터 확립된 관례대로 테이블 생성과 RLS를 같은 migration에서 함께
-- 적용한다.
alter table public.dream_situations enable row level security;

create policy dream_situations_select_public
  on public.dream_situations
  for select
  to anon, authenticated
  using (true);

-- INSERT/UPDATE/DELETE 정책 없음 = service_role 전용(관리자 정책 공통 원칙, 기존 dreams와
-- 동일). 새 RLS 완화를 만들지 않는다.
