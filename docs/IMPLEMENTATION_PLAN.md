# IMPLEMENTATION PLAN — 기술 구현 계획 (Supabase 네이티브 개정판)

> v2.0. [[MASTER_PRD]] §3 원칙(유지보수 비용 최소화, 확장성보다 현실성)에 따라 별도 인프라(Redis, 전용 워커 서버) 의존을 제거하고 Supabase 관리형 기능을 최대한 활용하는 구조로 전면 개정한다. **본 문서 자체는 설계 산출물이며, 실제 구현은 15개 설계 문서 승인 후 착수한다.**
>
> **v2.1 (2026-08-05, Phase 1 진행 방향 결정사항 반영)**: MVP 단계에서 Supabase Edge Functions + pg_cron 도입을 보류하고, 동일 기능(당첨확인 배치·통계 갱신·알림 발송)을 Next.js API Route 내 동기 처리로 구현하도록 아키텍처를 조정했다(§1, §2, §4.3, §4.4, §5). 도입 시점은 Phase 5 이후 실제 자동화 요구가 발생할 때로 명시했다. Free Tier 기준 비용 전략을 §10에 신설했다.

---

## 1. 기술 스택 (개정)

| 영역 | v1.0 제안 | v2.0 개정 | 개정 사유 |
|---|---|---|---|
| 프론트엔드 | Next.js | Next.js (유지) | SSG/SSR 혼합, [[SEO_STRATEGY]] 요구사항 충족 |
| 백엔드 | Node.js 별도 서버 검토 | **Next.js API Routes** (MVP), Supabase Edge Functions는 Phase5 이후 자동화 요구 시 추가 | 별도 서버 운영 부담 제거, 1인 개발 원칙(§4.3 Edge Function/Cron 도입 원칙) |
| 데이터베이스 | PostgreSQL | **Supabase(PostgreSQL)** | Auth/Storage/Realtime 통합 관리 |
| 인증 | 카카오 OAuth + 자체 세션 | **Supabase Auth + 카카오 커스텀 연동** | §3 참조, 세션관리 자체 구현 불필요 |
| 캐시/실시간 | ~~Redis Pub/Sub~~ | **Supabase Realtime (Postgres CDC)** | 별도 인프라 제거, [[DATABASE_SCHEMA]] §8 |
| 파일 저장 | S3 호환 스토리지 | **Supabase Storage** | 별도 계정/과금 관리 불필요 |
| 배치/스케줄러 | 별도 워커(BullMQ) | **MVP: Next.js API Route 내 동기 처리** (관리자 액션이 트리거) | 서버 상시 구동 불필요. Edge Functions+pg_cron은 Phase5 이후 실제 자동화 요구 발생 시 도입(§4.3, 신규 원칙 2026-08-05) |
| 알림 확장 | 카카오 알림톡(Phase2) | 이메일(Resend 등) + 웹푸시(MVP) → 카카오 알림톡/SMS(사업자등록 후) | [[FEATURE_SPEC]] §10 |
| 배포/인프라 | Vercel/AWS | Vercel(프론트) + Supabase(백엔드 일체) | 관리 포인트를 2곳으로 최소화 |

## 2. 아키텍처 개요 (개정)

```
[클라이언트: Web(반응형), 카카오톡 인앱브라우저 대응]
        │
[Next.js (Vercel)] ── SSG/ISR(꿈해몽/가이드/FAQ/로또명당 등 정적 콘텐츠)
        │              SSR/CSR(다이어리, 마이페이지 등 개인화 페이지, noindex)
        │
        ├── [Supabase Auth] ── 이메일 인증 기본제공 + 카카오 커스텀 연동(§3)
        │
        ├── [Supabase Postgres + RLS] ── 전체 데이터, RLS로 접근제어 ([[DATABASE_SCHEMA]] §6)
        │
        ├── [Supabase Realtime] ── 실시간 생성 로그(Phase3 재검토 시) — Redis 불필요
        │
        ├── [Next.js API Routes (서버 사이드)] ── 당첨확인 배치 / 통계 갱신 / 알림 발송 — MVP는 관리자 액션 트리거 + 동기 처리(Edge Functions+pg_cron은 Phase5 이후 도입, §4.3)
        │
        └── [Supabase Storage] ── 커뮤니티 이미지/공유카드 (`avatars`는 Phase1에서 생성하지 않음 — [[DATABASE_SCHEMA]] §5)
```

