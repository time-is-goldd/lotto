# Phase9-6 FAQ/가이드 관리자 CRUD 구현 보고서

> `docs/PHASE9_FAQ_GUIDE_DECISION.md`의 최종 결정(§14 Decision A — Phase9에 실제 구현)을 실제로 구현했다. Phase9 완료 기준 3개 중 마지막 하나("꿈해몽/FAQ/가이드 CRUD 정상 동작")를 이 작업으로 충족시킨다. 공개 페이지(`/faq`, `/guide/[topic]`)와 공지사항은 이번 작업 범위가 아니다(EXECUTION_PLAN Phase10, 지시문 §9/§1).

---

## 0. 지시문과의 설계 충돌 — PK 타입 결정

구현 착수 전 지시문 §2("id: uuid, primary key, 기존 프로젝트 UUID 생성 컨벤션 재사용")과 실제 코드베이스 사이에 충돌을 발견해 임의로 결정하지 않고 사용자에게 확인을 받았다.

- `supabase/migrations/*.sql` 12개 파일 전체를 `uuid` 키워드로 전수 검색한 결과, 이 프로젝트에는 **자체 UUID를 생성하는 PK 컨벤션이 존재하지 않았다.** `uuid` 타입은 오직 `auth.users.id`를 그대로 복사하는 FK=PK 컬럼(`profiles.id`)이나 `auth.users`/`profiles`를 가리키는 FK 컬럼(`user_id`)에만 쓰인다 — `gen_random_uuid()` 등 자체 생성 로직은 어디에도 없다.
- `dreams`/`notifications`/`draws`/`winning_cases`/`stores` 등 콘텐츠성 테이블은 예외 없이 `id bigint generated always as identity primary key`를 쓴다.
- `docs/PHASE9_FAQ_GUIDE_DECISION.md` §7 자체도 `content_entries.id`를 `bigint PK, generated always as identity`로 이미 확정해뒀다.

사용자에게 두 선택지(bigint identity 권장 / uuid)를 제시했고, **bigint identity**로 확정받았다. 이후 모든 설계(migration, 서비스, Route, UI)는 이 결정을 기준으로 진행했다.

---

## 1. 변경 파일 전체

**신규 생성**:
- `supabase/migrations/0014_content_entries.sql` — `content_entries` 테이블 + `content_entries_type` enum + RLS(정책 없음=service_role 전용) + 인덱스. **실제 원격 Supabase 프로젝트에 적용 완료**(`npx supabase db push`, `npx supabase migration list`로 local/remote 0014 동기화 확인).
- `lib/api/admin/content.ts` — 관리자 전용 CRUD 서비스(`getAdminContentEntries`, `getAdminContentEntryById`, `createContentEntry`, `updateContentEntry`, `deleteContentEntry`, 입력 파서).
- `lib/api/admin/content.test.ts` — 단위 테스트 30건.
- `app/api/admin/content/route.ts` — `GET`(목록, `type` 쿼리 필터), `POST`(생성).
- `app/api/admin/content/[id]/route.ts` — `PUT`(수정), `DELETE`(삭제).
- `components/admin/contentFormValidation.ts` — 클라이언트 검증 순수 함수(FAQ/가이드 공용).
- `components/admin/ContentForm.tsx` — 생성/수정 공용 폼(FAQ/가이드 공용, `type`은 페이지가 고정).
- `components/admin/DeleteContentButton.tsx` — 삭제 확인 버튼(FAQ/가이드 공용).
- `app/admin/faq/page.tsx`, `app/admin/faq/new/page.tsx`, `app/admin/faq/[id]/edit/page.tsx`
- `app/admin/guides/page.tsx`, `app/admin/guides/new/page.tsx`, `app/admin/guides/[id]/edit/page.tsx`
- `docs/PHASE9_FAQ_GUIDE_IMPLEMENTATION_REPORT.md`(본 보고서).

