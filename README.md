# Luck Platform

행운을 기록하고, 관리하고, 공유하는 플랫폼. 로또는 이 플랫폼의 첫 번째 서비스다.

설계 문서 전체는 [`docs/`](./docs) 디렉터리를 참조한다. 특히 아래 두 문서는 모든 작업의 최상위 기준이다.

- [`docs/AI_ENGINEERING_CONSTITUTION.md`](./docs/AI_ENGINEERING_CONSTITUTION.md) — 모든 개발보다 우선하는 프로젝트 헌법
- [`docs/EXECUTION_PLAN.md`](./docs/EXECUTION_PLAN.md) — Phase별 구현 순서

## 시작하기

```bash
git clone https://github.com/time-is-goldd/lotto.git
cd lotto
npm install
cp .env.example .env.local   # 값 채우기 — 아래 "환경변수 설정" 참조
npm run dev
```

http://localhost:3000 에서 확인한다.

## 환경변수 설정

`.env.example`에 키 목록과 각 값의 발급 위치가 주석으로 정리되어 있다. `.env.local`은 로컬 전용이며 절대 커밋되지 않는다(`.gitignore` 확인).

| 키 | 발급 위치 | 비고 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 → Settings → API | 클라이언트 노출 가능 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 프로젝트 → Settings → API | 클라이언트 노출 가능 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 프로젝트 → Settings → API | **서버 전용**. 클라이언트 코드/`NEXT_PUBLIC_` 접두사 절대 금지 |
| `NEXT_PUBLIC_SITE_URL` | 배포 도메인 (로컬은 `http://localhost:3000`) | OG 이미지, sitemap, 공유 링크 생성에 사용 |
| `KAKAO_REST_API_KEY` | 카카오 개발자 콘솔 → 내 애플리케이션 → 앱 키 | Phase 2(Authentication)부터 사용 |
| `KAKAO_CLIENT_SECRET` | 카카오 개발자 콘솔 → 앱 키 → REST API 키 하단 "클라이언트 시크릿 발급" | 서버 전용, Phase 2부터 사용 |
| `NEXT_PUBLIC_KAKAO_JS_KEY` | 카카오 개발자 콘솔 → 내 애플리케이션 → 앱 키 | 클라이언트 SDK(공유하기 등)용, Phase 2 이후 사용 |

Vercel 배포 시에는 Project Settings → Environment Variables에 위 7개 키를 동일하게 등록한다(Production/Preview 구분 등록 권장).

**카카오 Redirect URI** (Phase 2 Authentication 구현 시 사용할 콜백 경로, `docs/EXECUTION_PLAN.md` Phase 2 §3 기준 `app/(auth)/auth/callback/route.ts`): 카카오 개발자 콘솔 → 카카오 로그인 → Redirect URI에 아래 두 값을 미리 등록해 둔다.

- 로컬: `http://localhost:3000/auth/callback`
- 프로덕션: `https://lucky-zeta-azure.vercel.app/auth/callback`

> Vercel Preview Deployment는 배포마다 URL이 동적으로 바뀌므로(`*-git-<branch>-*.vercel.app`), 카카오 콘솔에 고정 등록이 불가능하다. 카카오 로그인은 로컬 또는 프로덕션 도메인에서만 테스트한다 — Preview에서의 카카오 로그인 테스트는 Phase 2에서 별도 방안(예: 고정 Preview 별칭)이 필요하면 그때 논의한다.

## 배포

`main` 브랜치에 push하면 Vercel이 자동으로 Production 빌드를 실행한다. 그 외 브랜치/PR은 Preview Deployment로 자동 배포된다.

```bash
git push origin main   # Production 자동 배포
```

로컬에서 배포 전 프로덕션 빌드를 미리 검증하려면:

```bash
npm run build
```

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 로컬 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run lint` | ESLint 검사 |
| `npm run type-check` | TypeScript 타입 검사 |
| `npm test` | Vitest 단위 테스트 실행 |
| `npm run format` | Prettier로 전체 포맷 |
| `npm run format:check` | 포맷 위반 여부만 검사(수정 없음) |

## 기술 스택

Next.js(App Router) · TypeScript · Tailwind CSS · Supabase(Postgres/Auth/Storage/Realtime) · Vercel

기술 선택 근거는 [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) 참조.

## 인프라 연결 상태

Phase 0(프로젝트 초기 세팅)의 콘솔 액션이 모두 완료됐다.

- [x] GitHub repository 생성 및 `main` 브랜치 push (`origin` = `time-is-goldd/lotto`)
- [x] Supabase 프로젝트 생성, `.env.local`에 실제 값 적용, REST/Auth 엔드포인트 연결 확인
- [x] Vercel 프로젝트 연결, 환경변수 7개 등록, Production 빌드 성공 확인
- [x] 카카오 개발자 앱 등록, 앱 키 발급 및 `.env.local` 반영 (Redirect URI는 위 "환경변수 설정" 참조, 실제 로그인 연동은 Phase 2)

각 환경변수의 목적·필요 시점·보안 위험은 `.env.example`의 주석과 [`docs/DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md) §6(RLS), [`docs/AI_ENGINEERING_CONSTITUTION.md`](./docs/AI_ENGINEERING_CONSTITUTION.md) §11(보안 원칙)을 참조한다. **`SUPABASE_SERVICE_ROLE_KEY`는 절대 `NEXT_PUBLIC_` 접두사를 붙이거나 클라이언트 코드에서 사용하지 않는다.**

## 현재 진행 단계

[`docs/EXECUTION_PLAN.md`](./docs/EXECUTION_PLAN.md) Phase 0 완료 (Task 0-2: 실 인프라 연결 및 검증 완료). 다음은 Phase 1 — DB 구축.
