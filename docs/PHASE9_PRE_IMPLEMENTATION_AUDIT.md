# Phase9-0 Pre-Implementation Audit — 관리자

> AUDIT ONLY. 코드/Migration/RLS/UI를 전혀 수정하지 않았다. Phase5~8이 이미 검증한 내용(당첨확인 로직, 꿈해몽 구조, SEO, 관리자 인증 아키텍처 자체의 설계 근거)은 재조사하지 않고 기존 보고서를 인용했다 — 이번 감사는 **Phase9 구현에 실제로 영향을 주는 부분만** 새로 조사했다.

---

## 1. Phase9의 정확한 범위 확정

`docs/EXECUTION_PLAN.md` Phase9 원문(직접 재확인)을 기준으로 삼는다 — `docs/ROADMAP.md`는 "Phase 9"라는 macro-phase 번호 자체가 없고(ROADMAP은 Phase0~8까지만 존재, §Phase8-0 감사가 이미 정리한 그대로), 관리자 관련 내용은 ROADMAP §2 Phase8(AI 자동화 운영 고도화)의 "AI 초안 → 사람 승인" 워크플로 설명에 흩어져 있을 뿐이다. **번호 충돌 자체가 없다** — Phase8-0/Phase8-5가 이미 겪은 EXECUTION_PLAN vs ROADMAP 충돌과 달리, "Phase9"는 EXECUTION_PLAN에만 존재하는 고유 명칭이라 혼동할 대상이 없다.

| 항목 | 내용 |
|---|---|
| **목표** | `[[ADMIN_REQUIREMENTS]]` **MVP 범위**(단일 관리자, 회차입력/꿈해몽관리/FAQ·가이드관리) 화면을 완성한다 |
| **필수 구현** | ① 관리자 판별+미들웨어 보호, ② 회차 입력 화면+Phase6 배치 실행 버튼 연결, ③ 꿈해몽 CRUD 화면, ④ FAQ/가이드 CRUD 화면, ⑤ 대시보드 핵심 지표 위젯 |
| **이번 Phase 제외** | 역할 분리(단일 관리자만), `ADMIN_REQUIREMENTS.md`가 서술하는 §3.2(당첨사례 관리)·§3.3(로또명당)·§4(커뮤니티/배틀)·§5(회원관리)·§6(알림 확장)·§7(쇼핑몰/멤버십)·§8(감사로그/시스템설정) — 이 항목들은 ADMIN_REQUIREMENTS.md에는 있지만 **EXECUTION_PLAN Phase9의 목표/완료기준에는 없다**(아래 §7에서 근거 상세) |
| **완료 기준** | 관리자 계정만 `/admin/*` 접근 가능(일반 회원 차단 확인), 회차 입력→배치 실행이 관리자 화면만으로 완결(SQL Editor 불필요), 꿈해몽/FAQ/가이드 CRUD 정상 동작 |
| **의존 Phase** | Phase 6(당첨확인 로직), Phase 7(꿈해몽 구조) — 둘 다 이미 완료(Phase6 PASS, Phase7 CONDITIONAL PASS) |
| **이후 Phase와 겹치는 영역** | 없음. Phase10(배포)은 Phase0~9 전체 완료를 선행조건으로 삼을 뿐 Phase9 자체와 기능이 겹치지 않는다 |

### 이미 구현된 부분 vs 신규 구현 필요 부분 (핵심 발견)

EXECUTION_PLAN Phase9의 "생성할 파일" 목록에는 `lib/auth/isAdmin.ts`, `supabase/migrations/0012_admin_flag.sql`이 포함돼 있지만, **이 둘은 이미 Phase6-4-1에서 만들어졌다**(`supabase/migrations/0012_admin_access.sql`이라는 이름으로, EXECUTION_PLAN이 예약해 둔 `0012_admin_flag.sql`과 동일한 예약 번호를 사용). Phase6이 Phase9 몫의 기반 작업 일부를 이미 앞당겨 끝내둔 상태다 — Phase7-0이 Phase4/Phase7 사이에서 발견했던 것과 같은 유형("문서가 계획한 파일이 실은 이전 Phase에서 이미 존재")이 이번에도 반복된다.