**수정**:
- `lib/types/database.ts` — `npx supabase gen types typescript --linked`로 재생성. `content_entries` 테이블(Row/Insert/Update)과 `content_entries_type` enum **추가만** 발생했고, 기존 타입은 prettier 포맷팅 차이를 제거한 순수 diff 기준으로 **한 글자도 바뀌지 않았음**을 직접 확인했다(§3).
- `lib/constants/index.ts` — `CONTENT_TITLE_MAX_LENGTH = 200` 1개 상수 추가(기존 `DREAM_KEYWORD_MAX_LENGTH` 등과 동일한 패턴).
- `app/admin/page.tsx` — `MANAGEMENT_LINKS`의 기존 "FAQ / 가이드"(href: null) placeholder 항목을 "FAQ 관리"(`/admin/faq`)와 "가이드 관리"(`/admin/guides`) 2개 항목으로 교체. 대시보드 레이아웃/통계 섹션은 무수정.

**검증 중 임시로 사용하고 전부 삭제한 것**(흔적 없음, `git status`로 확인):
- `app/api/jtest/route.ts`(Phase2 이래 반복 사용해 온 세션 발급/admin 승격/정리용 임시 라우트).
- Supabase 테스트 Auth 계정 5개(kakaoId 990961501/502, 990961601/602, 990961701 — 시나리오별로 재사용).
- 테스트 `content_entries` 행 4건(id 1/2/4/5, 제목 `JTEST-P9-FAQ-1`/`JTEST-P9-GUIDE-1`/`JTEST-P9-RLS-TARGET`/200자 title).
- `admins` 테스트 행(User B → admin 승격분).

**수정하지 않은 파일**(지시문 §14 금지 목록, `git status`/파일 내용으로 재확인): `app/admin/layout.tsx`, `lib/auth/isAdmin.ts`, `proxy.ts`, `lib/api/admin/draws.ts`, `app/api/admin/draws/route.ts`, `lib/api/admin/dreams.ts`, `app/api/admin/dreams/*`, Phase7 공개 꿈 페이지, Phase8 SEO 코드, `app/faq/*`, `app/guide/*`, `app/sitemap.ts`, `app/robots.ts`.

---

## 2. Migration 및 Schema

`supabase/migrations/0014_content_entries.sql`:

```sql
create type public.content_entries_type as enum ('faq', 'guide');

create table public.content_entries (
  id bigint generated always as identity primary key,
  type public.content_entries_type not null,
  title varchar(200) not null,
  body text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_content_entries_updated_at
  before update on public.content_entries
  for each row
  execute function public.set_updated_at();

create index content_entries_type_idx on public.content_entries (type);

alter table public.content_entries enable row level security;
-- SELECT/INSERT/UPDATE/DELETE 정책 없음 = 전부 service_role 전용
```

- PK: `bigint generated always as identity`(§0 결정).
- `type`: enum `content_entries_type('faq','guide')` — `<table>_<column>` 네이밍 컨벤션(`notifications_type`, `admin_role`)을 그대로 따름.
- `title varchar(200) not null`, `body text not null`, `display_order int not null default 0` — 지시문 §2 스펙 그대로.
- `updated_at`은 `0001`에서 정의한 `public.set_updated_at()` 트리거 함수를 재사용(새 함수 생성 없음).
- 인덱스: `content_entries_type_idx` — 관리자 목록이 항상 `type`으로 필터링하므로 조회조건 컬럼 인덱스 원칙 적용.
- **추가하지 않은 컬럼**: `slug`, `category`, `is_published`, `image_url`, revision/history 관련 컬럼, view/like/comment 카운트. `admin_audit_logs`도 생성하지 않았다 — 지시문 §2가 명시적으로 금지한 항목 전부.

---

## 3. Database Type 재생성

`npx supabase gen types typescript --linked` 실행 후 CLI raw 출력(세미콜론 없는 포맷)을 `prettier --write`로 기존 파일과 동일한 포맷으로 정렬한 뒤 `diff`했다. 실제 변경분은 다음뿐이었다:

- `Database["public"]["Tables"]["content_entries"]`(Row/Insert/Update/Relationships) 신규 추가.
- `Database["public"]["Enums"]["content_entries_type"]: "faq" | "guide"` 신규 추가.
- `Constants.public.Enums.content_entries_type: ["faq", "guide"]` 신규 추가.

기존 61개 이상의 테이블/enum 타입 정의는 **한 글자도 바뀌지 않았다**(순수 diff로 직접 확인). `npx tsc --noEmit`도 타입 재생성 직후 통과했다.

---

## 4. RLS 정책

