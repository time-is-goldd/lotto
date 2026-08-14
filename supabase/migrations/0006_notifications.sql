-- 0006_notifications.sql
-- notifications: 알림 내용(1건). notification_deliveries: 채널별 발송 기록(1:N).
-- 근거: docs/DATABASE_SCHEMA.md §3.0(공통 규칙), §3.16(notifications/notification_deliveries),
-- §8(인덱스 전략), v2.4 기준. [[EXECUTION_PLAN]] Phase1 구현순서 6번(profiles 참조)과 대응한다.
--
-- 범위: 두 테이블과 명확히 근거가 있는 인덱스만 포함한다. RLS는 0001~0005와 동일하게 이 파일에서
-- 다루지 않고 0008_rls_policies.sql에서 0001~0007 테이블 전체를 한 번에 적용한다
-- (docs/AI_ENGINEERING_CONSTITUTION.md §7 "RLS" Phase1 예외, docs/DATABASE_SCHEMA.md §9).
--
-- §8은 "notification_deliveries(status) 부분 인덱스"를 요구하지만 WHERE 조건(대상 status 값)을
-- 명시하지 않는다. 조건을 임의로 추정해 만들지 않고(설계 임의 추가 금지) notification_id 인덱스만
-- 생성한다 — status 부분 인덱스는 최종 보고서 "발견된 문제"에서 별도 확인 요청.

-- notifications.type
create type public.notifications_type as enum ('win_result', 'battle_result', 'system', 'marketing');

create table public.notifications (
  id bigint generated always as identity primary key,
  -- 컬럼 정의 표(docs/DATABASE_SCHEMA.md §3.16)에 NULL 허용 표기가 없는 컬럼은 dreams.keyword(0003) 등과
  -- 동일한 관례로 NOT NULL로 둔다. "본인만" RLS(§6)가 성립하려면 user_id가 항상 존재해야 한다.
  -- ON DELETE는 §3.0 원칙 1(profiles는 NO ACTION)을 따른다.
  user_id uuid not null references public.profiles (id),
  type public.notifications_type not null,
  title varchar(100) not null,
  body text not null,
  link_url varchar(255) not null,
  -- 인앱 열람 기준. 다른 boolean+DEFAULT 컬럼(profiles.marketing_opt_in 등)과 동일하게 NOT NULL로 둔다.
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  '알림 내용(1건). updated_at 없음(§3.16에 명시되지 않음).';

-- FK 컬럼 기본 인덱스 (docs/DATABASE_SCHEMA.md §8 "FK 컬럼 기본 인덱스" 목록에 notifications(user_id) 명시).
create index notifications_user_id_idx on public.notifications (user_id);

-- notification_deliveries.channel / status
create type public.notification_deliveries_channel as enum ('in_app', 'email', 'web_push', 'kakao_alimtalk', 'sms');
create type public.notification_deliveries_status as enum ('pending', 'sent', 'failed');

create table public.notification_deliveries (
  id bigint generated always as identity primary key,
  -- 부모(notifications) 행이 없으면 발송 기록 자체가 존재할 이유가 없는 자식 행이므로 CASCADE
  -- (docs/DATABASE_SCHEMA.md §3.0 원칙 2에 명시된 예시 그대로: "notification_deliveries.notification_id → notifications").
  notification_id bigint not null references public.notifications (id) on delete cascade,
  channel public.notification_deliveries_channel not null,
  -- DEFAULT는 문서에 명시되지 않아 추가하지 않는다(애플리케이션이 매 INSERT마다 명시적으로 값을 넣는다).
  status public.notification_deliveries_status not null,
  sent_at timestamptz,
  error_message text
);

comment on table public.notification_deliveries is
  '알림 채널별 발송 기록(1:N). created_at/updated_at 없음(§3.16에 명시되지 않음 — sent_at만 존재).';

-- FK 컬럼 기본 인덱스 (docs/DATABASE_SCHEMA.md §8에 명시적으로 열거됨).
create index notification_deliveries_notification_id_idx on public.notification_deliveries (notification_id);
