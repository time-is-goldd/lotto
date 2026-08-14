# Phase10-1 — 공개 콘텐츠 읽기 기반 구현 보고서

> `docs/PHASE10_RELEASE_GATE.md` §16이 확정한 범위(공개 SELECT RLS + guide title partial UNIQUE + `lib/api/content.ts`)만 구현했다. `/faq`, `/guide/[topic]` 등 공개 UI, sitemap, SEO는 이번 Task에서 만들지 않았다. Phase10-0에서 이미 확정된 결정(통합 테이블, public SELECT RLS 방식, partial UNIQUE 방식, title 기반 URL)을 재검토하지 않고 그대로 구현했다.

---

## 1. 생성/수정 파일

**신규**:
- `supabase/migrations/0015_content_entries_public_read.sql` — 공개 SELECT RLS + guide title partial UNIQUE 인덱스. **실제 원격 Supabase 프로젝트에 적용 완료**(§16).
- `lib/api/content.ts` — 공개 조회 서비스(`getFaqEntries`, `getGuideEntries`, `getGuideByTopic`).
- `lib/api/content.test.ts` — 단위 테스트 10건.
- `docs/PHASE10_PUBLIC_CONTENT_DATA_REPORT.md`(본 보고서).

**수정**:
- `lib/api/admin/content.ts` — `DuplicateGuideTitleError` 클래스 추가, `createContentEntry`/`updateContentEntry`가 Postgres unique violation(23505)을 guide title 중복으로 매핑(§7).
- `lib/api/admin/content.test.ts` — 위 변경에 대한 테스트 3건 추가.
- `app/api/admin/content/route.ts`, `app/api/admin/content/[id]/route.ts` — `DuplicateGuideTitleError` → `409 DUPLICATE_GUIDE_TITLE` 매핑 추가.
- `lib/types/database.ts` — `npx supabase gen types typescript --linked` 재실행. 실제 diff는 **0바이트**(§5).

**검증 중 임시로 사용하고 전부 삭제한 것**(흔적 없음, `git status` 확인): `app/api/jtest/route.ts`, Supabase 테스트 Auth 계정 2개(kakaoId 990962001/002), `admins` 테스트 행 1개, 테스트 `content_entries` 행 6개(id 6/7/10/12/13/14).

**수정하지 않은 파일**: `supabase/migrations/0014_content_entries.sql`(Schema Freeze, 무수정 확인), `app/faq/*`, `app/guide/*`, `app/sitemap.ts`, `app/robots.ts`, 관리자 UI 컴포넌트(`components/admin/*`), `app/admin/faq/*`, `app/admin/guides/*` — 전부 무수정.

---

## 2. Migration 내용

`supabase/migrations/0015_content_entries_public_read.sql`:

```sql
create policy content_entries_select_public
  on public.content_entries
  for select
  to anon, authenticated
  using (true);

create unique index content_entries_guide_title_idx
  on public.content_entries (title)
  where type = 'guide';
```

적용 전 `content_entries` 실데이터가 0건임을 재확인(서비스 롤 직접 SELECT)한 뒤 `npx supabase db push`로 적용했다(Dashboard SQL Editor 미사용). `npx supabase migration list` 결과 local/remote `0001`~`0015` 전부 동기화(drift 없음).

---

## 3. Public SELECT RLS

`content_entries_select_public`(`to anon, authenticated using (true)`) — `dreams_select_public`(0008_rls_policies.sql)과 완전히 동일한 패턴. INSERT/UPDATE/DELETE 정책은 추가하지 않아 그대로 없음(=service_role 전용) 상태를 유지한다. 실제 Supabase에서 anon/authenticated 양쪽 모두 SELECT는 되고 INSERT/UPDATE/DELETE는 전부 차단됨을 실측 확인했다(§8/§9).

---

## 4. Guide partial UNIQUE

`content_entries_guide_title_idx`(`on content_entries(title) where type='guide'`) — FAQ 행은 이 제약의 영향을 받지 않는다. `slug` 컬럼 추가, `id` 구조 변경, `type` 구조 변경 없음 — 기존 Decision 그대로 유지했다. 실제 Supabase에서 guide 중복 title 생성/수정 시도가 각각 차단됨을, FAQ는 동일 title이 허용됨을 실측 확인했다(§11/§12).

---

## 5. DB types 변경

