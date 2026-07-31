# IMPLEMENTATION PLAN — 기술 구현 계획 (Supabase 네이티브 개정판)

> v2.0. [[MASTER_PRD]] §3 원칙(유지보수 비용 최소화, 확장성보다 현실성)에 따라 별도 인프라(Redis, 전용 워커 서버) 의존을 제거하고 Supabase 관리형 기능을 최대한 활용하는 구조로 전면 개정한다. **본 문서 자체는 설계 산출물이며, 실제 구현은 15개 설계 문서 승인 후 착수한다.**

---

## 1. 기술 스택 (개정)

| 영역 | v1.0 제안 | v2.0 개정 | 개정 사유 |
|---|---|---|---|
| 프론트엔드 | Next.js | Next.js (유지) | SSG/SSR 혼합, [[SEO_STRATEGY]] 요구사항 충족 |
| 백엔드 | Node.js 별도 서버 검토 | **Supabase Edge Functions + Next.js API Routes** | 별도 서버 운영 부담 제거, 1인 개발 원칙 |
| 데이터베이스 | PostgreSQL | **Supabase(PostgreSQL)** | Auth/Storage/Realtime 통합 관리 |
| 인증 | 카카오 OAuth + 자체 세션 | **Supabase Auth + 카카오 커스텀 연동** | §3 참조, 세션관리 자체 구현 불필요 |
| 캐시/실시간 | ~~Redis Pub/Sub~~ | **Supabase Realtime (Postgres CDC)** | 별도 인프라 제거, [[DATABASE_SCHEMA]] §8 |
| 파일 저장 | S3 호환 스토리지 | **Supabase Storage** | 별도 계정/과금 관리 불필요 |
| 배치/스케줄러 | 별도 워커(BullMQ) | **Supabase Edge Functions + pg_cron** | 서버 상시 구동 불필요, 관리 부담 최소화 |
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
        ├── [Supabase Edge Functions + pg_cron] ── 당첨확인 배치 / 통계 갱신 / 알림 발송
        │
        └── [Supabase Storage] ── 아바타/커뮤니티 이미지/공유카드 ([[DATABASE_SCHEMA]] §5)
```

이 구조는 v1.0 대비 관리해야 할 별도 인프라(Redis, 전용 워커 서버)가 사라져, 1인 개발자가 인프라 장애 대응에 쏟는 시간을 최소화한다.

## 3. 카카오 로그인 × Supabase Auth 통합 (신규 — Phase 0 필수 기술검증)

카카오는 Supabase Auth의 기본 제공 OAuth 프로바이더 목록에 없다. **이 문서에서 "카카오 로그인 연동"을 1줄로 처리했던 v1.0의 문제**([[CRITICAL_REVIEW]] D-03)를 해결하기 위해, Phase 0에서 아래 두 방식 중 하나를 실제로 검증(PoC)하고 확정한다.

- **방식 A**: 클라이언트에서 카카오 SDK로 로그인 → 서버(Edge Function)에서 카카오 토큰 검증 → `supabase.auth.admin.createUser`/`generateLink`로 Supabase 사용자 생성 및 세션 발급
- **방식 B**: Supabase Auth의 커스텀 OIDC 프로바이더 설정으로 카카오를 등록 (카카오의 OIDC 지원 범위 확인 필요)

**PoC 완료 기준**: 실제 카카오 테스트 계정으로 로그인 → Supabase 세션 발급 → RLS(`auth.uid()`) 정책이 정상 동작하는 것까지 확인. 이 검증이 끝나기 전에는 MVP 일정에 "로그인 완료" 마일스톤을 넣지 않는다.

## 4. 핵심 기술 결정 사항 (개정)

### 4.1 렌더링 전략 — 유지
정적 콘텐츠는 SSG/ISR, 개인화 페이지(`/my/journal/*`)는 SSR/CSR + noindex.

### 4.2 실시간 로그 구현 방식 (개정)
[[FEATURE_SPEC]] §5.5에서 MVP 제외(Could)로 재분류됨에 따라, 구현 시점이 오면 Redis 대신 **Supabase Realtime의 Postgres Change 구독**을 `public_number_feed` 뷰에 연결해 구현한다. 별도 Pub/Sub 인프라가 필요 없다.

### 4.3 당첨 자동확인 배치 (개정)
Supabase Edge Function을 pg_cron 또는 관리자의 "확인" 액션으로 트리거. 대상 회차의 `user_numbers`를 페이지 단위로 스캔. 대용량 대비 `target_round` 파티셔닝은 실제 데이터 규모가 커졌을 때(Phase 3 이후) 검토 — MVP 단계에서는 불필요한 최적화다.

### 4.4 카카오 공유 — 유지
카카오 JS SDK Feed 템플릿, 동적 OG 이미지는 Edge Function으로 생성 후 Supabase Storage(`share-cards` 버킷)에 저장.

### 4.5 검색/자동완성 — 유지
PostgreSQL Full-Text Search(`pg_trgm`)로 MVP~중기까지 충분 ([[DATABASE_SCHEMA]] §8).

## 5. 보안 설계 원칙 (개정 — RLS 중심으로 재정렬)

- **모든 테이블 RLS 활성화가 기본값**이다 ([[DATABASE_SCHEMA]] §6 정책표를 그대로 구현). 예외를 두는 테이블(공개 콘텐츠)만 명시적으로 전체 SELECT를 허용한다.
- 관리자 전용 작업(회차 입력, 콘텐츠 발행 등)은 `service_role` 키를 사용하는 서버 사이드(Edge Function)에서만 수행하고, 클라이언트에 `service_role` 키를 절대 노출하지 않는다.
- 개인정보(생년월일 등)는 `profiles` 테이블에만 저장하고, 공개 노출용 데이터는 별도 뷰(`public_profiles`)로 분리해 실수로 인한 노출 경로를 원천 차단한다 ([[DATABASE_SCHEMA]] §3.1).
- 커뮤니티 스팸/XSS 방지: 입력값 sanitize, Rate limiting(Supabase Edge Function 또는 Next.js 미들웨어 레벨).

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
- 당첨확인 배치 실패 시 관리자 본인에게 이메일/웹푸시로 즉시 알림 (§10 알림 시스템과 동일 채널 재사용).
- Supabase 대시보드의 기본 모니터링(쿼리 성능, 스토리지 사용량)을 우선 활용하고, 별도 모니터링 스택 구축은 트래픽이 실제로 커졌을 때 검토한다 ([[MASTER_PRD]] 원칙 5).
