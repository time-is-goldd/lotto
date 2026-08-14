# Phase9-3 관리자 꿈해몽 CRUD 구현 보고서

> Phase6/7/9-1/9-2에서 이미 검증된 관리자 인증(`isAdmin()`, `app/admin/layout.tsx`)과 공개 조회 서비스(`lib/api/dreams.ts`)를 재구현하지 않고 그대로 재사용했다. FAQ/가이드 CRUD, 회원관리, 커뮤니티 등 범위 밖 기능은 구현하지 않았다.

---

## 1. 생성/수정 파일

**신규**:
- `lib/api/admin/dreams.ts` — 관리자 쓰기 서비스(`service_role`)
- `lib/api/admin/dreams.test.ts` — 위 서비스 유닛테스트
- `app/api/admin/dreams/route.ts` — `POST`(생성)
- `app/api/admin/dreams/[id]/route.ts` — `PUT`(수정)/`DELETE`(삭제)
- `components/admin/DreamForm.tsx` — 생성/수정 공용 폼(Client Component)
- `components/admin/DeleteDreamButton.tsx` — 삭제 버튼(확인 다이얼로그 포함)
- `components/admin/dreamFormValidation.ts` — 순수 클라이언트 검증 함수
- `components/admin/dreamFormValidation.test.ts` — 위 함수 유닛테스트
- `app/admin/dreams/page.tsx` — 목록
- `app/admin/dreams/new/page.tsx` — 생성 화면
- `app/admin/dreams/[id]/edit/page.tsx` — 수정 화면
- 본 보고서

**수정**: `lib/constants/index.ts`(`DREAM_KEYWORD_MAX_LENGTH`/`DREAM_INTERPRETATION_MAX_LENGTH` 2개 상수 추가), `app/admin/page.tsx`("꿈해몽 관리" 카드를 `/admin/dreams` 링크로 연결).

**미변경**: `lib/api/dreams.ts`(공개 조회, 무수정 — `getDreams`/`getDreamById`/`getDreamNumbers`/`getDreamCategories`를 그대로 재사용), `app/admin/layout.tsx`, `lib/auth/isAdmin.ts`, `proxy.ts`, `app/dream/**`(공개 페이지), Migration/RLS — 전부 무수정(`git status`로 확인).

검증 중 임시로 사용하고 전부 삭제한 것(흔적 없음): `app/api/jtest/route.ts`, Supabase 테스트 계정 2개, 테스트 꿈 콘텐츠(키워드 "테스트꿈9-3" 및 개명 후 "테스트꿈9-3-수정").

---

## 2. 실제 DB/schema 확인 결과

`supabase/migrations/0003_dreams.sql` 원문(재조사 아님, 이번 Task에서 직접 재확인)을 기준으로 판단했다.

| 확인 항목 | 결과 |
|---|---|
| `dreams` 컬럼 | `keyword varchar(50) not null`, `category varchar(30)`(NULL 허용), `interpretation text not null`, `image_url varchar(255)`(NULL 허용), `created_at`/`updated_at`(트리거로 자동 갱신) |
| `dream_number_mappings.dream_id` FK | `references public.dreams (id) on delete cascade` — **CASCADE가 이미 설정돼 있다.** 삭제 시 고아 데이터가 남는 구조가 아님을 migration 원문으로 직접 확인했다(§8) |
| `dream_number_mappings.dream_id` UNIQUE | **없음**(Phase7-1이 이미 발견한 기존 사실 재확인) — 한 꿈에 매핑 행이 여러 개 있을 수 있는 스키마라, 이번 CRUD는 "첫 번째 매핑 행만 대상으로 upsert"하는 `lib/api/dreams.ts`의 기존 전제(`getDreamNumbers()`의 `.limit(1)`)를 그대로 따랐다 |
| RLS | `dreams_select_public`/`dream_number_mappings_select_public`(전체 공개 SELECT), INSERT/UPDATE/DELETE 정책 없음(service_role 전용) — 무수정, 새 RLS 불필요 |
| `dreams.category` CHECK 제약 | **없음** — DB가 특정 taxonomy를 강제하지 않는다. 그래서 이번 CRUD는 하드코딩된 7개 목록 대신 `getDreamCategories()`(실제 DB 값)를 진실의 원천으로 삼았다(§5) |
| `lib/api/dreams.ts` | 조회 전용 4개 함수(`getDreamCategories`/`getDreams`/`getDreamByKeyword`/`getDreamById`/`getDreamNumbers`) — 전부 무수정 재사용, 새 조회 함수를 추가하지 않았다 |

