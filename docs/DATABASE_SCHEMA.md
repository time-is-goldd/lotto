# DATABASE SCHEMA — 데이터베이스 설계 (Supabase 네이티브 개정판)

> v2.0. Supabase(PostgreSQL + Auth + Storage + Realtime)를 전제로 전면 개정한다. [[CRITICAL_REVIEW]] D-01~D-09 지적사항(RLS 부재, auth 미통합, Storage 미설계, 테이블 불일치, 다중채널 알림 구조 미비)을 모두 반영했다. [[MASTER_PRD]] §3 "1인 개발 원칙"에 따라 별도 인프라(Redis 등) 의존을 최소화하고 Supabase 기본 기능을 최대한 활용하는 방향으로 설계를 조정했다.

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

### 3.1 `profiles` (구 `users`)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | UUID PK, FK → auth.users.id | |
| provider | ENUM('kakao','email') | 가입 경로 |
| nickname | VARCHAR(30) | 커뮤니티/실시간로그 노출용 |
| birth_date | DATE NULL | 운세 기능용, 선택입력 |
| gender | ENUM('M','F','N') NULL | |
| birth_time | TIME NULL | |
| age_verified | BOOLEAN DEFAULT false | 19세 이상 확인 여부 ([[CRITICAL_REVIEW]] P-08) |
| marketing_opt_in | BOOLEAN DEFAULT false | |
| privacy_public_default | BOOLEAN DEFAULT true | 실시간 로그 공개 기본값 |
| best_win_rank_ever | SMALLINT NULL | 다이어리 프로필 요약용 비정규화 캐시 |
| status | ENUM('active','withdrawn','suspended') | |
| created_at, updated_at | TIMESTAMP | |

**RLS**: `SELECT/UPDATE`는 `auth.uid() = id`인 본인만 허용. 닉네임 등 공개 노출용 필드는 `SECURITY DEFINER` 뷰(`public_profiles`)로 별도 분리해 커뮤니티/실시간로그가 이 뷰만 참조하도록 한다 (생년월일 등 민감정보가 실수로 노출되는 경로 자체를 차단).

### 3.2 `draws` — 회차/추첨 결과 (v1.0과 동일)
회차, 당첨번호6개, 보너스번호, 1등 당첨금/인원, 출처. **RLS**: 전체 공개 `SELECT` 허용(공개 데이터), `INSERT/UPDATE`는 관리자만.

### 3.3 `user_numbers` — 생성/저장 번호 (행운 다이어리 핵심 테이블, 컬럼 확장)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | BIGINT PK | |
| user_id | UUID FK → profiles.id NULL | 비회원 생성 시 NULL |
| session_id | VARCHAR(64) NULL | 비회원 추적용 |
| numbers | INT[6] CHECK(중복없이 1~45) | 생성된 번호 |
| generation_method | ENUM('auto','custom','dream','fortune') | |
| related_dream_id | BIGINT FK NULL | |
| related_fortune_id | BIGINT FK NULL | |
| **recommendation_reason** | TEXT NULL | **(신규)** 생성 당시 추천 이유 스냅샷 (예: "돼지꿈 연동 생성"). 원본 콘텐츠가 나중에 바뀌어도 기록이 변하지 않도록 생성 시점 텍스트를 그대로 저장(비정규화) |
| **is_purchased** | BOOLEAN DEFAULT false | **(신규)** 실제 구매 여부 — 자진 신고, 자동검증 불가 |
| **purchase_amount** | INT DEFAULT 0 | **(신규)** 구매 금액 — 자진 신고 |
| **memo** | TEXT NULL | **(신규)** 행운 메모 (사용자가 자유롭게 남기는 짧은 기록) |
| target_round | INT FK(draws.round) NULL | |
| is_public | BOOLEAN DEFAULT true | |
| match_count | SMALLINT NULL | |
| win_rank | SMALLINT NULL | |
| checked_at | TIMESTAMP NULL | |
| created_at | TIMESTAMP | |

**CHECK 제약** (신규, [[CRITICAL_REVIEW]] D-06): `array_length(numbers,1) = 6`, 각 원소 1~45 범위, 배열 내 중복 없음 — DB 트리거 또는 CHECK 제약으로 강제.

**RLS**: `SELECT/INSERT/UPDATE`는 `auth.uid() = user_id`인 본인만. 단, `is_public = true`인 레코드의 `numbers`, `created_at`, (마스킹된) 닉네임만 노출하는 별도 뷰(`public_number_feed`)를 만들어 실시간 로그 기능이 이 뷰만 조회하도록 한다.

### 3.4 `dreams` — 꿈해몽 사전 (v1.0과 동일, RLS: 전체 공개 SELECT, 관리자만 쓰기)

### 3.5 `dream_number_mappings` (v1.0과 동일)

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

