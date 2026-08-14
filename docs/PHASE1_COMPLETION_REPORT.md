# PHASE1 COMPLETION REPORT — DB 구축 완료 보고

> 이 문서는 [[EXECUTION_PLAN]] Phase 1(DB 구축)의 종료 시점 상태를 기록하는 **완료 보고 문서**다. 설계 산출물([[DATABASE_SCHEMA]])이나 실행 계획([[EXECUTION_PLAN]])을 대체하지 않으며, 이후 Phase 진행 중 "Phase1이 어떤 상태로 끝났는지" 참조하는 스냅샷 역할만 한다. 이 문서 자체는 Phase1 종료 시점 이후 갱신하지 않는다(미해결 사항의 진행 상황은 [[BACKLOG]]에서 추적).

---

## 1. Phase1 완료 범위

### 1.1 Migration 목록 (`0001`~`0010`, `0013`)

| 순번 | 파일명 | 포함 테이블/작업 | 상태 |
|---|---|---|---|
| 0001 | `profiles.sql` | `profiles` | 적용 완료(세션 이전) |
| 0002 | `draws_user_numbers.sql` | `draws`, `user_numbers`, `public.is_valid_lotto_numbers()` 함수 | 적용 완료 |
| 0003 | `dreams.sql` | `dreams`, `dream_number_mappings` | 적용 완료 |
| 0004 | `dream_journal_entries.sql` | `dream_journal_entries` | 적용 완료 |
| 0005 | `fortune_results_user_period_stats.sql` | `fortune_results`, `user_period_stats` | 적용 완료 |
| 0006 | `notifications.sql` | `notifications`, `notification_deliveries` | 적용 완료 |
| 0007 | `winning_cases_stores.sql` | `winning_cases`, `stores`, `store_win_records` | 적용 완료 |
| 0008 | `rls_policies.sql` | `0001`~`0007` 13개 테이블 RLS 활성화 + 정책 22개 | 적용 완료 |
| 0009 | `share_cards_storage.sql` | `share_cards` 테이블 + `share-cards` Storage 버킷 + RLS 정책 3개 | 적용 완료 |
| 0010 | `seed_data.sql` | `draws`(15) / `dreams`(25) / `dream_number_mappings`(25) 시드 | 적용 완료 |
| 0013 | `profiles_status_default.sql` | `profiles.status DEFAULT 'active'` 보완 | 적용 완료(세션 이전) |

10개 파일(`0011`/`0012`는 Phase4/Phase9 예약 번호로 Phase1에서 사용하지 않음) 전부 `supabase migration list` 기준 local=remote 일치 확인됨(각 Task 완료 시점마다 검증).

### 1.2 생성된 테이블 목록 (14개)

`profiles`, `draws`, `user_numbers`, `dreams`, `dream_number_mappings`, `dream_journal_entries`, `fortune_results`, `user_period_stats`, `notifications`, `notification_deliveries`, `winning_cases`, `stores`, `store_win_records`, `share_cards`.

[[DATABASE_SCHEMA]] §6 "Phase 1 대상 테이블" 표와 정확히 일치(14개 전부).

### 1.3 RLS 적용 현황

- 14개 테이블 전부 `pg_class.relrowsecurity = true` 확인(`0008`에서 13개, `0009`에서 `share_cards` 1개).
- `public` 스키마 정책 24개(`0008`: 22개, `0009`: `share_cards` 2개) + `storage.objects` 정책 1개(`0009`, `share-cards` 버킷 범위) = 총 25개 정책.
- 정책 방향은 [[DATABASE_SCHEMA]] §6 RLS 정책 요약표를 그대로 구현했다(각 Task 보고서에 테이블별 근거 기록 완료).
- **미완료 항목**: 실제 두 개의 인증 세션으로 "타인 데이터가 안 보이는지" 확인하는 살아있는(behavioral) 테스트는 수행하지 않았다 — `pg_policies`로 정책 정의 자체는 검증했으나, 실제 로그인 세션이 있어야 의미 있게 수행 가능한 테스트라 Phase2 이후로 넘긴다([[BACKLOG]] 항목 E).

### 1.4 Storage 생성 현황

