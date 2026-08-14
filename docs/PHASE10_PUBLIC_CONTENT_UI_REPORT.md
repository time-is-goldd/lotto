# Phase10-2 — FAQ/Guide 공개 UI + SEO + Sitemap 연동 구현 보고서

> `docs/PHASE10_RELEASE_GATE.md`와 `docs/PHASE10_PUBLIC_CONTENT_DATA_REPORT.md`(Phase10-1)가 확정한 공개 데이터 레이어(`content_entries` 공개 SELECT RLS, guide title partial UNIQUE, `lib/api/content.ts`)를 그대로 재사용해 실제 검색 가능한 공개 페이지로 연결했다. DB schema/migration/RLS를 추가하지 않았고, 관리자 CRUD를 재구현하지 않았다. 법적 페이지, synthetic draws, 운영 admin, Kakao E2E, 배포는 이번 Task 범위가 아니다.

---

## 1. 생성/수정 파일

**신규**:
- `app/faq/page.tsx` — FAQ 공개 목록 페이지.
- `app/guide/[topic]/page.tsx` — Guide 공개 상세 페이지.
- `docs/PHASE10_PUBLIC_CONTENT_UI_REPORT.md`(본 보고서).

**수정**:
- `app/sitemap.ts` — `/faq` 정적 URL 1개 + `getGuideEntries()`(Phase10-1) 기반 guide URL 목록 추가.

**수정하지 않은 파일**(전수 확인): `lib/api/content.ts`, `lib/api/admin/content.ts`, `app/api/admin/content/*`, `supabase/migrations/*`, `components/admin/*`, `app/admin/**`, `app/robots.ts`, `app/layout.tsx`, `components/navigation/*`, `app/terms|privacy|about`(생성 안 함), `app/dream/**`.

**검증 중 임시로 사용하고 전부 삭제한 것**(흔적 없음, `git status` 확인): `app/api/jtest/route.ts`, 테스트 Auth 계정 1개(kakaoId 990963001), `admins` 테스트 행 1개, 테스트 `content_entries` 4건(id 15/16/17/18).

---

## 2. `/faq` 구현

`getFaqEntries()`(Phase10-1)를 그대로 호출한다 — 새 Supabase query를 작성하지 않았다. `display_order asc → id asc` 정렬은 그 함수의 기존 계약을 그대로 신뢰한다. `<details>/<summary>` 기반 accordion으로 구현해 JavaScript 없이 질문/답변이 항상 SSR HTML에 존재하고 키보드/스크린리더 접근성을 기본 제공한다(외부 accordion 라이브러리·새 Client Component 없음). 시각 스타일은 `components/ui/Card.tsx`가 쓰는 클래스(`rounded-card bg-bg-subtle p-4 shadow-card`)를 그대로 재사용했다.

## 3. `/guide/[topic]` 구현

`getGuideByTopic(decodedTopic)`(Phase10-1)를 그대로 호출한다. `app/dream/[keyword]/page.tsx`(Phase8-2/8-3)와 동일한 이유로 페이지 컴포넌트와 `generateMetadata()` 양쪽에서 각각 `decodeURIComponent()`를 호출하는 대칭 구조를 그대로 재사용했다 — 새 decode 계약을 발명하지 않았다. `React.cache()`로 `getGuideByTopic`을 감싸 같은 렌더 요청 안에서 중복 조회를 막았다(dream 상세 페이지와 동일한 패턴).

## 4. `/guide` 목록 Route 구현 여부와 근거

**구현하지 않았다.** `docs/EXECUTION_PLAN.md` Phase10 §3의 "생성할 파일" 목록에 `app/guide/page.tsx`가 없고(오직 `app/guide/[topic]/page.tsx`만 명시), `docs/SITEMAP.md`도 `/guide`를 위한 별도 목록 route를 구체적으로 요구하지 않는다(§1 "`/guide, /faq` 가이드/FAQ(기존과 동일)"는 기능 영역을 가리킬 뿐 목록 페이지 존재를 확정하지 않음). `docs/PHASE10_RELEASE_GATE.md` §4도 Guide 공개 페이지 설계에서 `/guide` 인덱스를 언급하지 않는다. 문서에 명시되지 않은 route를 임의로 추가하지 않는다는 지시문 원칙에 따라 만들지 않았다 — 이 결정이 §11 BreadcrumbList 구조에도 그대로 반영된다.

