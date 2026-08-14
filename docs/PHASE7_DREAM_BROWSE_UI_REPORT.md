# Phase7-2 Dream Browse UI 구현 보고서

## 1. 생성/수정 파일

**신규**: `app/dream/page.tsx`, `app/dream/category/[category]/page.tsx`, `app/dream/[keyword]/page.tsx`, `components/dream/DreamCard.tsx`, `components/dream/DreamCategoryNav.tsx`, 본 보고서.
**미변경**: `lib/api/dreams.ts`(범위 제한 준수, mtime으로 확인), `lib/logic/generateNumbers.ts`, `lib/api/numbers.ts`, `app/api/numbers/*`, `app/generate/*`, `app/my/journal/*`, Migration/RLS/`proxy.ts`.

---

## 2. 구현한 라우트

| 경로 | 역할 |
|---|---|
| `/dream` | 허브 — 카테고리 목록 + 전체 꿈 키워드 목록 |
| `/dream/category/[category]` | 카테고리별 필터 목록 |
| `/dream/[keyword]` | 상세 — 해몽 본문 + 추천 번호(단일 페이지, 지시문 §2 요구사항대로 번호를 별도 페이지로 분리하지 않음) |

세 페이지 전부 Server Component, `getCurrentUser()`/`service_role` 미사용, RLS 변경 없음.

---

## 3. UX/SEO 구현

- **사용자 흐름**: `/dream`(카테고리·목록 확인) → 카드 클릭(카드 전체가 `Link`로 감싸져 클릭 가능) → `/dream/[keyword]`(해몽+번호). 카테고리 클릭 시 `/dream/category/[category]`로 이동, 다시 카테고리 전환 가능(`DreamCategoryNav`가 두 페이지에 공통 재사용).
- **긴 텍스트 안전 처리**: 상세 페이지 해몽 본문에 Phase4의 `whitespace-pre-wrap break-words` 패턴 재사용(줄바꿈 보존 + 모바일 375px 폭에서 가로 overflow 없음).
- **EmptyState**: 꿈 목록이 비었을 때(`/dream`, `/dream/category/*`), 추천 번호가 없을 때(`/dream/[keyword]`) 전부 기존 `EmptyState` 컴포넌트 재사용, 새 문구/컴포넌트를 만들지 않았다.
- **not-found**: 존재하지 않는 keyword는 `next/navigation`의 `notFound()`로 처리 — 이 프로젝트에 커스텀 `app/not-found.tsx`가 없어(전수 확인) Next.js 기본 404가 "기존 방식"이다. category는 자유 텍스트 필터라 존재하지 않아도 에러가 아니라 EmptyState로 처리(설계 의도, §9에 근거 기록).
- **디자인 토큰**: `text-h1`/`text-h2`/`text-body`/`text-text-primary`/`text-text-secondary`/`bg-primary`/`bg-bg-subtle`/`Card`/`Badge`/`EmptyState` — 전부 기존 토큰/컴포넌트. 새 색상 토큰을 추가하지 않았다. 추천 번호 표시는 `app/generate`(`NumberGenerator.tsx`)가 이미 쓰는 번호 볼 클래스(`rounded-full bg-primary text-button font-bold text-white`)를 그대로 재사용 — 번호 구간별 5색 문제(Known Issue)를 이번 Task에서 손대지 않았다.
- **컴포넌트 추출 기준**: `DreamCard`(허브+카테고리 페이지 2곳에서 반복)와 `DreamCategoryNav`(동일 2곳에서 반복)만 추출했다. 추천 번호 렌더링은 상세 페이지 1곳에서만 쓰여 별도 컴포넌트로 추출하지 않았다(지시문 §9 "한 번만 쓰이는 마크업은 추상화하지 않는다").
- **SEO metadata**: 세 페이지 모두 `title`/`description` 설정, `noindex` 미부여(공개 검색 대상 유지, `docs/SITEMAP.md` §4 P0 분류와 일치). 상세 페이지는 `generateMetadata()`로 keyword별 동적 title/description(해몽 본문 앞 100자) 생성.
- **GNB/BottomNavigation**: 수정하지 않았다 — `GlobalNav.tsx`의 "꿈해몽→/dream" 링크와 홈 `FEATURES` 카드가 Phase7-0에서 이미 확인한 대로 그대로 유효해졌다(더 이상 404가 아님).

---

## 4. 실제 렌더링 검증 (실제 dev 서버 + 실제 seed 데이터)

로컬 dev 서버(포트 3000)에 대해 실제 25건 시드 데이터로 검증했다.

