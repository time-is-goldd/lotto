# DATABASE SCHEMA — 데이터베이스 설계 (Supabase 네이티브 개정판)

> v2.0. Supabase(PostgreSQL + Auth + Storage + Realtime)를 전제로 전면 개정한다. [[CRITICAL_REVIEW]] D-01~D-09 지적사항(RLS 부재, auth 미통합, Storage 미설계, 테이블 불일치, 다중채널 알림 구조 미비)을 모두 반영했다. [[MASTER_PRD]] §3 "1인 개발 원칙"에 따라 별도 인프라(Redis 등) 의존을 최소화하고 Supabase 기본 기능을 최대한 활용하는 방향으로 설계를 조정했다.
>
> **v2.1 (2026-08-05, Phase 1 Design Gate 반영)**: `profiles.birth_date` NOT NULL 전환(19세 검증 근거 일원화), 회원탈퇴 정책 A안 확정(§7), `draws`/`dreams`/`dream_number_mappings`/`winning_cases` 컬럼 정의 보완, `share_cards` 신규 정의(§3.18), `user_period_stats` UNIQUE 제약 추가, RLS 정책표에 DELETE 열 추가(§6), Storage에서 `avatars` 제외(§5), Migration 순서(§9) 및 Schema Freeze 규칙(§10) 신설. 근거는 Phase 1 Design Gate 검토 기록 참조.
>
> **v2.2 (2026-08-05, Phase 1 진행 방향 결정사항 반영)**: Schema 관리 방식을 Supabase CLI + Migration 기반으로 명문화, Dashboard SQL Editor는 긴급 확인 용도로만 한정(§10-0). Edge Function/Cron 인프라는 MVP에서 보류하고 Phase5 이후 도입(상세 아키텍처 결정은 [[IMPLEMENTATION_PLAN]] 참조). Free Tier 기준 비용 전략을 [[IMPLEMENTATION_PLAN]] §10에 신설.
>
> **v2.3 (2026-08-05, Task 1-0.6 — `0002` 착수 전 마지막 Design Gate)**: 공통 컬럼/FK 규칙 신설(§3.0), `profiles.status` DEFAULT 확정, `draws` CHECK 제약 추가, `user_numbers.related_dream_id`/`related_fortune_id` FK 제거(마이그레이션 순서 역행 해소), `fortune_results` 컬럼 전체 정의, `public_profiles`/`public_number_feed` 뷰 Phase1 보류 확정, Seed 수량 정정(§9), `0002` 착수 전 최종 검증 체크리스트(§11) 신설. 이 개정으로 이전 Design Gate에서 남아있던 미해결 항목이 모두 해소되었다.
>
> **v2.4 (2026-08-05, `0003` 완료 후 문서 정합성 점검)**: `0002`/`0003` 적용 과정에서 실제로 생성된 `0013_profiles_status_default.sql`을 Migration 순서표(§9)에 반영, RLS 활성화 시점(테이블 생성 시 vs `0008` 일괄 적용)을 §6에 명시적으로 교차참조해 [[AI_ENGINEERING_CONSTITUTION]]·[[EXECUTION_PLAN]]과 동일한 결론이 나오도록 정렬했다. 스키마 자체(컬럼/제약/인덱스)는 변경하지 않았다 — 이미 적용된 `0001`/`0002`/`0003`/`0013`은 Schema Freeze 규칙(§10)에 따라 그대로 유지된다.

---

## 1. ERD 개요 (개정)

```
auth.users (Supabase 관리) ──1:1── profiles ──< user_numbers >── draws
                                     │              │
                                     │              └──< battle_entries >── battles
                                     │
                                     ├──< fortune_results
                                     ├──< dream_journal_entries
                                     ├──< user_period_stats
                                     ├──< notifications >── notification_deliveries
                                     ├──< community_posts ──< community_comments
                                     ├──< reports
                                     ├──< referrals (referrer/referred)
                                     ├──< orders >── order_items >── products
                                     └──< share_cards

dreams ──< dream_number_mappings ── winning_cases ── draws
stores ──< store_win_records ── draws   (로또 명당)
```

**v1.0 대비 변경**: `users` → `profiles`로 개명하고 `auth.users`를 참조하는 구조로 전환. ERD에만 있고 실제 정의가 없던 `dream_lookups`는 제거(§[[CRITICAL_REVIEW]] D-05) — 개인 꿈 기록이 필요하면 신규 `dream_journal_entries`를 사용한다. `notifications`는 내용/발송을 분리해 `notification_deliveries`를 신설했다.

---

## 2. Supabase Auth 통합 원칙 (신규)

- Supabase의 `auth.users`가 유일한 신원(identity) 테이블이다. 애플리케이션 프로필 데이터는 `public.profiles`에 저장하며 `profiles.id`는 `auth.users.id`(UUID)를 그대로 사용(1:1, PK=FK).
- **카카오 로그인**은 Supabase Auth의 기본 제공 OAuth 목록에 없다. 아래 두 방식 중 하나를 Phase 0 기술검증(PoC)에서 확정한다 ([[IMPLEMENTATION_PLAN]]):
  - (A) 카카오 REST API로 사용자 인증 후, Supabase Admin API(`auth.admin.createUser`)로 사용자를 생성/조회하고 커스텀 세션을 발급
  - (B) Supabase Auth의 커스텀 OIDC 프로바이더 설정으로 카카오를 OIDC 클라이언트로 등록 (카카오가 OIDC 표준을 지원하는 범위 내에서)
- 이메일 가입은 Supabase Auth 기본 이메일/비밀번호 인증을 그대로 사용 (카카오 장애 시 폴백, [[MASTER_PRD]] 리스크 대응).

## 3. 핵심 테이블 정의

### 3.0 공통 컬럼/제약 규칙 (신규, Task 1-0.6 확정)

Phase1 테이블 전체에 적용되는 공통 규칙. 개별 테이블 정의에서 매번 반복 설명하지 않고 이 규칙을 참조한다.

**`created_at`/`updated_at`**: 모든 `created_at`은 `TIMESTAMP NOT NULL DEFAULT now()`. `updated_at`이 있는 테이블은 `TIMESTAMP NOT NULL DEFAULT now()`로 만들고, `public.set_updated_at()`(0001에서 최초 정의된 공용 트리거 함수)을 재사용하는 `BEFORE UPDATE` 트리거를 건다 — 테이블마다 트리거 함수를 새로 만들지 않는다([[AI_ENGINEERING_CONSTITUTION]] §3 "중복 코드 작성 금지"). 어떤 테이블이 `updated_at`을 갖는지는 각 테이블 컬럼 표에 명시된 대로만 따른다(예: `user_numbers`는 `updated_at`이 없다 — 임의로 추가하지 않는다).

