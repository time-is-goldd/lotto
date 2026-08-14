# Phase9 FAQ/가이드 최소 스키마 및 구현 범위 결정

> DECISION ONLY. Production 코드/DB/Migration/RLS/UI를 전혀 수정하지 않았다(전수 확인: 변경 파일은 본 보고서 1개뿐). Phase6~9에서 이미 구현·검증된 관리자 인증/회차관리/꿈해몽 CRUD/대시보드는 재조사·재구현하지 않았다.

---

## 1. 현재 요구사항 (실제 문서 전수 확인)

`docs/EXECUTION_PLAN.md`, `docs/PHASE9_PRE_IMPLEMENTATION_AUDIT.md`, `docs/ADMIN_REQUIREMENTS.md`, `docs/DATABASE_SCHEMA.md`, `docs/FEATURE_SPEC.md`, `docs/SITEMAP.md`, `docs/INFORMATION_ARCHITECTURE.md`, `docs/CONTENT_STRATEGY.md`을 전부 `faq|가이드|guide|공지|notice` 키워드로 재검색했다(Phase9-0이 이미 확인한 것 외에 새로 찾은 근거만 아래에 정리).

| 문서 | 실제 서술 |
|---|---|
| `EXECUTION_PLAN.md` Phase9 §3 | 생성할 파일: `app/admin/content/faqs/page.tsx`, `app/admin/content/guides/page.tsx`(**관리자 화면만**, 공개 페이지 없음) |
| `EXECUTION_PLAN.md` Phase9 §6 | 완료 기준: "꿈해몽/FAQ/가이드 **CRUD** 정상 동작"(공개 노출까지는 요구하지 않음) |
| **`EXECUTION_PLAN.md` Phase10 §3(신규 발견)** | 생성할 파일: `app/faq/page.tsx`, `app/guide/[topic]/page.tsx` — **공개 페이지는 Phase9가 아니라 Phase10 소관으로 이미 명시돼 있다.** Phase9-0/9-1~9-4 어느 보고서도 이 사실을 명시적으로 언급하지 않았다 |
| `SITEMAP.md` §4 | `/guide/*`, `/faq/*`는 **P2**(신뢰도/롱테일/확장 보조) — `/dream/*`(P0)보다 우선순위가 낮음. `/notice`는 `/about`/`/terms`/`/privacy`와 함께 별도로 나열(§1) |
| **`CONTENT_STRATEGY.md`(신규 발견)** | "가이드/FAQ: 운영자 작성(MVP 최소 3~5편)", "공지/이벤트: 운영자, 수시", "FAQ 최소 5문항, 가이드 최소 3편" — **콘텐츠 분량 목표**는 있지만 스키마/필드 요구는 없음 |
| `ADMIN_REQUIREMENTS.md` §2.2 | "FAQ / 가이드 / 공지 관리 — 유지 (변경 없음)" — v1.0 문서를 그대로 가리킬 뿐 실제 필드 목록 없음(Phase9-0이 이미 확인) |
| `FEATURE_SPEC.md` | "faq"/"가이드"/"guide"/"공지"/"notice" **0건** — 기능 명세 자체가 없음(Phase9-0 재확인) |
| `DATABASE_SCHEMA.md §3.22` | "`faqs` / `guides` / `notices` (v1.0과 동일)" — 컬럼 정의 표 없음(Phase9-0이 이미 확인, 재확인만 함) |

### 정리

- FAQ 필요: 예(EXECUTION_PLAN Phase9 완료 기준에 명시).
- 가이드 필요: 예(동일).
- **공지사항 필요 여부: Phase9 범위 아님** — `EXECUTION_PLAN.md` Phase9의 "생성할 파일" 목록에 공지 관리 화면이 없다. `ADMIN_REQUIREMENTS.md`가 셋을 한 섹션에 묶어 서술한 것과 달리, 실제 실행 계획(EXECUTION_PLAN)은 공지사항을 Phase9에 포함하지 않았다 — **문서 간 우선순위는 지시문 원칙대로 EXECUTION_PLAN을 따른다.**
- CRUD 범위: 관리자 CRUD만. **공개 페이지(`/faq`, `/guide/[topic]`)는 Phase10 소관**이라 이번 결정·후속 구현 범위에 포함하지 않는다.
- 콘텐츠 분량(FAQ 5문항, 가이드 3편)은 **운영자가 채워야 할 실제 콘텐츠 목표**이지 스키마 요구사항이 아니다 — 이번 결정에서 다루지 않는다(관리자가 직접 작성).