**결론: 새 migration/RLS가 필요하지 않다** — 기존 스키마가 CRUD에 필요한 모든 것을 이미 갖추고 있었다(§8에서 재확인).

---

## 3. 관리자 인증/권한 검증

`app/admin/layout.tsx`(Phase9-1, 무수정)가 `/admin/dreams/**` 전체에 그대로 적용된다 — `getCurrentUser()`/`isAdmin()`을 다시 만들지 않았다. 각 mutation Route Handler(`POST`/`PUT`/`DELETE`)는 `app/api/admin/draws/route.ts`(Phase6-4-2)와 동일한 순서(비로그인 401 → 비관리자 403 → 입력 검증 400 → 실행)를 그대로 따른다 — 새 인증 패턴을 만들지 않았다.

**클라이언트 권한 판단만으로 보안을 완료했다고 보지 않았다** — `DreamForm.tsx`/`DeleteDreamButton.tsx` 어디에도 관리자 여부를 판단하는 코드가 없고, 실제 mutation은 항상 서버가 `isAdmin()`으로 재검증한다(§11 실측).

---

## 4. 목록 구현

`app/admin/dreams/page.tsx` — `getDreams()`(기존, 전체 목록)와 신규 `getDreamIdsWithNumbers()`(`dream_number_mappings.dream_id`만 조회해 `Set`으로 반환, anon 클라이언트, service_role 불필요)를 조합해 keyword/category/"추천 번호 있음·없음"/생성일을 표시한다. 25건 규모라 `lib/api/dreams.ts`가 이미 페이지네이션을 넣지 않은 것과 동일한 이유로 페이지네이션을 넣지 않았다. 검색/필터는 이번 규모에서 실익이 없어 추가하지 않았다(EmptyState는 재사용).

---

## 5. 생성 구현

`app/admin/dreams/new/page.tsx` → `DreamForm(mode="create")` → `POST /api/admin/dreams`. 필드는 keyword/category/interpretation/번호(선택) — 지시문이 명시한 "실제 dreams 테이블에 존재하는 필수 컬럼만"에 따라 `image_url`(NULL 허용, 선택 컬럼)은 이번 MVP 폼에서 제외했다(결정 사항, §14에 재기록).

**category**: 하드코딩 taxonomy를 만들지 않고 `getDreamCategories()`(기존)가 반환하는 실제 DB 값만 `<select>` 옵션으로 제공한다 — 서버(`assertKnownCategory`)도 동일한 함수로 재검증해, 클라이언트 드롭다운을 우회해도 알 수 없는 카테고리가 저장될 수 없다.

---

## 6. 수정 구현

`app/admin/dreams/[id]/edit/page.tsx` — `getDreamById()`+`getDreamNumbers()`+`getDreamCategories()`(전부 기존, 무수정)로 기존 값을 불러와 `DreamForm(mode="edit")`에 prefill한다. 존재하지 않는 id는 `notFound()`(기존 `/dream/[keyword]` 패턴 재사용). 저장은 `PUT /api/admin/dreams/[id]` → `updateAdminDream()`.

---

## 7. 삭제 구현

목록 화면의 각 행에서 `DeleteDreamButton`(Client Component)이 `window.confirm()`으로 1차 확인 후 `DELETE /api/admin/dreams/[id]`를 호출한다(ADMIN_REQUIREMENTS.md §9 "파괴적 액션 2단계 확인"을 새 모달 없이 최소로 만족). 실제 보안 경계는 여전히 서버(`isAdmin()`)다.