| 정책 | 대상 | 근거 |
|---|---|---|
| (없음) SELECT | — | client(anon/authenticated) 대상 SELECT 정책을 만들지 않음. 공개 페이지(Phase10)가 아직 없어 소비자가 없다(지시문 §3) |
| (없음) INSERT/UPDATE/DELETE | — | 관리자 정책 공통 원칙(`DATABASE_SCHEMA.md` §6) — service_role만 접근 가능 |

`content_entries`는 `dreams`(전체 공개 SELECT)와 달리 **SELECT/INSERT/UPDATE/DELETE 전부** client 정책이 없다 — Phase9 시점에는 완전히 비공개다. 관리자 조회(`getAdminContentEntries`)도 `lib/supabase/service.ts`(service_role)를 쓴다. 이 결정은 `docs/PHASE9_FAQ_GUIDE_DECISION.md` §7이 제안한 "공개 SELECT 정책"과 다르며, 이번 지시문 §3의 명시적 요구를 우선했다(결정 문서는 제안일 뿐 아직 migration으로 확정되지 않았던 사항).

실제 Supabase에서 직접 검증(§9 Test G):
- 비로그인/authenticated(비관리자) JWT로 PostgREST에 직접 INSERT → `403 42501 row-level security policy violation`.
- 같은 JWT로 UPDATE/DELETE(실제 존재하는 행 대상) → `200`이지만 **영향받은 행 0개**(RLS가 대상 행 자체를 안 보이게 함) — 관리자 API로 재조회해 데이터 무변경 확인.
- 비로그인 SELECT, authenticated(비관리자) SELECT 둘 다 결과 `[]`.

---

## 5. 관리자 인증 흐름

`app/admin/layout.tsx`, `lib/auth/isAdmin.ts`, `proxy.ts` **무수정** — 기존 인증 체계를 그대로 재사용했다.

- 페이지(`app/admin/faq/*`, `app/admin/guides/*`): 기존 `app/admin/layout.tsx`가 이미 `/admin/**` 전체에 적용되는 서버 측 게이트. 비로그인 → `/login?next=/admin` 리다이렉트, 로그인했지만 비관리자 → `notFound()`(404).
- Route Handler(`app/api/admin/content/route.ts`, `app/api/admin/content/[id]/route.ts`): 기존 `app/api/admin/dreams/*`와 동일한 순서로 각 핸들러가 독립적으로 `getCurrentUser()` → 비로그인 401 → `isAdmin()` → 비관리자 403 → JSON parse/검증 400 → 서비스 실행.

새 인증 체계(세션/쿠키/JWT/`profiles.is_admin` 등)를 전혀 만들지 않았다.

---

## 6. FAQ CRUD

- 목록: `app/admin/faq/page.tsx` → `getAdminContentEntries("faq")`(service_role, `display_order` 오름차순 → `id` 오름차순 2차 정렬).
- 생성: `app/admin/faq/new/page.tsx` → `ContentForm(mode="create", type="faq")` → `POST /api/admin/content`.
- 수정: `app/admin/faq/[id]/edit/page.tsx` → `getAdminContentEntryById(id)`(존재하지 않거나 `type !== "faq"`면 404) → `ContentForm(mode="edit", type="faq")` → `PUT /api/admin/content/[id]`.
- 삭제: `DeleteContentButton` → `window.confirm()` 1차 확인 → `DELETE /api/admin/content/[id]`(서버가 `isAdmin()` 재검증).

## 7. Guide CRUD

FAQ와 완전히 동일한 구조를 `type="guide"`로 재사용(`app/admin/guides/*`, 별도 서비스/컴포넌트 없음 — 지시문 §5 "동일 테이블에 동일 CRUD라면 불필요한 중복 서비스를 만들지 않는다"를 그대로 따랐다).

---

## 8. API 계약

| Method | Path | 응답 | 비고 |
|---|---|---|---|
| GET | `/api/admin/content?type=faq\|guide` | `200 { data: ContentEntry[] }` | `type` 생략 시 전체, 잘못된 값이면 `400` |
| POST | `/api/admin/content` | `201 { data: ContentEntry }` | |
| PUT | `/api/admin/content/[id]` | `200 { data: ContentEntry }` | |
| DELETE | `/api/admin/content/[id]` | `204` | |