## 5. FAQ EmptyState

`content_entries`에 `type='faq'` 행이 0건이면 `getFaqEntries()`가 빈 배열을 반환하고, 페이지는 에러 없이 `200`을 반환하며 기존 `EmptyState` 컴포넌트("아직 등록된 FAQ가 없어요")를 보여준다. 이 상태에서 FAQPage JSON-LD `<script>`는 아예 렌더링되지 않는다(§9). 새 CMS 기능이나 seed 데이터를 추가하지 않았다.

## 6. Guide 404

존재하지 않는 topic은 `notFound()`로 실제 `404` 상태 코드를 반환한다. 빈 200 페이지, 다른 Guide로의 fallback, 임의의 첫 행 반환 중 어느 것도 발생하지 않는다 — `getGuideByTopic()`이 `null`을 반환하면 즉시 `notFound()`를 호출하는 한 갈래 경로뿐이다. `content_entries_guide_title_idx`(0015, Phase10-1)가 `type='guide'` 행끼리 title 중복을 DB 레벨에서 막아주므로 정상 Guide는 항상 0건 또는 1건이다.

## 7. FAQ metadata

`title`/`description`/`alternates.canonical("/faq")`/`openGraph`/`twitter`를 정적 `export const metadata`로 구현했다(FAQ 콘텐츠 자체가 페이지 텍스트를 바꾸지 않으므로 `app/dream/page.tsx`처럼 `generateMetadata()`가 아니라 정적 객체로 충분). `openGraph.siteName`/`locale`을 명시적으로 재지정해 Phase8-2가 발견한 "페이지별 `openGraph`가 전역 값을 완전히 대체하는" 문제를 재발시키지 않았다(§17에서 실측 확인).

## 8. Guide dynamic metadata

`generateMetadata()`가 각 Guide의 실제 `title`/`body`로 `title`/`description`/`canonical`/`openGraph`/`twitter`를 생성한다. `description`은 `body.replace(/\s+/g, " ").trim().slice(0, 100)`로 plain text를 안전하게 정리했다(HTML 파싱 없음 — `body` 자체가 plain text 컬럼). `canonical`은 `/guide/${encodeURIComponent(guide.title)}`로 `sitemap.ts`/`BreadcrumbList`와 동일한 인코딩 규칙을 공유한다. 존재하지 않는 topic은 `{ title: "가이드" }`만 반환하고 `canonical`/OG를 채우지 않는다(dream 상세 페이지의 동일한 안전장치). `content_entries_guide_title_idx`가 title 중복을 막아주므로 임의의 행을 골라 metadata를 만드는 경로 자체가 없다.

## 9. FAQPage JSON-LD 구현 여부

**구현했다.** 실제 `/faq` 화면에 표시되는 질문/답변과 정확히 동일한 내용만 `mainEntity`에 담는다(허위 FAQ 없음, 화면에 없는 내용 없음). `entries.length === 0`이면 `buildFaqPageJsonLd()` 자체를 호출하지 않아 EmptyState에서는 `<script>` 태그가 출력되지 않는다(§16 실측 확인). `app/dream/[keyword]/page.tsx`/`app/layout.tsx`와 동일하게 `JSON.stringify(...).replace(/</g, "\\u003c")`로 `</script>` 조기 종료를 방어했다(§18에서 실제 XSS 시도 문자열로 검증).

## 10. Guide BreadcrumbList

**"홈 → 현재 Guide" 2단계**로 구성했다. `/guide` 목록 route가 존재하지 않으므로(§4) 존재하지 않는 가상 URL을 breadcrumb item으로 만들지 않는다는 지시문 §11 원칙을 그대로 따랐다 — `dream/[keyword]`의 3단계(홈→꿈해몽→현재 keyword)와 의도적으로 다른 구조다. 마지막 항목의 `item` URL은 `canonical`과 동일한 `encodeURIComponent(guide.title)` 규칙으로 만들어 항상 일치한다(§17에서 실측 확인).