---

## 2. 기존 문서 간 요구사항 비교 (충돌과 해소)

| 충돌 | 내용 | 해소 방법 |
|---|---|---|
| `ADMIN_REQUIREMENTS.md`(FAQ+가이드+공지 한 섹션) vs `EXECUTION_PLAN.md` Phase9(FAQ+가이드만, 공지 없음) | 범위 불일치 | EXECUTION_PLAN이 이 프로젝트가 실제로 실행해 온 기준 문서(Phase7-0/8-0/9-0이 반복 확정)이므로 그대로 따른다 — **공지사항은 이번 결정에서 제외**, 필요해지면 별도 Phase에서 다룬다 |
| `DATABASE_SCHEMA.md §3.22`("`faqs`/`guides`/`notices`" 3개 별도 이름) vs 실제로 필요한 것은 2개(공지 제외) | 원 설계 의도가 3테이블이었을 가능성 | §3.22는 컬럼 정의가 없는 참조뿐이라 "3개 분리 테이블"이라는 결정 자체가 실제로 확정된 적이 없다(Phase9-0이 이미 확인) — 이번 문서에서 스키마를 새로 설계하며 이 참조에 얽매이지 않는다 |
| `EXECUTION_PLAN.md` Phase9 §3(관리자 파일 2개, `faqs`/`guides` 별도) vs "1인 개발 최소화" 원칙(통합 여지) | 문서는 화면 2개를 계획했지만 테이블까지 2개라고 명시하지는 않음 | **화면(라우트)은 문서 계획대로 2개 유지, 테이블은 통합 여부를 이번 §6에서 별도로 비교·결정** — 문서를 "덮어쓰는" 것이 아니라 문서가 명시하지 않은 부분(테이블 수)만 새로 정한다 |

이번 문서에서 임의로 덮어쓴 기존 결정은 없다 — 전부 "문서가 정하지 않은 빈 자리"만 채웠다.

---

## 3. 현재 코드/DB 재사용 가능 여부

| 항목 | 확인 결과 |
|---|---|
| 재사용 가능한 기존 테이블 | **없음** — `faqs`/`guides`/`notices` 어느 것도 `supabase/migrations/*.sql` 어디에도 없음(`grep "create table.*faq\|guide\|notice"` 전수 검색, 0건) |
| 재사용 가능한 RLS 패턴 | `dreams_select_public`(전체 공개 SELECT) + INSERT/UPDATE/DELETE 정책 없음(service_role 전용) — `0008_rls_policies.sql`의 "관리자 정책 공통 원칙" 그대로 재사용 가능 |
| 재사용 가능한 관리자 CRUD 서비스 패턴 | `lib/api/admin/dreams.ts`(Phase9-3) — `parseXxxCreateInput`/`parseXxxUpdateInput`/`createXxx`/`updateXxx`/`deleteXxx` 구조를 그대로 재사용 가능 |
| 재사용 가능한 관리자 Form/UI 패턴 | `components/admin/DreamForm.tsx`(생성/수정 공용 폼), `components/admin/DeleteDreamButton.tsx`(확인 다이얼로그) — 동일 패턴 재사용 가능 |
| 재사용 가능한 공개 콘텐츠 페이지 패턴 | `app/dream/[keyword]/page.tsx`(Phase7-2/8) — **단, 이번 결정 범위 밖(Phase10)**이라 지금 재사용 계획만 기록해둔다 |
| SEO metadata 패턴 | `generateMetadata()` + `alternates.canonical` + OG/Twitter(Phase8-2) — Phase10에서 재사용 |
| sitemap 포함 여부 | `app/sitemap.ts`(Phase8-1)가 이미 `dreams`를 anon 클라이언트로 직접 조회하는 패턴 — Phase10에서 `guides`(개별 URL 있음)를 추가할 때 동일 패턴 재사용 가능. **FAQ는 개별 URL이 없어(SITEMAP.md `/faq/*`가 P2로 존재하긴 하나 이 프로젝트의 실제 계획은 `/faq` 단일 페이지, `app/faq/page.tsx` 하나뿐) sitemap에는 `/faq` 페이지 URL 1개만 추가하면 된다** |
| enum 네이밍 컨벤션 | `<table>_<column>` 형태(`user_numbers_generation_method`, `admin_role` 등, `grep "create type public\."` 전수 확인) — 새 enum도 이 컨벤션을 따른다 |