에러 형식: `{ error: { code, message } }`(기존 컨벤션 그대로). `code` ∈ `UNAUTHORIZED(401)` / `FORBIDDEN(403)` / `VALIDATION_ERROR(400)` / `NOT_FOUND(404)` / `INTERNAL_ERROR(500)`.

입력 검증(`lib/api/admin/content.ts`):
- `type`: `"faq" | "guide"`만 허용, 그 외(`notice`, 임의 문자열, 누락) → 400.
- `title`: 문자열, trim 후 1~200자.
- `body`: 문자열, trim 후 빈 문자열 금지(길이 상한 없음 — text 컬럼, 지시문이 상한을 요구하지 않음).
- `display_order`: 생략 시 0, 값이 있으면 0 이상의 정수(`lib/api/admin/draws.ts`의 기존 숫자 검증 패턴 재사용).
- `id`(경로 파라미터): 양의 정수만 허용(`dreams.id`와 동일한 bigint 파싱 패턴).
- 클라이언트가 `user_id`/`admin_id`/`created_at`/`updated_at`을 보내도 파서가 화이트리스트 필드만 추출하므로 저장 대상이 되지 않는다.

---

## 9. UI 구현

- `components/admin/ContentForm.tsx`: 제목/본문/표시 순서 3개 필드만 노출. `type`은 props로 페이지가 고정해서 넘기며 사용자가 바꿀 수 있는 UI 요소가 없다. 저장 성공 시 `type`에 대응하는 목록(`/admin/faq` 또는 `/admin/guides`)으로 이동.
- `components/admin/DeleteContentButton.tsx`: `DreamForm`/`DeleteDreamButton`과 동일한 UX(브라우저 `confirm()` 1차 확인, 서버가 최종 권한 재검증).
- 목록 페이지: `display_order` 오름차순, 동일 순서는 `id` 오름차순으로 안정적 2차 정렬(FAQ/Guide 동일).
- `app/admin/page.tsx`: 기존 "FAQ / 가이드"(href 없음) placeholder를 "FAQ 관리"/"가이드 관리" 2개 카드로 교체, 대시보드 디자인/통계 섹션은 무수정.

---

## 10. 실제 Supabase 검증 결과

`npm run dev` + 실제 원격 Supabase 프로젝트를 대상으로, Phase2 이래 반복 사용해 온 방법(`establishKakaoSupabaseSession()` 재사용, 임시 `app/api/jtest/route.ts` 생성 후 검증 종료 즉시 삭제)으로 테스트 계정을 만들어 검증했다. 한글 데이터는 Git Bash inline 인자로 직접 전달하지 않고, 전부 Write 도구로 만든 JSON 파일(`--data-binary @file`) 또는 영문 고유값(`JTEST-P9-*` 접두사)을 사용했다.

| 시나리오 | 결과 |
|---|---|
| `/admin`, `/admin/faq`, `/admin/faq/new`, `/admin/guides`, `/admin/guides/new` — 비로그인 | 전부 `307 → /login?next=/admin` |
| 위 5개 페이지 — 일반 사용자 | 전부 `404`(`notFound()`) |
| 위 5개 페이지 — 관리자 | 전부 `200`, 한글 UI 텍스트("FAQ 관리", "새 FAQ 추가" 등) 정상 렌더링 확인 |
| `/admin/dreams`, `/admin/draws`, `/admin/dreams/new`(회귀) | 관리자 `200` — 기존 Phase9 화면 영향 없음 |

---

## 11. 보안 검증 결과 (지시문 §10 Test A~K)