**FK `ON DELETE` 기본 원칙**:
1. 참조 대상이 설계상 실제로 삭제되지 않는 테이블(`profiles` — §7 A안, `draws` — 영구 공개 기록)을 가리키는 FK는 별도 지정 없이 Postgres 기본값(`NO ACTION`)을 쓴다. 이 테이블들은 삭제 대신 상태 전환/익명화로 처리되므로, 예외적으로 삭제가 시도되면 조용히 전파되지 않고 오류로 막히는 것이 설계 의도와 일치한다.
2. 부모 행이 없으면 존재 의미가 없는 자식 행(`dream_number_mappings.dream_id → dreams`, `notification_deliveries.notification_id → notifications`, `store_win_records.store_id → stores`)은 `CASCADE`.
3. 콘텐츠(관리자가 실제로 편집·삭제할 수 있는 대상)를 가리키되, 그 콘텐츠가 사라져도 사용자의 개인 기록 자체는 보존되어야 하는 선택적 참조(`user_numbers.related_dream_id`/`related_fortune_id`)는 **FK 제약을 걸지 않는다** — §3.3 참조.

### 3.1 `profiles` (구 `users`)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | UUID PK, FK → auth.users.id | ON DELETE는 §3.0 원칙 1(NO ACTION)을 따른다 — `auth.users`는 §7 A안에 따라 실제로 삭제되지 않으므로, 예외적으로 삭제가 시도되면 오류로 막히는 편이 정책 의도와 일치한다(CASCADE 채택 안 함 — 채택 시 탈퇴 정책이 의도한 익명화 경로를 우회해 프로필이 조용히 사라질 수 있음). SET NULL은 PK 컬럼이라 애초에 적용 불가 |
| provider | ENUM('kakao','email') | 가입 경로 |
| nickname | VARCHAR(30) | 커뮤니티/실시간로그 노출용 |
| birth_date | DATE NOT NULL | **가입 시 필수 입력(v2.1 변경)**. 만 19세 미만 이용제한 검증(§9.3 [[FEATURE_SPEC]], Must·법적요건)의 판정 근거이며, 운세 기능(§3.2 [[FEATURE_SPEC]])에도 동일 값을 재사용한다 — 두 목적이 하나의 값을 공유하므로 필수 컬럼으로 확정(Phase1 Design Gate) |
| gender | ENUM('M','F','N') NULL | 선택입력 유지(MVP 운세 로직이 아직 사용하지 않음) |
| birth_time | TIME NULL | |
| age_verified | BOOLEAN NOT NULL DEFAULT false | 19세 이상 확인 여부 ([[CRITICAL_REVIEW]] P-08) |
| marketing_opt_in | BOOLEAN NOT NULL DEFAULT false | |
| privacy_public_default | BOOLEAN NOT NULL DEFAULT true | 실시간 로그 공개 기본값 |
| best_win_rank_ever | SMALLINT NULL | 다이어리 프로필 요약용 비정규화 캐시 |
| status | ENUM('active','withdrawn','suspended') NOT NULL DEFAULT 'active' | **(v2.3 확정, Task 1-0.6)** 신규 프로필은 항상 `active`로 시작하고 이후 UPDATE로만 전환되므로, 매 INSERT마다 애플리케이션이 명시적으로 값을 넣게 하는 것보다 DB DEFAULT로 강제하는 편이 단순하고 유지보수 부담이 적다(1인 개발 원칙, [[MASTER_PRD]] §3). **주의**: `0001_profiles.sql`은 이미 적용되었고 이 DEFAULT 없이 생성되었다 — Schema Freeze 규칙(§10)에 따라 `0001`을 수정하지 않고, `0002` 작업 시작 전 별도 `ALTER TABLE`로 추가한다 |
| created_at | TIMESTAMP NOT NULL DEFAULT now() | §3.0 공통 규칙 |
| updated_at | TIMESTAMP NOT NULL DEFAULT now() | §3.0 공통 규칙, `public.set_updated_at()` 트리거로 갱신 |

**RLS**: `SELECT/UPDATE`는 `auth.uid() = id`인 본인만 허용. **`public_profiles` 뷰는 Phase1에서 만들지 않는다(v2.3, Task 1-0.6 — 보류 확정)** — 이 뷰를 실제로 참조하는 기능(커뮤니티, 실시간 로그)이 모두 Phase3~4로 연기되어 있어 MVP에는 소비자가 없다. 해당 기능을 만드는 Phase에서 뷰의 정확한 `SELECT` 컬럼 목록과 함께 신설한다. 그때까지 `profiles`의 다른 회원 정보는 어떤 경로로도 공개되지 않는다(본인만 SELECT).

### 3.2 `draws` — 회차/추첨 결과 (v2.1: 컬럼/제약 명시화)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | BIGINT PK | |
| round | INT UNIQUE NOT NULL | 회차 번호. `user_numbers.target_round`, `store_win_records.round`가 이 값을 FK로 참조하므로 UNIQUE 필수(Phase1 Design Gate — 기존 문서는 PK/UNIQUE 구조가 불명확했음) |
| numbers | INT[6] NOT NULL CHECK(중복없이 1~45) | 당첨번호 6개. **(v2.3 확정, Task 1-0.6)** `user_numbers.numbers`와 동일한 CHECK를 적용한다 — 당첨 매칭 로직 전체가 이 값의 무결성에 의존하므로 사용자 입력용 컬럼보다 느슨하게 둘 이유가 없다 |
| bonus_number | INT NOT NULL CHECK(1 ~ 45 범위) | 보너스번호 |
| first_prize_amount | BIGINT NOT NULL | 1등 당첨금. DEFAULT 없음 — 관리자가 회차 입력 시 항상 실제 값을 명시하도록 강제(자리표시자 0이 실제 데이터처럼 남는 것을 방지) |
| first_prize_count | INT NOT NULL | 1등 당첨 인원. 위와 동일한 이유로 DEFAULT 없음 |
| source | VARCHAR(50) NOT NULL DEFAULT 'manual' | 데이터 출처. MVP는 관리자 수동 입력만 존재하므로([[ROADMAP]] §11 자동화 로드맵) 기본값을 `manual`로 둔다 — Phase8에서 공공데이터 API 자동수집이 추가되면 그 경로에서 `api` 등의 값을 명시적으로 넣는다 |
| created_at | TIMESTAMP NOT NULL DEFAULT now() | §3.0 공통 규칙. `draws`는 `updated_at`을 두지 않는다(공식 기록은 사실상 append-only) |

