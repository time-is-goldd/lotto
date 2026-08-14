# Phase9-1 관리자 공통 레이아웃 + 접근 게이트 구현 보고서

> Phase9-0(`docs/PHASE9_PRE_IMPLEMENTATION_AUDIT.md`)이 이미 확인한 관리자 인증 기반(`admins`/`admin_role`/RLS/`isAdmin()`/`/api/admin/*` proxy 보호)을 100% 재사용했다. 새 인증 시스템·세션·쿠키·JWT·`profiles.is_admin`·`admin_flag`·새 권한 체크 유틸을 전혀 만들지 않았다.

---

## 1. 생성/수정 파일

**신규**: `app/admin/layout.tsx`, `app/admin/page.tsx`, 본 보고서.

**미변경**: `admins` 테이블/RLS, `lib/auth/isAdmin.ts`, `getCurrentUser()`, `proxy.ts`, `app/api/admin/draws/route.ts`, `lib/api/admin/draws.ts` — 전부 무수정 재사용(`git status`로 확인, `app/admin/` 외 production 코드 변경 없음). Migration/RLS 신규 생성 없음.

검증 중 임시로 사용하고 전부 삭제한 것(흔적 없음, `git status` 확인): `app/api/jtest/route.ts`(Phase2 이래 반복 사용해 온 세션 발급/정리용 임시 라우트), Supabase 테스트 계정 2개, `admins` 테스트 행 1개.

---

## 2. 관리자 인증 흐름

```
사용자 → /admin/* 요청
  → app/admin/layout.tsx(Server Component)
    1. getCurrentUser()(기존, 무수정)
       - 비로그인 → redirect(`/login?next=/admin`)
         (app/my/journal/dreams/new/page.tsx가 이미 쓰는 것과 동일한 기존 패턴 재사용)
    2. isAdmin()(기존, 무수정 — admins 본인 행 RLS SELECT, service_role 미사용)
       - 관리자 아님 → notFound()
         (이 프로젝트에 기존 403 UI 패턴이 없어(전수 확인) 새로 만들지 않고
          app/dream/[keyword]/page.tsx가 이미 쓰는 Next.js 기본 404를 재사용)
    3. 관리자 → children 렌더링(Container로 감싸기만 함)
  → app/admin/page.tsx — 정적 placeholder만(실제 데이터 없음)
```

`proxy.ts`는 이번 Task에서 수정하지 않았다(범위 밖, §9-0 D2) — 따라서 이번 단계에서 `/admin/*`의 **유일한 서버 측 보안 경계는 `app/admin/layout.tsx`**다. `getCurrentUser()`/`isAdmin()` 둘 다 이미 검증된 기존 함수를 그대로 호출할 뿐 새 로직이 없다. 클라이언트에서 관리자 여부를 판단하는 코드는 어디에도 없다 — `AdminLayout`은 Server Component이고 `isAdmin()` 결과에 따라 `children` 자체를 렌더링하지 않는 구조다.

---

## 3. 비로그인/일반 사용자/관리자 접근 결과 (실제 Supabase, production build)

| 시나리오 | 결과 |
|---|---|
| **Test A**: 비로그인 → `/admin` | `307` → `Location: /login?next=%2Fadmin` |
| **Test B**: 일반 로그인 사용자(관리자 아님) → `/admin` | `404`, 관리자 콘텐츠가 **화면에 렌더링되지 않음**(아래 §7 참조) |
| **Test C**: 관리자(테스트 계정을 `admins`에 임시 등록) → `/admin` | `200`, `<h1>관리자</h1>` + 4개 예정 섹션 카드 정상 렌더링, `robots: noindex, nofollow` |

`npm run build` + `npm run start`(**production 모드**)로 실제 배포 환경에 가까운 상태에서 검증했다 — dev 모드 검증만으로 끝내지 않았다.

---

## 4. 기존 `/api/admin/*` 보호 회귀 여부

`POST /api/admin/draws`를 세 가지 세션으로 재검증했다:

| 세션 | 결과 |
|---|---|
| 비로그인 | `401 UNAUTHORIZED` |
| 일반 사용자(Test B와 동일 계정) | `403 FORBIDDEN` |
| 관리자(Test C와 동일 계정, 빈 body) | 인증은 통과하고 `400 VALIDATION_ERROR`("round는 1~100000 사이의 정수여야 합니다")로 이동 — **`isAdmin()` 검증 자체가 정상 통과됨을 확인** |

**회귀 없음.** `app/admin/layout.tsx` 추가가 기존 API 보호 로직에 어떤 영향도 주지 않았다.

---

## 5. 보안 검증 결과

실제 Supabase 프로젝트에 테스트 계정 2개(카카오 세션 발급 재사용 트릭, Phase2 이래 반복 검증된 방식과 동일)를 만들어 검증했다:

- User A(일반) → `/admin` `404`, `/api/admin/draws` `403`.
- User B → `admins`에 `service_role`로 1회성 `INSERT`(운영 계정이 아닌 순수 테스트용, `docs/PHASE6_ADMIN_AUTH_DECISION.md §6`이 이미 설계해 둔 절차와 동일한 방식) → `/admin` `200`, `/api/admin/draws` 인증 통과.
- 검증 종료 후 `admins`/`profiles`의 테스트 행과 Supabase Auth 계정 2개를 `service_role`로 전부 삭제하고, 두 테이블 모두 **잔여 0건**을 응답으로 직접 재확인했다. 코드에 UID를 기록하지 않았고, 운영 관리자 계정은 만들지 않았다(지시문 그대로 준수).
- 임시 검증 라우트(`app/api/jtest/route.ts`)도 삭제 완료 — `git status`로 흔적 없음 확인.

---

## 6. 테스트 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과, 경고 0건 |
| `npm run type-check` | 통과(`.next` 캐시에 삭제된 임시 라우트의 타입 참조가 한 차례 남아있었음 — `.next` 정리 후 재빌드로 해결, §7 기록) |
| `npm test` | 통과 — 12 test files, **168 tests**(변화 없음. 관리자 게이트는 Server Component 인증 분기라 이 프로젝트의 jsdom 없는 vitest 환경에서 유닛테스트 대상이 아니라 실제 HTTP 검증으로 대체) |
| `npm run build` | 통과 — 라우트 **24개**(기존 23 + `/admin` 1개 신규), `/admin`은 `ƒ`(Dynamic, `getCurrentUser()`/`isAdmin()`이 매 요청 세션을 확인해야 하므로 당연한 결과) |
| 기존 페이지 회귀 | `/`, `/dream`, `/generate`, `/login`, `/my/journal` 전부 `200` 유지. `/robots.txt`/`/sitemap.xml` 응답·내용 변화 없음(sitemap 35개 URL 그대로, `/admin` 미포함 확인) |

---

## 7. 발견된 문제

### 7-1. (기록만, 이번 Task에서 수정 안 함) 404 응답에도 자식 페이지의 RSC payload가 포함됨

Test B(`404`) 응답을 실제로 검사한 결과, 화면에 렌더링되지는 않지만 **HTTP 응답 본문(React Server Component 하이드레이션용 `<script>` 스트림) 안에 `app/admin/page.tsx`의 텍스트 콘텐츠("회차 관리", "꿈해몽 관리" 등)가 그대로 포함**되어 있음을 발견했다 — dev 모드와 **production 빌드(`next build && next start`) 둘 다에서 재현**을 확인했다.

원인은 Next.js App Router가 레이아웃과 그 자식 페이지를 부분적으로 병렬 렌더링하기 때문으로 보인다 — `app/admin/layout.tsx`가 `notFound()`를 던져 최종 HTML에는 자식이 마운트되지 않지만, 자식(`AdminHomePage`)의 RSC 출력 자체는 이미 계산되어 응답 스트림에 직렬화된 채 남는다. **화면에 실제로 표시되는 콘텐츠는 아니지만, raw HTTP 응답을 직접 읽으면(예: `curl`) 텍스트를 확인할 수 있다.**

