-- 0009_share_cards_storage.sql
-- share_cards: 공유 카드 테이블. share-cards: 동적 생성 OG 이미지를 위한 Storage 버킷 + RLS.
-- 근거: docs/DATABASE_SCHEMA.md §3.18(share_cards), §5(Storage 버킷 설계), §6(RLS 정책 요약표),
-- §8(인덱스 전략), §9(Migration 순서 — 0009는 테이블+버킷+RLS를 같은 파일에서 함께 생성하는
-- 유일한 예외), v2.4 기준. docs/AI_ENGINEERING_CONSTITUTION.md §7 "RLS" 일반 원칙(0009부터는
-- 테이블 생성과 RLS를 같은 파일에서 함께 수행)과 정확히 대응한다.
--
-- 범위: 테이블/인덱스/버킷/RLS 정책만 포함한다. 실제 OG 이미지 생성·업로드 기능 구현은 이 Task
-- 범위가 아니다(§3.18 "Phase1에서는 테이블과 버킷만 선반영"). 새 CHECK/함수/트리거는 만들지 않는다
-- (numbers 배열이나 updated_at 컬럼이 없어 재사용 대상 자체가 없음).

-- ============================================================
-- A. public.share_cards 테이블
-- ============================================================

-- content_type: 공유 대상 콘텐츠 종류. 향후 확장 시 ENUM 값만 추가(§3.18).
create type public.share_cards_content_type as enum ('number_result', 'fortune', 'yearly_report');

create table public.share_cards (
  id bigint generated always as identity primary key,
  -- 비회원 생성 결과도 공유 가능하므로 NULL 허용(§3.18, user_numbers.user_id와 동일한 이유).
  -- ON DELETE는 §3.0 원칙 1(profiles는 NO ACTION 대상으로 명시)을 따른다.
  user_id uuid references public.profiles (id),
  -- 컬럼 정의 표(§3.18)에 NULL 허용 표기가 없어 dreams.keyword(0003) 등과 동일한 관례로 NOT NULL.
  share_id varchar(20) not null unique,
  content_type public.share_cards_content_type not null,
  -- content_type에 따라 user_numbers.id 또는 fortune_results.id 등 서로 다른 테이블을 가리키는
  -- 참조. 콘텐츠 종류마다 대상 테이블이 다르므로 §3.18이 명시적으로 "엄격한 FK 대신 애플리케이션
  -- 레벨에서 검증"하도록 지정했다 — FK 제약을 걸지 않는다(user_numbers.related_dream_id/
  -- related_fortune_id, §3.0 원칙 3과 동일한 패턴).
  content_ref_id bigint,
  image_url varchar(255),
  created_at timestamptz not null default now()
);

comment on table public.share_cards is
  '공유 카드(카카오 공유 데이터 기반). 전체 공개 SELECT, INSERT는 본인 또는 서버, UPDATE/DELETE 불허. updated_at 없음(§3.18에 명시되지 않음).';
comment on column public.share_cards.content_ref_id is
  'content_type에 따라 user_numbers.id 또는 fortune_results.id 등을 가리키는 애플리케이션 레벨 참조. FK 제약 없음(사유는 컬럼 정의 위 주석 참조).';

-- FK 컬럼 기본 인덱스 (docs/DATABASE_SCHEMA.md §8에 share_cards(user_id)가 명시적으로 열거됨).
-- share_id는 위 UNIQUE 제약이 이미 고유 인덱스를 생성하므로(§8에 share_cards(share_id)(UNIQUE)로
-- 표기된 것과 일치) 별도 인덱스를 추가하지 않는다(중복 인덱스 방지).
create index share_cards_user_id_idx on public.share_cards (user_id);

alter table public.share_cards enable row level security;

-- SELECT: 전체 공개(공유 링크 특성상 익명 접근 전제, §6). fortune_results(0008)와 동일한 이유로
-- Postgres RLS는 "그 share_id를 아는지"를 판단할 수 없어(행 가시성만 제어 가능) 사실상 전체
-- 공개로 구현한다.
create policy share_cards_select_public
  on public.share_cards
  for select
  to anon, authenticated
  using (true);

-- INSERT: 본인 또는 서버(§6, 문서 문구 그대로 두 경로 모두 허용). authenticated로 범위를 좁혀
-- auth.uid()=user_id를 요구하므로 로그인 사용자는 항상 양쪽이 non-null이라 0008에서 다룬
-- NULL=NULL 매칭 문제가 재현되지 않는다. anon 역할에는 정책을 주지 않아(정책 없음=차단) 비회원
-- 공유 카드 생성은 자동으로 서버(service_role) 경로만 남는다 — fortune_results(0008)가 쓴 것과
-- 같은 "NULL 문제를 일으킬 역할에는 정책을 아예 안 준다"는 기법을 재사용한 것이며, fortune_results
-- 처럼 로그인 사용자까지 서버로 강제하지는 않는다(이 테이블은 신뢰할 계산 로직이 없어 그 정도
-- 제약이 §6 문구상 요구되지 않는다고 판단) — 이 판단은 최종 보고서 "발견된 문제"에서 확인 요청.
create policy share_cards_insert_own
  on public.share_cards
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- UPDATE/DELETE 정책 없음 = 불허(§6 "UPDATE/DELETE 불허" — service_role도 이 표에서는 쓰기 대상이
-- INSERT만 명시되어 있어 UPDATE/DELETE는 어떤 역할에도 허용하지 않는다).

-- ============================================================
-- B. share-cards Storage 버킷
-- ============================================================

-- 공개 읽기, 서버(service_role)만 쓰기(§5). 문서에 파일 크기 제한(file_size_limit)이나 허용 MIME
-- 타입(allowed_mime_types)이 명시되어 있지 않아(§5 "제약" 열에 "서버 함수에서만 생성"만 기재,
-- community-uploads처럼 "5MB 이하" 같은 구체적 수치가 없음) 임의로 제한을 추가하지 않는다.
insert into storage.buckets (id, name, public)
values ('share-cards', 'share-cards', true);

-- storage.objects는 Supabase 플랫폼이 기본적으로 RLS를 활성화해 관리하므로 이 마이그레이션에서
-- 별도로 ENABLE ROW LEVEL SECURITY를 실행하지 않는다(검증 단계에서 실제 상태를 확인한다).

-- SELECT: 공개 읽기 — 버킷의 public=true와 함께, storage.objects 레벨에서도 명시적으로 허용해
-- 0008에서 사용한 패턴(draws/dreams 등 "전체 공개" 테이블에 명시적 SELECT 정책을 두는 방식)과
-- 일관성을 유지한다.
create policy share_cards_bucket_select_public
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'share-cards');

-- INSERT/UPDATE/DELETE 정책 없음 = service_role 전용("서버 함수에서만 생성", §5). 폴더 구조
-- 규칙이 문서에 정의되어 있지 않아 사용자별 경로 제한 정책은 만들지 않는다(억지 구현 금지 —
-- 최종 보고서 "발견된 문제" 참조).