**RLS**: 전체 공개 `SELECT` 허용(공개 데이터), `INSERT/UPDATE`는 service_role 전용(§6 — `admins` 테이블이 Phase9에야 생성되므로 Phase1~8은 client 대상 관리자 정책을 만들지 않는다).

### 3.3 `user_numbers` — 생성/저장 번호 (행운 다이어리 핵심 테이블, 컬럼 확장)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | BIGINT PK | |
| user_id | UUID FK → profiles.id NULL | 비회원 생성 시 NULL. ON DELETE는 §3.0 원칙 1(NO ACTION) |
| session_id | VARCHAR(64) NULL | 비회원 추적용 |
| numbers | INT[6] NOT NULL CHECK(중복없이 1~45) | 생성된 번호 |
| generation_method | ENUM('auto','custom','dream','fortune') NOT NULL | |
| related_dream_id | BIGINT NULL, `dreams.id` 참조 (FK 제약 없음) | **(v2.3 확정, Task 1-0.6)** 이전에는 `dreams`를 FK로 참조했으나, `dreams`는 `0003`에서 생성되고 `user_numbers`는 `0002`에서 생성되어 마이그레이션 순서가 역행하는 문제가 있었다. §3.0 원칙 3에 따라 강한 FK 제약을 걸지 않고 애플리케이션 레벨에서 검증하는 참조로 전환한다(`share_cards.content_ref_id`와 동일 패턴) — 부수 효과로 "관리자가 꿈 콘텐츠를 지우면 사용자의 저장된 번호 기록까지 함께 삭제되는" CASCADE 오발동 위험도 함께 제거된다 |
| related_fortune_id | BIGINT NULL, `fortune_results.id` 참조 (FK 제약 없음) | 위와 동일한 이유(`fortune_results`는 `0005`에서 생성) |
| **recommendation_reason** | TEXT NULL | **(신규)** 생성 당시 추천 이유 스냅샷 (예: "돼지꿈 연동 생성"). 원본 콘텐츠가 나중에 바뀌어도 기록이 변하지 않도록 생성 시점 텍스트를 그대로 저장(비정규화) |
| **is_purchased** | BOOLEAN NOT NULL DEFAULT false | **(신규)** 실제 구매 여부 — 자진 신고, 자동검증 불가 |
| **purchase_amount** | INT NOT NULL DEFAULT 0 | **(신규)** 구매 금액 — 자진 신고 |
| **memo** | TEXT NULL | **(신규)** 행운 메모 (사용자가 자유롭게 남기는 짧은 기록) |
| target_round | INT NULL FK(draws.round) | ON DELETE는 §3.0 원칙 1(NO ACTION) |
| is_public | BOOLEAN NOT NULL DEFAULT true | |
| match_count | SMALLINT NULL | |
| win_rank | SMALLINT NULL | |
| checked_at | TIMESTAMP NULL | |
| created_at | TIMESTAMP NOT NULL DEFAULT now() | §3.0 공통 규칙. `user_numbers`는 `updated_at`을 두지 않는다(`match_count`/`win_rank`/`checked_at` 갱신 시점은 `checked_at` 자체가 이미 기록하므로 별도 컬럼 불필요) |

**CHECK 제약** (신규, [[CRITICAL_REVIEW]] D-06): `array_length(numbers,1) = 6`, 각 원소 1~45 범위, 배열 내 중복 없음 — DB 트리거 또는 CHECK 제약으로 강제.

**RLS**: `SELECT/INSERT/UPDATE`는 `auth.uid() = user_id`인 본인만. **`public_number_feed` 뷰는 Phase1에서 만들지 않는다(v2.3, Task 1-0.6 — 보류 확정)** — 이 뷰가 지원하는 "실시간 번호 생성 로그" 기능 자체가 [[ROADMAP]]에서 Could(Phase3 이후 재검토)로 분류되어 있어 MVP에는 소비자가 없다. 해당 기능을 실제로 만드는 시점에 `numbers`/`created_at`/마스킹된 닉네임의 정확한 `SELECT` 표현과 함께 신설한다. 그때까지 `is_public` 컬럼 값은 저장만 되고 실제로 공개 경로에 쓰이지 않는다.

### 3.4 `dreams` — 꿈해몽 사전 (v2.1: 컬럼 정의 신설)
기존 문서는 "v1.0과 동일"로만 참조했으나, 저장소 git 이력을 확인한 결과 v1.0 문서가 실제로 존재한 적이 없어(Phase1 Design Gate 확인) 아래와 같이 신규로 정의한다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | BIGINT PK | |
| keyword | VARCHAR(50) | 꿈 키워드(예: "돼지꿈"). `pg_trgm` GIN 인덱스 대상(§8) |
| category | VARCHAR(30) NULL | `/dream/category/[category]`([[EXECUTION_PLAN]] Phase7) 라우팅용 분류 |
| interpretation | TEXT | 해몽 본문. `pg_trgm` GIN 인덱스 대상(§8) |
| image_url | VARCHAR(255) NULL | `dream-images` 버킷 참조(선택) |
| created_at, updated_at | TIMESTAMP | |

**RLS**: 전체 공개 `SELECT`, `INSERT/UPDATE`는 service_role 전용(관리자 콘텐츠 작성/수정).

### 3.5 `dream_number_mappings` — 꿈별 추천번호 매핑 (v2.1: 컬럼 정의 신설)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | BIGINT PK | |
| dream_id | BIGINT FK(dreams.id) | |
| numbers | INT[6] CHECK(중복없이 1~45) | 해당 꿈 키워드에 매칭된 추천번호 |
| created_at | TIMESTAMP | |

**RLS**: 전체 공개 `SELECT`, `INSERT/UPDATE`는 service_role 전용.

