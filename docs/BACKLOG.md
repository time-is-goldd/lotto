# BACKLOG — 보류된 발견사항 추적

> Phase1(DB 구축) 진행 중 발견됐지만 **지금 해결하지 않고 보류**하기로 한 항목을 모두 기록한다. 각 항목은 스키마/코드를 임의로 바꾸지 않고 사용자 승인을 받은 뒤에만 처리한다([[AI_ENGINEERING_CONSTITUTION]] §15-17 "헌법이나 설계 문서와 상충하는 기능을 조용히 구현하지 않는다"의 문서 버전). 항목이 해결되면 이 문서에서 제거하지 않고 "처리 완료(날짜, 처리한 Migration/PR)"로 상태만 갱신한다 — 이력 보존.
>
> [[PHASE1_COMPLETION_REPORT]]가 Phase1 종료 시점의 스냅샷이라면, 이 문서는 그 스냅샷에 남은 미해결 사항을 계속 추적하는 살아있는 문서다.

---

## A. `draws.draw_date` 컬럼 검토

- **현재 상태**: [[DATABASE_SCHEMA]] §3.2 `draws` 컬럼 정의에 날짜 컬럼이 없다(`id`/`round`/`numbers`/`bonus_number`/`first_prize_amount`/`first_prize_count`/`source`/`created_at`뿐). `created_at`은 "이 행이 DB에 INSERT된 시각"이지 "실제 추첨이 열린 날짜"가 아니다.
- **발견 경위**: `0010`(Seed) Task 지시문이 `draw_date`/`winning_numbers` 컬럼을 언급했으나 실제 스키마에는 존재하지 않음을 확인(`information_schema.columns` 직접 조회로 재확인).
- **재검토 필요 시점**: 실제 로또 공식 데이터를 import하는 시점(Phase10 배포 직전, [[BACKLOG]] 항목 B와 연동) 또는 "최근 회차"를 날짜 기준으로 표시/정렬하는 화면 기능이 설계될 때.
- **처리 방향(승인 대기)**: 필요하다고 판단되면 `0011`+ 신규 migration으로 `ALTER TABLE draws ADD COLUMN draw_date date`를 추가한다. 지금은 컬럼을 추가하지 않는다.
- **상태**: 미해결

---

## B. `draws` seed 데이터 교체

- **현재 상태**: `0010_seed_data.sql`의 `draws` 15건은 CHECK 제약을 통과하는 **합성(synthetic) placeholder 데이터**이며 실제 로또 6/45 공식 당첨 결과가 아니다.
- **위험**: 이 상태로 프로덕션에 배포되면 허위 당첨 정보를 게시하는 것과 같다 — [[MASTER_PRD]] §6 비목표("사행성 조장 문구 금지" 등)와 직결되는 리스크.
- **처리 방향**: [[EXECUTION_PLAN]] Phase10(배포) §5 "seed 데이터를 실제 최근 회차 데이터로 교체" 단계에서 반드시 실제 공식 데이터로 교체한다. 신규 migration(또는 관리자 화면을 통한 데이터 입력, Phase9 이후)으로 처리하며, 기존 `0010`의 synthetic 데이터를 그대로 프로덕션에 노출하지 않는다.
- **상태**: 미해결(Phase10 전까지는 정상 — 로컬/개발 환경 전용 데이터로 의도된 것)

---

## C. `winning_cases` / `stores` / `store_win_records` 콘텐츠 데이터

- **현재 상태**: `0007`에서 스키마만 생성됐고 `0010` seed 대상에서 제외됐다([[DATABASE_SCHEMA]] §9가 이 세 테이블을 시드 대상으로 지정하지 않음). 현재 0건.
- **영향**: [[ROADMAP]] §1에서 `winning_cases`(실제 당첨 사례)는 Should, `stores`(로또 명당)는 Could로 분류되어 있어 MVP 초기에는 필수는 아니지만, 관련 페이지가 열리는 시점에는 콘텐츠가 있어야 한다.
- **처리 방향**: Phase7(꿈해몽) 전후, 콘텐츠 기획이 진행되는 시점에 실제 당첨 사례·판매점 데이터를 조사해 입력한다(관리자 화면 완성 후에는 Phase9 관리자 CRUD로, 그 전에는 별도 seed migration으로 처리 가능).
- **상태**: 미해결(Phase1 범위 밖 — 계획대로 보류 중)

