# EXECUTION_PLAN.md — 1인 개발자 실행 청사진

> 목적: 이 문서 하나만 보고 처음부터 끝까지 개발할 수 있게 만든다. "다음에 뭘 만들어야 하지?"라는 고민이 생기면, 그건 이 문서가 아니라 지금 하는 작업이 잘못됐다는 신호다 — 이 문서 순서대로 돌아온다.
>
> 전제 문서: [[MASTER_PRD]] · [[ROADMAP]] · [[FEATURE_SPEC]] · [[DATABASE_SCHEMA]] · [[IMPLEMENTATION_PLAN]] · [[DESIGN_SYSTEM]] · [[UI_UX_GUIDELINE]] · [[SEO_STRATEGY]] · [[ADMIN_REQUIREMENTS]] · [[SITEMAP]] · [[INFORMATION_ARCHITECTURE]]
>
> **코드는 작성하지 않는다. 파일 경로, 목적, 순서, 완료 기준만 정의한다.**

---

## 0. 이 문서를 쓰는 법

1. Phase는 반드시 순서대로 진행한다. Phase를 건너뛰거나 여러 Phase를 동시에 벌이지 않는다.
2. 각 Phase의 "완료 기준"을 전부 충족하기 전에는 다음 Phase로 넘어가지 않는다.
3. 각 Phase가 끝나면 앱은 **항상 실제로 동작하는 상태**여야 한다(Phase0에서 만든 Vercel 자동배포 기준, 로컬이 아니라 배포된 URL로 확인하는 것을 기본으로 한다).
4. **막혔을 때의 규칙**: 같은 Phase에서 3일 이상 진행이 안 되면, 그 Phase 안의 기능을 Must만 남기고 나머지(Should/Could)는 다음 사이클로 미룬 뒤 일단 다음 Phase로 넘어간다. 완벽을 기다리다 아무것도 못 내는 것이 가장 큰 리스크다 ([[MASTER_PRD]] §3 원칙 5).
5. 코드를 짜기 전에 항상 해당 Phase의 "왜 지금 이 Phase인가"를 다시 읽는다 — 순서에는 전부 이유가 있다.

## 1. 전체 Phase 로드맵 개요

| Phase | 이름 | 예상 시간 | 이 시점에 동작하는 것 |
|---|---|---|---|
| 0 | 프로젝트 초기 설정 | 1~2일 | 빈 화면이지만 배포 파이프라인이 도는 앱 |
| 1 | DB 구축 | 3~4일 | 데이터는 있지만 화면이 없는 안전한 DB |
| 2 | Authentication | 4~6일 | 카카오로 로그인/로그아웃이 되는 앱 |
| 3 | 공통 UI | 5~7일 | 로그인 상태를 보여주는, 스타일이 갖춰진 앱 |
| 4 | 행운 다이어리 (틀) | 3~4일 | 빈 다이어리를 볼 수 있는 앱 |
| 5 | 번호 생성 | 3일 | 번호를 뽑고 다이어리에 쌓이는 앱 |
| 6 | 당첨 확인 | 4~5일 | **MVP Must 핵심 루프 완성** — 생성→저장→당첨확인이 도는 앱 |
| 7 | 꿈해몽 | 4~5일(+콘텐츠 2~3일) | 검색 유입 콘텐츠가 붙은 앱 |
| 8 | SEO | 3일 | 검색엔진이 색인하기 시작하는 앱 |
| 9 | 관리자 | 4~5일 | 코드를 안 건드리고 운영 가능한 앱 |
| 10 | 배포 | 3~4일 | 실사용자에게 정식 오픈된 앱 |

**Phase 0~6 (약 24~31일, 5~6주)** = [[ROADMAP]] Phase 1 "MVP Must" 목표와 정합. **Phase 7~10 (약 14~17일, 3주 내외)** = MVP Should까지 포함한 정식 오픈 준비. 전체 합산 약 **8~9주** (하루 3~4시간, 주 5일 작업 기준 — 개인 역량과 막힘 여부에 따라 변동). Phase3(공통 UI)이 가장 시간이 많이 드는 구간이므로, 일정이 밀리면 UI 컴포넌트 라이브러리(예: shadcn/ui류) 활용으로 단축하는 것을 최우선으로 고려한다.

## 2. 전체 순서 논리 (왜 이 순서인가 — 요약)

```
Phase0 도구/구조 확정
   ↓ (그릇이 있어야 뭘 넣을지 정할 수 있다)
Phase1 DB+RLS 확정
   ↓ (누가 접근하는지 알아야 RLS가 의미있다)
Phase2 인증
   ↓ (로그인 상태가 있어야 화면 분기를 설계할 수 있다)
Phase3 공통 UI
   ↓ (다이어리부터 만들어 "그릇"을 먼저 완성 — MASTER_PRD §0 철학을 코드 순서에 반영)
Phase4 다이어리(틀)
   ↓ (그릇에 담을 첫 콘텐츠 — 가장 로직이 단순함)
Phase5 번호생성
   ↓ (MVP Must 마지막 조각)
Phase6 당첨확인
   ↓ (Must 루프 완성 후 콘텐츠형 기능으로 확장)
Phase7 꿈해몽
   ↓ (콘텐츠가 있어야 SEO가 의미있다)
Phase8 SEO
   ↓ (기능이 다 있어야 운영화면이 의미있다)
Phase9 관리자
   ↓ (마지막 실사용 점검)
Phase10 배포
```

---

## Phase 0 — 프로젝트 초기 설정