### 3.6 `dream_journal_entries` — 개인 꿈 기록 (신규, 행운 다이어리 전용)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | BIGINT PK | |
| user_id | UUID FK → profiles.id | |
| entry_date | DATE | |
| dream_text | TEXT | 사용자가 직접 작성한 꿈 내용 |
| linked_dream_id | BIGINT FK(dreams.id) NULL | 사전 키워드 매칭 시 연결 |
| created_at | TIMESTAMP | |

**RLS**: 본인만 CRUD 가능 (`auth.uid() = user_id`). 이 데이터는 절대 공개되지 않는다 — 사전(`dreams`)과 명확히 분리된 완전 사적 기록.

### 3.7 `fortune_results` — AI 운세 결과 (v2.3: 컬럼 정의 신설, Task 1-0.6)
기존 문서는 "v1.0과 거의 동일"로만 참조했으나, v1.0 문서가 저장소에 존재한 적이 없어(Phase1 Design Gate 확인) 아래와 같이 [[FEATURE_SPEC]] §3.2·§3.3 기준으로 신규 정의한다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | BIGINT PK | |
| user_id | UUID NULL, `profiles.id` 참조 (FK 제약, ON DELETE는 §3.0 원칙 1) | [[FEATURE_SPEC]] §3.3 "비로그인도 이용 가능"에 따라 비회원은 NULL(`user_numbers.user_id`와 동일한 패턴) |
| input_birth_date | DATE NOT NULL | 운세 계산에 사용한 생년월일. 비회원도 이용 가능하므로 `profiles.birth_date`를 참조하지 않고 매 요청마다 독립적으로 입력받아 저장한다 |
| zodiac_sign | VARCHAR(10) NULL | 계산된 띠(12지). MVP 산출 로직(생년월일→띠, 단순 산술)의 결과 캐시 |
| overall_fortune | TEXT NOT NULL | 종합운세. MVP 필수 3항목 중 하나([[FEATURE_SPEC]] §3.2) |
| luck_score | SMALLINT NOT NULL | 행운지수. MVP 필수 |
| recommended_numbers | INT[6] NOT NULL CHECK(중복없이 1~45) | 추천 번호. MVP 필수. `user_numbers`/`draws`와 동일한 CHECK 적용 |
| today_energy | TEXT NULL | 오늘의 기운. Phase2 이후 채움([[FEATURE_SPEC]] §3.2 나머지 7항목) |
| money_luck | TEXT NULL | 금전운. Phase2 이후 |
| action_guide | TEXT NULL | 행동지침. Phase2 이후 |
| things_to_avoid | TEXT NULL | 피해야 할 행동. Phase2 이후 |
| lucky_color | VARCHAR(20) NULL | 행운색. Phase2 이후 |
| lucky_direction | VARCHAR(10) NULL | 행운방향. Phase2 이후 |
| lucky_time | VARCHAR(20) NULL | 행운시간. Phase2 이후 |
| share_id | VARCHAR(20) UNIQUE NOT NULL | 공유 링크(`/share/[shareId]`) 및 비회원 익명 조회 식별자. MVP 필수 |
| created_at | TIMESTAMP NOT NULL DEFAULT now() | §3.0 공통 규칙. `updated_at` 없음(운세 결과는 생성 후 수정되지 않는 스냅샷) |

**RLS**: 본인 또는 `share_id`로 조회하는 익명 접근(공유 링크)만 허용.

### 3.8 `user_period_stats` — 개인 월간/연간 통계 캐시 (신규)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | BIGINT PK | |
| user_id | UUID FK | |
| period_type | ENUM('monthly','yearly') | |
| period_key | VARCHAR(10) | "2026-07" / "2026" |
| total_generated | INT | |
| total_purchased_count | INT | |
| total_purchase_amount | INT | |
| best_win_rank | SMALLINT NULL | |
| most_frequent_numbers | INT[] | |
| updated_at | TIMESTAMP | |

> 개인별 데이터는 규모가 작아 캐시 없이 즉시 쿼리해도 무방하지만(사용자 1인당 레코드 수 제한적), 연말 Luck Report 생성 시점에는 이 캐시를 배치로 미리 만들어두는 것이 응답속도에 유리하다.

**제약**: `(user_id, period_type, period_key)` UNIQUE — 배치 upsert 시 중복 행 생성을 막기 위해 필수(v2.1 추가, Phase1 Design Gate).

**RLS**: 본인만 조회, `INSERT/UPDATE`는 service_role 전용(배치).

### 3.9 `battles` / `battle_entries` (v1.0과 동일 구조, Phase 4)
`battles.reward_description`에 대해 애플리케이션 레벨 검증(관리자 UI)에서 "현금/상품권 문구 포함 시 저장 차단" 룰을 추가한다 ([[MASTER_PRD]] 비목표 §6).

### 3.10 `hall_of_fame_entries` (v1.0과 동일, Phase 4)

### 3.11 `winning_cases` — 실제 당첨 사례 (v2.1: 컬럼 정의 신설)
기존 문서는 "v1.0과 동일"로만 참조했으나, v1.0 문서가 저장소에 존재한 적이 없어(Phase1 Design Gate 확인) 아래와 같이 신규로 정의한다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | BIGINT PK | |
| round | INT FK(draws.round) NULL | 관련 회차(선택) |
| title | VARCHAR(100) | |
| story_text | TEXT | 당첨 스토리 본문(최소 큐레이션, [[FEATURE_SPEC]] §6.1) |
| is_featured | BOOLEAN DEFAULT false | 홈/명당 페이지 노출 우선순위 |
| created_at | TIMESTAMP | |

**RLS**: 전체 공개 `SELECT`, `INSERT/UPDATE`는 service_role 전용.

### 3.12 `stores` — 로또 명당 (신규, [[CRITICAL_REVIEW]] S-01)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | BIGINT PK | |
| name | VARCHAR(100) | 판매점명 |
| address | VARCHAR(200) | |
| region_sido | VARCHAR(20) | 시/도 |
| region_sigungu | VARCHAR(20) | 시/군/구 |
| lat, lng | NUMERIC | 지도 표시용 |
| total_first_prize_count | INT DEFAULT 0 | 누적 1등 배출 횟수 |
| created_at | TIMESTAMP | |

### 3.13 `store_win_records` — 판매점별 당첨 이력 (신규)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | BIGINT PK | |
| store_id | BIGINT FK | |
| round | INT FK(draws.round) | |
| prize_rank | SMALLINT | |
| created_at | TIMESTAMP | |