| EXECUTION_PLAN이 계획한 파일 | 실제 상태 |
|---|---|
| `lib/auth/isAdmin.ts` | **이미 존재**(Phase6-4-1). 재구현 금지 |
| `supabase/migrations/0012_admin_flag.sql` | **이미 존재**(`0012_admin_access.sql`, 동일 목적). 신규 migration 금지 |
| `proxy.ts`(`/admin/*` 보호 강화) | **부분 존재** — `/api/admin/*`(JSON API)는 이미 보호됨(Phase6-4-2). `/admin/*`(페이지 UI)는 아직 라우트 자체가 없어 미보호 상태 — **Phase9-1에서 실제로 손댈 부분** |
| `app/api/admin/draws/route.ts`(UI 연결) | **POST 이미 완전히 구현·검증됨**(Phase6-4-2/4-3). "UI 연결"은 이 파일의 코드 변경이 아니라 새 UI가 기존 엔드포인트를 호출하는 것을 의미 — 라우트 자체는 무수정 재사용 |
| `app/admin/layout.tsx`, `app/admin/page.tsx`, `app/admin/lottery/draws/page.tsx`, `app/admin/content/dreams/page.tsx`, `app/admin/content/faqs/page.tsx`, `app/admin/content/guides/page.tsx` | **전부 없음**(전수 확인, `Glob "app/admin/**"` 결과 0건). Phase9-1이 실제로 새로 만들어야 하는 부분 |

---

## 2. 현재 관리자 시스템 상태 (재사용 가능 여부 판정)

| 요소 | 상태 | 재사용 가능 여부 |
|---|---|---|
| `admins` 테이블 | `0012_admin_access.sql`, `id`/`user_id`(uuid, unique, FK→`auth.users`)/`role`/`created_at` | **그대로 재사용**, 스키마 변경 불필요 |
| `admin_role` enum | `('super')` — 단일 값만 존재 | **그대로 재사용** — `ADMIN_REQUIREMENTS.md §0` "역할 단일화" 원칙과 일치, Phase9에서 역할을 늘리지 않는다(지시문 원칙과도 일치) |
| `admins` RLS | `admins_select_own`(본인 SELECT만), INSERT/UPDATE/DELETE 정책 없음(service_role 전용) | **그대로 재사용**, 변경 불필요 |
| `lib/auth/isAdmin.ts` | `getCurrentUser()` → `admins` 본인 행 조회(anon 세션, service_role 미사용), fail-closed(에러 시 false) | **그대로 재사용**, 재구현 금지(지시문) |
| `/api/admin/*` proxy 보호 | `proxy.ts`의 `PROTECTED_API_PATHS = ["/api/admin"]` — 비로그인 시 `401` JSON 즉시 반환 | **그대로 재사용**. `/admin/*`(페이지)은 이 목록에 없어 별도 처리 필요(§4) |
| `app/api/admin/draws/route.ts` | `POST` 완전 구현 — `getCurrentUser()`→`isAdmin()`→입력검증→`registerDrawAndMatchUserNumbers()` | **무수정 재사용**. `GET`(목록 조회)은 없음 — 아래 §4에서 필요 여부 판정 |
| `lib/api/admin/draws.ts` | `parseAdminDrawsInput`/`registerDrawAndMatchUserNumbers`(Phase6, `service_role`로 draws INSERT + user_numbers 일괄 대조 + 알림 생성까지 한 번에 처리) | **무수정 재사용**, 판정 로직 복제 금지 원칙과 정확히 일치 |
| `service_role` 사용 구조 | `lib/supabase/service.ts` — 서버 전용, 브라우저에서 호출 시 즉시 에러. 이 프로젝트 전역에서 관리자 쓰기(`admins`/`draws`/`user_numbers` 배치)에만 사용되는 기존 패턴 | **그대로 재사용** |
| `draws` 테이블 | `round UNIQUE`, `numbers`/`bonus_number` CHECK, `source`(`'manual'` 기본값, Phase8에서 자동수집 시 `'api'` 등 구분 예정 — Phase9와 무관), `first_prize_amount`/`first_prize_count` | **그대로 재사용**, 변경 불필요 |
| **현재 운영 관리자 미등록 상태** | 실제 `admins` 테이블에 행이 0건(운영 계정 없음) — `docs/PHASE6_ADMIN_AUTH_DECISION.md` §6이 이미 절차를 설계해 둠: 개발자 본인의 `auth.users` UUID를 Supabase Dashboard SQL Editor(또는 1회성 service_role 스크립트)로 `INSERT INTO admins (user_id, role) VALUES ('<uuid>', 'super');` 직접 실행 | **Phase9-1 코드와 무관한 운영 절차** — 이미 설계돼 있으므로 새로 설계할 필요 없음. 다만 실제로 이 INSERT를 언제 누가 실행할지는 Phase9-1 착수 시 확인 필요(§8 Required) |

