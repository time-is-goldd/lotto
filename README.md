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

## 현재 진행 단계

[`docs/EXECUTION_PLAN.md`](./docs/EXECUTION_PLAN.md) Phase 0 — 프로젝트 초기 세팅.