**왜 지금**: 아무것도 없는 상태에서 도구와 규칙을 먼저 고정해야 한다. 1인 개발자는 "나중에 정리하자"가 통하지 않는다 — 정리해줄 동료가 없다. 폴더 구조를 나중에 바꾸면 이후 모든 Phase의 import 경로를 다시 손봐야 하므로, 지금 확정한다.

1. **목표**: 로컬 개발 환경, 저장소, 배포 파이프라인, 코드 스타일, 폴더 구조, 공통 타입/상수/유틸의 뼈대를 완성해 "다음 기능부터는 바로 코드를 짤 수 있는 상태"를 만든다.

2. **선행 조건**: GitHub/Vercel/Supabase/카카오 개발자 계정 보유, Node.js LTS 설치, 설계 문서 15종 승인 완료(완료됨).

3. **생성할 파일**:
   - `README.md`, `.gitignore`, `.env.example`(키 목록만: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `NEXT_PUBLIC_KAKAO_JS_KEY`, `NEXT_PUBLIC_SITE_URL`), `.env.local`(실값, 미커밋)
   - `next.config.ts`, `tsconfig.json`, `.eslintrc`/`eslint.config.mjs`, `.prettierrc`, `.prettierignore`, `package.json`
   - `vitest.config.ts` (단위테스트 프레임워크 — Phase5/6에서 순수함수 테스트에 사용)
   - `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
   - `components/ui/.gitkeep`, `components/layout/.gitkeep`
   - `lib/supabase/client.ts`, `lib/supabase/server.ts` (이 시점엔 초기화 껍데기만)
   - `lib/constants/index.ts`, `lib/types/index.ts`, `lib/utils/index.ts` (빈 export만)
   - `proxy.ts` (껍데기, Phase2에서 채움 — Next.js 16부터 구 `middleware.ts` 컨벤션이 `proxy.ts`로 개명되었다. export 함수명도 `middleware` → `proxy`. 문서 전반의 "미들웨어"라는 표현은 개념을 가리키며, 실제 파일/함수명은 `proxy`를 따른다.)

4. **수정할 파일**: 없음(최초 생성).

5. **구현 순서**:
   1. GitHub private 리포지토리 생성 → 로컬 clone
   2. Next.js(App Router, TypeScript) 프로젝트 생성 ([[IMPLEMENTATION_PLAN]] 스택 기준)
   3. ESLint/Prettier 설정 및 저장 시 자동 포맷 연동
   4. Vitest 설치 및 최소 샘플 테스트 1개로 동작 확인
   5. 폴더 구조 스캐폴딩(§3 목록대로 빈 파일 생성)
   6. Supabase 프로젝트 생성(한국 사용자 대상이므로 지연시간 고려해 리전 선택)
   7. `.env.local`에 Supabase URL/anon key 입력
   8. Vercel에 GitHub 리포지토리 연결, 환경변수 등록, 첫 배포(placeholder 페이지) 확인, Preview Deployment 활성화(브랜치별 자동 미리보기)
   9. 카카오 개발자 콘솔에 앱 등록(키만 확보, 연동은 Phase2)

6. **완료 기준**:
   - `main` push 시 Vercel 자동배포 및 placeholder 화면 정상 표시
   - `lint`/`format`/`test`(샘플) 명령 에러 없이 실행
   - 로컬에서 Supabase 연결 테스트(간단 쿼리) 성공
   - `.env.example`에 필요한 키 전부 문서화

7. **예상 작업시간**: 1~2일

8. **의존성**: 없음

9. **주의사항**:
   - `.env.local` 절대 커밋 금지
   - `SUPABASE_SERVICE_ROLE_KEY`에 `NEXT_PUBLIC_` 접두사 절대 금지(클라이언트 노출 시 DB 전체 노출, [[IMPLEMENTATION_PLAN]] §5)
   - 폴더 구조는 지금 확정하고 이후 바꾸지 않는다

10. **체크리스트**:
    - [x] GitHub repo + 첫 커밋 (원격 연결 및 `main` push 완료, `origin` = `time-is-goldd/lotto`)
    - [x] Next.js 로컬 실행 확인 (build 성공, 커스텀 홈 화면 확인)
    - [x] ESLint/Prettier/Vitest 동작 확인 (전부 경고 없이 통과)
    - [x] Supabase 프로젝트 생성 및 연결 테스트 — `.env.local`에 실제 값 적용, REST(`/rest/v1/`)·Auth(`/auth/v1/settings`) 엔드포인트에 anon/service key 인증 확인(무인증 요청은 401)
    - [x] Vercel 배포 + Preview Deployment 확인 — 프로젝트 연결, 환경변수 7개 등록, Production 빌드 성공 확인
    - [x] 카카오 개발자 앱 등록(키 확보) — 앱 키 발급 및 `.env.local` 반영. Redirect URI(`/auth/callback`)는 README "환경변수 설정" 참조, 실제 로그인 연동은 Phase 2
    - [x] 폴더 구조 스캐폴딩 완료
    - [x] `.env.example` 문서화 완료

---

## Phase 1 — DB 구축

**왜 지금**: 인증도 UI도 결국 데이터를 저장/조회해야 의미가 있다. Supabase RLS는 DB 레벨에서 동작하므로, 인증 로직을 짜기 전에 테이블과 RLS가 먼저 존재해야 Phase2에서 "로그인한 사람만 자기 데이터를 본다"를 검증할 수 있다. 순서를 반대로 하면 RLS 없는 상태로 앱을 만들다 나중에 구멍을 막는 위험한 패턴이 된다 ([[CRITICAL_REVIEW]] D-01 재발 방지).

1. **목표**: MVP(Must+Should, [[ROADMAP]] §1) 전체 테이블·RLS·Storage·시드 데이터를 완성한다.

2. **선행 조건**: Phase 0 완료(Supabase 프로젝트 존재)

3. **생성할 파일**:
   - `supabase/migrations/0001_profiles.sql`
   - `supabase/migrations/0002_draws_user_numbers.sql`
   - `supabase/migrations/0003_dream_tables.sql` (dreams, dream_number_mappings, dream_journal_entries)
   - `supabase/migrations/0004_fortune_results.sql`
   - `supabase/migrations/0005_user_period_stats.sql`
   - `supabase/migrations/0006_notifications.sql` (notifications, notification_deliveries)
   - `supabase/migrations/0007_winning_cases_stores.sql` (Should 대비 선반영)
   - `supabase/migrations/0008_rls_policies.sql`
   - `supabase/migrations/0009_storage_buckets.sql`
   - `supabase/seed.sql`
   - `lib/types/database.ts` (`supabase gen types typescript` 결과 저장 위치)

4. **수정할 파일**: `lib/supabase/client.ts`, `lib/supabase/server.ts` (DB 타입 제네릭 연결)

5. **구현 순서** (테이블 생성 순서 — 의존관계 역행 방지):
   1. `profiles` (auth.users 참조, 최상위 신원 테이블)
   2. `draws` (독립 테이블)
   3. `user_numbers` (profiles·draws 참조) — MVP 핵심
   4. `dreams`, `dream_number_mappings` (독립 콘텐츠 테이블)
   5. `dream_journal_entries` (profiles·dreams 참조)
   6. `fortune_results` (profiles 참조)
   7. `user_period_stats` (profiles 참조)
   8. `notifications`, `notification_deliveries` (profiles 참조)
   9. `winning_cases`, `stores`, `store_win_records` (Should, 지금 미리 생성해두어 나중에 마이그레이션 파일을 또 만드는 수고를 던다)
   10. RLS 정책 전체 적용 ([[DATABASE_SCHEMA]] §6 표 그대로)
   11. Storage 버킷 생성(`avatars`, `share-cards` — MVP 필요분만)
   12. Seed 데이터: 최근 회차 `draws` 10~20건, `dreams` 5~10건(테스트용)

6. **완료 기준**:
   - Supabase 대시보드에 MVP 전체 테이블 존재
   - 전체 테이블 RLS 활성화 확인 + SQL Editor에서 익명 키로 타인 데이터 비노출 실제 테스트 완료
   - `avatars`, `share-cards` 버킷 생성 및 정책 적용
   - DB 타입 생성 및 코드 연결 완료
   - seed 데이터 존재

7. **예상 작업시간**: 3~4일

8. **의존성**: Phase 0

9. **주의사항**:
   - RLS를 "나중에 켜자"고 미루지 않는다 — 테이블 생성과 RLS를 같은 작업 세트로 묶는다
   - `user_numbers.numbers` CHECK 제약(6개, 1~45, 중복없음)을 반드시 포함 ([[DATABASE_SCHEMA]] §3.3)
   - 이미 적용한 마이그레이션 파일은 수정하지 않고 항상 새 파일을 추가한다

10. **체크리스트**:
    - [ ] 전체 테이블 생성(profiles~store_win_records)
    - [ ] 전체 RLS 적용 및 실제 테스트
    - [ ] Storage 버킷 생성
    - [ ] Seed 데이터 삽입
    - [ ] DB 타입 생성 및 연결

---

## Phase 2 — Authentication

**왜 지금**: DB와 RLS가 준비됐으니 이제 "누가 요청하는지"를 알아야 RLS가 실제로 의미를 가진다. 카카오 연동은 기술적으로 자명하지 않으므로([[IMPLEMENTATION_PLAN]] §3), 이 단계에서 가장 먼저 리스크를 확인한다 — 뒤로 미룰수록 발견이 늦어져 일정 리스크가 커진다.

1. **목표**: 카카오 로그인으로 가입/로그인이 가능하고, 세션이 안전하게 유지되며, 로그인 여부에 따라 접근이 제어되는 상태를 만든다.

2. **선행 조건**: Phase 1 완료(profiles·RLS 존재)

3. **생성할 파일**:
   - `app/(auth)/login/page.tsx`
   - `app/(auth)/auth/callback/route.ts`
   - `app/(auth)/auth/kakao/route.ts`
   - `lib/auth/kakao.ts`, `lib/auth/session.ts`, `lib/auth/getCurrentUser.ts`
   - `app/api/profile/route.ts` (최초 로그인 시 profiles 생성/갱신)
   - `components/auth/AgeVerificationModal.tsx` (**Must**, [[FEATURE_SPEC]] §9.3)
   - `components/auth/LoginButton.tsx`

4. **수정할 파일**:
   - `proxy.ts` (세션 갱신 + `/my/*`, `/admin/*` 접근 제어)
   - `lib/supabase/server.ts` (쿠키 기반 세션 연결)
   - `app/layout.tsx` (전역 인증 상태 연결)

5. **구현 순서**:
   1. [[IMPLEMENTATION_PLAN]] §3의 카카오×Supabase Auth 통합 방식(A/B) **최종 확정** — 미확정 상태로는 다음 단계 진행 불가
   2. 카카오 개발자 콘솔 Redirect URI/동의항목(닉네임·프로필만) 설정
   3. 이메일 로그인(Supabase Auth 기본 제공)을 먼저 연결해 인증 배관 자체를 검증
   4. 카카오 로그인 플로우 구현
   5. 최초 로그인 시 `profiles` 자동 생성
   6. 19세 미만 이용제한 체크 + 서버 검증 로직 삽입 (**Must**)
   7. `proxy.ts`에서 보호 경로 리다이렉트 구현
   8. 로그아웃 구현

6. **완료 기준**:
   - 카카오 가입 시 `profiles` 레코드 및 `age_verified` 정상 기록
   - 새로고침 후에도 로그인 유지
   - 비로그인 상태로 보호 경로 접근 시 `/login` 리다이렉트
   - RLS가 실제 세션 기준으로 정상 동작
   - 이메일 로그인 폴백 정상 동작

7. **예상 작업시간**: 4~6일 (가장 리스크 큰 Phase)

8. **의존성**: Phase 1

9. **주의사항**:
   - 카카오 연동이 막히면 방식 A/B 중 하나로 조기 전환 결정(둘 다 붙잡고 시간 끌지 않기)
   - `service_role` 키는 서버 라우트에서만 사용, 클라이언트 번들 포함 여부 반드시 확인
   - 19세 미만 제한은 체크박스만이 아니라 서버 검증까지 필수

10. **체크리스트**:
    - [ ] 카카오×Supabase 통합 방식 확정 및 PoC 성공
    - [ ] 이메일 로그인 동작 확인
    - [ ] 카카오 로그인 동작 확인
    - [ ] profiles 자동 생성 확인
    - [ ] 19세 미만 검증(클라이언트+서버) 확인
    - [ ] middleware 리다이렉트 확인
    - [ ] 로그아웃 확인
    - [ ] RLS 재검증(실 세션 기준)

---

## Phase 3 — 공통 UI

**왜 지금**: 인증까지 끝났으니 화면을 만들 차례다. 개별 기능 화면을 각자 따로 만들면 버튼·카드 스타일이 기능마다 미묘하게 달라진다. 재사용 컴포넌트를 먼저 만들면 Phase4 이후 모든 화면 작업 속도가 빨라진다 — [[DESIGN_SYSTEM]]을 실제 코드로 옮기는 단계다.

1. **목표**: [[DESIGN_SYSTEM]]/[[UI_UX_GUIDELINE]]의 토큰·컴포넌트를 코드로 구현하고 전체 레이아웃을 완성한다.

2. **선행 조건**: Phase 2 완료(헤더에 로그인 상태 표시 필요)

3. **생성할 파일** (Theme/Layout/Navigation/컴포넌트 그룹):
   - **Theme**: `app/globals.css`의 `@theme` 블록(색상/폰트/간격 토큰, [[DESIGN_SYSTEM]] §1~3) — Phase 0에서 Tailwind v4로 세팅했으므로 v3식 `tailwind.config.ts` 대신 CSS 파일 안에서 토큰을 정의한다
   - **Layout**: `components/layout/Header.tsx`, `components/layout/Footer.tsx`
   - **Navigation**: `components/layout/BottomTabBar.tsx`(홈/번호생성/운세/다이어리/더보기, [[INFORMATION_ARCHITECTURE]] §1.2), `components/layout/MoreMenuGrid.tsx`
   - **Button**: `components/ui/Button.tsx`, `components/ui/KakaoButton.tsx`
   - **Modal**: `components/ui/Modal.tsx`
   - **Toast**: `components/ui/Toast.tsx`, `lib/hooks/useToast.ts`
   - **Card**: `components/ui/Card.tsx`, `components/ui/LottoBall.tsx`([[DESIGN_SYSTEM]] §4.2 시그니처 컴포넌트)
   - **Loading/Skeleton**: `components/ui/LoadingSpinner.tsx`, `components/ui/Skeleton.tsx`
   - **Empty/Error**: `components/ui/EmptyState.tsx`, `components/ui/ErrorState.tsx`
   - **Typography**: `components/ui/Typography.tsx`
   - **온보딩**: `components/onboarding/OnboardingSlides.tsx`([[UI_UX_GUIDELINE]] §13.1)

4. **수정할 파일**: `app/layout.tsx`(Header/Footer/BottomTabBar 배치)

5. **구현 순서**:
   1. 디자인 토큰(색상/폰트/간격) — 이후 모든 컴포넌트가 참조하므로 최우선
   2. Typography → Button → Card → LottoBall
   3. Toast → Modal → LoadingSpinner → Skeleton
   4. EmptyState → ErrorState
   5. Header(로그인 상태 표시) → Footer → BottomTabBar → MoreMenuGrid
   6. 온보딩 슬라이드(최초 방문 판별 포함)
   7. 루트 레이아웃 조립 + 반응형(모바일 하단탭/데스크톱 GNB) 확인

6. **완료 기준**:
   - 더미 데이터로 전체 공통 컴포넌트가 임시 데모 페이지에서 정상 렌더링
   - 반응형이 [[UI_UX_GUIDELINE]] 기준(터치타겟 44px 이상, 본문 16px 이상 등) 충족
   - 로그인/비로그인 상태에 따라 헤더/탭바 정상 분기
   - 온보딩 슬라이드가 신규 사용자에게 1회만 노출

7. **예상 작업시간**: 5~7일

8. **의존성**: Phase 2, Phase 0(토큰 자리)

9. **주의사항**:
   - 이 Phase의 컴포넌트에 특정 기능 로직을 섞지 않는다(순수 UI만 — 재사용성 보존)
   - 다크모드 미구현([[DESIGN_SYSTEM]] §8, MVP 범위 아님)
   - Modal에 exit-intent 팝업 패턴을 넣지 않는다([[UI_UX_GUIDELINE]] §13.2)

10. **체크리스트**:
    - [ ] 디자인 토큰 적용
    - [ ] Button/Card/Typography/LottoBall 구현
    - [ ] Toast/Modal/Loading/Skeleton 구현
    - [ ] EmptyState/ErrorState 구현
    - [ ] Header/Footer/BottomTabBar/MoreMenuGrid 구현
    - [ ] 온보딩 슬라이드 구현
    - [ ] 반응형 점검 완료

---

## Phase 4 — 행운 다이어리 (틀)

**왜 지금**: [[MASTER_PRD]] §0 "핵심은 번호생성이 아니라 다이어리"라는 철학을 코드 순서에도 반영한다. 아직 번호생성 기능(Phase5)이 없는데 다이어리부터 만드는 게 이상해 보일 수 있지만, **다이어리의 데이터 구조와 화면 틀을 먼저 확정해두면 Phase5(번호생성)·Phase6(당첨확인)·Phase7(꿈해몽)을 만들 때마다 "이 데이터를 다이어리 어디에 꽂을지"가 이미 정해져 있어 매번 고민하지 않는다.** 그릇을 먼저 만들고 내용물을 채우는 순서다.

1. **목표**: 다이어리의 DB 조회 함수·API·화면(빈 상태 포함)을 완성해, Phase5부터는 실제 데이터가 여기 흘러들어오기만 하면 되는 상태를 만든다.

2. **선행 조건**: Phase 1(DB), Phase 2(인증), Phase 3(공통 UI) 완료

3. **생성할 파일** (DB/API/UI/페이지/컴포넌트/테스트 그룹):
   - **DB**: (Phase1에서 테이블은 이미 생성됨) `supabase/migrations/0010_journal_summary_view.sql` — 다이어리 요약 조회용 뷰(선택, 필요 시)
   - **API**: `lib/api/journal.ts`(`getHistory()`, `getResults()`, `getSummary()` 등 — 지금은 빈 배열/널 반환), `app/api/journal/summary/route.ts`(옵션)
   - **UI(공통 컴포넌트)**: `components/journal/JournalSummaryCard.tsx`, `components/journal/NumberHistoryList.tsx`, `components/journal/ResultCard.tsx`
   - **페이지**: `app/(journal)/my/journal/page.tsx`, `.../history/page.tsx`, `.../results/page.tsx`, `.../calendar/page.tsx`(Should, 최소 골격), `.../dreams/page.tsx`(Should, 골격), `.../fortune-history/page.tsx`(Should, 골격)
   - **레이아웃**: `app/(journal)/layout.tsx` (로그인 필수, 비로그인 시 가치설명 화면)
   - **타입**: `lib/types/journal.ts`
   - **테스트**: `lib/api/journal.test.ts`(빈 상태 반환값 테스트)

4. **수정할 파일**: `components/layout/BottomTabBar.tsx`("다이어리" 탭 실제 라우트 연결)

5. **구현 순서**:
   1. `lib/api/journal.ts` 함수 시그니처 확정(반환 타입 설계에 시간을 아끼지 않는다 — 이후 Phase가 이 계약을 그대로 따른다)
   2. 다이어리 홈(요약 카드) — 데이터 없을 때 EmptyState("첫 기록을 남겨보세요")
   3. 히스토리 페이지 — EmptyState + 목록 UI 틀
   4. 당첨확인 페이지 — EmptyState + 결과 카드 틀
   5. 캘린더/꿈기록/운세이력 — 최소 골격("준비 중" 허용)
   6. 비로그인 접근 시 가치설명 화면 연결

6. **완료 기준**:
   - 로그인 후 다이어리 진입 시 에러 없이 빈 상태 정상 표시
   - `lib/api/journal.ts` 함수들이 실제 DB(Phase1 테이블)를 조회하도록 연결(현재는 빈 값)
   - 비로그인 시 가치설명 화면 노출

7. **예상 작업시간**: 3~4일

8. **의존성**: Phase 1, 2, 3

9. **주의사항**:
   - "번호생성 기능도 없는데 왜 다이어리부터?"라는 의문이 들면 본 Phase 상단의 "왜 지금" 설명을 다시 읽는다
   - API 반환 타입을 확정해두지 않으면 Phase5~7에서 화면 코드를 다시 손대야 한다

10. **체크리스트**:
    - [ ] 다이어리 홈/히스토리/당첨확인 페이지 골격 완성
    - [ ] EmptyState 정상 동작
    - [ ] API 함수 시그니처 확정 및 DB 연결
    - [ ] 비로그인 가치설명 화면 연결
    - [ ] 하단탭 라우팅 연결
    - [ ] 빈 상태 테스트 통과

---

## Phase 5 — 번호 생성

**왜 지금**: 다이어리라는 그릇이 준비됐으니 그 안에 채울 첫 콘텐츠를 만든다. 번호 생성은 로직이 가장 단순한 기능(1~45 무작위 6개)이라 다이어리를 채우는 첫 기능으로 가장 적합하다.

1. **목표**: 번호를 생성하고, 로그인 상태면 자동으로 다이어리(`user_numbers`)에 기록되는 기능을 완성한다.

2. **선행 조건**: Phase 4 완료(다이어리 히스토리가 데이터를 받을 준비 완료)

3. **생성할 파일**:
   - `app/generate/page.tsx`
   - `components/lotto/NumberGenerator.tsx`, `components/lotto/NumberResultDisplay.tsx`(LottoBall 재사용)
   - `lib/logic/generateNumbers.ts`(순수 함수)
   - `lib/logic/generateNumbers.test.ts`
   - `app/api/numbers/route.ts`(POST — 생성+저장)
   - `lib/api/numbers.ts`

4. **수정할 파일**: `lib/api/journal.ts`(실데이터 반영 최종 점검), `app/(journal)/my/journal/history/page.tsx`(실데이터 렌더링 확인)

5. **구현 순서**:
   1. `generateNumbers()` 순수 함수 구현 + 단위 테스트(1~45 범위, 중복없음, 6개)
   2. `/generate` 페이지 UI(결과 노출 애니메이션, [[DESIGN_SYSTEM]] §6)
   3. 비로그인: 결과만 표시(저장 없음) + "로그인하면 다이어리에 기록돼요" 배너
   4. 로그인: `POST /api/numbers` → `user_numbers` INSERT → 다이어리 히스토리에 즉시 반영
   5. 히스토리 페이지에서 EmptyState가 실제 리스트로 전환되는지 확인

6. **완료 기준**:
   - 비로그인 생성 정상 동작(저장 없이)
   - 로그인 생성 시 다이어리 히스토리에 즉시 반영
   - CHECK 제약 위반 데이터가 생성되지 않음(테스트로 확인)

7. **예상 작업시간**: 3일

8. **의존성**: Phase 4

9. **주의사항**:
   - "당첨 확률 보장 없음" 문구 상시 노출([[FEATURE_SPEC]] §1.1)
   - 커스텀 생성(고정/제외번호, Should)은 무리해서 넣지 않는다 — 완전자동만으로 이 Phase를 끝낸다

10. **체크리스트**:
    - [ ] generateNumbers 단위 테스트 통과
    - [ ] 비로그인 생성 동작
    - [ ] 로그인 생성 + 자동 저장 동작
    - [ ] 다이어리 히스토리 실데이터 반영 확인
    - [ ] 면책 문구 노출 확인

---

## Phase 6 — 당첨 확인

**왜 지금**: 번호가 쌓이기 시작했으니 이제 당첨 여부를 확인하는 기능을 만든다. 이 Phase가 끝나면 [[ROADMAP]] MVP Must 핵심 루프(생성→저장→당첨확인)가 완성된다.

1. **목표**: 관리자가 회차 결과를 입력하면 자동 대조되어 다이어리에 반영되고, 알림이 발송되는 기능을 완성한다.

2. **선행 조건**: Phase 5 완료(대조할 `user_numbers` 존재)

3. **생성할 파일**:
   - `app/api/admin/draws/route.ts`(POST — 회차 결과 입력, 임시로 관리자 화면 없이 직접 호출 테스트 가능)
   - `supabase/functions/check-winnings/index.ts`(Edge Function — 배치)
   - `lib/logic/matchNumbers.ts`(순수 함수), `lib/logic/matchNumbers.test.ts`
   - `lib/api/notifications.ts`
   - `components/journal/WinResultBanner.tsx`

4. **수정할 파일**: `proxy.ts`(관리자 API 임시 보호), `app/(journal)/my/journal/results/page.tsx`(실데이터 연결), `lib/api/journal.ts`(결과 조회 완성)

5. **구현 순서**:
   1. `matchNumbers()` 구현 — **경계값 테스트 최우선**(5개+보너스=2등, 5개=3등 등 [[FEATURE_SPEC]] §1.3)
   2. 관리자 회차 입력 API(화면은 Phase9에서)
   3. Edge Function 배치: 회차 `user_numbers` 전수 조회 → 대조 → `match_count`/`win_rank` UPDATE
   4. 당첨자 `notifications` INSERT
   5. 다이어리 당첨확인 화면 실데이터 렌더링 + 당첨 축하 연출
   6. 사이트 내 알림(헤더 뱃지) 연동

6. **완료 기준**:
   - 테스트 데이터로 1~5등 전체 케이스 정확히 판정(자동화 테스트)
   - 관리자 입력 → 다이어리 결과 반영 확인
   - 당첨자 알림 생성 확인

7. **예상 작업시간**: 4~5일

8. **의존성**: Phase 5

9. **주의사항**:
   - 등수 판정 로직은 서비스 신뢰도와 직결 — 경계값마다 테스트 케이스 필수
   - 비회원(`user_id NULL`) 번호는 대조 대상에서 제외([[FEATURE_SPEC]] §1.3)

10. **체크리스트**:
    - [ ] matchNumbers 경계값 테스트 전체 통과
    - [ ] 회차 입력 API 동작
    - [ ] 배치 실행 후 match_count/win_rank 정확 반영
    - [ ] 당첨 알림 생성 확인
    - [ ] 다이어리 결과 화면 실데이터 확인

> **이 시점에서 [[ROADMAP]] MVP Must 전체가 완성된다.** 원한다면 여기서 한 번 소규모로 조기 오픈(비공개 베타)하는 것도 고려할 수 있다.

---

## Phase 7 — 꿈해몽

**왜 지금**: MVP Must 루프가 끝났다. 이제 Should 등급 콘텐츠 기능으로 다이어리를 확장한다. 꿈해몽은 [[SEO_STRATEGY]] 최우선 콘텐츠 클러스터이므로 이 시점부터 검색 유입 준비를 시작한다.

1. **목표**: 꿈해몽 열람, 꿈별 추천번호, 개인 꿈 기록(다이어리 연동)을 완성한다.

2. **선행 조건**: Phase 1의 dreams 계열 테이블 존재, Phase 4 다이어리 골격 존재

3. **생성할 파일**:
   - `app/dream/page.tsx`, `app/dream/[keyword]/page.tsx`, `app/dream/[keyword]/numbers/page.tsx`, `app/dream/category/[category]/page.tsx`
   - `components/dream/DreamContent.tsx`, `components/dream/DreamNumberSuggestion.tsx`
   - `components/journal/DreamJournalForm.tsx`
   - `lib/api/dreams.ts`
   - `content/dreams-seed/*.md`(코드 아님 — 시드 콘텐츠 원고 관리용)

4. **수정할 파일**: `app/(journal)/my/journal/dreams/page.tsx`(실데이터 연결), `app/generate/page.tsx`(꿈 연동 진입 쿼리파라미터 처리)

5. **구현 순서**:
   1. `dreams` 시드 콘텐츠 20~30건 작성([[CONTENT_STRATEGY]] Phase0 분량, 원고 작업)
   2. 꿈해몽 상세/카테고리 페이지
   3. 꿈별 추천번호 → `/generate?source=dream` 연동
   4. 개인 꿈 기록 폼 → 다이어리 "내 꿈 기록" 실데이터 연결
   5. 내부링크(연관 꿈 키워드) 구현

6. **완료 기준**:
   - 시드 콘텐츠 20~30건 정상 렌더링
   - 꿈별 추천번호 → 번호생성 자연 연결
   - 개인 꿈 기록이 다이어리에 실제로 쌓임
   - 꿈해몽 페이지 SSG/ISR 적용

7. **예상 작업시간**: 4~5일(+콘텐츠 원고 2~3일)

8. **의존성**: Phase 4

9. **주의사항**:
   - 콘텐츠 원고 작성은 개발 작업과 별도 시간으로 관리(개발자 모드/작가 모드 혼용 금지)
   - 콘텐츠 하단 면책 문구 통일([[CONTENT_STRATEGY]] §4)

10. **체크리스트**:
    - [ ] 시드 콘텐츠 20~30건 작성/등록
    - [ ] 꿈해몽 상세/카테고리 페이지 구현
    - [ ] 꿈별 추천번호 + 생성 연동
    - [ ] 개인 꿈 기록 다이어리 연동
    - [ ] SSG/ISR 적용 확인

---

## Phase 8 — SEO

**왜 지금**: 콘텐츠(꿈해몽)가 생겼으니 검색엔진이 찾을 수 있게 만든다. 콘텐츠보다 먼저 하면 색인할 대상이 없어 무의미하다.

1. **목표**: sitemap, robots, 메타태그, 구조화 데이터, canonical을 실제 적용한다.

2. **선행 조건**: Phase 7 완료(색인할 콘텐츠 존재)

3. **생성할 파일**:
   - `app/sitemap.ts`([[SITEMAP]] §5 그룹 반영), `app/robots.ts`
   - `lib/seo/metadata.ts`, `lib/seo/jsonld.ts`
   - `components/seo/Breadcrumb.tsx`

4. **수정할 파일**: `app/dream/[keyword]/page.tsx`(메타/JSON-LD), `app/(journal)/**`(전체 noindex), `app/layout.tsx`(기본 메타데이터, WebSite JSON-LD)

5. **구현 순서**:
   1. 페이지별 메타데이터 동적 생성 헬퍼
   2. P0 페이지(꿈해몽/홈/번호생성) 우선 적용
   3. JSON-LD(Article, BreadcrumbList) 적용
   4. `/my/journal/*` noindex 확인
   5. sitemap.xml/robots.txt 생성 및 접근 확인
   6. Google Search Console + 네이버 서치어드바이저 등록/제출

6. **완료 기준**:
   - `/sitemap.xml`, `/robots.txt` 정상 응답
   - 주요 페이지 메타/JSON-LD를 Rich Results Test로 확인
   - `/my/journal/*` noindex 확인
   - Search Console/서치어드바이저 등록 완료

7. **예상 작업시간**: 3일

8. **의존성**: Phase 7

9. **주의사항**: noindex/index 대상을 [[SITEMAP]] §4 표와 반드시 재대조

10. **체크리스트**:
    - [ ] sitemap.ts/robots.ts 구현
    - [ ] 메타데이터 헬퍼 및 P0 적용
    - [ ] JSON-LD 적용 및 Rich Results Test 통과
    - [ ] noindex 재확인
    - [ ] Search Console/서치어드바이저 등록

---

## Phase 9 — 관리자

**왜 지금**: 지금까지 관리자 작업(회차 입력 등)은 API 직접 호출/SQL Editor로 임시 처리했다. 매주 반복 운영이 시작되기 전에 최소 관리 화면이 필요하다. 관리자 화면은 "이미 존재하는 기능을 운영하는 창구"이므로 기능 개발 이후에 만드는 것이 순리다.

1. **목표**: [[ADMIN_REQUIREMENTS]] MVP 범위(단일 관리자, 회차입력/꿈해몽관리/FAQ·가이드관리) 화면을 완성한다.

2. **선행 조건**: Phase 6(당첨확인 로직), Phase 7(꿈해몽 구조)

3. **생성할 파일**:
   - `app/admin/layout.tsx`, `app/admin/page.tsx`
   - `app/admin/lottery/draws/page.tsx`
   - `app/admin/content/dreams/page.tsx`, `app/admin/content/faqs/page.tsx`, `app/admin/content/guides/page.tsx`
   - `lib/auth/isAdmin.ts`
   - `supabase/migrations/0011_admin_flag.sql`

4. **수정할 파일**: `proxy.ts`(`/admin/*` 보호 강화), `app/api/admin/draws/route.ts`(UI 연결)

5. **구현 순서**:
   1. 관리자 판별(단일 계정, [[ADMIN_REQUIREMENTS]] §0) + 미들웨어 보호
   2. 회차 입력 화면 + Phase6 배치 실행 버튼 연결
   3. 꿈해몽 CRUD 화면
   4. FAQ/가이드 CRUD 화면
   5. 대시보드 핵심 지표 위젯

6. **완료 기준**:
   - 관리자 계정만 `/admin/*` 접근 가능(일반 회원 차단 확인)
   - 회차 입력→배치 실행이 관리자 화면만으로 완결(SQL Editor 불필요)
   - 꿈해몽/FAQ/가이드 CRUD 정상 동작

7. **예상 작업시간**: 4~5일

8. **의존성**: Phase 6, 7

9. **주의사항**:
   - 역할 분리를 만들지 않는다(단일 관리자 판별만, [[ADMIN_REQUIREMENTS]] §0)
   - 파괴적 액션에 2단계 확인 필수([[ADMIN_REQUIREMENTS]] §9)

10. **체크리스트**:
    - [ ] 관리자 인증/접근제어 구현
    - [ ] 회차 입력+배치 실행 화면 완성
    - [ ] 꿈해몽 CRUD 완성
    - [ ] FAQ/가이드 CRUD 완성
    - [ ] 대시보드 기본 지표 표시

---

## Phase 10 — 배포

**왜 지금**: MVP Must+Should 기능과 운영 화면이 모두 갖춰져야 실사용자에게 노출할 수 있다. 배포 파이프라인 자체는 Phase0에서 이미 구축했으므로, 이 Phase는 "실사용 준비"(법적 페이지, 실데이터, 성능)에 집중한다.

1. **목표**: 실사용자에게 안전하게 노출 가능한 상태로 최종 점검하고 정식 오픈한다.

2. **선행 조건**: Phase 0~9 전체 완료

3. **생성할 파일**: `app/terms/page.tsx`, `app/privacy/page.tsx`, `app/about/page.tsx`, `app/faq/page.tsx`, `app/guide/[topic]/page.tsx`

4. **수정할 파일**: `next.config.ts`(프로덕션 최적화), 환경변수(Vercel 프로덕션 최종 확인)

5. **구현 순서**:
   1. 이용약관/개인정보처리방침/서비스소개 작성(법적 최소 요건, [[ROADMAP]] MVP Must)
   2. seed 데이터를 실제 최근 회차 데이터로 교체
   3. 프로덕션 환경변수 최종 점검(카카오 Redirect URI를 프로덕션 도메인으로)
   4. 성능 점검(Core Web Vitals, [[IMPLEMENTATION_PLAN]] §6 목표 대조)
   5. 핵심 루프(생성→로그인→다이어리→당첨확인) 수동 E2E 테스트
   6. 프로덕션 배포 및 도메인 연결

6. **완료 기준**:
   - 실제 도메인에서 핵심 루프 오류 없이 동작
   - 이용약관/개인정보처리방침 게시
   - Core Web Vitals 목표치 충족(또는 개선계획 문서화)
   - 실제 회차 데이터로 당첨확인 정상 동작

7. **예상 작업시간**: 3~4일

8. **의존성**: Phase 0~9 전체

9. **주의사항**:
   - 카카오 앱을 "개발" → "운영" 모드로 전환하는 절차를 놓치지 않는다(누락 시 실사용자 로그인 실패)
   - 배포 직후 관리자 본인이 번호생성/저장/로그인/로그아웃 전 과정을 실제로 1회 수행해 확인한다

10. **체크리스트**:
    - [ ] 법적 페이지(약관/개인정보) 게시
    - [ ] 실제 회차 데이터 백필
    - [ ] 프로덕션 환경변수/카카오 운영모드 전환 확인
    - [ ] Core Web Vitals 점검
    - [ ] 핵심 루프 수동 E2E 테스트
    - [ ] 프로덕션 배포 및 도메인 연결 확인

---

## 부록 A. 최종 폴더 구조 (Phase 0~10 누적본)

```
/
├── app/
│   ├── (marketing)/            # about, terms, privacy 등
│   ├── (auth)/                 # login, auth/callback
│   ├── (journal)/my/journal/   # 다이어리 전체
│   ├── generate/
│   ├── dream/
│   ├── fortune/
│   ├── admin/
│   ├── api/
│   ├── sitemap.ts, robots.ts
│   └── layout.tsx, page.tsx, globals.css
├── components/
│   ├── ui/            # Button, Modal, Toast, Card, LottoBall, Skeleton, EmptyState, ErrorState, Typography
│   ├── layout/         # Header, Footer, BottomTabBar, MoreMenuGrid
│   ├── journal/
│   ├── lotto/
│   ├── dream/
│   ├── auth/
│   ├── onboarding/
│   └── seo/
├── lib/
│   ├── supabase/       # client.ts, server.ts
│   ├── auth/
│   ├── api/            # journal.ts, numbers.ts, dreams.ts, notifications.ts
│   ├── logic/          # generateNumbers.ts, matchNumbers.ts (+ .test.ts)
│   ├── seo/
│   ├── types/
│   ├── constants/
│   └── utils/
├── supabase/
│   ├── migrations/
│   ├── functions/       # check-winnings 등 Edge Functions
│   └── seed.sql
├── content/dreams-seed/  # 콘텐츠 원고(코드 아님)
├── proxy.ts
└── .env.example
```

## 부록 B. Phase별 상태 추적표 (진행 중 직접 기입용)

| Phase | 시작일 | 완료일 | 비고 |
|---|---|---|---|
| 0 | 2026-07-31 | 2026-08-05 | 로컬 스캐폴딩/도구/git 완료. GitHub·Supabase·Vercel·카카오 인프라 연결 및 검증 완료(Task 0-2) |
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |
| 8 | | | |
| 9 | | | |
| 10 | | | |