이 구조는 v1.0 대비 관리해야 할 별도 인프라(Redis, 전용 워커 서버)가 사라져, 1인 개발자가 인프라 장애 대응에 쏟는 시간을 최소화한다. MVP는 여기서 한 단계 더 나아가 Edge Functions/pg_cron 자체도 보류해, Vercel(Next.js)과 Supabase(DB/Auth/Storage) 두 관리 지점만으로 전체 백엔드를 운영한다.

## 3. 카카오 로그인 × Supabase Auth 통합 (신규 — Phase 0 필수 기술검증)

카카오는 Supabase Auth의 기본 제공 OAuth 프로바이더 목록에 없다. **이 문서에서 "카카오 로그인 연동"을 1줄로 처리했던 v1.0의 문제**([[CRITICAL_REVIEW]] D-03)를 해결하기 위해, Phase 0에서 아래 두 방식 중 하나를 실제로 검증(PoC)하고 확정한다.

- **방식 A**: 클라이언트에서 카카오 SDK로 로그인 → 서버(Next.js API Route)에서 카카오 토큰 검증 → `supabase.auth.admin.createUser`/`generateLink`로 Supabase 사용자 생성 및 세션 발급 (Edge Function이 아닌 API Route를 쓰는 이유는 §4.3 하단 원칙과 동일)
- **방식 B**: Supabase Auth의 커스텀 OIDC 프로바이더 설정으로 카카오를 등록 (카카오의 OIDC 지원 범위 확인 필요)

**PoC 완료 기준**: 실제 카카오 테스트 계정으로 로그인 → Supabase 세션 발급 → RLS(`auth.uid()`) 정책이 정상 동작하는 것까지 확인. 이 검증이 끝나기 전에는 MVP 일정에 "로그인 완료" 마일스톤을 넣지 않는다.

## 4. 핵심 기술 결정 사항 (개정)

### 4.1 렌더링 전략 — 유지
정적 콘텐츠는 SSG/ISR, 개인화 페이지(`/my/journal/*`)는 SSR/CSR + noindex.

### 4.2 실시간 로그 구현 방식 (개정)
[[FEATURE_SPEC]] §5.5에서 MVP 제외(Could)로 재분류됨에 따라, 구현 시점이 오면 Redis 대신 **Supabase Realtime의 Postgres Change 구독**을 `public_number_feed` 뷰에 연결해 구현한다. 별도 Pub/Sub 인프라가 필요 없다.

### 4.3 당첨 자동확인 배치 및 Edge Function/Cron 도입 원칙 (개정, 2026-08-05 Phase1 진행 방향 결정사항)

**MVP는 Edge Function/pg_cron을 도입하지 않는다.** 관리자가 회차 결과를 입력하는 `app/api/admin/draws/route.ts` POST 요청 안에서, 대상 회차의 `user_numbers`를 전수 조회해 대조하고 `match_count`/`win_rank`를 UPDATE하는 로직까지 **같은 요청 안에서 동기 처리**한다([[EXECUTION_PLAN]] Phase6). 별도의 Edge Function 배포·pg_cron 스케줄 등록이 필요 없다.

- **이유**: 초기 사용자 규모에서는 비동기 배치 인프라가 불필요하고, 관리자가 주 1회 결과를 입력하는 흐름 자체가 이미 트리거 역할을 하므로 별도 스케줄러가 없어도 "자동 대조"라는 Must 요구사항([[ROADMAP]] §1)은 그대로 만족된다. Edge Function을 별도로 두면 배포·모니터링·에러 추적 지점이 하나 늘어나 1인 개발 부담이 커진다.
- **도입 시점**: [[ROADMAP]] Phase 5(쇼핑몰) 이후, 아래와 같은 실제 자동화 요구가 발생하면 그때 Supabase Edge Functions + pg_cron을 도입한다.
  - 로또 당첨번호 자동 수집(공공데이터 API 연동, [[EXECUTION_PLAN]] §11 관리 자동화 로드맵)
  - `user_numbers` 당첨 확인 배치가 동기 처리로 감당하기 어려울 만큼 사용자/데이터가 증가한 경우
  - 알림 발송이 요청-응답 흐름과 분리되어야 할 만큼 채널/물량이 늘어난 경우
  - `user_period_stats` 등 통계 배치의 스케줄 실행이 필요한 경우