| 테스트 | 결과 |
|---|---|
| **Test A**: 비로그인 GET/POST/PUT/DELETE | 전부 `401 UNAUTHORIZED` |
| **Test B**: 일반 사용자 GET/POST/PUT/DELETE | 전부 `403 FORBIDDEN` |
| **Test C**: 관리자 FAQ 생성(`display_order=5`) | `201`, 이후 GET으로 DB 반영 확인 |
| **Test D**: 관리자 FAQ 수정(title/body/display_order 전부 변경) | `200`, `updated_at`이 트리거로 `created_at`과 다르게 자동 갱신됨 확인 |
| **Test E**: 관리자 FAQ 삭제 | `204`, 재조회 결과 `{data:[]}` |
| **Test F**: 관리자 Guide 생성→수정→삭제 전 과정 | `201`→`200`→`204`, 매 단계 재조회로 확인 |
| **Test G**: 일반 사용자가 PostgREST에 직접 INSERT/UPDATE/DELETE 시도(앱을 거치지 않고 anon key+JWT로 직접) | INSERT `403 42501`(RLS 위반 에러), UPDATE/DELETE는 대상 행에 영향 0건(관리자 API 재조회로 데이터 무변경 확인). anon/authenticated 직접 SELECT 둘 다 `[]` |
| **Test H**: 일반 사용자가 실제 존재하는 id로 앱 Route PUT/DELETE 시도 | 전부 `403`, 데이터 무변경 확인 |
| **Test I**: `type="notice"`/임의 문자열/누락 | 전부 `400 VALIDATION_ERROR` |
| **Test J**: title 200자 성공(`201`) / 201자 거부(`400`) / body 빈 문자열 거부(`400`) | 전부 기대대로 |
| **Test K**: id가 숫자 형식이 아님(`not-a-uuid`, `abc-123`) → `400`. 형식은 유효하나 존재하지 않는 id(`999999999`) → `404` | 전부 기대대로 |

테스트 데이터 정리: 테스트 `content_entries` 4건을 관리자 API로 전부 삭제 후 `GET /api/admin/content?type=faq`, `?type=guide` 둘 다 `{"data":[]}` 재확인. 테스트 Auth 계정 5개(및 연결된 `admins` 행)를 `service_role`로 전부 삭제 후, 삭제된 계정의 세션 쿠키로 재요청 시 `401`(세션 완전 폐기)로 재확인. `admins`/`profiles`에 해당 사용자를 참조하는 행이 남아있었다면 `auth.admin.deleteUser()`가 FK 위반으로 실패했을 것이므로, 삭제 성공 자체가 잔여 0건의 간접 증거이기도 하다.

---

## 12. 회귀 검증

| 대상 | 결과 |
|---|---|
| `/dream`(목록) | `200` |
| `/dream/돼지꿈`(JSON-LD 포함) | `200`, `application/ld+json` 스크립트 존재 확인(Phase8 무수정이므로 개수 자체는 이번 검증 기준선으로만 기록) |
| `/generate` | `200` |
| `/robots.txt` | `200`, 기존 규칙 그대로 |
| `/sitemap.xml` | `200`, URL 35개. `/faq`\|`/guide` 포함 URL **0건** — 공개 페이지를 추가하지 않았으므로 sitemap URL 개수가 늘지 않음(지시문 §12 요구사항 충족) |
| `/admin/dreams`, `/admin/draws`, `/admin/dreams/new`(관리자) | 전부 `200`, 기존 Phase9 CRUD 화면 영향 없음 |
| `/api/admin/draws`, `lib/api/admin/dreams.ts`, `app/api/admin/dreams/*` | 파일 무수정(git 상태로 확인), 기존 단위테스트 전부 통과 |

---

## 13. 테스트 수 / lint / type-check / build

| 항목 | 결과 |
|---|---|
| 신규 테스트 | `lib/api/admin/content.test.ts` 30건(`parseAdminContentCreateInput` 19건 + `createContentEntry`/`updateContentEntry`/`deleteContentEntry`/`getAdminContentEntries` 11건) |
| `npm test` | **17 test files, 264 tests 전부 통과**(작업 전 234건 → +30건, 기존 테스트 삭제/수정 없음) |
| `npm run lint` | 통과, 경고 0건 |
| `npm run type-check`(`tsc --noEmit`) | 통과 |
| `npm run build` | 통과, 33개 라우트(`/admin/faq`, `/admin/faq/[id]/edit`, `/admin/faq/new`, `/admin/guides`, `/admin/guides/[id]/edit`, `/admin/guides/new`, `/api/admin/content`, `/api/admin/content/[id]` 8개 신규) |
| 클라이언트 번들 `service_role` 유출 검사 | `.next/static/chunks/`를 `grep -rl "SUPABASE_SERVICE_ROLE_KEY\|service_role"`로 전수 검사 — **0건** |

---

## 14. Migration local/remote sync