**RLS**: `stores`, `store_win_records` 모두 전체 공개 SELECT, 관리자만 쓰기.

### 3.14 `community_posts` / `community_comments` (v1.0과 동일, Phase 4)

### 3.15 `reports` — 신고 (신규, [[CRITICAL_REVIEW]] D-07)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | BIGINT PK | |
| target_type | ENUM('post','comment','profile') | |
| target_id | BIGINT | |
| reporter_id | UUID FK | |
| reason | TEXT | |
| status | ENUM('pending','reviewed','dismissed') | |
| created_at | TIMESTAMP | |

기존에는 `community_posts.status='reported'`로만 처리했으나, 누가·왜 신고했는지 기록이 없어 운영 감사가 불가능했다. 신고 5건 누적 시 자동으로 게시글을 **임시 비공개**(완전 삭제 아님) 처리하는 트리거를 추가해 조직적 허위신고(brigading)에 대비한다.

### 3.16 `notifications` / `notification_deliveries` — 알림 (구조 분리, 신규)

**`notifications`** (알림 내용, 1건)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | BIGINT PK | |
| user_id | UUID FK | |
| type | ENUM('win_result','battle_result','system','marketing') | |
| title | VARCHAR(100) | |
| body | TEXT | |
| link_url | VARCHAR(255) | |
| is_read | BOOLEAN DEFAULT false | (인앱 열람 기준) |
| created_at | TIMESTAMP | |

**`notification_deliveries`** (채널별 발송 기록, 1:N — 신규)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | BIGINT PK | |
| notification_id | BIGINT FK | |
| channel | ENUM('in_app','email','web_push','kakao_alimtalk','sms') | MVP는 in_app/email/web_push만 사용, kakao_alimtalk/sms는 사업자등록 이후 |
| status | ENUM('pending','sent','failed') | |
| sent_at | TIMESTAMP NULL | |
| error_message | TEXT NULL | |

이 구조 덕분에 알림 하나를 여러 채널로 동시 발송하고 각 채널의 성공/실패를 독립적으로 추적할 수 있다 ([[CRITICAL_REVIEW]] D-09 해결).

### 3.17 `referrals` — 친구 초대 (신규)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | BIGINT PK | |
| referrer_id | UUID FK → profiles.id | 초대한 사람 |
| referred_id | UUID FK → profiles.id NULL | 가입 완료한 친구 (가입 전엔 NULL) |
| invite_code | VARCHAR(20) UNIQUE | |
| status | ENUM('pending','completed') | |
| reward_granted | BOOLEAN DEFAULT false | 비현금 보상 지급 여부 |
| created_at, completed_at | TIMESTAMP | |

**RLS**: 본인이 `referrer_id`인 레코드만 조회 가능.

### 3.18 `share_cards` — 공유 카드 (v2.1: 신규 정의, Phase1 Design Gate 결정)
Must 기능인 카카오 공유([[FEATURE_SPEC]] §9.1)의 데이터 기반. **Phase1에서는 테이블과 `share-cards` Storage 버킷(§5)만 선반영하며, 실제 OG 이미지 생성·업로드 기능 구현은 해당 기능(번호생성/공유 UI)이 만들어지는 이후 Phase에서 진행한다.**

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | BIGINT PK | |
| user_id | UUID FK → profiles.id NULL | 비회원 생성 결과도 공유 가능하므로 NULL 허용(`user_numbers.user_id`와 동일한 이유) |
| share_id | VARCHAR(20) UNIQUE | `/share/[shareId]` 공개 URL 식별자 |
| content_type | ENUM('number_result','fortune','yearly_report') | 공유 대상 콘텐츠 종류. 향후 확장 시 ENUM 값만 추가 |
| content_ref_id | BIGINT NULL | `content_type`에 따라 `user_numbers.id` 또는 `fortune_results.id` 등을 가리키는 참조. 콘텐츠 종류마다 대상 테이블이 다르므로 엄격한 FK 대신 애플리케이션 레벨에서 검증한다 |
| image_url | VARCHAR(255) NULL | `share-cards` 버킷에 생성된 OG 이미지 경로 |
| created_at | TIMESTAMP | |

**RLS**: 전체 공개 `SELECT`(공유 링크 특성상 익명 접근 전제), `INSERT`는 본인 또는 서버(service_role), `UPDATE/DELETE` 불허.

### 3.19 `products` / `orders` / `order_items` — 쇼핑몰 (Phase 5~6 확장)
v1.0 구조 유지하되, 향후 입점(Phase 6) 대비 `products`에 컬럼 추가:
| 추가 컬럼 | 타입 | 설명 |
|---|---|---|
| seller_id | UUID FK → profiles.id NULL | NULL이면 자사 판매, 값이 있으면 입점 판매자 |

### 3.20 `affiliate_links` / `affiliate_clicks` — 제휴 마케팅 (신규, Phase 6)
| 컬럼(affiliate_links) | 타입 | 설명 |
|---|---|---|
| id | BIGINT PK | |
| partner_name | VARCHAR(100) | |
| target_url | VARCHAR(255) | |
| tracking_code | VARCHAR(30) UNIQUE | |

| 컬럼(affiliate_clicks) | 타입 | 설명 |
|---|---|---|
| id | BIGINT PK | |
| link_id | BIGINT FK | |
| clicked_at | TIMESTAMP | |
| referrer_path | VARCHAR(255) NULL | |

### 3.21 `memberships` — 프리미엄 멤버십 (신규, Phase 7)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | BIGINT PK | |
| user_id | UUID FK | |
| tier | ENUM('free','premium') | |
| started_at | TIMESTAMP | |
| expires_at | TIMESTAMP NULL | |
| payment_ref | VARCHAR(100) NULL | 결제 시스템 연동 시 참조ID |

### 3.22 `faqs` / `guides` / `notices` (v1.0과 동일)

### 3.23 `admins` / `admin_audit_logs` (개정)
1인 운영 기준으로 `admins.role`은 MVP에서 `super` 단일값만 사용한다 ([[ADMIN_REQUIREMENTS]] 단순화 원칙). `admin_audit_logs.diff`(JSONB)에 개인정보(생년월일 등)가 포함될 경우 저장 전 마스킹 처리 규칙을 애플리케이션 레벨에 추가한다 ([[CRITICAL_REVIEW]] D-08).

---

## 4. 통계 캐시 테이블 (v1.0과 동일)