**결론: 재사용 가능한 테이블은 없지만, 재사용 가능한 패턴(RLS/서비스/UI/enum 네이밍)은 전부 이미 확립돼 있다 — 새 패턴을 발명할 필요가 없다.**

---

## 4. FAQ 최소 스키마 제안

| 컬럼 | 타입 | NULL | 근거 |
|---|---|---|---|
| `id` | bigint identity | NOT NULL | 기존 컨벤션 |
| `title` | varchar(200) | NOT NULL | 질문. `dreams.keyword`(varchar(50))보다 넉넉하게 잡음 — 질문은 문장형이라 50자로는 부족할 수 있다(예시 문장 길이 기준 200자면 충분) |
| `body` | text | NOT NULL | 답변. 길이 제약 없음(`dreams.interpretation`과 동일 이유) |
| `display_order` | int | NOT NULL DEFAULT 0 | §6-B에서 근거 상세 |
| `created_at`/`updated_at` | timestamptz | NOT NULL DEFAULT now() | `dreams`와 동일, `updated_at`은 트리거로 자동 갱신(`public.set_updated_at()` 기존 함수 재사용, 새 함수 만들지 않음) |

**포함하지 않은 것과 이유**: `category`(§6-C), `is_published`(§6-D), `slug`(FAQ는 개별 URL이 없어 애초에 불필요).

---

## 5. 가이드 최소 스키마 제안

| 컬럼 | 타입 | NULL | 근거 |
|---|---|---|---|
| `id` | bigint identity | NOT NULL | |
| `title` | varchar(200) | NOT NULL | 가이드 제목. **URL 세그먼트로도 그대로 재사용한다** — `dreams.keyword`가 별도 slug 컬럼 없이 URL로 직접 쓰이는 기존 컨벤션(Phase7-1 Decision, `components/dream/DreamCard.tsx`의 `encodeURIComponent(dream.keyword)` 패턴)을 그대로 따른다. `EXECUTION_PLAN.md`의 라우트명 자체가 `/guide/[topic]`이라 "slug"라는 개념을 새로 만들 근거가 없다 |
| `body` | text | NOT NULL | 가이드 본문 |
| `display_order` | int | NOT NULL DEFAULT 0 | FAQ와 동일 근거 |
| `created_at`/`updated_at` | timestamptz | NOT NULL DEFAULT now() | 동일 |

**포함하지 않은 것**: `category`, `is_published`(§6), 별도 `slug` 컬럼(위 근거).

---

## 6. FAQ와 가이드 통합/분리 비교

### 비교표

| 기준 | 분리(2개 테이블: `faqs`/`guides`) | 통합(1개 테이블 + `type`) |
|---|---|---|
| 구현 복잡도 | migration 2배(테이블+RLS+enum 없음) | migration 1개, RLS 1세트 |
| 관리자 CRUD 단순성 | 서비스 파일 2개(`lib/api/admin/faqs.ts`, `lib/api/admin/guides.ts`) | 서비스 파일 1개(`lib/api/admin/content.ts`), `type` 파라미터로 분기 |
| RLS 단순성 | 정책 8개(테이블당 SELECT/INSERT/UPDATE/DELETE ×2) | 정책 4개 |
| SEO | 영향 없음(Phase10에서 어느 쪽이든 동일하게 조회 가능) | 영향 없음 |
| 향후 유지보수 | 스키마가 늘어날 때마다(예: 공지 추가) 테이블이 계속 늘어남 | `type` 값만 추가하면 확장(예: `'notice'`) — 이번엔 추가하지 않지만 **경로만 열어둠** |
| 1인 개발 적합성 | 낮음(관리 지점 2배) | **높음**(관리 지점 1개) |
| 기존 프로젝트 구조와의 일관성 | `notifications.type` enum처럼 "한 테이블 + type enum으로 유사 콘텐츠를 묶는" 기존 패턴과는 다른 방향 | **`notifications`(type: `win_result`/`battle_result`/`system`/`marketing`)가 이미 증명한 패턴과 일치** |
| 데이터 무결성 | 테이블별 독립이라 혼선 없음 | `type`이 없거나 잘못되면 문제 — enum + NOT NULL로 방지 가능(`admin_role`과 동일 방식) |
| Phase10 이후 확장성 | 공지사항 추가 시 세 번째 테이블 신설 필요 | `type` 값 하나(`'notice'`) 추가 + 필요 시 컬럼 추가만으로 확장 |

