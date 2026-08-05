# Luck Platform

행운을 기록하고, 관리하고, 공유하는 플랫폼. 로또는 이 플랫폼의 첫 번째 서비스다.

설계 문서 전체는 [`docs/`](./docs) 디렉터리를 참조한다. 특히 아래 두 문서는 모든 작업의 최상위 기준이다.

- [`docs/AI_ENGINEERING_CONSTITUTION.md`](./docs/AI_ENGINEERING_CONSTITUTION.md) — 모든 개발보다 우선하는 프로젝트 헌법
- [`docs/EXECUTION_PLAN.md`](./docs/EXECUTION_PLAN.md) — Phase별 구현 순서

## 시작하기

```bash
npm install
cp .env.example .env.local   # 값 채우기 (Supabase/카카오 콘솔에서 발급)
npm run dev
```

http://localhost:3000 에서 확인한다.

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

## 배포 전 체크리스트

로컬 스캐폴딩(Phase 0-1)과 코드 레벨 검증(Phase 0-2)은 끝났다. 아래는 코드로 대신할 수 없는, **콘솔에서 직접 해야 하는 작업**이다. 순서대로 진행한다.

1. **GitHub repository 생성** → 아래 명령으로 원격 연결
   ```bash
   git remote add origin <repository-url>
   git push -u origin main
   ```
2. **Supabase 프로젝트 생성** (Settings → API에서 URL/anon key/service role key 확인) → `.env.local`의 3개 값을 플레이스홀더에서 실제 값으로 교체
3. **Vercel 프로젝트 연결** (GitHub 리포지토리 import) → Project Settings → Environment Variables에 `.env.example`의 7개 키를 동일하게 등록 (Production/Preview 구분 등록 권장)
4. **카카오 개발자 콘솔 앱 등록** (사업자 등록 불필요 — 카카오 로그인/공유는 개인 개발자도 즉시 사용 가능, 알림톡만 사업자 등록 이후로 미룬다) → 발급된 키를 `.env.local`/Vercel 환경변수에 반영

각 환경변수의 목적·필요 시점·보안 위험은 `.env.example`의 주석과 [`docs/DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md) §6(RLS), [`docs/AI_ENGINEERING_CONSTITUTION.md`](./docs/AI_ENGINEERING_CONSTITUTION.md) §11(보안 원칙)을 참조한다. **`SUPABASE_SERVICE_ROLE_KEY`는 절대 `NEXT_PUBLIC_` 접두사를 붙이거나 클라이언트 코드에서 사용하지 않는다.**

## 현재 진행 단계

[`docs/EXECUTION_PLAN.md`](./docs/EXECUTION_PLAN.md) Phase 0 — 프로젝트 초기 세팅 (Task 0-2: 배포/외부 서비스 연결 환경 검증 완료, 위 체크리스트의 콘솔 액션은 사용자 진행 대기 중).