- **현재 유지 사항**: DB 구조(`user_numbers`, `notifications`/`notification_deliveries`, `user_period_stats` 등)는 나중에 Edge Function 기반 배치로 전환해도 스키마 변경 없이 그대로 재사용 가능하도록 이미 설계되어 있다([[DATABASE_SCHEMA]]) — 지금은 그 데이터를 채우는 실행 방식(동기 vs 비동기)만 MVP에 맞게 단순화한다.
- 대용량 대비 `target_round` 파티셔닝은 실제 데이터 규모가 커졌을 때(Phase 3 이후) 검토 — MVP 단계에서는 불필요한 최적화다.

### 4.4 카카오 공유 — 유지 (Edge Function 표현 조정)
카카오 JS SDK Feed 템플릿을 사용한다. 동적 OG 이미지 생성은 `share_cards` 기능이 실제로 구현되는 Phase에서 Next.js Route Handler(`next/og` 등)로 생성 후 Supabase Storage(`share-cards` 버킷)에 저장하는 방식을 우선 검토한다 — Edge Function 없이도 Vercel 런타임에서 처리 가능하다면 그쪽을 우선한다(§4.3 원칙과 동일한 이유).

### 4.5 검색/자동완성 — 유지
PostgreSQL Full-Text Search(`pg_trgm`)로 MVP~중기까지 충분 ([[DATABASE_SCHEMA]] §8).

## 5. 보안 설계 원칙 (개정 — RLS 중심으로 재정렬)

- **모든 테이블 RLS 활성화가 기본값**이다 ([[DATABASE_SCHEMA]] §6 정책표를 그대로 구현). 예외를 두는 테이블(공개 콘텐츠)만 명시적으로 전체 SELECT를 허용한다.
- 관리자 전용 작업(회차 입력, 콘텐츠 발행 등)은 `service_role` 키를 사용하는 서버 사이드(**Next.js API Route** — MVP는 Edge Function을 쓰지 않는다, §4.3)에서만 수행하고, 클라이언트에 `service_role` 키를 절대 노출하지 않는다.
- 개인정보(생년월일 등)는 `profiles` 테이블에만 저장하고, 공개 노출용 데이터는 별도 뷰(`public_profiles`)로 분리해 실수로 인한 노출 경로를 원천 차단한다 ([[DATABASE_SCHEMA]] §3.1).
- 커뮤니티 스팸/XSS 방지: 입력값 sanitize, Rate limiting(Next.js 미들웨어/API Route 레벨).

## 6. 성능 목표 — 유지

LCP 2.5초, INP 200ms, CLS 0.1, 번호생성 응답 1초 이내.

## 7. 테스트 전략 — 유지 + 추가

- **RLS 정책 테스트를 신규 필수 항목으로 추가**: 각 테이블에 대해 "본인 데이터만 보이는지 / 타인 데이터가 절대 보이지 않는지"를 자동화 테스트로 검증. 1인 개발 환경에서는 보안 결함을 코드 리뷰로 잡아줄 동료가 없으므로 이 테스트가 사실상 유일한 안전망이다.
- 당첨 매칭 로직 경계값 테스트는 유지.

## 8. 단계별 구현 순서 (개정 — [[ROADMAP]] Phase와 정합)

1. Supabase 프로젝트 셋업 + 카카오×Auth PoC (Phase 0)
2. RLS 정책 전체 적용 + 핵심 스키마 구축 ([[DATABASE_SCHEMA]])
3. 번호생성 + 로그인 + 다이어리 최소버전(히스토리+당첨확인) (Phase 1 Must)
4. 이메일/웹푸시 알림, 꿈해몽/운세 최소버전 (Phase 1 Should)
5. 다이어리 고도화(캘린더/통계/연말리포트) (Phase 3)
6. 커뮤니티/배틀/친구초대 (Phase 4)
7. 쇼핑몰/입점/멤버십 (Phase 5~7)
8. 자동화 파이프라인(당첨번호 API, AI 콘텐츠 초안) 고도화 (Phase 8, 지속)