**결론: 관리자 인증 기반(DB+RLS+판정 함수+API 보호)은 100% 완성된 상태다. Phase9-1이 새로 만들 것은 오직 "화면"(`app/admin/**`)과 그 화면이 쓰는 서비스 계층 확장뿐이다.** 관리자 인증 체계를 새로 만들 이유가 전혀 없다(지시문 원칙과 일치, 재확인).

---

## 3. DB / Migration 감사

실제 migration 원문(`0001`~`0013`) 전수 확인 기준. 신규 migration이 필요한지 항목별로 판정한다.

| 기능 | 필요한 데이터 | 현재 상태 | Migration 필요 여부 |
|---|---|---|---|
| 회차 입력 화면 | `draws` 테이블 쓰기 | 이미 완비(§2) | **불필요** |
| 꿈해몽 CRUD | `dreams`(`keyword`/`category`/`interpretation`/`image_url`), `dream_number_mappings`(`numbers`) | 둘 다 `0003_dreams.sql`에 이미 존재, 현재는 **읽기 서비스만**(`lib/api/dreams.ts`) 있고 쓰기(INSERT/UPDATE/DELETE) 서비스가 없음 — 테이블/컬럼 자체는 완비 | **테이블 불필요, 서비스 계층만 신규**(§4) |
| FAQ/가이드 CRUD | `faqs`/`guides`/`notices` 테이블 | **테이블 자체가 존재하지 않는다**(전수 확인, `0001`~`0013` 어디에도 `create table.*faqs\|guides\|notices` 없음). `docs/DATABASE_SCHEMA.md §3.22`는 "`faqs`/`guides`/`notices` (v1.0과 동일)"라고만 적혀 있고, **컬럼/타입 정의 표가 이 문서에 전혀 없다** — 참조 대상인 "v1.0" 문서 자체도 이 저장소에 없다(전수 확인, `docs/FEATURE_SPEC.md`에도 "faq"/"guide" 키워드 0건) | **필요 — 그러나 컬럼 스키마가 어디에도 정의돼 있지 않아 지금 바로 만들 수 없다**(§8 BLOCKER) |
| 대시보드 지표 | "오늘 신규가입"(`profiles.created_at`), "오늘 번호생성"(`user_numbers.created_at`), "다음 추첨까지 남은 시간"(계산, DB 불필요), "미처리 신고 건수"(`ADMIN_REQUIREMENTS.md §1`이 언급하나 `reports` 테이블은 Phase4 스코프라 존재하지 않음) | 3/4 지표는 기존 테이블로 충분, 1개("미처리 신고")는 원천적으로 불가능 | **불필요(단, "미처리 신고" 지표는 이번 Phase에서 뺀다 — §5)** |
| `admin_audit_logs` | 관리자 액션 감사로그 | 존재하지 않음. Phase6-4-1이 이미 "필요해지는 시점(Phase9)에 별도 migration"으로 명시적으로 미뤄뒀다(`docs/PHASE6_ADMIN_AUTH_IMPLEMENTATION_REPORT.md §5`) | **EXECUTION_PLAN Phase9의 완료 기준에는 없음 — Deferred(§8)**, 지시문 §7이 재감사를 금지한 기존 Known Issue와 동일 성격 |

**Migration 판정 요약**: 회차 입력/대시보드는 신규 migration 불필요. 꿈해몽 CRUD도 테이블은 있으니 migration 불필요(서비스 계층만 신규). **FAQ/가이드만 신규 테이블이 필요하지만, 그 스키마를 지금 추측해서 만들 수 없다** — 이것이 이번 감사의 핵심 BLOCKER다.

기존 RLS로 충분한가: `DATABASE_SCHEMA.md §6`(관리자 정책 공통 원칙, 원문 재확인)이 이미 "Phase9에서 관리자 플래그가 생기더라도 클라이언트가 직접 RLS를 통과해 쓰는 대신 **서버 API route + service_role 패턴을 그대로 유지할 것을 권장**"이라고 명시한다 — 즉 `faqs`/`guides`/`notices`를 실제로 만들더라도 **client 대상 INSERT/UPDATE/DELETE RLS 정책을 새로 만들 필요가 없다**(`dreams`/`draws`와 동일하게 전체 공개 SELECT + service_role 전용 쓰기 패턴을 그대로 적용하면 됨). 이 원칙은 이미 결정된 사항이라 재결정하지 않는다.