`npx supabase gen types typescript --linked` 재실행 후 raw 출력을 prettier로 포맷해 기존 `lib/types/database.ts`와 `diff`했다 — **실제 diff 0바이트**. 지시문이 예상한 대로 RLS 정책과 partial 인덱스는 generated TypeScript 타입에 나타나지 않는다(테이블/컬럼/enum 시그니처만 반영되며 이번 migration은 그중 어느 것도 바꾸지 않았다) — 이것을 오류로 취급하지 않았다. `npx tsc --noEmit`도 통과.

---

## 6. `lib/api/content.ts`

`lib/api/admin/content.ts`(관리자 mutation, `lib/supabase/service.ts`)와 완전히 분리된 별도 파일. `service_role`/`isAdmin`/`getCurrentUser`를 어디에서도 import·사용하지 않는다(§13에서 코드로 재확인).

**클라이언트 선택**: `lib/supabase/server.ts`(쿠키 기반, `next/headers`의 `cookies()`)를 쓰지 않고 `app/sitemap.ts`와 동일하게 `@supabase/supabase-js`의 `createClient`로 쿠키 없는 순수 anon 클라이언트를 이 파일 안에서 직접 만든다. `lib/api/dreams.ts`는 쿠키 기반 클라이언트를 써서 렌더 경로가 완전히 동적으로 처리되는 기존 Known Issue(SSG/ISR 미적용)를 그대로 갖고 있지만, `lib/api/content.ts`는 처음부터 이 문제를 만들지 않는 패턴을 택했다 — 로그인 여부와 무관하게 항상 동일한 결과를 반환하고, Phase10-2가 SSG/ISR을 붙일 수 있는 길을 열어둔다.

---

## 7. 공개 서비스 API 계약

```ts
getFaqEntries(): Promise<PublicContentEntry[]>       // type='faq', display_order asc → id asc
getGuideEntries(): Promise<PublicContentEntry[]>     // type='guide', display_order asc → id asc
getGuideByTopic(topic: string): Promise<PublicContentEntry | null>  // type='guide' AND title=topic 정확 일치
```

`PublicContentEntry = Pick<Tables<"content_entries">, "id"|"type"|"title"|"body"|"display_order"|"updated_at">` — DB generated type을 `Pick`으로만 재사용하고 필드를 손으로 재선언하지 않았다. `created_at`은 공개 UI에 필요하지 않아 select 대상에서 제외했다(`select("*")` 미사용, 필요한 6개 컬럼만 명시).

`getGuideByTopic`은 이미 디코딩된 문자열을 받는다 — decode 책임은 호출부(Phase10-2의 `app/guide/[topic]/page.tsx`)에 있다. `lib/api/dreams.ts`의 `getDreamByKeyword()`/`app/dream/[keyword]/page.tsx`가 이미 확립한 계약(페이지가 `decodeURIComponent()`를 직접 호출한 뒤 이미 디코딩된 값을 서비스에 넘김)과 동일하게 맞췄다 — 새 decode 계약을 발명하지 않았다.

---

## 8. anon/authenticated SELECT 검증

관리자 API로 테스트 FAQ(id=6)·Guide(id=7)를 생성한 뒤 앱을 거치지 않고 Supabase REST API에 직접 요청했다.

| 테스트 | 결과 |
|---|---|
| Test A: anon SELECT FAQ | `200`, 정확한 행 반환 |
| Test B: anon SELECT Guide | `200`, 정확한 행 반환 |
| Test C: authenticated(비관리자) SELECT FAQ+Guide | `200`, 둘 다 정상 반환(공개 콘텐츠이므로 로그인 여부 무관) |

---

## 9. anon/authenticated mutation 차단 검증

| 테스트 | 결과 |
|---|---|
| Test D: anon INSERT | `401`, `42501`(RLS 위반) |
| Test E: anon UPDATE(id=6) | `200`이지만 **영향받은 행 0개**(빈 배열) — 관리자 API 재조회로 데이터 무변경 확인 |
| Test F: anon DELETE(id=6) | 상동, 무변경 확인 |
| Test G: authenticated(비관리자) INSERT | `403`, `42501` |
| Test G: authenticated(비관리자) UPDATE/DELETE(id=7) | 0행 영향, 관리자 API 재조회로 무변경 확인 |

새 공개 SELECT 정책이 INSERT/UPDATE/DELETE에 어떤 영향도 주지 않음을 확인했다(정책을 추가하지 않은 연산은 여전히 차단).