## 11. WebSite JSON-LD 공존

`/faq`, `/guide/[topic]` 둘 다 `app/layout.tsx`의 전역 WebSite JSON-LD(무수정)와 함께 렌더링된다. 실측 결과 `/faq`는 script 태그 정확히 2개(WebSite + FAQPage), `/guide/[topic]`도 정확히 2개(WebSite + BreadcrumbList) — 중복 출력이나 서로 다른 페이지로의 새어나감 없이 Phase8이 확립한 공존 패턴을 그대로 유지한다.

## 12. Sitemap 변경

`app/sitemap.ts`에 `/faq` 정적 URL 1개(`staticEntries`)와 `getGuideEntries()`(Phase10-1) 기반 guide URL 목록(`guideEntries`)을 추가했다. `lib/api/content.ts`를 그대로 재사용했고(별도 Supabase query 미작성), `service_role`은 어디에서도 쓰지 않았다(`getGuideEntries()`도 anon 클라이언트 기반, Phase10-1). `admin`/FAQ admin URL은 포함하지 않았다(sitemap.ts는 애초에 `dreams`/`content_entries`의 공개 조회 함수만 호출하고 `/admin/*`를 참조하는 코드 경로가 없음). `revalidate = 3600`(기존 값, 무수정) 유지. `dreamEntries` 생성 로직은 손대지 않았다.

## 13. Guide title 변경 시 URL 동작 (Known Behavior)

관리자가 Guide의 title을 수정하면 URL도 함께 바뀐다 — 이것은 MVP에서 의도된 구조다(slug/redirect history/alias 미구현, 지시문 §13). 실측(§16 Test E): 기존 `/guide/Public%20Guide%20Test` → title 변경 직후 `404`, 신규 `/guide/Public%20Guide%20Test%20Renamed` → `200`. **sitemap 반영 시점**: `npm run dev`(개발 서버)는 `revalidate=3600` ISR 캐시를 적용하지 않고 매 요청 즉시 재계산하므로, 개발 환경에서는 title 변경 직후 요청한 `/sitemap.xml`에도 새 URL이 곧바로 반영됨을 확인했다. **production 빌드(`next build`+`next start`)에서는 이 설정이 실제로 최대 1시간 캐시로 동작할 것**(sitemap.ts 자체는 무수정이므로 Phase8-1이 이미 확립한 캐시 정책을 그대로 물려받음) — 이번 Task에서는 프로덕션 배포/재시작 검증까지는 범위 밖이라 dev 서버 실측만 기록한다.

## 14. Rendering/cache 방식

`npm run build` 결과 `/faq`, `/guide/[topic]` 둘 다 `ƒ`(Dynamic, on-demand 렌더링)로 표시된다. 이는 이번 Task가 만든 코드 때문이 아니다 — `app/layout.tsx`가 모든 페이지에서 공유하는 `Header`(`components/layout/Header.tsx`)가 `getCurrentUser()`로 쿠키 기반 세션을 읽어, `/`·`/dream`·`/dream/[keyword]`·`/generate` 등 **이 프로젝트의 모든 일반 페이지가 이미 `ƒ`**다(기존 Known Issue, Phase7 Final Audit에 이미 기록된 "SSG/ISR 미적용"과 동일한 원인). `lib/api/content.ts`(Phase10-1)가 쿠키 없는 anon 클라이언트를 쓰기로 한 선택은 이 문제를 새로 만들지 않기 위한 것이었을 뿐, `Header`가 이미 만들어 둔 사이트 전역 dynamic 제약을 이번 Task 범위에서 풀 수는 없다 — 지시문 §19 "단순히 정적화를 위해 복잡한 구조를 추가하지 않는다"에 따라 `generateStaticParams()` 등도 추가하지 않았다. `app/sitemap.ts`는 `○`(정적, `Revalidate: 1h`)로 무변화 유지된다.