| 항목 | 결과 |
|---|---|
| `/dream` 정상 렌더링 | `200`, 카드 25개 렌더링 확인 |
| 7개 카테고리 정상 표시 | `동물/신체/인물/상황/자연/행동/사물` 전부 렌더링됨(실측) |
| 실제 keyword 클릭(`돼지꿈`) | `200`, title="돼지꿈 해몽", 해몽 본문 정상 표시 |
| 카테고리 필터(`동물`) | `200`, title="동물 꿈해몽" 정상 표시 |
| 관련 번호가 있는 꿈 정상 표시 | `돼지꿈` 상세 페이지에서 추천 번호 `3, 7, 12, 21, 34, 45` 정상 렌더링 확인 |
| 관련 번호가 없는 꿈 EmptyState | 코드로는 처리돼 있으나(`numbers ? ... : <EmptyState .../>`), **현재 seed 데이터가 25:25(전부 1:1 매핑)라 이 케이스를 실제 데이터로는 재현할 수 없었다** — 로직 검토로만 확인(§9에 기록) |
| 존재하지 않는 keyword 처리 | `404` 정상 확인 |
| 모바일 레이아웃 | 실제 브라우저/헤드리스 도구가 없어 시각적으로 확인하지 못했다 — `Container`(반응형 `max-w-content`+`px-6`)와 `grid grid-cols-1 sm:grid-cols-2`(모바일 1열/데스크톱 2열) 등 기존에 검증된 반응형 클래스만 사용했음을 코드 검토로 확인 |
| 긴 해몽 텍스트 줄바꿈 | `whitespace-pre-wrap break-words` 적용 확인(코드 검토, Phase4가 이미 동일 패턴으로 실측 검증한 클래스 조합 재사용) |
| metadata 정상 생성 | `/dream`="꿈해몽", `/dream/category/동물`="동물 꿈해몽", `/dream/돼지꿈`="돼지꿈 해몽" — 전부 실측 확인 |

기존 페이지 회귀 확인: `/`, `/login`, `/generate`, `/my/journal`, `/ui-preview` 전부 `200` 유지(실측).

---

## 5. lint/type-check/test/build 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 통과 — 12 test files, **133 tests**(변경 없음 — 이번 Task는 jsdom/RTL이 없어 새 페이지 테스트를 추가하지 않고, Phase7-1의 조회 서비스 테스트를 그대로 유지했다) |
| `npm run build` | 통과 — `/dream`, `/dream/[keyword]`, `/dream/category/[category]` 3개 라우트 추가, 전부 `ƒ`(동적)로 표시됨(§9 발견된 문제 참조) |

`git status`로 확인한 변경 파일: `app/dream/**`(신규 3개 페이지), `components/dream/**`(신규 2개 컴포넌트), 본 보고서. 그 외 범위 제한 목록의 파일(`lib/api/dreams.ts` 포함)은 전부 mtime 기준 미변경.

---

## 6. 발견된 문제

### 문제 1 — Next.js 페이지 컴포넌트 `params`가 URL 디코딩되지 않음 (실제로 발견하고 수정함)

실제 dev 서버 검증 중 `/dream/돼지꿈`(퍼센트 인코딩된 실제 URL)이 `404`를 반환하는 것을 발견했다. 원인을 추적한 결과, **이 Next.js 버전(16.2.12)에서 `generateMetadata()`의 `params`는 URL 디코딩된 값("돼지꿈")을 주지만, 페이지 컴포넌트 자신의 `params`는 퍼센트 인코딩된 원본 문자열("%EB%8F%BC%EC%A7%80%EA%BF%88")을 그대로 준다**는 비대칭을 실측으로 확인했다(디버그 로그로 직접 확인, 실제 Supabase 쿼리 자체는 문제 없었음 — 별도 스크립트로 동일 쿼리가 정상 동작함을 재확인). `/dream/category/[category]`도 동일한 문제가 있었다(카테고리 필터가 조용히 빈 결과만 반환해 EmptyState로 위장되는 방식이라 상태 코드만으로는 드러나지 않았다).

**해결**: 두 페이지 모두에서 `params`를 받은 즉시 `decodeURIComponent()`를 직접 호출하도록 수정했다(`generateMetadata`/페이지 본문 둘 다 동일하게 적용해 비대칭에 의존하지 않도록 함). 이미 디코딩된 문자열에 다시 호출해도 퍼센트 인코딩 패턴이 없으면 안전하게 그대로 반환된다(idempotent). 수정 후 실제 dev 서버로 재검증해 정상 동작을 확인했다(§4).

이 문제는 `lib/api/dreams.ts`(Phase7-1)의 결함이 아니라 순수하게 이번 Task에서 새로 작성한 두 페이지 컴포넌트의 문제였고, 발견 즉시 이번 Task 범위 안에서 수정했다(범위를 넘어서는 수정이 아님).

### 문제 2 — `/dream/*`가 SSG/ISR이 아니라 완전 동적 렌더링(`ƒ`)이다 (기록만 함, 이번 Task에서 해결하지 않음)

