-- 0023_daily_number_generations.sql
-- claude-code-luck-platform-home-brand-daily-numbers-prompt.md §9.5: "오늘의 세 조합" 정책을
-- server/database 레벨에서도 강제한다. 기존 user_numbers("저장 번호"/행운 다이어리)와 의미가
-- 다르므로 별도 테이블을 쓴다(§9.5 "기존 저장 번호 테이블과 '일일 생성 기록'의 의미가 다르면
-- 별도 구조를 사용") — user_numbers는 사용자가 명시적으로 "저장"한 번호만 담고, 이 테이블은
-- "오늘 몇 번 만들었는지"를 세는 append-only 일일 기록이다. 하나가 다른 하나를 오염시키지
-- 않는다.
--
-- is_valid_lotto_numbers()는 0002_draws_user_numbers.sql이 이미 만든 함수를 그대로 재사용한다
-- (중복 CHECK 표현 금지 원칙, docs/AI_ENGINEERING_CONSTITUTION.md §3). generation_method도
-- 0002가 이미 만든 enum(user_numbers_generation_method)을 재사용한다 — 이 테이블은 'auto'와
-- 'dream' 두 값만 실제로 쓰지만, 별도 enum을 새로 만들 이유가 없다(같은 개념을 두 번 정의하지
-- 않는다).

create table public.daily_number_generations (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id),
  -- KST(Asia/Seoul) 달력 날짜. lib/utils/kstDate.ts의 getKstDateString()이 계산한 문자열을
  -- 그대로 date로 캐스팅해 저장한다 — 브라우저/서버 타임존과 무관하게 "한국 날짜 기준"이라는
  -- 프롬프트 §9.1 요구를 DB 레벨에서도 동일하게 유지한다.
  generation_date date not null,
  slot_index smallint not null check (slot_index between 1 and 3),
  numbers int[] not null check (public.is_valid_lotto_numbers(numbers)),
  generation_method public.user_numbers_generation_method not null default 'auto',
  -- user_numbers.related_dream_id(0002)와 동일한 이유로 FK를 걸지 않는다 — 꿈 콘텐츠가
  -- 삭제되어도 "그날 이미 생성했다"는 기록 자체는 보존돼야 한다.
  related_dream_id bigint,
  -- numbers 중 실제로 꿈에서 유래한 부분집합(claude-code-luck-platform-home-brand-daily-numbers-
  -- prompt.md §2 "실제 꿈 숫자만 골드로 표현", §9.4 "골드 fill + 라벨"). 생성 시점의
  -- lib/logic/dreamNumbers.ts buildDreamAwareNumbers()가 이미 계산한 값을 그대로 저장한다 —
  -- 조회 시점에 dreams 테이블을 다시 조회해 추정하지 않는다(꿈 콘텐츠가 나중에 수정/삭제돼도
  -- "그날 실제로 보여준 골드 숫자"가 흔들리지 않는다).
  dream_numbers int[] check (dream_numbers is null or dream_numbers <@ numbers),
  created_at timestamptz not null default now(),
  -- 프롬프트 §9.5 "user_id + generation_date(KST) + slot_index(1~3)에 unique constraint" —
  -- 이 제약 하나가 "하루 최대 3개"를 DB 레벨에서 강제하는 핵심이다: slot_index는 CHECK로
  -- 1~3만 허용되고, 같은 (user_id, generation_date, slot_index) 조합은 이 unique 제약으로
  -- 두 번 존재할 수 없으므로, RPC를 거치지 않고 직접 INSERT를 시도해도(§9.5 "동시에 여러
  -- 탭에서 요청해도 4번째 row가 생기지 않도록") 4번째 행은 구조적으로 만들어질 수 없다.
  unique (user_id, generation_date, slot_index)
);

comment on table public.daily_number_generations is
  '오늘의 세 조합 — 하루 최대 3개 생성 정책의 append-only 기록. 사용자가 명시적으로 "저장"한
  번호(user_numbers)와는 별개다. UPDATE/DELETE 정책이 없어 애플리케이션에서 수정/삭제할 수
  없다(§9.1 "삭제해도 생성 가능 횟수는 복구되지 않는다"를 애초에 삭제 경로 자체를 막아 보장).';

create index daily_number_generations_user_id_date_idx
  on public.daily_number_generations (user_id, generation_date);

alter table public.daily_number_generations enable row level security;

create policy daily_number_generations_select_own
  on public.daily_number_generations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- INSERT는 이 정책과 아래 RPC(generate_daily_number) 둘 다 거칠 수 있지만, 어느 경로로
-- 들어와도 위 CHECK/UNIQUE 제약이 "하루 3개"를 최종적으로 강제한다 — 이 정책은 "본인 것만"만
-- 추가로 보장한다.
create policy daily_number_generations_insert_own
  on public.daily_number_generations
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- UPDATE/DELETE 정책 없음 = 기본 차단(append-only, 위 comment 참조).

-- 프롬프트 §9.5 "동시에 여러 탭에서 요청해도 4번째 row가 생기지 않도록 transaction/idempotent
-- 처리". CHECK+UNIQUE만으로도 4번째 row 자체는 항상 막히지만, 그것만으로는 클라이언트가
-- "다음 slot_index가 몇 번인지"를 스스로 계산해야 하고 동시 요청 시 같은 slot_index를 두 번
-- 시도해 한쪽이 23505(unique_violation)로 실패하는 사용자 경험이 남는다. 이 함수는 같은
-- (user_id, generation_date) 조합에 대해 pg_advisory_xact_lock으로 직렬화한 뒤 다음 slot을
-- 계산해 INSERT하므로, 동시 요청도 항상 순서대로 1→2→3번을 받고 4번째 요청만 명확한 예외로
-- 실패한다.
create or replace function public.generate_daily_number(
  p_numbers int[],
  p_generation_method public.user_numbers_generation_method,
  p_related_dream_id bigint,
  p_generation_date date,
  p_dream_numbers int[] default null
) returns public.daily_number_generations
language plpgsql
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_count int;
  v_slot smallint;
  v_row public.daily_number_generations;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- hashtextextended(..., 0)로 (user_id, date) 조합 하나당 하나의 advisory lock 키를 만든다.
  -- 트랜잭션 종료 시 자동 해제되는 xact 버전을 써서 별도 unlock 호출이 필요 없다.
  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || p_generation_date::text, 0)
  );

  select count(*) into v_count
  from public.daily_number_generations
  where user_id = v_user_id and generation_date = p_generation_date;

  if v_count >= 3 then
    raise exception 'daily generation limit reached' using errcode = 'P0001';
  end if;

  v_slot := (v_count + 1)::smallint;

  insert into public.daily_number_generations
    (user_id, generation_date, slot_index, numbers, generation_method, related_dream_id, dream_numbers)
  values
    (v_user_id, p_generation_date, v_slot, p_numbers, p_generation_method, p_related_dream_id, p_dream_numbers)
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.generate_daily_number is
  '오늘의 세 조합 중 다음 slot을 원자적으로 계산해 INSERT한다. auth.uid() 기준으로만 동작하며
  RLS와 별개로 이미 본인 행만 다룬다. 4번째 호출은 예외를 던진다(호출부는 이를 "오늘의 생성
  한도 도달"로 처리한다).';

grant execute on function public.generate_daily_number(int[], public.user_numbers_generation_method, bigint, date, int[]) to authenticated;