### 권고안: **통합(`content_entries` + `type` enum)**

**이유**: (1) 1인 개발 적합성과 유지보수 관점에서 명백히 유리하다 — `lib/api/admin/dreams.ts`(Phase9-3)와 동일한 서비스 파일 패턴을 재사용하면서도 파일 수는 늘리지 않는다. (2) 이 프로젝트에 이미 "유사한 콘텐츠를 하나의 테이블+`type` enum으로 묶는" 정확히 같은 패턴이 존재한다(`notifications.type`, `admins.role`) — 새 패턴이 아니라 **기존 패턴의 반복 적용**이다. (3) `EXECUTION_PLAN.md`가 계획한 화면 2개(`app/admin/content/faqs/page.tsx`, `app/admin/content/guides/page.tsx`)는 **테이블이 아니라 화면**을 지정한 것이므로, 테이블을 통합해도 그 두 화면(같은 테이블을 `type` 필터로 다르게 보여주는 두 페이지)을 그대로 만들 수 있어 문서 계획과 충돌하지 않는다. (4) 공지사항이 나중에 실제로 필요해지면 `type` 값 하나만 추가하면 되어 Phase10 이후 확장성도 더 유리하다.

**분리안을 채택하지 않는 이유**: FAQ(질문/답변)와 가이드(제목/본문)의 실질 필드 구조가 (`title`, `body`)로 완전히 동일하다 — 억지로 통합한 것이 아니라 원래 같은 모양이다. 유일한 차이(가이드만 개별 공개 URL을 가짐)는 Phase10의 공개 페이지 라우팅 문제이지 DB 스키마 문제가 아니다.

---

## 7. 확정 스키마 제안 (통합안 기준, migration 아님 — 제안만)

```text
table: content_entries

id             bigint       PK, generated always as identity
type           content_entries_type NOT NULL   -- enum('faq', 'guide')
title          varchar(200) NOT NULL
body           text         NOT NULL
display_order  int          NOT NULL DEFAULT 0
created_at     timestamptz  NOT NULL DEFAULT now()
updated_at     timestamptz  NOT NULL DEFAULT now()  -- 기존 set_updated_at() 트리거 재사용

enum: content_entries_type ('faq', 'guide')
      -- 기존 네이밍 컨벤션(<table>_<column>) 그대로, notifications_type/admin_role과 동일 패턴
```

**인덱스**: `content_entries_type_idx`(type 컬럼) — 관리자 목록 화면이 항상 `type`으로 필터링해 조회하므로(FAQ 목록/가이드 목록 분리 표시), 기존 프로젝트의 "FK 컬럼 기본 인덱스" 원칙과 같은 이유로 조회 조건 컬럼에 인덱스가 필요하다.

**UNIQUE 제약**: 없음. `title` UNIQUE도 걸지 않는다 — `dreams.keyword`도 UNIQUE가 아닌 기존 선례(Phase7-1이 이미 이렇게 결정, 재확인만 함)를 그대로 따른다. 중복 제목이 생겨도 서비스 로직 안전성(`.maybeSingle()` 등)으로 대응하는 기존 패턴을 재사용하면 된다.

**RLS 정책**:

| 정책 | 대상 | 근거 |
|---|---|---|
| `content_entries_select_public` | `anon, authenticated` SELECT `using (true)` | `dreams_select_public`과 동일한 "관리자 정책 공통 원칙" — 공개 콘텐츠는 전체 공개 |
| INSERT/UPDATE/DELETE | 정책 없음(=service_role 전용) | `dreams`/`draws`와 동일 |

**관리자 INSERT/UPDATE/DELETE 권한**: `service_role`만(Route Handler에서 `getCurrentUser()`→`isAdmin()` 확인 후 `lib/supabase/service.ts` 사용) — Phase9-3의 `lib/api/admin/dreams.ts`와 완전히 동일한 패턴.