## 9. 모니터링/운영 (개정)

- 에러 트래킹 도구(Sentry 무료 티어 등) 도입 — 1인 운영자가 장애를 가장 먼저 인지할 수 있는 유일한 장치.
- 당첨확인 처리는 MVP에서 관리자 요청에 동기 처리되므로, 실패 시 API 응답으로 즉시 확인 가능하다(§4.3). Phase5 이후 Edge Function+pg_cron 비동기 배치로 전환하면, 그 시점부터 배치 실패를 관리자 본인에게 이메일/웹푸시로 즉시 알리는 별도 채널이 필요해진다([[FEATURE_SPEC]] §10 알림 시스템 채널 재사용 예정).
- Supabase 대시보드의 기본 모니터링(쿼리 성능, 스토리지 사용량)을 우선 활용하고, 별도 모니터링 스택 구축은 트래픽이 실제로 커졌을 때 검토한다 ([[MASTER_PRD]] 원칙 5).

## 10. Supabase 비용 전략 (신규, 2026-08-05 Phase 1 진행 방향 결정사항)

**Free Tier 기준으로 MVP 출시 및 초기 검증을 진행한다.** [[MASTER_PRD]] §3 원칙4(유지보수 비용 최소화)·원칙5(확장성보다 현실성)를 비용 측면에서 구체화한 것이다.

### 10.1 원칙
- 초기 비용을 최소화한다 — Supabase Free Tier, Vercel Hobby/Free 범위 안에서 MVP를 완성하는 것을 기본 목표로 삼는다.
- 트래픽이 발생하기 전에 과잉 최적화하지 않는다 — "언젠가 트래픽이 늘면 필요할 것"이라는 이유만으로 지금 인프라를 늘리지 않는다([[AI_ENGINEERING_CONSTITUTION]] §15-21과 동일한 원칙).
- Pro 플랜 전환은 실제 사용량이 Free Tier 한도에 근접했을 때(Supabase 대시보드 사용량 지표 기준)만 검토한다 — 미리 전환하지 않는다.

### 10.2 지금 적용하는 것
- FK 컬럼 기본 인덱스([[DATABASE_SCHEMA]] §8) — 쿼리 비용(DB 연산량)을 낮춰 Free Tier의 컴퓨팅 한도를 아낀다.
- 목록/피드성 조회는 처음부터 pagination을 고려해 설계한다(무제한 전체 조회로 응답 크기·DB 부하가 커지는 것을 방지).
- Storage 버킷을 용도별로 분리한다([[DATABASE_SCHEMA]] §5) — 버킷별 접근 정책·정리 기준을 명확히 해 불필요한 저장 용량 누적을 막는다.
- 불필요한 로그를 저장하지 않는다 — 디버깅에 필요한 최소한만 남기고, 사용자 행동을 광범위하게 수집·적재하는 로그 테이블은 만들지 않는다(개인정보 최소수집 원칙과도 연결, [[AI_ENGINEERING_CONSTITUTION]] §11).

### 10.3 지금 적용하지 않는 것
- Redis — 캐시/실시간 기능은 Supabase Realtime(Postgres CDC)으로 대체(§2, [[DATABASE_SCHEMA]] §8).
- Elasticsearch — 검색은 PostgreSQL `pg_trgm`으로 MVP~중기까지 충분(§4.5).
- 별도 cache layer — 개인별 데이터는 규모가 작아 즉시 쿼리해도 무방하며, 필요한 곳(연말 리포트 등)만 DB 내 캐시 테이블(`user_period_stats`)로 최소 대응한다([[DATABASE_SCHEMA]] §3.8).
- DB replication — 1인 개발 초기 트래픽 규모에서는 불필요. 실제 읽기 부하가 커지는 시점에 Supabase의 Read Replica 등 관리형 옵션을 먼저 검토한다.
- Edge Functions + pg_cron — §4.3 참조. 별도 비용 발생 지점이자 관리 지점이므로 Phase5 이후로 도입을 미룬다.