`npm run build` 결과 세 라우트 전부 `ƒ`(Dynamic)로 표시됐다. 원인: `lib/api/dreams.ts`가 쓰는 `lib/supabase/server.ts`의 `createClient()`가 항상 `next/headers`의 `cookies()`를 호출하는데, Next.js는 렌더 경로 어디서든 `cookies()`가 호출되면 그 라우트 전체를 강제로 동적 렌더링으로 전환한다 — `/dream/*`는 인증이 전혀 필요 없는 완전 공개 콘텐츠인데도 공용 클라이언트를 재사용한 탓에 정적 생성 혜택을 받지 못한다. `EXECUTION_PLAN.md` Phase7의 완료 기준 중 하나("꿈해몽 페이지 SSG/ISR 적용")와 직접 관련된 사안이다.

이번 Task에서 해결하지 않은 이유: 해결하려면 `lib/api/dreams.ts`가 쿠키 없는 별도 공개 전용 Supabase 클라이언트를 쓰도록 바꿔야 하는데, 그 파일은 이번 Task의 명시적 범위 제한 대상이다("이미 결정된 사항을 다시 결정하지 않는다"는 원칙과, `lib/api/dreams.ts`를 건드리지 말라는 §11 범위 제한을 함께 지켰다). Phase7-2를 막는 문제가 아니라(동적 렌더링이어도 페이지는 정상 동작하고 검색엔진 색인도 막히지 않는다 — SSG/ISR은 성능 최적화이지 기능 요구사항이 아니다) 성능/EXECUTION_PLAN 완료 기준 관점의 후속 결정 사항으로 기록한다.

### 문제 3 — "관련 번호 없음" EmptyState 경로가 실제 데이터로 검증되지 않음

`getDreamNumbers()`가 `null`을 반환하는 실제 사례가 현재 seed 데이터(25:25, 전부 1:1 매핑)에 없어 EmptyState 분기를 실측하지 못했다. 코드 리뷰로 로직은 확인했으나(`numbers ? ... : <EmptyState />`), 향후 매핑 없는 꿈이 추가되면 반드시 재확인이 필요하다.

---

## TASK REPORT

1. **생성/수정 파일**: `app/dream/page.tsx`, `app/dream/category/[category]/page.tsx`, `app/dream/[keyword]/page.tsx`(신규 3개 페이지), `components/dream/DreamCard.tsx`, `components/dream/DreamCategoryNav.tsx`(신규 2개 컴포넌트), 본 보고서. `lib/api/dreams.ts`를 포함한 범위 제한 파일은 전부 미변경.

2. **구현 라우트**: `/dream`(허브), `/dream/category/[category]`(카테고리 필터), `/dream/[keyword]`(해몽+추천번호 통합 상세) — 전부 Server Component, 인증/`service_role` 미사용.

3. **UX/SEO 구현**: 카드 전체 클릭 가능, 긴 텍스트 안전 처리(Phase4 패턴 재사용), EmptyState/404 처리, 기존 디자인 토큰만 사용(새 색상 없음, 번호는 `/generate`와 동일한 번호 볼 스타일 재사용), keyword/category별 동적 metadata, `noindex` 미부여.

4. **실제 렌더링 검증**: 실제 dev 서버 + 실제 25건 seed 데이터로 허브/카테고리/상세/404/metadata 전부 정상 확인. 기존 페이지(`/`, `/login`, `/generate`, `/my/journal`, `/ui-preview`) 회귀 없음 확인.

5. **Validation**: lint/type-check 통과, test 12 files·133 tests 통과(변경 없음), build 통과(신규 라우트 3개 정상 추가).

6. **발견된 문제**: (1) Next.js 페이지 컴포넌트 `params`가 이 버전에서 URL 디코딩되지 않는 문제를 실측으로 발견해 `decodeURIComponent()` 명시 호출로 즉시 수정(범위 내 수정). (2) `/dream/*`가 `cookies()` 사용으로 인해 SSG/ISR이 아닌 완전 동적 렌더링 상태 — `lib/api/dreams.ts` 범위 제한 때문에 이번 Task에서 해결하지 않고 기록만 함. (3) "추천 번호 없음" EmptyState 경로는 현재 데이터로 실측 불가.

7. **Phase7-3 착수 가능 여부: READY** — 열람 UI가 실제 데이터로 정상 동작함을 확인했고, `/generate` 연동에 필요한 `getDreamByKeyword()`/`getDreamNumbers()` 계약도 이미 검증됐다. 다만 Decision D2(`lib/api/numbers.ts`의 `saveUserNumbers()` 확장 방식, Phase7-0에서 이미 식별)는 Phase7-3 착수 전 확정이 필요하다는 기존 결론 그대로 유효하다.