---

## 8. 번호 매핑 처리

**Phase9 MVP 요구사항에 포함시켰다** — 이유: `dream_number_mappings`가 없으면 관리자가 새로 만든 꿈에 추천번호를 넣을 방법이 SQL Editor밖에 없어, Phase9의 "왜 지금"(SQL Editor 불필요) 목표와 정면으로 배치되기 때문이다. 다만 별도 CRUD 화면으로 분리하지 않고 `DreamForm` 안의 선택적 체크박스+6개 입력으로 통합했다(지시문 §2 "필요하다면 CRUD에 포함하되 기존 schema 그대로 사용"에 따른 결정).

- **생성/수정 시 번호 upsert**: 기존 매핑 행이 있으면 `UPDATE`, 없으면 `INSERT`(§2 재확인대로 dream_id가 UNIQUE가 아니라 첫 행만 대상). numbers 검증은 `lib/logic/matchNumbers.ts`의 `assertValidNumberSet`(Phase6-1, 무수정)을 그대로 재사용 — 새 검증 로직을 만들지 않았다.
- **번호 필드를 비워둔 채 제출하면 기존 매핑을 건드리지 않는다** — "빈 값 제출 = 매핑 삭제"로 해석하면 실수로 기존 데이터를 지우는 사고가 생길 수 있어, 매핑 삭제는 이번 MVP 범위에 넣지 않았다(결정 사항, 명확히 기록).
- **삭제 시 고아 데이터 위험 확인**: `dream_number_mappings.dream_id`가 `ON DELETE CASCADE`로 설정돼 있음을 migration 원문으로 직접 확인했다(§2) — 꿈을 삭제하면 관련 매핑 행이 DB 레벨에서 자동으로 함께 삭제되므로, **"고아 데이터가 되는 구조라면 중단"** 조건에 해당하지 않아 그대로 구현을 진행했다. 실제 Supabase에서 매핑이 있는 테스트 꿈을 삭제해 매핑 행이 함께 사라짐을 실측 확인했다(§12 Test E/G).

---

## 9. Public `/dream/*` 회귀 검증

실제 Supabase에서 테스트 꿈을 생성 → 공개 페이지 반영 → 수정 → 재반영 → 삭제 → 404 순서로 전부 실측했다(§12). 기존 실제 꿈(돼지꿈 등 25건)은 조회만 하고 어떤 데이터도 변경하지 않았다 — 유일한 예외는 수정 화면(`/admin/dreams/1/edit`)에 실제로 접속해 프리필 값을 확인한 것뿐이며, **저장 버튼을 누르지 않아 실제 데이터는 변경되지 않았다**(§12에서 별도 명시).

---

## 10. SEO/JSON-LD 회귀 검증

기존 돼지꿈 상세 페이지(`/dream/돼지꿈`)를 재조회해 `<title>`/`canonical`/`og:site_name`과 JSON-LD 스크립트 태그 개수(2개: WebSite+BreadcrumbList)가 Phase8과 동일하게 유지됨을 확인했다(§12). `/robots.txt`/`/sitemap.xml`도 응답·URL 개수(35개) 변화 없음을 확인했다 — 이번 Task가 만든 `/admin/dreams/**`는 전부 `noindex`이고 sitemap에도 포함되지 않는다(sitemap.ts 무수정이므로 당연한 결과).

---

## 11. 보안 검증

- 비로그인 → `POST/PUT/DELETE /api/admin/dreams*` 전부 `401`.
- 일반 사용자(User A) → 전부 `403`.
- 관리자(User B로 승격) → 정상 수행.
- 클라이언트 번들(`.next/static/chunks/`)을 `grep -rl "SUPABASE_SERVICE_ROLE_KEY\|service_role"`로 전수 검사해 **0건** 확인 — `service_role`은 `lib/api/admin/dreams.ts`(서버 전용 파일)에만 존재한다.
- `user_id`/소유권 필드 개념 자체가 이 기능에 없다(꿈은 공개 콘텐츠, 특정 사용자 소유가 아님) — 위조할 필드가 애초에 존재하지 않는다.