---

## D. `dreams` SEO 콘텐츠 확장

- **현재 상태**: `0010`에서 25건 시드 — [[ROADMAP]] §2 "최소 20~30건" 요구는 충족하지만 최소 분량 수준이다.
- **처리 방향**: Phase7(꿈해몽) 착수 시 [[EXECUTION_PLAN]] Phase7 "시드 콘텐츠 20~30건 작성"이 이미 계획돼 있다 — 이는 신규 콘텐츠 확장이 아니라 현재 25건을 그대로 활용/보완하는 것으로 해석 가능하나, 정식 오픈 전 검색 유입 극대화를 위해 분량을 추가로 늘리는 것을 권장한다.
- **상태**: 미해결(Phase7에서 재검토)

---

## E. RLS 실제 사용자 테스트

- **현재 상태**: `0008`/`0009`의 RLS 정책은 `pg_policies` 시스템 카탈로그 조회로 **정의 자체**는 전수 검증했지만, 실제 로그인한 두 사용자 계정으로 "타인 데이터가 실제로 안 보이는지" 확인하는 behavioral 테스트는 수행하지 않았다.
- **왜 지금 못 하는가**: 이 테스트가 의미를 가지려면 실제 `auth.uid()`를 가진 인증 세션이 최소 2개 필요한데, 인증 기능 자체가 아직 없다(Phase2에서 구현).
- **처리 방향**: Phase2(Authentication) 완료 직후, 실제 카카오/이메일 로그인으로 테스트 계정 2개를 만들어 각 테이블에서 "본인 데이터만 보이는지 / 타인 데이터가 절대 안 보이는지"를 확인한다([[IMPLEMENTATION_PLAN]] §7 "RLS 정책 테스트를 신규 필수 항목으로 추가"와 동일한 요구사항). 자동화 테스트로 구현하는 것을 권장한다.
- **상태**: **DONE(2026-08-06, [[PHASE2_RLS_REAL_USER_TEST_REPORT]])**. 실제 Supabase 프로젝트에 카카오 로그인 흐름(`establishKakaoSupabaseSession()`, 카카오 API 호출부만 우회)으로 authenticated 세션 2개(User A/B)를 발급하고, anon key + 각자의 실제 JWT로 Supabase REST API를 직접 호출해 `profiles`/`user_numbers`/`dream_journal_entries`/`notifications`/`notification_deliveries`/공개 테이블 7종(`draws`/`dreams`/`dream_number_mappings`/`winning_cases`/`stores`/`store_win_records`/`share_cards`) 전체에서 "본인 데이터만 보이고 타인 데이터는 차단됨"을 실측 확인했다. 정책 결함 발견되지 않음. 테스트 계정·데이터는 검증 후 전량 삭제. 이전 기록(위 3줄)은 이력 보존을 위해 그대로 남긴다.

---

## F. 세션 중 추가로 발견된 항목 (A~E 외)

Phase1 각 Task 진행 중 발견됐으나 위 5개 항목에 포함되지 않은 나머지 미해결 사항. 전부 RLS/스키마 정확성에 즉각적인 문제를 일으키지는 않지만, 향후 Migration이나 문서 정합성 작업에서 다뤄야 한다.