---

## 4. 관리자 UI / API 구조 조사

기존 프로젝트 컨벤션(Server Component가 인증 판단 → Client Component는 상태/이벤트만, Phase5 `NumberGenerator.tsx`/Phase7 `DreamJournalForm.tsx` 패턴)을 그대로 따르는 것을 전제로 조사했다.

| 항목 | 조사 결과 |
|---|---|
| 관리자 페이지 경로 | EXECUTION_PLAN이 이미 `app/admin/page.tsx`, `app/admin/lottery/draws/page.tsx`, `app/admin/content/dreams/page.tsx`, `app/admin/content/faqs/page.tsx`, `app/admin/content/guides/page.tsx`로 확정해 둠 — 새로 설계할 필요 없음 |
| 관리자 레이아웃 | `app/admin/layout.tsx` 필요 — 기존 `app/layout.tsx`(Root)와 별개로, `/admin/*` 전용 인증 게이트+네비게이션을 두는 것이 Next.js 표준 패턴(`app/my/*`는 이런 별도 layout이 없고 각 페이지가 개별 인증하는 방식을 써왔다는 점과 다름 — `/admin/*`은 페이지 수가 늘어날 예정이라 layout에서 인증을 한 번만 확인하는 것이 반복을 줄인다) |
| 관리자 네비게이션 | 기존 `GlobalNav`/`BottomNavigation`과 별개의 관리자 전용 네비(사이드바 또는 상단 탭)가 필요 — 기존 컴포넌트를 재사용할 이유 없음(일반 사용자 네비게이션과 목적이 다름) |
| Route Handler | 회차 입력: 기존 `POST /api/admin/draws` 재사용. 꿈해몽 CRUD: `POST`/`PATCH`/`DELETE /api/admin/dreams`(신규, 패턴은 `/api/admin/draws`와 동일하게 `getCurrentUser()`→`isAdmin()`→검증→`service_role` 처리). FAQ/가이드: 테이블이 생긴 뒤에만 설계 가능(§3 BLOCKER와 연동) |
| service layer | 꿈해몽 쓰기: `lib/api/admin/dreams.ts`(신규, `lib/api/admin/draws.ts`와 동일한 디렉터리 컨벤션) — 기존 `lib/api/dreams.ts`(조회 전용, Phase7 계약)는 무수정, 쓰기는 별도 파일로 분리(Phase7-4가 `lib/api/journal.ts` 조회/쓰기를 분리한 것과 동일한 기존 패턴 재사용) |
| client/server component 경계 | 목록/상세 조회는 Server Component가 담당(기존 `lib/api/dreams.ts` 또는 신규 `lib/api/admin/dreams.ts` 직접 호출), 폼 제출(생성/수정/삭제)만 Client Component로 분리 — Phase7 `DreamJournalForm.tsx`와 동일 패턴 |
| 데이터 조회/변경 책임 | 조회: 공개 데이터(`dreams`)는 기존 anon 클라이언트로 충분(관리자든 아니든 동일 SELECT RLS). 변경(INSERT/UPDATE/DELETE): 반드시 `service_role`(§3 RLS 원칙 재확인) |
| service_role이 필요한 지점 | `dreams`/`dream_number_mappings` INSERT/UPDATE/DELETE(신규 서비스), `faqs`/`guides`/`notices` 전체(테이블 생긴 뒤), `draws` INSERT(기존, 무수정) |
| 일반 사용자에게 노출되면 안 되는 데이터 | 관리자 화면 자체(관리자가 아니면 페이지 진입 불가 — §6), `admins` 테이블의 다른 관리자 `user_id` 목록(현재 `admins_select_own`이 본인 행만 허용하므로 이미 차단됨, 신규 조치 불필요) |