`number_frequency_cache`, `combination_statistics_cache` — 사이트 전체 통계는 여전히 배치 캐시가 필요하다(레코드 수가 크기 때문). 이는 §3.8 `user_period_stats`(개인용, 소규모, 캐시 선택적)와 명확히 구분된다.

---

## 5. Storage 버킷 설계 (신규, [[CRITICAL_REVIEW]] D-04 / v2.1 avatars 제외)

| 버킷 | 접근 정책 | 용도 | 제약 |
|---|---|---|---|
| `share-cards` | 공개 읽기, 서버(서비스 롤)만 쓰기 | 동적 생성되는 공유용 OG 이미지 | 서버 함수에서만 생성. Phase1에 `share_cards` 테이블(§3.18)과 함께 생성 |
| `community-uploads` | 공개 읽기, 작성자만 쓰기 | 게시글 첨부 이미지 (Phase 4) | 5MB 이하, 게시글당 최대 5장 |
| `dream-images` | 공개 읽기, 관리자만 쓰기 | 꿈해몽 콘텐츠 삽화 (선택) | |

**보류 결정(v2.1)**: `avatars` 버킷은 Phase1에서 생성하지 않는다. [[FEATURE_SPEC]] 전체에 프로필 이미지 업로드 기능이 명시되어 있지 않고 `profiles`에도 참조 컬럼이 없어, 기능 명세 없는 업로드 인프라를 먼저 만들지 않는다는 원칙([[AI_ENGINEERING_CONSTITUTION]] §7 Storage 원칙, §15 금지사항)에 따라 보류한다. 실제 아바타 업로드 기능이 설계되는 시점에 버킷과 `profiles.avatar_url` 컬럼을 함께 추가한다(Phase1 Design Gate 결정).

모든 버킷은 Supabase Storage RLS 정책으로 위 접근 규칙을 강제한다.

---

## 6. RLS 정책 요약표 (v2.1: SELECT/INSERT/UPDATE/DELETE 4열로 확장, [[CRITICAL_REVIEW]] D-01 전면 해결)

**RLS 활성화 시점(v2.4 명시)**: 이 표는 각 테이블이 "최종적으로" 가져야 할 RLS 정책을 정의하며, 실제로 언제 활성화되는지는 §9 Migration 순서를 따른다 — `0001`~`0007`은 테이블 생성만 담당하고 이 구간 테이블의 RLS는 `0008_rls_policies.sql`에서 일괄 적용한다. `0009`(`share_cards`)부터는 테이블 생성과 RLS를 같은 파일에서 함께 적용한다. 이 문서·[[AI_ENGINEERING_CONSTITUTION]] §7·[[EXECUTION_PLAN]] Phase1은 동일한 원칙을 공유한다.

**관리자 정책에 대한 공통 원칙**: `admins` 테이블/관리자 플래그는 [[EXECUTION_PLAN]] Phase 9에야 생성된다. 따라서 Phase 1~8 동안 "관리자만" 권한은 **client 대상 RLS 정책을 아예 만들지 않는 방식(정책 없음 = 기본 차단)** 으로 구현하고, 실제 관리자 쓰기는 서버 API route가 `service_role`로 수행한다([[IMPLEMENTATION_PLAN]] §5와 동일). Phase 9에서 관리자 플래그가 생기더라도, 클라이언트가 직접 RLS를 통과해 쓰는 대신 "서버 API route + service_role" 패턴을 그대로 유지할 것을 권장한다(보안 표면 최소화).

### Phase 1 대상 테이블

| 테이블 | SELECT | INSERT | UPDATE | DELETE | 비고 |
|---|---|---|---|---|---|
| profiles | 본인만(`auth.uid()=id`) | 본인만(가입 트리거) | 본인만 | **불허** | 탈퇴는 UPDATE로 익명화(§7 A안). DELETE 정책 없음=기본 차단. `public_profiles` 뷰는 Phase1에 만들지 않음(v2.3, §3.1) |
| user_numbers | 본인만 | 본인만(`auth.uid()=user_id`) | 본인만(memo/purchase_amount 등) | **본인만** | 사용자가 잘못 생성한 기록을 지울 수 있어야 하므로 본인 DELETE 허용(v2.1 결정). `public_number_feed` 뷰는 Phase1에 만들지 않음(v2.3, §3.3) |
| dream_journal_entries | 본인만 | 본인만 | 본인만 | **본인만** | 완전 비공개 개인 기록. 사용자가 자유롭게 삭제 가능해야 함(v2.1 결정) |
| fortune_results | 본인 또는 `share_id` 익명 조회 | 본인 또는 서버 | 서버만 | 불허 | |
| user_period_stats | 본인만 | service_role 전용(배치) | service_role 전용(배치) | 불허 | (user_id, period_type, period_key) UNIQUE |
| notifications | 본인만 | service_role 전용 | 본인만(`is_read`만) | 불허 | |
| notification_deliveries | 본인 소유 알림에 한함(서버 경유 권장) | service_role 전용 | service_role 전용 | 불허 | 채널별 발송 기록, 클라이언트 직접 조회 최소화 |
| draws | 전체 공개 | **service_role 전용** | service_role 전용 | 불허 | 관리자 정책 공통 원칙(위) 적용. Phase9 이후에도 서버 경유 유지 권장 |
| dreams / dream_number_mappings | 전체 공개 | service_role 전용 | service_role 전용 | 불허 | 상동 |
| winning_cases / stores / store_win_records | 전체 공개 | service_role 전용 | service_role 전용 | 불허 | 상동 |
| share_cards | 전체 공개(공유 링크 특성상 익명 접근 전제) | 본인 또는 서버 | 불허 | 불허 | |

### 후행 Phase 테이블 (참고용, 이번 Phase1 대상 아님)

| 테이블 | SELECT | INSERT | UPDATE | DELETE | 비고 |
|---|---|---|---|---|---|
| referrals (Phase4) | 본인(referrer)만 | 서버만 | 서버만 | 불허 | |
| community_posts/comments (Phase4) | 전체 공개(숨김 제외) | 작성자 본인 | 작성자 본인 | 작성자 본인(소프트 삭제 권장) | |
| reports (Phase4) | 신고자 본인 + 관리자 | 회원 누구나 | 불허 | 불허 | |
| products/orders (Phase5+) | 본인 주문만 / 상품은 공개 | 본인(주문), 관리자(상품) | 관리자만(상품) | 불허 | |

