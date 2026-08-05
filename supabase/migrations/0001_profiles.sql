-- 0001_profiles.sql
-- profiles: Supabase Auth(auth.users)를 1:1로 확장하는 애플리케이션 프로필 테이블.
-- 근거: docs/DATABASE_SCHEMA.md §2(Supabase Auth 통합 원칙), §3.1(profiles 컬럼 정의, v2.1)
--
-- 범위: 테이블/타입/updated_at 트리거만 포함한다. RLS·Storage·다른 테이블·Seed는
-- docs/DATABASE_SCHEMA.md §9 Migration 순서에 따라 이후 마이그레이션 파일에서 다룬다.

-- 가입 경로. 카카오 로그인이 Must, 이메일은 카카오 장애 시 폴백 (docs/DATABASE_SCHEMA.md §2)
create type public.profile_provider as enum ('kakao', 'email');

-- 성별. 선택 입력이며 MVP 운세 로직(FEATURE_SPEC §3.2, 띠 계산만 사용)은 아직 참조하지 않는다.
create type public.profile_gender as enum ('M', 'F', 'N');

-- 계정 상태. 탈퇴는 auth.users를 삭제하지 않고 이 값을 'withdrawn'으로 전환해 표현한다
-- (docs/DATABASE_SCHEMA.md §7 탈퇴 처리 A안).
create type public.profile_status as enum ('active', 'withdrawn', 'suspended');

create table public.profiles (
  -- auth.users.id를 그대로 사용(PK=FK, 1:1). ON DELETE를 명시하지 않아 기본값(NO ACTION)을 따른다 —
  -- §7 A안이 "auth.users를 삭제하면 FK 정합성 문제가 생기기 때문에 삭제하지 않는다"를 전제로 하므로,
  -- 실수로 auth.users가 삭제되는 경우 조용히 cascade되지 않고 오류로 막히는 쪽이 이 전제와 일치한다.
  id uuid primary key references auth.users (id),
  provider public.profile_provider not null,
  nickname varchar(30) not null,
  -- 만 19세 미만 이용제한 검증(Must, FEATURE_SPEC §9.3)과 운세 기능이 이 값을 함께 쓰므로 필수 입력.
  birth_date date not null,
  gender public.profile_gender,
  birth_time time,
  age_verified boolean not null default false,
  marketing_opt_in boolean not null default false,
  privacy_public_default boolean not null default true,
  best_win_rank_ever smallint,
  status public.profile_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'auth.users를 1:1로 확장하는 애플리케이션 프로필. id는 auth.users.id를 그대로 사용한다(PK=FK).';

-- updated_at은 Postgres가 자동으로 갱신해주지 않으므로 트리거로 처리한다.
-- 다른 테이블에서도 동일 패턴이 필요하면 이 함수를 재사용한다(중복 함수 생성 금지).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();