**Proxy/Route Handler 2계층 원칙 재확인**: 지시문이 강조한 "Proxy는 1차 UX 보호, Route Handler의 `isAdmin()`이 최종 보안 경계"는 이미 `docs/PHASE6_ADMIN_AUTH_DECISION.md §7/§8`이 설계하고 `/api/admin/*`에 대해 실제로 구현된 원칙이다(Phase6-4-2). Phase9-1이 새로 할 일은 이 원칙을 **페이지 라우트(`/admin/*`)에도 동일하게 적용**하는 것뿐이다 — `app/admin/layout.tsx`가 `getCurrentUser()`+`isAdmin()`으로 1차 확인(기존 `/my/journal/dreams/new/page.tsx`가 로그인만 확인하듯 이 layout은 관리자 여부까지 확인), `proxy.ts`는 선택적으로 `/admin` 경로를 `PROTECTED_PATHS`에 추가해 비로그인 사용자를 조기에 걸러낼 수 있다(성능/UX 최적화일 뿐, 없어도 layout이 최종 방어선이라 보안상 필수는 아님 — 정확히 `hasProfile()`과 `/onboarding`의 관계와 동일한 구조).

---

## 5. Phase9 데이터 흐름

### A. 회차 입력 (기존 서비스 100% 재사용)

```
관리자 로그인(기존, 무수정)
→ /admin/lottery/draws 접근 → app/admin/layout.tsx가 isAdmin() 확인(신규)
→ 폼 입력(신규 UI, Client Component)
→ POST /api/admin/draws(기존, 무수정) — getCurrentUser()→isAdmin()→parseAdminDrawsInput()→registerDrawAndMatchUserNumbers()
→ draws INSERT + user_numbers 일괄 대조 + notifications 생성(전부 기존 로직)
→ 결과 확인(신규 UI가 응답의 matchedCount/winnersCount/failedUpdateIds 표시)
```

새로 작성할 파일은 `app/admin/lottery/draws/page.tsx`(폼 UI)뿐이다. **판정/저장 로직을 다시 만들지 않는다.**

### B. 꿈해몽 CRUD (조회는 재사용, 쓰기는 신규)

```
관리자 로그인 → /admin/content/dreams 접근 → isAdmin() 확인(공용 layout)
→ 목록 조회: 기존 lib/api/dreams.ts의 getDreams()(무수정, 조회 전용 계약 유지)
→ 생성/수정/삭제 폼 제출(신규 UI)
→ POST/PATCH/DELETE /api/admin/dreams(신규 Route Handler)
→ 신규 lib/api/admin/dreams.ts(service_role, 입력 검증 후 dreams/dream_number_mappings 쓰기)
→ 결과 확인
```

### C. FAQ/가이드 CRUD — **§3/§8의 BLOCKER 때문에 이번 Phase9-1에서 착수 불가**

스키마가 없어 흐름 자체를 설계할 수 없다. Decision(§8) 확정 후 별도 sub-phase에서 A/B와 동일한 패턴(조회 공개 SELECT + 쓰기 service_role Route Handler)으로 진행하면 된다.

### D. 대시보드 지표

```
관리자 로그인 → /admin 접근 → isAdmin() 확인
→ Server Component가 직접 집계 쿼리(신규, 각각 단순 count — profiles.created_at 오늘자, user_numbers.created_at 오늘자, 다음 토요일까지 남은 시간 계산)
→ 위젯 렌더링
```

새 서비스 함수가 필요하다면 최소한으로("오늘 가입자 수"/"오늘 생성 수"는 각각 한 줄짜리 count 쿼리라 별도 파일로 분리할 만큼 복잡하지 않음 — Phase9-1 착수 시 실제 구현 규모를 보고 결정).

---

## 6. 보안 감사 (Phase9에서 신규로 발생할 위험만)