모든 테이블은 기본적으로 **RLS 활성화(Enable RLS)를 원칙**으로 하며, 위 표에 명시되지 않은 조합(특히 모든 테이블의 DELETE 기본값)은 전부 차단한다.

---

## 7. 데이터 보존/삭제 정책 (v2.1: 탈퇴 처리 A안 확정, Phase1 Design Gate 2026-08-05)

기존 문서는 "기존 정책(소프트삭제/익명화)을 유지"라고만 서술했으나, 그 근거였던 v1.0 문서가 저장소에 존재한 적이 없어(git 이력 확인 완료) 실제 메커니즘이 정의되어 있지 않았다. 아래와 같이 확정한다.

**탈퇴 처리 방식(A안)**:
- `auth.users` 레코드는 **삭제하지 않고 유지**한다. 로그인 자체는 애플리케이션 레벨(`profiles.status='withdrawn'` 확인)에서 차단한다. `profiles.id`가 `auth.users.id`를 PK=FK로 참조하는 1:1 구조이므로, `auth.users`를 실제 삭제하면 FK 정합성 문제가 발생하기 때문에 이 방식을 채택했다.
- `profiles`의 개인정보 컬럼(`nickname`, `birth_date`, `gender`, `birth_time`)은 탈퇴 시 UPDATE로 **익명화**(NULL 또는 마스킹 값 처리)하고 `status='withdrawn'`으로 전환한다.
- `user_numbers.memo`/`purchase_amount`, `dream_journal_entries` 등 완전히 사적인 개인 기록은 익명화 대상이 아니라 **완전 삭제(hard delete)** 대상이다(통계 목적으로도 보존하지 않음) — 개인정보 최소보유 원칙.
- 탈퇴 처리의 상세 트리거/API 플로우(예: 유예기간, 재가입 처리, 실제 UPDATE/DELETE를 실행하는 API 라우트 설계)는 이 문서(DB 설계)의 범위가 아니라 [[EXECUTION_PLAN]] **Phase 2(Authentication) 설계 문서에서 구체화**한다. 이 문서는 "탈퇴 후 각 테이블이 최종적으로 어떤 상태여야 하는가"까지만 규정한다.

기존 정책(게시글 삭제 유예, 감사로그 3년 보존)은 유지한다.

## 8. 인덱스/파티셔닝 전략 (v1.0 유지 + 추가)

- `user_numbers(user_id, target_round)`, `(target_round, is_public)`, `(created_at)` — 유지
- `notification_deliveries(notification_id)`, `(status)` 부분 인덱스 — 신규
- `community_posts(category, created_at)` — 카테고리 목록 조회용, 신규 명시
- `dreams` 검색을 위한 `pg_trgm` GIN 인덱스(`keyword`, `interpretation`) — 신규, [[INFORMATION_ARCHITECTURE]] 검색 기능 지원
- 실시간 로그는 Redis 대신 **Supabase Realtime(Postgres Change Data Capture)**을 `public_number_feed` 뷰에 연결해 구현한다 — 별도 캐시 인프라 불필요 ([[IMPLEMENTATION_PLAN]] 개정 참조, [[MASTER_PRD]] 원칙 4 "유지보수 비용 최소화").
- **FK 컬럼 기본 인덱스** (v2.1 추가, [[AI_ENGINEERING_CONSTITUTION]] §7 "외래키 컬럼에는 기본적으로 인덱스를 건다"): `dream_journal_entries(user_id)`, `dream_journal_entries(linked_dream_id)`, `fortune_results(user_id)`, `fortune_results(share_id)`(UNIQUE — 익명 공유 조회 진입점), `notifications(user_id)`, `store_win_records(store_id)`, `store_win_records(round)`, `share_cards(share_id)`(UNIQUE), `share_cards(user_id)`.
- **참조용 컬럼 인덱스** (v2.3, FK 제약은 없지만 조회 패턴상 인덱스는 필요, §3.0 원칙 3): `user_numbers(related_dream_id)`, `user_numbers(related_fortune_id)`.

---

## 9. Migration 순서 — Phase 1 (확정, 2026-08-05 Phase1 Design Gate)

승인된 결정사항에 따라 아래 순서로 확정한다. [[EXECUTION_PLAN]] Phase1 §3의 파일 목록은 Task 1-0.5(2026-08-05)에서 이 순서에 맞춰 이미 동기화되었다([[EXECUTION_PLAN]] Phase1 Change Log 참조) — 더 이상 별도 갱신이 필요한 상태가 아니다.

| 순번 | 파일명 | 포함 테이블/작업 |
|---|---|---|
| 0001 | `profiles.sql` | `profiles` (auth.users 참조) |
| 0002 | `draws_user_numbers.sql` | `draws`, `user_numbers` |
| 0003 | `dreams.sql` | `dreams`, `dream_number_mappings` (전체 공개·service_role 쓰기 콘텐츠 클러스터) |
| 0004 | `dream_journal_entries.sql` | `dream_journal_entries` (완전 비공개·본인 쓰기 — 0003과 RLS 성격이 정반대라 분리) |
| 0005 | `fortune_results_user_period_stats.sql` | `fortune_results`, `user_period_stats` |
| 0006 | `notifications.sql` | `notifications`, `notification_deliveries` |
| 0007 | `winning_cases_stores.sql` | `winning_cases`, `stores`, `store_win_records` |
| 0008 | `rls_policies.sql` | 0001~0007 테이블 전체 RLS 정책(§6) |
| 0009 | `storage_share_cards.sql` | `share_cards` 테이블 + `share-cards` Storage 버킷 + 해당 RLS. 테이블과 버킷이 하나의 기능 단위로 강하게 결합되어 있어 같은 파일로 묶음 |
| 0010 | `seed_data.sql` | `draws` 최근 회차 10~20건, `dreams` **20~30건**(v2.3 정정, Task 1-0.6 — 이전 "5~10건(테스트용)"이 [[ROADMAP]] §2 Phase0 산출물 요구사항 "최소 꿈해몽 콘텐츠 20~30건"과 불일치했음), `dream_number_mappings`(v2.3 추가 — 시드된 `dreams` 각각에 대응하는 추천번호가 없으면 "꿈→추천번호" 기능이 로컬에서 동작하지 않음) |
| 0013 | `profiles_status_default.sql` | `profiles.status`에 `DEFAULT 'active'` 추가(§3.1, §11). **번호가 0001a 등이 아니라 0013인 이유**: `0001`은 이미 적용되어 Schema Freeze(§10-1)상 직접 수정 불가하고, Supabase CLI가 순수 숫자 접두사만 인식해 알파벳 접미사를 쓸 수 없으며, `0003`~`0012`는 이미 다른 테이블/기능 이름으로 확정돼 있어 재번호 매기기가 불가능했다 — 당시 예약되지 않은 가장 빠른 번호(Phase9의 `0012_admin_flag.sql` 다음)를 사용했다(상세 근거는 `0013_profiles_status_default.sql` 파일 헤더 주석 참조). `profiles`가 `0001`에서 이미 생성되어 있으므로 실행 순서상 `0002`~`0010`보다 뒤에 적용돼도 문제없다 |