이번 단계는 `AdminHomePage`에 실제 데이터를 전혀 넣지 않았으므로(지시문 §4/§9) 지금은 민감정보 노출이 아니다 — 노출되는 것은 정적 placeholder 라벨 4개뿐이다. **그러나 이 발견은 Phase9-2 이후에 매우 중요하다**: 향후 관리자 페이지(`/admin/draws`, `/admin/dreams` 등)가 실제 데이터를 페이지 컴포넌트 자체에서 조회하기 시작하면, 그 조회 코드가 비관리자 요청에서도 실행되고 그 결과가 (화면에는 안 보이지만) 응답 본문에 직렬화될 위험이 있다 — 이 프로젝트가 `/my/journal/*`에서 이미 써 온 "레이아웃/proxy 1차 방어 + 페이지 자신도 독립적으로 재검증" 2계층 원칙(`proxy.ts` 주석, Phase4 이래 일관 적용)이 단순한 이중 안전장치가 아니라 **이 프레임워크 동작 때문에 실질적으로 필요**하다는 것을 실측으로 재확인한 셈이다. Phase9-2 착수 시 각 관리자 페이지가 실제 데이터를 조회하기 전에 `isAdmin()`을 다시 한번 확인하는 것을 권장한다(§9).

### 7-2. (수정 완료) `.next` 빌드 캐시의 stale 타입 참조

임시 검증 라우트(`app/api/jtest/route.ts`)를 삭제한 뒤 `type-check`가 `.next/types/validator.ts`에 남아있던 그 라우트 참조 때문에 실패했다 — Next.js가 라우트 파일 목록을 캐시하기 때문이다. `.next` 삭제 후 재빌드로 해결했다(코드 문제 아님, 발견 즉시 처리).

### 7-3. (기록만) robots.txt에 `/admin` 미포함

`app/robots.ts`는 이번 Task 범위(§1 구현 파일 목록)에 없어 수정하지 않았다. `/admin/*`는 페이지 자체의 `robots: noindex, nofollow` 메타데이터로 이미 색인 차단되지만(§2/§5 실측 확인), `robots.txt`의 `Disallow` 목록에는 아직 없다(`/my/`, `/login`, `/onboarding`, `/api/`, `/ui-preview`만 존재) — 크롤 예산 최적화 관점의 사소한 보강 여지이며 보안 문제는 아니다(robots.txt는 크롤 차단일 뿐 접근 차단이 아니라는 점은 Phase8-1이 이미 확립한 원칙과 동일).

---

## 8. Phase9-2 착수 가능 여부

**READY.** Critical/High 문제 없음(§7-1은 현재 데이터가 없어 실질적 노출이 없고, Phase9-2 설계 시 반영해야 할 가이드로 기록됨). 관리자 인증 게이트가 실제 Supabase 세션으로 3가지 시나리오 전부 정상 동작함을 production 빌드 기준으로 확인했고, 기존 `/api/admin/draws` 보호와 기존 페이지 전체에 회귀가 없다.

---

## 9. Phase9-2에서 구현할 가장 우선순위 높은 작업

**회차 입력 화면(`app/admin/draws/page.tsx`) — 기존 `POST /api/admin/draws`에 폼을 연결한다.**

이유: `docs/PHASE9_PRE_IMPLEMENTATION_AUDIT.md`가 이미 확인한 대로 이 기능은 백엔드(검증+저장+대조+알림)가 Phase6에서 100% 완성돼 있어 새로 만들 코드가 "폼 UI 하나"뿐이고(판정 로직 재구현 없음), FAQ/가이드처럼 스키마 미확정으로 막혀 있지도 않다 — Phase9-2 중 재작업 위험이 가장 낮고 즉시 착수 가능한 항목이다. 구현 시 §7-1의 발견을 반영해 페이지 컴포넌트 자신도 `isAdmin()`을 한 번 더 확인하는 것을 권장한다(이 화면은 아직 실데이터 조회가 없어 이번 Phase9-1처럼 리스크가 낮지만, 등록된 회차 목록을 보여주기 시작하면 §7-1의 권장 패턴이 실질적으로 필요해진다).