---

## 12. 실제 Supabase 통합 테스트 (production build 기준)

| 테스트 | 결과 |
|---|---|
| **Test A**: 비로그인 mutation | `401` |
| **Test B**: 일반 사용자 mutation | `403` |
| **Test C**: 관리자 생성(keyword="테스트꿈9-3", category="동물", numbers=[3,7,12,21,34,45]) | `201`, service_role 재조회로 `dreams`+`dream_number_mappings` 둘 다 정확히 저장 확인 |
| **Test D**: 관리자 수정(keyword/category/interpretation/numbers 전부 변경) | `200`, `updated_at`이 트리거로 자동 갱신됨을 확인. 매핑은 **새 행이 아니라 기존 행이 UPDATE**됨(같은 `id`) 확인 — upsert 정상 동작 |
| **Test E/G**: 매핑이 있는 꿈 삭제 | `204`, 이후 `dream_number_mappings` 재조회 결과 **0건**(cascade로 자동 삭제, 고아 데이터 없음) |
| **Test F**: public 반영 | `/dream/테스트꿈9-3-수정`에서 수정된 title/description/h1/추천번호(1,2,3...)/canonical/BreadcrumbList 전부 정확히 반영 확인. 삭제 후에는 같은 URL이 `404` |
| 잘못된 category | `400`, "category는 다음 중 하나여야 합니다: 동물, 사물, 상황, 신체, 인물, 자연, 행동 (또는 미지정)" |
| 존재하지 않는 id 수정/삭제 | 둘 다 `404 NOT_FOUND` |
| keyword 51자(길이 초과) | `400` |
| 관리자 UI 렌더링 | `/admin/dreams`(목록, "새 꿈 추가" 버튼) `200`, `/admin/dreams/new`(카테고리 드롭다운에 실제 DB 7개 값 정확히 표시) `200`, 일반 사용자는 둘 다 `404` |
| 기존 실제 꿈 수정 화면 | `/admin/dreams/1/edit`(돼지꿈) 프리필 정상 확인, **저장은 하지 않아 실제 데이터 무변경** |

검증 종료 후 테스트 계정 2개, `admins`/`profiles` 테스트 행, 테스트 꿈 콘텐츠(개명 전/후 키워드 둘 다)를 전부 삭제하고 **잔여 0건**을 응답으로 직접 재확인했다. 임시 검증 라우트도 삭제 완료.

**실측 중 발견한 것(결함 아님)**: Windows Git Bash에서 한글 텍스트를 curl `-d` 인자에 직접 인라인으로 넣으면 인코딩이 깨져 "category는 다음 중 하나여야 합니다..." 오류가 (정상 값인 "동물"을 보냈음에도) 발생했다 — Phase7-4/7-5가 이미 기록한 것과 동일한 테스트 도구 아티팩트다. Node로 생성한 JSON 파일(`--data-binary @file`)로 재시도해 정상 동작을 확인했다. 실제 브라우저의 `fetch()`는 이 문제가 없다.

---

## 13. 테스트 수 / lint / type-check / build

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과, 경고 0건 |
| `npm run type-check` | 통과(1건 수정 — `DreamForm.tsx`에서 nullable union을 배열 인덱스 대입에 그대로 캐스팅해 발생한 오류, `NonNullable<>`로 수정) |
| `npm test` | 통과 — 15 test files, **227 tests**(기존 188 + 신규 39: `lib/api/admin/dreams.test.ts` 22건 + `components/admin/dreamFormValidation.test.ts` 17건) |
| `npm run build` | 통과 — 라우트 **28개**(기존 25 + 신규 3: `/admin/dreams`, `/admin/dreams/[id]/edit`, `/admin/dreams/new`, API 2개: `/api/admin/dreams`, `/api/admin/dreams/[id]`) |
| 클라이언트 번들 service_role 검사 | `grep -rl "SUPABASE_SERVICE_ROLE_KEY\|service_role" .next/static/chunks/` **0건** |