**일반 사용자 SELECT 권한**: 비로그인 포함 전체 허용(RLS `using (true)`).

**"공개 여부"를 판단하는 방법**: **별도 컬럼을 두지 않는다.** `dreams`가 "생성 즉시 공개"인 것과 동일하게, `content_entries`도 행이 존재하면 곧 공개된 것으로 취급한다(§6-D 상세 근거). Phase10에서 공개 페이지를 만들 때 이 전제가 부족하다고 판단되면 그때 `is_published boolean not null default true` 컬럼을 추가하는 것이 순서상 맞다 — 지금은 소비자(공개 페이지)가 없는 상태에서 발행 상태를 미리 설계하는 것은 추측성 설계다.

**왜 이것이 "최소 스키마"인가**: 7개 컬럼(`id`/`type`/`title`/`body`/`display_order`/`created_at`/`updated_at`) 중 `id`/`created_at`/`updated_at`은 이 프로젝트의 모든 콘텐츠 테이블이 이미 공통으로 갖는 컬럼이고, `type`은 통합 테이블이 성립하기 위한 필수 판별자이며, `title`/`body`는 문서가 명시한 요구사항(질문+답변, 제목+본문)의 최소 표현이다. `display_order` 하나만 문서에 명시되지 않은 판단(§6-B)이고, 나머지는 전부 문서 요구사항 또는 기존 컨벤션에서 직접 도출됐다.

---

## 8. 판단 근거 상세 — 필드별 채택/제외 이유

### A. slug — **채택하지 않음**
가이드의 URL 키(`/guide/[topic]`)는 `title`을 그대로 재사용한다(§5). `dreams.keyword`가 이미 이 프로젝트에서 "별도 slug 컬럼 없이 자연어 필드를 URL 세그먼트로 직접 사용"하는 선례를 확정해 둔 상태라(Phase7-1 Decision), 존재하지 않는 개념을 새로 만들지 않는다는 원칙과 정확히 일치한다.

### B. display_order — **채택(단, 문서에 명시된 요구는 아님을 밝힘)**
어떤 문서에도 "정렬 가능해야 한다"는 문장은 없다. 그러나 FAQ/가이드는 태생적으로 "목록으로 소비되는" 콘텐츠라 노출 순서가 콘텐츠 품질에 직접 영향을 준다(가장 중요한 질문이 위로 오는 것이 자연스럽다). `int not null default 0` 컬럼 하나를 지금 추가하는 비용은 거의 0에 가깝지만, 나중에 추가하려면 별도 migration이 필요하다 — "미래 재작업 방지"가 "지금 추측성으로 만들지 않는다"는 원칙보다 우선한다고 판단했다. **이것은 이 문서의 판단이며, 사용자가 불필요하다고 보면 제거해도 나머지 설계에 영향이 없다.**

### C. category — **채택하지 않음**
`dreams.category`는 25건 규모에서 탐색을 돕기 위해 유의미했다. 그러나 `CONTENT_STRATEGY.md`가 명시한 초기 콘텐츠 규모는 "FAQ 최소 5문항, 가이드 최소 3편" — 총 8건 수준이다. 이 규모에서 카테고리 분류는 실익이 없고, 오히려 관리자 입력 부담만 늘린다(과도한 CMS 구조 회피 원칙, 지시문 §3). 콘텐츠가 실제로 늘어나 분류가 필요해지는 시점에 컬럼을 추가하는 것이 맞다.

### D. is_published(공개 여부) — **채택하지 않음**
이유 두 가지: (1) `dreams`가 이미 "생성 즉시 공개, 별도 발행 상태 없음" 패턴을 확립해 뒀다 — 일관성을 위해 같은 패턴을 따른다. (2) 지시문 §3이 명시적으로 "draft workflow"를 만들지 말라고 금지했다 — 발행 상태 컬럼은 draft workflow의 최소 형태이므로 이 금지 항목에 정확히 해당한다. (3) Phase9은 관리자 CRUD만 만들고 공개 페이지(Phase10)가 아직 없으므로, "공개 여부"를 판단할 소비자 자체가 지금 존재하지 않는다 — 필요성이 실증되지 않은 필드다.

### E. revision/history, rich text editor, image upload, scheduled publishing, view count, likes, comments, audit log — **전부 채택하지 않음**
지시문 §3이 명시적으로 예시로 든 항목들이며, 어떤 문서에도 요구사항으로 등장하지 않는다.