| 위험 | Phase9 예정 구조에서의 평가 |
|---|---|
| 일반 사용자의 관리자 API 접근 | `/api/admin/draws`는 이미 차단 검증 완료(Phase6). 신규 `/api/admin/dreams` 등도 동일 패턴(`getCurrentUser()`→`isAdmin()`)을 그대로 적용하면 위험 없음 — **새 패턴을 발명하지 않는 것 자체가 이 위험의 예방책** |
| 관리자 아닌 사용자의 관리자 **페이지** 접근 | 현재 `/admin/*`는 라우트 자체가 없어 위험이 존재하지 않는다. Phase9-1이 페이지를 만들 때 `app/admin/layout.tsx`에서 `isAdmin()` 확인을 반드시 넣어야 한다 — **누락 시 실제 위험이 되므로 §4의 2계층 원칙 적용이 필수** |
| ID/user_id 위조 | 기존 전 Phase(4~8)에서 반복 검증된 원칙(클라이언트가 보낸 `user_id`를 신뢰하지 않고 `getCurrentUser()`만 사용) 그대로 적용 — Phase9 신규 코드도 이 컨벤션만 따르면 됨 |
| 다른 사용자의 데이터 접근 | 관리자 화면이 조회하는 데이터(`dreams`, `draws`, 집계 통계)는 전부 공개 데이터이거나 집계값이라 "특정 사용자의 비공개 데이터를 관리자가 임의로 열람"하는 기능이 이번 Phase9 스코프에 없음 — **위험 자체가 이번 범위에 없음** |
| `service_role` 노출 | 신규 서비스 파일(`lib/api/admin/dreams.ts` 등)도 `lib/api/admin/draws.ts`와 동일하게 Route Handler(서버)에서만 import되어야 한다 — Client Component에서 직접 import 금지(기존 컨벤션) |
| 클라이언트 입력 신뢰 | 신규 CRUD 입력(꿈 keyword/category/interpretation, 추천번호)도 `parseAdminDrawsInput()`과 동일한 화이트리스트 검증 패턴 필요 — 숫자 배열(`dream_number_mappings.numbers`)은 기존 `assertValidNumberSet()`(`lib/logic/matchNumbers.ts`)를 그대로 재사용 가능(복제 금지) |
| 권한 상승 | `admins` 테이블에 client INSERT/UPDATE 정책이 없어(§2) 일반 사용자가 스스로 관리자가 될 경로가 없다 — Phase9 신규 코드가 이 정책을 건드리지 않는 한 위험 없음 |
| DELETE/UPDATE 권한 | 꿈해몽 DELETE는 파괴적 액션 — `ADMIN_REQUIREMENTS.md §9`(2단계 확인)가 이미 원칙으로 정해져 있다(재결정 불필요, UI 구현 시 그대로 적용) |
| 민감정보 노출 | 관리자 화면이 다루는 데이터(꿈 콘텐츠, 회차 결과)는 원래 공개 데이터라 노출 위험이 낮다. 대시보드의 "오늘 신규가입 수"는 집계값(개인 식별 정보 아님)이라 문제없음 |
| CSRF/서버 요청 위조 | 이 프로젝트는 세션 쿠키+`getCurrentUser()`로 매 요청 검증(Phase2 이래 일관 패턴), 별도 CSRF 토큰 체계가 없다는 것은 기존 프로젝트 전역의 기존 상태이지 Phase9이 새로 만드는 위험이 아니다(Phase9 스코프에서 새로 발생하지 않음, 재론하지 않음) |
| 관리자 권한 변경 경로 | `admins` INSERT/DELETE는 여전히 SQL Editor/1회성 스크립트로만 가능(§2) — Phase9-1이 "관리자 계정 관리 화면"을 만들지 여부는 결정 필요(§8) |

**결론: Phase9이 기존 패턴(Route Handler+`isAdmin()`+`service_role`)을 그대로 재사용하는 한 신규 보안 위험은 낮다.** 유일하게 실제로 새로 신경 써야 할 지점은 "페이지 레벨 인증 게이트를 빠뜨리지 않는 것"(`app/admin/layout.tsx`)이다.

---

## 7. 기존 Known Issue 재확인 (재감사하지 않음)

지시문 §7이 나열한 항목(`/generate` 표기, `proxy` 문서 불일치, WCAG, 번호 5색, SSG/ISR, Rich Results Test, Search Console, Case C, `user_numbers` 위조 가능성) — **전부 Phase9와 직접 연관이 없어 이번 감사에서 재조사하지 않았다.** 코드 검토 중 이 항목들과 접촉하는 지점이 없음을 확인했다(관리자 화면은 이 이슈들이 위치한 `/generate`/`/dream/*`/`user_numbers` 판정 컬럼 자체를 재구현하지 않기 때문).

---

## 8. 의사결정 사항

이미 다른 문서(Phase6 시리즈)가 결정해 둔 사항은 다시 제시하지 않는다(예: Option C 관리자 인증 방식, 역할 단일화, `service_role`+Route Handler 패턴 — 전부 기 확정).

### BLOCKER