`npx supabase db push`로 `0014_content_entries.sql` 적용 후 `npx supabase migration list` 결과, local/remote 전부 `0001`~`0014`로 완전 동기화(drift 없음).

---

## 15. 발견된 문제

- **Windows Git Bash `-w` 포맷 문자열 경로 자동변환**: `curl -w "/admin/dreams -> %{http_code}\n"`처럼 `-w` 값이 `/`로 시작하면 MSYS가 이를 Windows 경로로 오인해 변환하는 현상을 확인했다(`MSYS_NO_PATHCONV=1`로 우회 시도 중 `curl: (23) Write Error`까지 발생해 재시도). 실제 HTTP 응답 코드 자체에는 영향이 없었고, 라벨 문자열을 `/`로 시작하지 않게 바꿔 해결했다 — 결함이 아니라 테스트 도구 아티팩트(Phase9-3이 기록한 한글 인코딩 이슈와 같은 성격).
- 그 외 설계/구현 단계에서 예상하지 못한 DB/RLS 문제는 발견되지 않았다. §0에 기록한 PK 타입 충돌은 구현 착수 전 사용자 확인으로 해소했다.

---

## 16. Phase9 완료 기준 충족 여부

`EXECUTION_PLAN.md` Phase9 완료 기준 3개:
1. 관리자 인증(로그인/권한 분리) — Phase6/9-1에서 이미 충족(무수정, 재확인만 함).
2. 회차 관리 CRUD — Phase6/9-2에서 이미 충족(무수정, 재확인만 함).
3. **꿈해몽/FAQ/가이드 CRUD 정상 동작** — 꿈해몽은 Phase9-3에서 이미 충족. **FAQ/가이드는 이번 Task로 충족**(§10/§11 실측 확인).

→ Phase9 완료 기준 3개 **전부 충족**.

---

## 17. 최종 판단

- **Phase9 FAQ/Guide 구현**: PASS
- **Security**: PASS
- **DB/RLS**: PASS
- **Regression**: PASS
- **Phase9 전체**: PASS
- **Phase10 착수 가능**: YES
- **다음 작업**: Phase10 공개 페이지 구현(`app/faq/page.tsx` — FAQ 전체 목록 단일 페이지, `app/guide/[topic]/page.tsx` — `title`을 URL 세그먼트로 쓰는 가이드 개별 페이지) 1개.

---

## 18. Phase10에서 구현해야 할 공개 FAQ/Guide 후속 작업 (참고용 기록)

이번 Task 범위가 아니므로 구현하지 않았으나, Phase10 착수 시 참고할 사항을 기록해둔다:

- **공개 SELECT RLS 정책 추가 필요**: 현재 `content_entries`는 client 대상 SELECT 정책이 전혀 없다(§4). Phase10에서 공개 페이지를 붙이려면 `dreams_select_public`과 동일한 패턴(`to anon, authenticated using (true)`)의 신규 마이그레이션이 먼저 필요하다.
- **`is_published` 컬럼 필요 여부 재검토**: `docs/PHASE9_FAQ_GUIDE_DECISION.md` §8-D가 "소비자가 없어 필요성이 실증되지 않았다"는 이유로 보류했다 — Phase10에서 실제 소비자(공개 페이지)가 생기는 시점에 발행 상태 관리가 필요한지 다시 판단해야 한다.
- **가이드 URL 세그먼트**: `dreams.keyword`와 동일하게 `title`을 `encodeURIComponent`로 그대로 URL에 사용하는 기존 컨벤션을 재사용할 수 있다(별도 `slug` 컬럼 없음, 결정 문서 §8-A).
- **sitemap.ts 확장**: `app/sitemap.ts`(Phase8-1)가 이미 `dreams`를 anon 클라이언트로 직접 조회하는 패턴을 갖고 있어, 공개 SELECT 정책이 추가되면 `guides`(개별 URL 있음)를 동일한 방식으로 추가할 수 있다. FAQ는 단일 페이지이므로 URL 1개만 추가하면 된다(결정 문서 §11).
- FAQ 최소 5문항, 가이드 최소 3편의 실제 콘텐츠 작성(`CONTENT_STRATEGY.md`)은 이번 관리자 CRUD 화면을 통해 운영자가 직접 채워야 하는 별도 작업이다.