### 3.7 `fortune_results` — AI 운세 결과 (v1.0과 거의 동일)
컬럼 구성은 유지하되, MVP(Should)에서는 `overall_fortune`, `luck_score`, `recommended_numbers`, `share_id`만 필수로 채우고 나머지(행동지침/피해야할행동/행운색 등)는 Phase 2에서 채우는 것을 허용하도록 NULL 허용 범위를 넓힌다 ([[FEATURE_SPEC]] AI 운세 간소화 참조).

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

> 개인별 데이터는 규모가 작아 캐시 없이 즉시 쿼리해도 무방하지만(사용자 1인당 레코드 수 제한적), 연말 Luck Report 생성 시점에는 이 캐시를 배치로 미리 만들어두는 것이 응답속도에 유리하다. **RLS**: 본인만 조회.

### 3.9 `battles` / `battle_entries` (v1.0과 동일 구조, Phase 4)
`battles.reward_description`에 대해 애플리케이션 레벨 검증(관리자 UI)에서 "현금/상품권 문구 포함 시 저장 차단" 룰을 추가한다 ([[MASTER_PRD]] 비목표 §6).

### 3.10 `hall_of_fame_entries` (v1.0과 동일, Phase 4)

### 3.11 `winning_cases` (v1.0과 동일)

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

### 3.18 `share_cards` (v1.0과 동일)

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

## 5. Storage 버킷 설계 (신규, [[CRITICAL_REVIEW]] D-04)

| 버킷 | 접근 정책 | 용도 | 제약 |
|---|---|---|---|
| `avatars` | 공개 읽기, 본인만 쓰기 | 프로필 이미지 | 2MB 이하, 이미지 파일만 |
| `community-uploads` | 공개 읽기, 작성자만 쓰기 | 게시글 첨부 이미지 (Phase 4) | 5MB 이하, 게시글당 최대 5장 |
| `share-cards` | 공개 읽기, 서버(서비스 롤)만 쓰기 | 동적 생성되는 공유용 OG 이미지 | 서버 함수에서만 생성 |
| `dream-images` | 공개 읽기, 관리자만 쓰기 | 꿈해몽 콘텐츠 삽화 (선택) | |

모든 버킷은 Supabase Storage RLS 정책으로 위 접근 규칙을 강제한다.

---

## 6. RLS 정책 요약표 (신규, [[CRITICAL_REVIEW]] D-01 전면 해결)

| 테이블 | SELECT | INSERT/UPDATE | 비고 |
|---|---|---|---|
| profiles | 본인만 (공개용은 별도 뷰) | 본인만 | |
| user_numbers | 본인만 (공개 피드는 별도 뷰) | 본인만 | |
| dream_journal_entries | 본인만 | 본인만 | 완전 비공개 |
| fortune_results | 본인 또는 share_id 익명 | 본인/서버 | |
| user_period_stats | 본인만 | 서버(배치)만 | |
| notifications / deliveries | 본인만 | 서버만 | |
| referrals | 본인(referrer)만 | 서버만 | |
| draws, dreams, winning_cases, stores | 전체 공개 | 관리자만 | 공개 콘텐츠 |
| community_posts/comments (Phase 4) | 전체 공개(숨김 제외) | 작성자 본인(수정), 전체 회원(작성) | |
| reports | 신고자 본인 + 관리자 | 회원 누구나(생성) | |
| products/orders (Phase 5+) | 본인 주문만 / 상품은 공개 | 본인(주문), 관리자(상품) | |

모든 테이블은 기본적으로 **RLS 활성화(Enable RLS)를 원칙**으로 하며, 위 표에 명시되지 않은 조합은 전부 차단한다.

---

## 7. 데이터 보존/삭제 정책 (v1.0과 동일 + 확장)

기존 정책(회원탈퇴 소프트삭제/익명화, 게시글 삭제 유예, 감사로그 3년 보존)에 더해:
- `dream_journal_entries`, `user_numbers.memo/purchase_amount` 등 민감한 개인 기록은 탈퇴 시 **완전 삭제**(익명화 대상에서 제외, 통계 목적으로도 보존하지 않음) — 개인정보 최소보유 원칙 강화.

## 8. 인덱스/파티셔닝 전략 (v1.0 유지 + 추가)

- `user_numbers(user_id, target_round)`, `(target_round, is_public)`, `(created_at)` — 유지
- `notification_deliveries(notification_id)`, `(status)` 부분 인덱스 — 신규
- `community_posts(category, created_at)` — 카테고리 목록 조회용, 신규 명시
- `dreams` 검색을 위한 `pg_trgm` GIN 인덱스(`keyword`, `interpretation`) — 신규, [[INFORMATION_ARCHITECTURE]] 검색 기능 지원
- 실시간 로그는 Redis 대신 **Supabase Realtime(Postgres Change Data Capture)**을 `public_number_feed` 뷰에 연결해 구현한다 — 별도 캐시 인프라 불필요 ([[IMPLEMENTATION_PLAN]] 개정 참조, [[MASTER_PRD]] 원칙 4 "유지보수 비용 최소화").