**D1. FAQ/가이드/공지 스키마 부재**
- **문제**: `faqs`/`guides`/`notices` 테이블이 어떤 migration에도 없고, `DATABASE_SCHEMA.md §3.22`는 컬럼 정의 없이 "v1.0과 동일"이라고만 적혀 있으며 그 "v1.0" 문서가 저장소에 존재하지 않는다. `FEATURE_SPEC.md`에도 관련 스펙이 전혀 없다.
- **결정하지 않고 구현하면 생기는 문제**: 컬럼(title/body/category/order/게시여부 등)을 추측해서 migration을 만들면 "실제 schema를 추측하지 말라"는 이 프로젝트의 반복된 원칙(Phase1 Schema Freeze, Phase4/6/7 전 감사에서 일관되게 적용된 규칙)을 정면으로 위반한다. 잘못된 컬럼 설계로 만들면 이후 재작업(migration 되돌리기)이 필요해진다.
- **필요한 조치**: 사용자가 FAQ/가이드/공지의 최소 컬럼(제목/본문/카테고리/노출순서/공개여부 등)을 확정해야 migration을 설계할 수 있다. 확정 전까지 **Phase9-1에서 FAQ/가이드 CRUD를 제외**하고 회차 입력+꿈해몽 CRUD+대시보드로 먼저 진행하는 것을 권장(§10).

### Required

**D2. `/admin/*` 페이지의 proxy 보호 여부**
- **문제**: 현재 `proxy.ts`의 `PROTECTED_PATHS`에 `/admin`이 없다(`/api/admin`만 있음, §2). 페이지가 생기면 이 목록에 추가할지, 아니면 `app/admin/layout.tsx`의 자체 `isAdmin()` 확인만으로 충분할지 결정 필요.
- **결정하지 않고 구현하면 생기는 문제**: `app/admin/layout.tsx`가 인증을 빠뜨리면(구현 실수) 관리자 화면이 그대로 노출된다 — proxy가 1차 방어선 역할을 하면 이 실수의 영향이 줄어든다. 다만 `proxy.ts`가 anon 클라이언트로 `admins`를 조회하려면 `hasProfile()`과 동일한 패턴(§4)이 필요해 `proxy.ts` 수정이 불가피 — 이번 Task는 이 파일을 수정하지 않았으므로 실제 결정/구현은 Phase9-1 몫이다.

**D3. 최초 관리자 계정 등록 시점**
- **문제**: 현재 `admins` 테이블이 비어 있다(§2). 코드가 완성돼도 실제로 관리자로 로그인할 계정이 없으면 화면을 검증할 수 없다.
- **결정하지 않고 구현하면 생기는 문제**: Phase9-1 구현 완료 후 실제 HTTP 검증(이 프로젝트가 매 Phase마다 요구해 온 절차)을 할 수 없다 — 이미 설계된 절차(§2, `PHASE6_ADMIN_AUTH_DECISION.md §6`)를 실행할 시점만 정하면 된다(설계를 새로 할 필요는 없음).

### Recommended

**D4. `app/admin/layout.tsx`의 네비게이션 범위**
- ADMIN_REQUIREMENTS.md는 `/admin/lottery`, `/admin/content`, `/admin/engagement`(Phase4+), `/admin/users`, `/admin/notifications`, `/admin/settings` 등 넓은 메뉴 구조를 그린다. Phase9-1은 이번에 실제로 만드는 3개 화면(회차입력/꿈해몽/[FAQ·가이드]+대시보드)만 네비게이션에 넣고, 아직 없는 메뉴 항목을 미리 만들어 두지 않는 것을 권장한다(Phase7-0이 "존재하지 않는 페이지를 홈 카드에 미리 연결해 두는 것"과는 다른 상황 — 그때는 라우트가 예정돼 있었지만 지금은 스펙조차 없는 항목이 섞여 있음).

### Deferred

**D5. `admin_audit_logs`** — Phase6-4-1이 이미 Phase9로 미뤄뒀지만, EXECUTION_PLAN Phase9의 완료 기준 3개(§1) 어디에도 감사로그가 없다. **Phase9-1의 필수 요구사항이 아니다** — 관리자 액션 종류가 실제로 늘어나 감사 필요성이 커지는 후속 시점까지 다시 미룬다.

**D6. ADMIN_REQUIREMENTS.md §3.2(당첨사례)/§3.3(로또명당)/§4(커뮤니티·배틀)/§5(회원관리)/§6(알림 확장)/§7(쇼핑몰)/§8(감사로그·시스템설정)** — 전부 EXECUTION_PLAN Phase9 스코프 밖(§1 근거). 각자 대응하는 EXECUTION_PLAN 후속 Phase(대부분 아직 시작조차 안 함)에서 다룬다.

---

## 9. 구현하지 않은 사항 확인

이번 Task는 지시대로 production 코드/migration/RLS/UI를 전혀 수정하지 않았다. `git status`로 확인한 변경 파일은 본 보고서(`docs/PHASE9_PRE_IMPLEMENTATION_AUDIT.md`) 1개뿐이다.