- `share-cards` 버킷 생성 완료(`public=true`, `file_size_limit`/`allowed_mime_types` 미설정 — [[DATABASE_SCHEMA]] §5에 구체적 제한이 명시되지 않아 임의로 추가하지 않음).
- `avatars` 버킷은 [[DATABASE_SCHEMA]] §5 결정대로 Phase1에서 생성하지 않음(기능 명세 부재).
- `community-uploads`/`dream-images`는 Phase1 대상이 아니며(§5, Phase4 이후) 생성하지 않음.

### 1.5 Seed 데이터 현황

| 테이블 | 건수 | 비고 |
|---|---|---|
| `draws` | 15건 | **합성(synthetic) placeholder 데이터** — 실제 로또 공식 결과 아님. Production 배포 전 교체 필수([[BACKLOG]] 항목 B) |
| `dreams` | 25건 | [[ROADMAP]] §2 "최소 20~30건" 요구 충족 |
| `dream_number_mappings` | 25건 | 시드된 `dreams` 각각에 1건씩 대응 |
| `winning_cases`/`stores`/`store_win_records` | 0건 | [[DATABASE_SCHEMA]] §9가 시드 대상으로 지정하지 않음([[BACKLOG]] 항목 C) |

---

## 2. Phase1 완료 기준 체크리스트

[[EXECUTION_PLAN]] Phase 1 §6("완료 기준")·§10("체크리스트") 대조.

### 완료 항목
- [x] Supabase 프로젝트에 MVP 전체 테이블(`profiles`~`share_cards`, 14개) 존재
- [x] 전체 테이블 RLS **활성화**(`ENABLE ROW LEVEL SECURITY`) 및 정책 **정의** 완료(구조적 검증: `pg_class.relrowsecurity`, `pg_policies`)
- [x] `share-cards` Storage 버킷 생성 및 정책 적용, `avatars` 미생성 확인
- [x] DB 타입 생성(`lib/types/database.ts`) 및 코드 연결 완료
- [x] Seed 데이터 존재(`draws`/`dreams`/`dream_number_mappings`)
- [x] 매 Migration마다 `npm run lint` / `type-check` / `test` / `build` 통과 확인(누적 10회)

### 미완료 항목
- [ ] **RLS 실제 사용자 테스트**: "SQL Editor에서 익명 키로 타인 데이터 비노출 실제 테스트 완료"([[EXECUTION_PLAN]] Phase1 §6) — 정책 정의는 검증했지만 실제 인증 세션 기반 동작 테스트는 미수행([[BACKLOG]] 항목 E)

### Phase2 이후 처리 예정 항목
아래는 Phase1 범위가 아니거나, Phase1에서 발견됐지만 Phase1 내에서 해결할 성격이 아닌 항목이다. 전부 [[BACKLOG]]로 이관한다.
- `draws.draw_date` 컬럼 필요 여부 재검토(항목 A)
- `draws` seed를 실제 로또 데이터로 교체(항목 B, Phase10 배포 직전)
- `winning_cases`/`stores`/`store_win_records` 실제 콘텐츠 입력(항목 C, Phase7 이후)
- `dreams` SEO 콘텐츠 확장(항목 D, Phase7)
- RLS 실제 사용자 테스트(항목 E, Phase2 완료 후)
- 그 외 세션 중 발견된 컬럼/제약/정책 관련 미결정 사항 다수([[BACKLOG]] "F. 세션 중 추가로 발견된 항목" 참조)

---

## 3. Phase1 전체 요약

10개 Migration(`0001`~`0010`) + 선행 적용된 `0013`을 통해 [[DATABASE_SCHEMA]] v2.4가 정의한 Phase1 스키마 전체(14개 테이블, RLS 정책, `share-cards` Storage 버킷, 로컬 개발용 시드 데이터)가 원격 Supabase 프로젝트에 반영되었다. 매 Migration은 `information_schema`/`pg_constraint`/`pg_indexes`/`pg_trigger`/`pg_policies` 등 시스템 카탈로그 조회로 실제 적용 상태를 확인했으며, Schema Freeze 규칙([[DATABASE_SCHEMA]] §10)에 따라 이미 적용된 파일은 한 번도 수정하지 않았다.

다만 완료 기준의 "실제 테스트" 항목과, 진행 중 발견된 다수의 문서-스키마 불일치/설계 판단 보류 사항이 남아있다 — 상세 내용과 처리 방향은 [[BACKLOG]] 참조.