---

## 10. 관리자 CRUD 회귀

| 확인 대상 | 결과 |
|---|---|
| `GET /api/admin/content` 비로그인/비관리자/관리자 | `401` / `403` / `200`(무수정 확인) |
| `/admin/faq` 관리자/비관리자/비로그인 | `200` / `404` / `307`(무수정 확인) |
| `/admin/guides` 관리자 | `200`(무수정 확인) |
| `/admin`, `/admin/draws`, `/admin/dreams` 관리자 | 전부 `200`(회귀 없음) |

Phase9-6이 만든 인증 흐름(401→403→400/실행)에 이번 migration/RLS 변경이 어떤 영향도 주지 않았다.

---

## 11. Guide duplicate 검증

| 테스트 | 결과 |
|---|---|
| Test H: `POST` guide title="Unique Guide Test" 1회 | `201` |
| Test H: 동일 title로 재`POST` | `409 DUPLICATE_GUIDE_TITLE` |
| Test I: 다른 guide(id=12, title="Another Guide Title")를 위 title로 `PUT` 수정 시도 | `409 DUPLICATE_GUIDE_TITLE`, 재조회 결과 id=12는 원래 title/updated_at 그대로(데이터 손상 없음) |

수정 전 코드는 unique violation을 그대로 `throw`해 Route Handler의 제네릭 catch가 `500`으로 응답했을 것 — `lib/api/admin/content.ts`에 `DuplicateGuideTitleError` + `POSTGRES_UNIQUE_VIOLATION("23505")` 매핑을 추가하고(`lib/api/admin/draws.ts`의 `DuplicateRoundError`와 동일한 기존 패턴 재사용), Route Handler에서 `409`로 매핑했다. 사전 SELECT로 중복을 미리 확인하는 방식은 쓰지 않았다 — DB UNIQUE 제약을 최종 진실의 원천으로 유지해 race condition을 만들지 않는다.

---

## 12. FAQ duplicate 허용 검증

Test J: 동일 title("Duplicate FAQ Title Test")로 FAQ를 2회 연속 `POST` — 둘 다 `201`로 정상 생성됨을 확인했다. `type='guide'`에만 적용되는 partial UNIQUE 인덱스가 FAQ에는 전혀 영향을 주지 않는다.

---

## 13. 보안 검증

- `lib/api/content.ts` 실제 import 문 전수 확인: `@supabase/supabase-js`, `@/lib/types/database`(타입 전용), `@/lib/utils/env` — `service_role`/`isAdmin`/`getCurrentUser` 전부 **0건**. 파일 내 두 곳의 문자열 매치는 "이 파일이 이것들을 쓰지 않는다"고 설명하는 주석뿐임을 직접 확인했다.
- `npm run build` 후 `.next/static/chunks/`를 `grep -rl "SUPABASE_SERVICE_ROLE_KEY|service_role"`로 전수 검사 — **0건**.
- 공개 SELECT로 노출되는 필드는 `id`/`type`/`title`/`body`/`display_order`/`updated_at` 6개뿐(§7) — `created_at` 등 불필요한 필드도 노출하지 않는다.
- `profiles`/`user_numbers`/`dream_journal_entries` 등 다른 테이블의 RLS 정책은 이번 migration에서 전혀 건드리지 않았다(`0015` 원문에 `content_entries` 외 테이블 참조 없음, 코드로 재확인).

---

## 14. 테스트 데이터 cleanup

| 대상 | 정리 방법 | 확인 방법 |
|---|---|---|
| 테스트 `content_entries` 6건(id 6,7,10,12,13,14) | 관리자 API `DELETE`(id 기준) | `GET /api/admin/content?type=faq`/`?type=guide` 둘 다 `{"data":[]}` 재확인 + service_role 직접 카운트 `content_entries: 0` |
| 테스트 Auth 계정 2개 | `service_role` 기반 `admin.deleteUser()`(jtest cleanup) | 삭제 후 두 계정의 세션 쿠키로 재요청 시 `401`(세션 완전 폐기) 확인 |
| `admins` 테스트 행 1개 | 위 cleanup에서 `user_id` 기준 사전 삭제 | service_role 직접 카운트 `admins: 0` |