---

## 10. 최종 판정

- **Phase9 범위**: EXECUTION_PLAN 원문 기준 "단일 관리자 판별 + 회차입력 화면 + 꿈해몽 CRUD 화면 + FAQ/가이드 CRUD 화면 + 대시보드 핵심 지표"(§1). ADMIN_REQUIREMENTS.md의 더 넓은 항목(당첨사례/로또명당/커뮤니티/배틀/회원관리/쇼핑몰/감사로그)은 전부 범위 밖.
- **현재 구현된 기반**: `admins`/`admin_role`/RLS/`isAdmin()`/`/api/admin/*` proxy 보호/`app/api/admin/draws/route.ts`/`lib/api/admin/draws.ts`/`draws` 테이블 — **관리자 인증·회차입력 백엔드는 100% 완성**(Phase6). `lib/api/dreams.ts`(조회)도 완성(Phase7).
- **신규 구현 필요 영역**: `app/admin/**`(레이아웃+5개 페이지, 전무), 꿈해몽 쓰기 서비스(`lib/api/admin/dreams.ts`+Route Handler, 전무), 대시보드 집계 쿼리(전무). FAQ/가이드는 스키마 확정 전까지 구현 불가.
- **DB 변경 필요 여부**: 회차입력/꿈해몽/대시보드는 **불필요**. FAQ/가이드만 **필요하나 스키마 미확정**(BLOCKER).
- **Migration 필요 여부**: 위와 동일 — FAQ/가이드 스키마 확정 후에만 신규 migration 1건 필요, 그 외는 불필요.
- **관리자 인증 재구축 필요 여부**: **불필요.** 기존 구조를 100% 재사용한다.
- **Critical**: 0
- **High**: 0
- **Medium**: 1 — D1(FAQ/가이드 스키마 부재, BLOCKER지만 보안/데이터 위험이 아니라 "스펙 없이 구현 불가" 성격이라 Critical/High가 아니라 Medium 완료-기준 저해 항목으로 분류)
- **Low**: 2 — D4(네비게이션 범위 조정 권고), 대시보드 "미처리 신고 건수" 지표를 이번 Phase에서 제외해야 한다는 점(§3)
- **BLOCKER**: D1(FAQ/가이드 스키마 미확정) — **FAQ/가이드 CRUD에 한해서만** 착수 불가. 회차입력/꿈해몽/대시보드는 BLOCKER 없음.
- **Phase9-1 착수 가능 여부**: **READY(부분)** — 회차입력 화면·꿈해몽 CRUD·대시보드는 즉시 착수 가능. FAQ/가이드 CRUD는 D1 해결(스키마 확정) 전까지 보류.

### Phase9-1에서 가장 먼저 구현해야 할 단 하나의 작업

**`app/admin/layout.tsx` + `app/admin/page.tsx`(관리자 인증 게이트만, 대시보드 위젯 없이 최소 형태)**

이유: EXECUTION_PLAN 구현순서 1번("관리자 판별+미들웨어 보호")이자 이후 모든 관리자 화면(회차입력/꿈해몽/FAQ)이 공유하는 전제조건이다. 이미 완성된 `isAdmin()`(§2)을 페이지 레벨에서 처음으로 실제 사용하는 지점이라 새 로직이 거의 없고("이미 있는 것을 재사용"), 이 한 파일이 검증되면 나머지 화면은 같은 레이아웃 아래에 페이지만 추가하면 되므로 재작업 위험이 가장 낮다. D2(proxy 보호 여부)와 D3(최초 관리자 계정 등록)는 이 작업 착수 직전에 결정하면 충분하다.

---

## Validation

이번 Task는 코드 변경이 없어 `lint`/`type-check`/`test`/`build`를 실행할 대상 변경사항이 없다. 그럼에도 지시문 §10이 "실제 validation 결과"를 요구해 baseline 확인 목적으로 실행했다.

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과, 경고 0건 |
| `npm run type-check` | 통과 |
| `npm test` | 통과 — 12 test files, **168 tests**(Phase8-5 종료 시점과 동일, 변화 없음) |
| `npm run build` | 통과, 라우트 21개(변화 없음) |

`git status` 확인 결과 이번 Task로 변경된 파일은 `docs/PHASE9_PRE_IMPLEMENTATION_AUDIT.md` 1개뿐이다.