---

## 14. 발견된 문제

새로 발견된 Critical/High 문제는 없다.

- **(결정 사항, 기록) `image_url` 필드를 CRUD 폼에서 제외했다** — 지시문 §2가 "실제 dreams 테이블에 존재하는 필수 컬럼만" 입력하도록 명시했고, `image_url`은 NULL 허용(선택) 컬럼이라 MVP 범위에서 뺐다. 기존 꿈들의 `image_url` 값은 이번 CRUD로 건드릴 수 없다(조회도 수정도 안 됨) — 향후 필요해지면 별도로 추가하면 된다.
- **(결정 사항, 기록) 번호 매핑을 "비우기"(삭제)는 지원하지 않는다** — 빈 값 제출 시 기존 매핑을 그대로 둔다(§8). 매핑을 완전히 제거해야 하는 경우는 이번 MVP 범위 밖으로 남겨뒀다.
- Windows Git Bash 한글 인라인 인자 인코딩 아티팩트(§12) — 애플리케이션 문제 아님, 기록만.

---

## 15. 기존 Known Issues와 신규 이슈 구분

이번 Task는 `docs/PHASE9_PRE_IMPLEMENTATION_AUDIT.md`/`PHASE9_ADMIN_GATE_REPORT.md`/`PHASE9_DRAWS_ADMIN_UI_REPORT.md`가 이미 기록한 이슈(`/login?next=`이 하위 경로 대신 `/admin` 고정, `/admin/*` title template 미적용, robots.txt에 `/admin` 미포함, FAQ/가이드 스키마 미확정 BLOCKER)를 재조사하지 않았다 — 전부 이번 Task 범위(꿈해몽 CRUD)와 무관하며, 실제로 재현되더라도 새 이슈로 등록하지 않았다. `dreams.keyword`에 DB UNIQUE 제약이 없다는 기존 Known Issue(Phase7-1)도 재확인만 했다 — 이번 Task는 애플리케이션 레벨에서 새로운 검증을 추가하지 않았고, 실제로 중복 keyword를 만들 수 있는 상태는 이전과 동일하게 남아있다(범위 확대 없이 기록만).

---

## 16. Phase9-4 착수 가능 여부

**READY.** Critical/High 문제 없음. 목록/생성/수정/삭제/번호 매핑이 실제 Supabase 환경에서 전부 정상 동작함을 확인했고, public `/dream/*`·SEO/JSON-LD·Phase4~8 주요 페이지·`POST /api/admin/draws`에 회귀가 없다. FAQ/가이드는 여전히 스키마 미확정 BLOCKER 상태로 이번 Task에서도 건드리지 않았다.

---

## 17. 다음 작업 추천

**대시보드 핵심 지표 위젯(`app/admin/page.tsx` 확장).**

이유: `docs/PHASE9_PRE_IMPLEMENTATION_AUDIT.md`가 이미 확인한 대로 "오늘 신규가입"(`profiles.created_at`)/"오늘 번호생성"(`user_numbers.created_at`)/"다음 추첨까지 남은 시간"(계산)은 기존 테이블만으로 충분하고 스키마 확정이나 새 migration이 필요 없다 — FAQ/가이드(BLOCKER)와 달리 지금 바로 착수 가능한 마지막 EXECUTION_PLAN Phase9 완료 기준 항목이다("미처리 신고 건수"는 `reports` 테이블이 아직 없어 Phase9-1 감사가 이미 이번 지표 세트에서 제외하기로 판단해 둔 것을 그대로 따르면 된다). 이 작업까지 끝나면 FAQ/가이드를 제외한 EXECUTION_PLAN Phase9 완료 기준 3개 중 2개(관리자 접근제어, 회차입력+꿈해몽 CRUD)가 이미 충족된 상태에서 대시보드까지 완성돼, FAQ/가이드 스키마 결정만 남게 된다.