**0003/0004 분리 근거**: 기존 계획은 `dreams`/`dream_number_mappings`/`dream_journal_entries`를 한 파일로 묶었으나(구 `0003_dream_tables`), 전자는 "전체 공개, service_role만 쓰기"이고 후자는 "완전 비공개, 본인만 쓰기"로 RLS 성격이 정반대라 분리하는 것이 유지보수 관점에서 더 명확하다(Phase1 Design Gate 판단).

**avatars 버킷 제외**: §5에서 확정한 대로 Phase1 Storage는 `share-cards`만 생성한다.

---

## 10. Schema Freeze 규칙 (신규, Phase1 Design Gate 확정)

0. **관리 방식**: 모든 schema 변경은 **Supabase CLI로 migration 파일을 생성한 뒤 적용**하는 것을 원칙으로 한다. Supabase Dashboard의 SQL Editor에서 직접 스키마를 수정하는 것은 **긴급 상황 확인(디버깅) 용도로만** 허용하며, 확인이 끝나면 동일한 변경 내용을 반드시 새 migration 파일로 재현해 커밋한다 — SQL Editor에서의 변경만 남고 migration 파일로 기록되지 않는 상태(migration 이력과 실제 DB 상태의 불일치)를 만들지 않는다(신규 원칙, 2026-08-05).
1. **Migration 작성이 시작된 이후, 이미 적용(운영에 반영)된 마이그레이션 파일은 절대 수정하지 않는다.** 컬럼/제약을 바꿔야 하면 반드시 새 마이그레이션 파일을 추가한다([[AI_ENGINEERING_CONSTITUTION]] §7, §15-9와 동일한 원칙).
2. **Schema 변경은 항상 새 마이그레이션 파일로 표현한다.** 이 문서를 먼저 고치고 마이그레이션을 나중에 맞추는 순서가 아니라, 마이그레이션과 이 문서를 같은 작업 단위에서 함께 갱신한다([[AI_ENGINEERING_CONSTITUTION]] §4 Phase E).
3. **컬럼 삭제·타입 변경 등 비가역적이거나 기존 데이터에 영향을 주는 변경은 Impact Analysis 없이 진행하지 않는다.** Impact Analysis에는 최소한 "어떤 기능이 이 컬럼을 읽는가", "기존 데이터는 어떻게 처리되는가"를 포함하고, 사용자 승인 후에만 실행한다.
4. **Phase1 Migration(0001~0010) 적용이 완료되는 시점부터 이 문서의 Phase1 테이블 구조는 Schema Freeze 상태로 전환한다.** Freeze 상태에서는 여기 정의된 구조를 변경 없이 유지하며, Phase2 이후 새로운 요구사항은 신규 마이그레이션(0011~)으로만 확장한다. Freeze를 해제(=기존 테이블 구조 자체를 변경)하려면 사용자의 명시적 승인이 필요하다.

---

## 11. `0002` 착수 전 최종 검증 (Task 1-0.6, 2026-08-05)

이전 Design Gate에서 "나중에 결정"으로 남겨두었던 항목을 모두 여기서 확정했다. 더 이상 미해결 항목은 없다.

| 항목 | 상태 | 처리 내용 |
|---|---|---|
| `profiles.status` DEFAULT | **해결** | `DEFAULT 'active'` 확정(§3.1) |
| `created_at`/`updated_at` 정책 | **해결** | §3.0에 프로젝트 공통 규칙으로 명문화 |
| `profiles.id` ON DELETE | **해결** | `NO ACTION`(기본값) 확정, 근거 §3.1·§3.0 |
| `draws` CHECK 제약 | **해결** | `numbers`/`bonus_number`에 CHECK 추가(§3.2) |
| `user_numbers` FK 순서 역행 | **해결** | `related_dream_id`/`related_fortune_id`의 FK 제약을 제거(§3.0 원칙 3, §3.3) — 마이그레이션 순서 문제와 CASCADE 오발동 위험을 동시에 제거 |
| `fortune_results` 컬럼 정의 | **해결** | 전체 컬럼 신규 정의(§3.7) |
| `public_profiles`/`public_number_feed` 뷰 | **보류** | 소비하는 기능(커뮤니티·실시간로그)이 모두 Phase3~4로 연기되어 있어 MVP에는 필요 없음. 해당 기능 구현 시점에 정의(§3.1·§3.3에 명시) |
| Seed 수량/대상 | **해결** | `dreams` 20~30건으로 정정, `dream_number_mappings` 시드 추가(§9) |

**Migration 순서 재검증 결과**: `related_dream_id`/`related_fortune_id`의 FK 제약을 제거함에 따라, `0001`~`0010` 전 구간에서 뒤에 생성되는 테이블을 먼저 참조하는 순방향 참조(forward reference)가 더 이상 없다. RLS(`0008`)는 그 대상인 `0001`~`0007` 테이블이 모두 생성된 뒤에 실행되고, `share_cards`의 RLS는 자신의 테이블 생성과 같은 파일(`0009`)에 있어 문제없다. 순환 참조 없음.

**`0002` 착수 전 필수 조치 (SQL 아님, 실행 항목 안내)**: `profiles.status DEFAULT 'active'`는 이미 적용된 `0001_profiles.sql`에는 반영되어 있지 않다(Schema Freeze 규칙 §10-1에 따라 `0001`을 직접 고치지 않았다). `0002` 작업을 시작할 때, `0002_draws_user_numbers.sql`과는 별개로 `ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'active'`를 반영하는 신규 마이그레이션을 함께 준비해야 한다(파일 분리 여부는 `0002` 구현 Task에서 결정).