---

## 15. 실제 Supabase 통합 테스트

`npm run dev` + 실제 원격 Supabase 프로젝트를 대상으로, Phase2 이래 반복 사용해 온 방법(`establishKakaoSupabaseSession()` 재사용, 임시 `app/api/jtest/route.ts` 생성 후 검증 종료 즉시 삭제)으로 관리자 계정을 만들어 검증했다. 테스트 데이터는 전부 관리자 API(`POST/PUT/DELETE /api/admin/content`)로 생성/수정/삭제했고, 한글 값은 Write 도구로 만든 JSON 파일(`--data-binary @file`)로만 전달했다.

| 테스트 | 결과 |
|---|---|
| Test A: FAQ 2개 생성 → `/faq` | `200`, 두 질문/답변 모두 raw HTML에 존재, `display_order`(1→2) 순서대로 A가 B보다 먼저 등장, FAQPage JSON-LD `mainEntity` 2건이 실제 화면 내용과 정확히 일치 |
| Test B: Guide(영문 title) 생성 → `/guide/Public%20Guide%20Test` | `200`, title/body 정상 렌더링, `description`이 줄바꿈을 공백으로 정리한 형태로 정상 생성 |
| Test C: Guide(한글 title) 생성 → encoded URL 접근 | `200`, title/body 정상, canonical이 실제 요청 URL과 정확히 일치 |
| Test D: 존재하지 않는 topic | `404` |
| Test E: Guide title 수정 | 새 URL `200`, 기존 URL `404`(§13) |
| Test F: Guide 삭제 | 해당 URL `404` |

## 16. 한글 URL 검증

Test C에서 `encodeURIComponent("가이드 테스트 한글")`로 만든 URL(`/guide/%EA%B0%80%EC%9D%B4%EB%93%9C%20%ED%85%8C%EC%8A%A4%ED%8A%B8%20%ED%95%9C%EA%B8%80`)로 실제 요청해 `200`과 정확한 title/body/canonical을 확인했다 — `app/dream/[keyword]/page.tsx`가 이미 겪은 것과 동일한 이중 decode 대칭 구조(`generateMetadata()`는 디코딩된 params, 페이지 컴포넌트는 퍼센트 인코딩된 원본 params)가 이번 Next.js 버전(16.2.12)에서도 그대로 재현됨을 실측으로 재확인했고, 두 진입점 모두 `decodeURIComponent()`를 직접 호출하는 동일한 패턴으로 정상 동작함을 검증했다. 한글 값은 전부 Write 도구로 만든 JSON 파일을 통해서만 전달했다 — Git Bash 커맨드라인 인자에 한글을 직접 인라인으로 넣지 않았다.

## 17. JSON-LD/XSS 검증

FAQ B의 title/body에 `</script>`와 `<b>bold</b>` 마크업 시도를 그대로 담아 생성했다. 실제 `/faq` 응답을 검사한 결과:
- FAQPage JSON-LD `<script>` 태그는 정확히 1개만 존재(WebSite와 합쳐 정확히 2개) — `</script>` 문자열이 실제 script 경계를 깨지 않았다.
- JSON-LD raw 콘텐츠에 리터럴 `</script>`가 존재하지 않고 `<` 이스케이프로 치환되어 있음을 확인(`grep -c "u003c"` > 0).
- `JSON.parse()`로 해당 script 태그 내용을 파싱한 결과 원래 문자열(`"JTEST-P10-2-FAQ-B contains </script> attempt"`)이 정확히 복원됨 — 이스케이프가 데이터를 손상시키지 않았다.
- UI에서 `<b>bold</b>` 등 어떤 마크업도 HTML로 실행되지 않고 리터럴 텍스트로만 렌더링됨(React가 텍스트 노드로 자동 이스케이프, `dangerouslySetInnerHTML`은 JSON-LD `<script>` 태그 자체에만 쓰였고 사용자 콘텐츠 렌더링에는 쓰이지 않음).