---

## 9. 관리자 CRUD 범위

- **생성**: `type`/`title`/`body`(필수) + `display_order`(선택, 기본 0).
- **조회(목록)**: `type`으로 필터링한 목록(FAQ 목록/가이드 목록 각각) — `app/admin/content/faqs/page.tsx`, `app/admin/content/guides/page.tsx`가 동일한 서비스 함수를 `type` 인자만 다르게 호출.
- **수정**: 전체 필드 재제출(Phase9-3의 `DreamForm` 패턴과 동일 — 부분 업데이트 개념 없음).
- **삭제**: 확인 다이얼로그 필요(`DeleteDreamButton`과 동일 패턴), FK로 참조하는 다른 테이블이 없어(신규 테이블이라 아직 아무것도 참조하지 않음) CASCADE 고려사항 자체가 없다.

이 범위는 Phase9-3(꿈해몽 CRUD)과 완전히 동일한 4개 동작(C/R/U/D)이며, 새로운 CRUD 패턴을 발명하지 않는다.

---

## 10. 공개 페이지 범위

**이번 결정/후속 구현 범위에 포함하지 않는다.** `EXECUTION_PLAN.md` Phase10 §3이 `app/faq/page.tsx`, `app/guide/[topic]/page.tsx`를 이미 Phase10 소관으로 명시했다(§1 신규 발견). Phase9은 관리자 CRUD까지만 완료하면 자신의 완료 기준을 충족한다.

---

## 11. SEO/sitemap 영향

**이번 결정 범위에서는 영향 없음** — 공개 페이지가 없으므로 SEO metadata/sitemap 작업 자체가 발생하지 않는다. Phase10에서 실제로 구현할 때를 대비해 다음만 기록해 둔다: `/faq`는 단일 페이지(목록 전체를 한 화면에 노출하는 것이 일반적인 FAQ UX와 `SITEMAP.md`의 실제 계획에 부합), `/guide/[topic]`은 `dreams`와 동일하게 `title`을 `encodeURIComponent`로 URL 세그먼트화한 개별 페이지 — `app/sitemap.ts`(Phase8-1)의 기존 패턴을 그대로 확장하면 된다.

---

## 12. 구현 난이도 및 유지보수 영향

- **신규 migration**: 1개(`content_entries` 테이블 + enum + 인덱스 + RLS, `dreams`+`0008` 규모와 비슷한 크기).
- **신규 서비스 파일**: `lib/api/admin/content.ts` 1개(`lib/api/admin/dreams.ts`를 그대로 본뜬 구조).
- **신규 Route Handler**: `app/api/admin/content/route.ts`(POST) + `app/api/admin/content/[id]/route.ts`(PUT/DELETE) — Phase9-3과 동일한 2-파일 구조.
- **신규 UI**: `ContentEntryForm`(생성/수정 공용, `DreamForm` 패턴 재사용) + `app/admin/content/faqs/page.tsx`/`app/admin/content/guides/page.tsx`(목록, `type` 필터만 다름) + 각각의 `new`/`[id]/edit` 페이지.
- 유지보수 부담: Phase9-3과 동일 수준(이미 검증된 패턴의 반복 적용) — 새로운 유지보수 부담 유형이 추가되지 않는다.

---

## 13. Phase9 완료 기준과의 관계

`EXECUTION_PLAN.md` Phase9의 완료 기준 3개 중 마지막 하나("꿈해몽/FAQ/가이드 CRUD 정상 동작")는 **관리자 CRUD 동작만을 요구**하며, 공개 노출이나 실제 콘텐츠 분량(CONTENT_STRATEGY의 "FAQ 5문항/가이드 3편")을 요구하지 않는다. 이 문서가 스키마를 확정함으로써 **Phase9-0이 지목한 유일한 BLOCKER(스키마 미확정)가 해소**됐다 — 실제 구현(migration+서비스+API+UI)은 이 문서의 후속 작업이며 이번 Task 범위가 아니다.

---

## 14. 최종 권고안

**Decision: A — FAQ/가이드는 Phase9에 실제 구현해야 한다.**