한글 문자열이나 텍스트 매칭으로 정리 여부를 판정하지 않고, 전부 **id/count 기준**으로 최종 확인했다(Phase9 Final Audit §7이 발견한 "한글 인라인 필터 → 거짓 양성" 문제를 재발시키지 않기 위해 처음부터 영문 고유 title + id 기반 cleanup만 사용).

---

## 15. lint/type-check/test/build

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과, 경고 0건 |
| `npm run type-check` | 통과 |
| `npm test` | **18 test files, 277 tests 전부 통과**(baseline 264건 → `lib/api/content.test.ts` +10건, `lib/api/admin/content.test.ts` +3건. 기존 테스트 삭제/수정 없음) |
| `npm run build` | 통과, **33개 라우트**(baseline과 동일 — 공개 UI를 추가하지 않아 신규 라우트 없음), `/sitemap.xml` 정적 유지(`Revalidate: 1h`) |
| 클라이언트 번들 `service_role` 검사 | 0건 |

---

## 16. migration local/remote sync

`npx supabase migration list` 결과 `0001`~`0015` 전부 **local/remote 완전 동기화**(drift 없음). `0014`는 원문 무수정 확인(`git status`에 diff 없음).

---

## 17. 발견된 문제

- **관리자 CRUD의 unique violation 처리 회귀 가능성**: §7/§11에서 설명한 대로, 이번 migration이 추가되기 전에는 guide title 중복 시 `lib/api/admin/content.ts`가 원본 Postgres 에러를 그대로 `throw`해 Route Handler가 `500 INTERNAL_ERROR`로 응답했을 것이다(코드 경로 확인, 실제로 이전 상태로 되돌려 재현하지는 않았음 — migration 롤백은 위험한 작업이라 수행하지 않았다). 지시문이 예견한 정확히 그 상황이라 판단해 최소 에러 매핑(`DuplicateGuideTitleError` → `409`)을 추가했다. 새로운 validation 시스템이나 사전 SELECT 기반 중복 확인은 추가하지 않았다.
- 그 외 설계/구현 단계에서 예상하지 못한 DB/RLS 문제는 발견되지 않았다.

---

## 18. Phase10-2 착수 가능 여부

**READY.** `lib/api/content.ts`(공개 조회 서비스)와 그 기반 RLS/UNIQUE가 실제 Supabase 환경에서 전부 검증되었다. Phase10-2(`app/faq/page.tsx`, `app/guide/[topic]/page.tsx`, metadata/JSON-LD, `app/sitemap.ts` 확장)는 이 파일을 그대로 가져다 쓰면 된다 — 추가 마이그레이션이나 서비스 계층 변경 없이 UI만 얹는 작업이다.

---

## 19. 다음 작업 추천

**Phase10-2(FAQ + Guide 공개 UI + SEO/Sitemap 통합)**를 다음 작업으로 권장한다. `docs/PHASE10_RELEASE_GATE.md` §14가 이미 이 순서를 확정해 뒀고, 이번 Task로 그 선행 조건(공개 읽기 기반)이 전부 충족되었다.

---

## TASK REPORT — Phase10-1

- **Migration**: PASS (`0015_content_entries_public_read.sql`, local/remote 동기화 확인, `0014` 무수정)
- **Public SELECT RLS**: PASS (anon/authenticated SELECT 허용, INSERT/UPDATE/DELETE 정책 없음 유지, 실측 확인)
- **Guide UNIQUE**: PASS (partial UNIQUE, guide만 적용, FAQ 미적용, 실측 확인)
- **Public Service**: PASS (`lib/api/content.ts`, service_role/admin 인증 미사용, 쿠키 없는 anon 클라이언트)
- **Anonymous Read**: PASS
- **Anonymous Write**: PASS (전부 차단)
- **Authenticated Read**: PASS
- **Authenticated Write**: PASS (전부 차단)
- **Admin CRUD Regression**: PASS
- **Security**: PASS
- **Tests**: PASS (277/277, +13건)
- **Build**: PASS (33 routes, 변화 없음)
- **Migration Sync**: PASS (0001~0015 local/remote 동기화)
- **Cleanup**: PASS (content_entries 0건, admins 0건, 테스트 계정 세션 폐기 확인 — 전부 id/count 기준)
- **Phase10-1**: PASS
- **Phase10-2 Ready**: YES
- **다음 작업**: Phase10-2(FAQ + Guide 공개 UI + SEO/Sitemap 통합) 1개