테스트 데이터는 검증 직후 전부 삭제했다(§20).

## 18. 관리자 CRUD 회귀

| 확인 대상 | 결과 |
|---|---|
| `/admin/faq`, `/admin/faq/new`, `/admin/faq/[id]/edit` | 전부 `200`(무수정 확인) |
| `/admin/guides`, `/admin/guides/new`, `/admin/guides/[id]/edit` | 전부 `200`(무수정 확인) |
| Guide 중복 title → `POST /api/admin/content` | `409 DUPLICATE_GUIDE_TITLE` 유지(Phase10-1과 동일하게 재확인) |

공개 SELECT RLS(Phase10-1)나 이번 Task의 페이지 추가가 관리자 mutation 흐름에 어떤 영향도 주지 않았다.

## 19. 기존 Phase6~9 회귀

| 대상 | 결과 |
|---|---|
| `/`, `/dream`, `/dream/돼지꿈`, `/generate`, `/my/journal` | 전부 `200` |
| `/admin`, `/admin/draws`, `/admin/dreams` | 전부 `200`(관리자 세션) |
| `/robots.txt`, `/sitemap.xml` | 전부 `200` |
| `/dream/돼지꿈` JSON-LD 개수 | 4(기존과 동일 — WebSite+BreadcrumbList 각 1개, RSC 하이드레이션 payload에 각각 1회씩 echo되어 raw 텍스트 기준 2배로 관측되는 기존 관찰 결과와 동일, Phase8-4가 이미 기록한 것과 같은 현상) |

**회귀 없음.**

---

## 20. lint/type-check/test/build

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과, 경고 0건 |
| `npm run type-check` | 통과 |
| `npm test` | **18 test files, 277 tests 전부 통과**(baseline과 동일 — 새 UI/metadata/JSON-LD 페이지는 이 프로젝트의 jsdom 없는 vitest 환경에서 유닛테스트 대상이 아니라 실제 HTTP 검증으로 대체, Phase8과 동일한 판단. 신규 테스트 0건, 기존 테스트 삭제/수정 없음) |
| `npm run build` | 통과, **35개 라우트**(baseline 33 + `/faq` + `/guide/[topic]`), `/faq`/`/guide/[topic]` 둘 다 `ƒ`(§14), `/sitemap.xml` 정적 유지(`Revalidate: 1h`) |
| 클라이언트 번들 `service_role` 검사 | 0건 |
| `npx supabase migration list` | `0001`~`0015` local/remote 동기화 유지, **신규 migration 없음**(이번 Task 범위 준수) |

---

## 21. cleanup

| 대상 | 정리 방법 | 확인 방법 |
|---|---|---|
| 테스트 `content_entries` 4건(id 15/16/17/18) | 관리자 API `DELETE`(id 기준, 17은 Test F에서 이미 삭제) | `GET /api/admin/content?type=faq`/`?type=guide` 둘 다 `{"data":[]}` + service_role 직접 카운트 `content_entries: 0` |
| 테스트 Auth 계정 1개 | `service_role` 기반 `admin.deleteUser()`(jtest cleanup) | 세션 쿠키로 재요청 시 `401`(세션 완전 폐기) |
| `admins` 테스트 행 1개 | 위 cleanup에서 `user_id` 기준 사전 삭제 | service_role 직접 카운트 `admins: 0` |
| sitemap 상태 | — | cleanup 후 `36`(baseline 35 + `/faq`, guide 0건)으로 정확히 복귀 확인 |

한글 title 문자열 하나만으로 cleanup 여부를 판정하지 않고, 전부 id 기준 삭제 + service_role 직접 카운트로 재확인했다. 기존 실제 콘텐츠(꿈해몽 25건 등)는 어떤 시점에도 건드리지 않았다.

---

## 22. 발견된 문제

새로 발견된 Critical/High 결함은 없다. 기록할 사항:

- **`/faq`/`/guide/[topic]`이 `ƒ`(Dynamic)로 렌더링됨** — §14에서 설명한 대로 이 프로젝트의 기존 `Header`(쿠키 기반 인증 상태 표시)가 모든 페이지를 이미 dynamic으로 만들고 있어, 새로 만든 두 페이지도 동일한 상태를 물려받았다. 새로운 문제가 아니라 Phase7 Final Audit이 이미 기록한 기존 Known Issue의 연장선이다.
- **Guide title 변경 시 sitemap 반영 시점이 dev/production에서 다를 수 있음**(§13) — dev 서버는 즉시 반영, production은 `revalidate=3600`(최대 1시간) 캐시가 적용될 것으로 예상되나 이번 Task에서 production 빌드 기동까지 검증하지는 않았다. 코드 결함이 아니라 기존 캐시 정책(Phase8-1, 무수정)의 정상 동작이다.

---

## 23. Phase10-2 최종 판정

### PASS

Critical/High 결함 없음, 지시문이 요구한 최소 범위(FAQ 목록 + Guide 상세 + 각 페이지 metadata/JSON-LD + sitemap 연동)를 전부 구현했고 실제 Supabase 환경에서 전부 검증했다. 관리자 CRUD/기존 Phase6~9 기능 회귀 없음. `/guide` 목록처럼 문서에 없는 route는 임의로 추가하지 않았고, 법적 페이지/synthetic draws/운영 admin/Kakao E2E/배포 등 범위 밖 항목에는 손대지 않았다(§22 "금지" 목록 전수 미수행 확인).

---

## 24. Phase10-3 착수 가능 여부

**READY.** 공개 FAQ/Guide 페이지와 SEO/sitemap 연동이 실제 Supabase 환경에서 검증 완료되어, `docs/PHASE10_RELEASE_GATE.md` §14가 계획한 다음 단계(법적 페이지 → production 데이터/운영 준비 → 배포 설정 → 배포 후 검증)로 진행할 수 있는 상태다.

---

## 25. 다음 작업 추천

`docs/PHASE10_RELEASE_GATE.md` §14 순서상 다음은 **법적 페이지(`app/terms/page.tsx`, `app/privacy/page.tsx`, `app/about/page.tsx`) 구현**이다. FAQ/Guide(Could 등급)와 달리 ROADMAP.md §1이 이용약관/개인정보처리방침을 **Must**(법적 최소 요건)로 분류하고 있고, DB/공개 데이터 레이어에 대한 의존이 전혀 없어 이번 Task의 결과물과 독립적으로 즉시 착수 가능하다.

---

## TASK REPORT — Phase10-2

- **FAQ**: PASS
- **Guide**: PASS
- **Guide Index**: NOT IMPLEMENTED (문서에 명시되지 않아 의도적으로 미구현, §4)
- **FAQ Metadata**: PASS
- **Guide Metadata**: PASS
- **FAQPage JSON-LD**: PASS (구현함, 실제 화면 내용과 일치, empty 상태에서 미출력)
- **BreadcrumbList**: PASS (홈→현재 Guide 2단계, `/guide` 목록 부재를 반영한 구조)
- **Sitemap**: PASS
- **Final Sitemap Count**: 36 (baseline 35 + `/faq` 1, guide 0건 — cleanup 후 상태)
- **Public RLS**: PASS (Phase10-1 그대로 유지, 회귀 없음)
- **Admin CRUD Regression**: PASS
- **Security**: PASS (service_role 미사용, XSS 이스케이프 검증 완료)
- **Rendering**: Dynamic(`ƒ`) — 이 프로젝트의 기존 Header 쿠키 의존으로 인한 사이트 전역 특성, 이번 Task로 인한 회귀 아님
- **Tests**: PASS (277/277, 신규 없음 — Phase8과 동일하게 실제 HTTP 검증으로 대체)
- **Build**: PASS (35 routes)
- **Cleanup**: PASS (content_entries 0건, admins 0건, 세션 폐기 확인 — 전부 id/count 기준)
- **Phase10-2**: PASS
- **Phase10-3 Ready**: YES
- **다음 작업**: 법적 페이지(`app/terms`, `app/privacy`, `app/about`) 구현 1개