**근거**:
1. `EXECUTION_PLAN.md` Phase9의 완료 기준에 명시적으로 포함돼 있다.
2. 스키마를 가로막던 유일한 이유(정의 부재)가 이 문서로 해소됐다.
3. 통합 테이블 설계로 구현 규모가 Phase9-3(꿈해몽 CRUD)과 거의 동일한 수준으로 작아졌다 — 재작업 위험이 낮다.
4. 공개 페이지(Phase10)를 끌어오지 않아 범위가 계속 최소로 유지된다.

**B(Phase10 이월)를 채택하지 않는 이유**: 이월할 근거였던 "스키마 미확정"이 사라졌다. 남은 이유가 없다.
**C(추가 결정 필요)를 채택하지 않는 이유**: §2에서 발견한 문서 간 불일치(공지 포함 여부, 테이블 통합 여부)를 전부 EXECUTION_PLAN 우선 원칙과 기존 프로젝트 패턴으로 해소했다 — 사용자의 재가는 필요하지만(§17), 설계 자체를 진행하지 못하게 막는 미해결 충돌은 남아있지 않다.

---

## 15. 다음 Phase에서 실행할 정확한 작업 순서

**"Phase9-6"(또는 다음 번호) — FAQ/가이드 관리자 CRUD 구현**, Phase9-3(꿈해몽 CRUD)과 동일한 순서:

1. migration 1건 생성(§7 스키마 그대로) + `npx supabase migration list`로 local/remote 재확인.
2. `lib/api/admin/content.ts`(서비스, `lib/api/admin/dreams.ts` 패턴 재사용) + 유닛테스트.
3. `app/api/admin/content/route.ts`(POST) + `app/api/admin/content/[id]/route.ts`(PUT/DELETE).
4. `components/admin/ContentEntryForm.tsx`(+검증 함수 분리) + `DeleteDreamButton` 패턴 재사용.
5. `app/admin/content/faqs/page.tsx`, `app/admin/content/faqs/new/page.tsx`, `app/admin/content/faqs/[id]/edit/page.tsx` — `type: 'faq'` 고정.
6. `app/admin/content/guides/page.tsx`, `.../new`, `.../[id]/edit` — `type: 'guide'` 고정.
7. `app/admin/page.tsx`의 "FAQ / 가이드" placeholder 카드를 실제 링크로 연결.
8. 실제 Supabase로 관리자 인증(비로그인/일반사용자/관리자)+CRUD 전 과정 실측, 테스트 데이터 정리·잔여 0건 확인.
9. `docs/PHASE9_CONTENT_ADMIN_CRUD_REPORT.md` 작성.

이 작업이 끝나면 Phase9의 완료 기준 3개가 전부 충족되어 Phase9을 CONDITIONAL PASS가 아닌 **PASS**로 종료할 수 있다.

---

## Validation

이번 Task는 코드 변경이 없어 baseline 확인 목적으로만 실행했다.

| 항목 | 결과 |
|---|---|
| `git status` | 이번 Task로 변경된 파일은 `docs/PHASE9_FAQ_GUIDE_DECISION.md` 1개뿐 |
| `npx supabase migration list` | local/remote `0001`~`0013` 완전 동기화, drift 없음 |
| `npm run lint` | 통과, 경고 0건 |
| `npm run type-check` | 통과 |
| `npm test` | 통과 — 16 test files, 234 tests(Phase9-5 종료 시점과 동일, 변화 없음) |
| `npm run build` | 통과, 라우트 28개(변화 없음) |

---

## 최종 요약

- **Decision: A**(Phase9에 실제 구현)
- **FAQ schema**: `content_entries`(`type='faq'`) — `id`/`type`/`title`(varchar 200)/`body`(text)/`display_order`(int, default 0)/`created_at`/`updated_at`
- **Guide schema**: `content_entries`(`type='guide'`) — FAQ와 동일 테이블·동일 컬럼, `title`을 URL 세그먼트로 재사용
- **Migration 필요**: **YES**(신규 1건, 이번 Task에서는 생성하지 않음 — 다음 작업 몫)
- **Phase9 완전 종료 가능 여부**: **NO**(이 문서는 설계 확정일 뿐, §15의 구현이 완료돼야 Phase9이 PASS로 종료된다)
- **다음 작업**: §15에 정리한 "FAQ/가이드 관리자 CRUD 구현"(migration 1건 + 서비스 1개 + Route 2개 + UI 6개 화면) 단 하나.