| # | 항목 | 발견 Task | 처리 방향 |
|---|---|---|---|
| F1 | `user_period_stats`에 `created_at` 없음(`updated_at`만 존재) | 0005 | 감사/디버깅 목적으로 필요해지면 `0011`+ `ALTER TABLE ADD COLUMN`. RLS와 무관해 급하지 않음 |
| F2 | `notification_deliveries`에 `created_at`/`updated_at`이 전혀 없음 | 0006 | "발송 대기가 언제 큐에 들어갔는지" 추적이 필요해지면 `0011`+ `ALTER TABLE ADD COLUMN` |
| F3 | `notifications.link_url`이 NOT NULL — 링크 없는 시스템/마케팅 알림 표현이 부자연스러울 수 있음 | 0006 | 실사용 중 문제가 확인되면 `ALTER COLUMN link_url DROP NOT NULL` 검토 |
| F4 | `notification_deliveries(status)` 부분 인덱스의 `WHERE` 조건이 [[DATABASE_SCHEMA]] §8에 명시되지 않음 | 0006 | 조건(예상: `WHERE status = 'pending'`) 확정 후 `0011`+ 인덱스 추가 |
| F5 | `stores.lat`/`lng`가 NOT NULL — 좌표 미확보 상태의 판매점 등록 워크플로와 충돌 가능 | 0007 | Phase9 관리자 화면 설계 시점에 실제 데이터 입력 흐름 확인 후 재검토 |
| F6 | `store_win_records`에 `(store_id, round, prize_rank)` UNIQUE 제약 없음 — 중복 입력 방지 불가 | 0007 | 필요 시 `0011`+ `ALTER TABLE ADD CONSTRAINT` |
| F7 | [[EXECUTION_PLAN]]과 [[ROADMAP]]의 MoSCoW 등급 표기 불일치(`stores`를 Should vs Could로 다르게 기재) | 0007 | 스키마 무관, 문서 표기만 정정하면 됨 |
| F8 | `notifications` UPDATE 정책이 "`is_read`만 수정 가능"을 강제하지 못함(현재는 본인 소유 행 전체 수정 가능) — Postgres RLS는 OLD/NEW 컬럼별 비교를 트리거 없이 표현할 수 없음 | 0008 | ① `BEFORE UPDATE` 트리거 추가(신규 함수 생성 필요, 승인 대기) 또는 ② 서버 API Route에서 `is_read` 외 필드 무시하는 애플리케이션 레벨 검증으로 대체. 현재는 ②에 의존 |
| F9 | `fortune_results`/`share_cards`의 SELECT가 "본인 또는 share_id" 문서 표현과 달리 구조적으로 전체 공개(`USING (true)`)로 구현됨 — Postgres RLS가 "요청이 특정 share_id를 아는지"를 판단할 수 없기 때문 | 0008, 0009 | 기능적으로는 올바른 구현(공유 링크 패턴의 필연적 결과)이나, [[DATABASE_SCHEMA]] §3.7/§3.18에 이 사실을 명시적으로 각주 처리할지 검토 |
| F10 | `share_cards` INSERT 정책을 `fortune_results`(0008 Decision 1, 전면 서버 강제)와 다르게 "로그인 사용자 직접 INSERT 허용 + 비회원만 서버 경유" 하이브리드로 구현 | 0009 | 의도적 판단이었으나 **사용자 확인 필요** — fortune_results와 동일하게 전면 서버 강제로 통일할지 결정 필요 |
| F11 | 카카오×Supabase Auth 통합 방식(A/B) PoC 시점이 문서마다 다르게 기술됨 — [[IMPLEMENTATION_PLAN]] §3 제목/본문은 "Phase 0 필수 기술검증"이라 명시하지만, [[EXECUTION_PLAN]] Phase0 체크리스트는 실제 로그인 연동을 "Phase 2"로 명시적으로 미루었고 Phase2 §5 구현순서 1번이 이 A/B 확정을 Phase2의 첫 단계로 계획한다 | Phase2 착수 전 점검(이번 Task) | 기능적 블로커는 아님(EXECUTION_PLAN의 실제 계획은 자체적으로 일관됨 — PoC를 Phase2 1단계에서 수행). 문서 정합성만 문제이므로 [[IMPLEMENTATION_PLAN]] §3 제목의 "Phase 0 필수 기술검증"을 "Phase 2 착수 시 최우선 기술검증"으로 정정할지 검토 필요(문서 수정만 필요, 승인 후 처리) |

---

## 처리 우선순위 권장(참고용, 확정 아님)

1. **Phase2 착수 직후**: 항목 E(RLS 실제 테스트) — 인증이 생기자마자 가능해지는 유일한 항목. **DONE(2026-08-06)**
2. **Phase2~3 사이 여유 시점**: F8(notifications UPDATE 제약), F10(share_cards INSERT 정책 통일 여부) — 둘 다 사용자 판단이 필요한 설계 확정 사안
3. **Phase7 착수 시점**: 항목 C(winning_cases/stores 콘텐츠), D(dreams 확장), F5(stores.lat/lng), F6(store_win_records UNIQUE) — 콘텐츠/운영 화면과 함께 다루는 것이 효율적
4. **Phase10 배포 직전**: 항목 B(draws 실데이터 교체), 항목 A(draw_date 필요 여부, B와 연동)
5. **여유 있을 때 아무 때나**: F1~F4, F7, F9 — 급하지 않은 스키마 보완/문서 정정
