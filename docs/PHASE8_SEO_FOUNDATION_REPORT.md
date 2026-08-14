# Phase8-1 SEO Foundation 구현 보고서

> Phase8-0 감사(`docs/PHASE8_PRE_IMPLEMENTATION_AUDIT.md`)가 확정한 대로 EXECUTION_PLAN.md 원문의 "Phase 8 — SEO"를 구현한다. 외부 로또 데이터 자동 수집(ROADMAP macro-Phase8)은 이번 Task와 무관하며 전혀 다루지 않았다. SEO를 한 번에 전부 구현하지 않고 **Foundation(global metadata, robots.txt, sitemap.xml, 최소한의 개별 페이지 보완)만** 구현했다.

---

## 1. 현재 SEO 상태 (구현 전 실측)

| 항목 | 구현 전 상태 |
|---|---|
| `app/layout.tsx` metadata | `title`(문자열, template 없음), `description`만 존재. `metadataBase`/`robots`/`openGraph`/`twitter` 없음 |
| `app/robots.ts` | **없음**(전수 확인, `Glob` 결과 0건) |
| `app/sitemap.ts` | **없음** |
| `/dream`, `/dream/category/[category]`, `/dream/[keyword]` | title/description 이미 구현됨(Phase7-2), `robots` 미지정(= 기본 색인 허용, 의도와 일치), canonical 없음, 404는 `notFound()`로 이미 처리됨 |
| `/generate` | title/description 이미 구현됨(Phase5), `robots` 미지정(P0 의도와 일치), canonical 없음 — `?dream=<id>` 상태 쿼리와 중복 콘텐츠 신호 위험 존재 |
| `/login` | **metadata 자체가 없음**(전수 확인) — `getCurrentUser()` 확인이나 redirect 없이 누구에게나(크롤러 포함) 그대로 렌더링됨. `docs/SITEMAP.md` §4가 P3(noindex)로 분류한 것과 실제 코드가 불일치 |
| `/onboarding` | metadata 없음. 단 `getCurrentUser()` 확인 후 비로그인이면 즉시 `redirect("/")` — 크롤러는 실제 콘텐츠를 볼 수 없어 `/login`과 리스크 성격이 다름 |
| `/my/journal/*`, `/ui-preview` | 이미 개별적으로 `robots: { index: false, follow: false }` 지정됨(Phase4/Phase3) — 정상, 무수정 |
| favicon | `app/favicon.ico` 존재(Next.js 기본 라우트) — 무수정 |
| OG 이미지 자산 | `public/` 디렉터리에 `.gitkeep`뿐, 실제 이미지 없음(전수 확인) |

---

## 2. 이번 Task에서 구현한 항목

1. `app/layout.tsx`: `metadataBase`, title template(`%s | Luck Platform`), 사이트 기본 `description`을 `SITE_DESCRIPTION` 상수로 재사용, 기본 `robots: {index:true, follow:true}`, `openGraph`/`twitter` 기본값.
2. `app/generate/page.tsx`: 기존 title/description은 무수정, `alternates.canonical: "/generate"`만 추가.
3. `app/login/page.tsx`: metadata가 아예 없던 상태에서 `title`+`robots: {index:false, follow:false}` 신규 추가.
4. `app/robots.ts`: 신규 생성. `docs/SITEMAP.md` §4 P3 목록 + `proxy.ts`의 `PROTECTED_PATHS`를 그대로 반영.
5. `app/sitemap.ts`: 신규 생성. 실제 구현된 공개 페이지(홈/`/dream`/`/generate`/카테고리 7개/꿈 상세 25개)만 포함, `export const revalidate = 3600`으로 캐싱.

**변경하지 않은 것**: `/dream`, `/dream/category/[category]`, `/dream/[keyword]`의 기존 title/description/404 로직, `/onboarding`(§9 근거), `lib/api/dreams.ts`, `generateNumbers()`, `POST /api/numbers`, `POST /api/journal/dreams`, Phase6 admin API, `proxy.ts`, 모든 RLS/Migration.

---

## 3. 변경 파일

| 파일 | 종류 |
|---|---|
| `app/layout.tsx` | 수정(기존 파일) |
| `app/generate/page.tsx` | 수정(기존 metadata에 1개 필드 추가) |
| `app/login/page.tsx` | 수정(metadata 신규 export 추가) |
| `app/robots.ts` | 신규 |
| `app/sitemap.ts` | 신규 |
| `docs/PHASE8_SEO_FOUNDATION_REPORT.md` | 신규(본 보고서) |

`lib/seo/metadata.ts`/`lib/seo/jsonld.ts`/`components/seo/Breadcrumb.tsx`(EXECUTION_PLAN.md Phase8 §3이 원래 예정했던 파일들)는 만들지 않았다 — 이번 Task 범위(Foundation)에서 실제로 필요하지 않았고, 지시문 §12 "필요한 경우에만 작은 유틸 추가"에 따라 불필요한 선제작업을 하지 않았다.

---

## 4. Global metadata 전략

- `metadataBase`는 기존 컨벤션(`NEXT_PUBLIC_SITE_URL`, `.env.example`에 이미 존재, `lib/auth/kakao.ts`의 `getKakaoRedirectUri()`가 쓰는 것과 동일한 환경변수)을 그대로 재사용했다 — 새 환경변수를 추가하지 않았다.
- title template(`%s | Luck Platform`)을 도입해, 이미 title을 문자열로 지정해 둔 모든 페이지(Dream 상세/카테고리, `/generate`, `/my/journal/*`)가 코드 수정 없이 자동으로 "OOO | Luck Platform" 형태가 되도록 했다. 홈(`app/page.tsx`)은 별도 metadata가 없어 `default`(“Luck Platform”)만 그대로 쓰인다 — template이 적용되지 않는 것이 Next.js의 표준 동작이며, 홈페이지 title로는 사이트명 단독이 자연스러워 별도 title을 추가하지 않았다.
- `openGraph`/`twitter`는 **전역 기본값만** 설정했다. 페이지별 OG 제목/설명(예: `/dream/돼지꿈`을 공유했을 때 "돼지꿈 해몽"이 OG title로 뜨는 것)은 각 페이지가 자신의 `openGraph` 객체를 별도로 지정해야 하는데, 이는 이번 Foundation 범위를 넘는 페이지별 작업이라 하지 않았다(§15 Phase8-2 후보).
- OG 이미지(`images`)는 지정하지 않았다 — `public/`에 실제 이미지 자산이 없는 상태에서 존재하지 않는 경로를 넣으면 공유 미리보기가 깨진 상태로 노출되기 때문이다(허위 콘텐츠 금지 원칙과 같은 맥락).

---

## 5. canonical 전략

- 전역 canonical 기본값은 설정하지 않았다 — Next.js는 `alternates.canonical`을 명시하지 않으면 canonical 태그 자체를 생성하지 않으며, 이 프로젝트에는 페이지별로 canonical이 필요한 실제 중복 콘텐츠 사례가 `/generate` 외에는 없다(Dream 상세/카테고리는 쿼리 파라미터 변형이 없음).
- `/generate`에만 `alternates: { canonical: "/generate" }`를 추가했다 — `/generate?dream=<id>`(Phase7-3의 CTA가 만드는 상태성 URL)도 검색엔진이 항상 같은 canonical(`/generate`)을 보도록 해, 지시문 §4가 명시한 "상태성 query URL을 별도 SEO 콘텐츠 URL로 취급하지 않음" 원칙을 그대로 구현했다. 실측(§14)으로 `?dream=1`을 붙여도 canonical이 `/generate`로 고정됨을 확인했다.

---

## 6. robots 전략

`app/robots.ts` 신규 생성. `docs/SITEMAP.md` §4 P3 목록(`/my/*`, `/login`, `/admin/*`)과 `proxy.ts`의 `PROTECTED_PATHS`(`/onboarding`, `/my`)를 새로 설계하지 않고 그대로 반영했다:

```
User-Agent: *
Allow: /
Disallow: /my/
Disallow: /login
Disallow: /onboarding
Disallow: /api/
Disallow: /ui-preview
Sitemap: <SITE_URL>/sitemap.xml
```

`/api/`는 SITEMAP.md에 별도 항목이 없지만 지시문 §5("관리자 API, 내부 API")가 명시적으로 요구해 포함했다 — API 응답은 애초에 검색 노출 대상이 아니다. robots.txt는 크롤 예산 안내일 뿐 보안 경계로 쓰지 않았다(지시문 §5) — 실제 데이터 접근 차단은 여전히 `proxy.ts`/RLS가 담당하며 이번 Task에서 그 두 가지를 전혀 수정하지 않았다.

---

## 7. sitemap 전략

`app/sitemap.ts` 신규 생성, 실측(§14)으로 확인한 최종 결과: **정적(`○`) 라우트, `revalidate: 1h`.**

**"DB를 매 요청마다 과도하게 조회하지 않는다"(지시문 §6)를 실제로 만족시키기 위한 설계 결정**: `lib/api/dreams.ts`는 `lib/supabase/server.ts`(`next/headers`의 `cookies()`)를 쓰는데, Phase7-2가 이미 발견한 대로 `cookies()`가 호출되는 렌더 경로는 Next.js가 무조건 완전 동적으로 강제 전환한다(`docs/PHASE7_DREAM_BROWSE_UI_REPORT.md` §9 문제2). 이 함수를 `sitemap.ts`에 그대로 재사용하면 sitemap도 매 요청 DB 조회가 되어 지시문을 어기게 된다.

`lib/api/dreams.ts`는 Phase7/Phase8-0 범위 제한 대상이라 수정하지 않았다(지시문 §1/§11). 대신 **`app/sitemap.ts` 안에서만** `@supabase/supabase-js`의 `createClient()`(anon key, `cookies()` 미사용 — `lib/supabase/service.ts`가 service_role로 쓰는 것과 동일한 "쿠키 없는 직접 클라이언트" 패턴을 anon key로 재현)를 써서 `dreams` 테이블을 직접 조회하고, `export const revalidate = 3600`을 지정했다. `dreams`는 공개 콘텐츠라 anon key만으로 RLS(`dreams_select_public`)를 통과한다 — `service_role`이 필요 없다.

**포함 대상**: 홈(`/`), `/dream`, `/generate`(canonical과 동일하게 쿼리 없는 경로만), 실제 DB의 7개 category(`/dream/category/<category>`), 실제 DB의 25개 dream(`/dream/<keyword>`) — 총 35개 URL(실측 확인, §14). `SITEMAP.md` §4가 P0로 분류한 `/fortune`/`/winners/*`/`/store/*`는 실제로 구현된 적이 없어(전수 확인) 존재하지 않는 URL을 올리지 않았다.

**제외 대상**: `/my/*`, `/login`, `/onboarding`, `/api/*`, `/ui-preview`, 관리자 경로 — 실측(§14)으로 전부 미포함 확인.

`SITEMAP.md` §5가 구상한 `sitemap-core.xml`/`sitemap-dream.xml` 등 다중 파일+인덱스 구조는 도입하지 않았다 — 현재 25개 콘텐츠 규모에서는 과도한 설계이며, 지시문 §6 "가장 단순한 방법을 선택한다"에 따라 단일 `app/sitemap.ts`로 충분하다. Next.js 사이트맵 1개 파일 상한(50,000 URL)에 근접할 때 재검토하면 된다.

---

## 8. Dream SEO 상태

Phase7-2가 이미 구현해 둔 것을 재확인만 하고 수정하지 않았다:

| 페이지 | title/description | robots | canonical | 404 |
|---|---|---|---|---|
| `/dream` | 정적, 이미 구현 | 기본값(색인 허용) 상속 | 없음(불필요, 쿼리 변형 없음) | 해당 없음 |
| `/dream/category/[category]` | `generateMetadata()`로 동적 생성, 이미 구현 | 기본값 상속 | 없음(불필요) | 존재하지 않는 카테고리는 EmptyState(에러 아님, Phase7-2 의도적 설계) |
| `/dream/[keyword]` | `generateMetadata()`로 동적 생성, 이미 구현(해몽 본문 앞 100자를 description으로 사용) | 기본값 상속 | 없음(불필요) | `notFound()`로 실제 404 처리(실측 재확인, §14) |

**Phase7이 발견한 "`/dream/*`가 `cookies()`로 인해 완전 동적 렌더링됨" 문제(SSG/ISR 미적용)는 이번 Task에서 해결하지 않았다** — 지시문 §7이 명시적으로 "이번 Task에서 임의로 해결하지 않는다"고 지정했고, 이 문제는 페이지 자체의 검색 노출(색인 가능 여부)을 막지 않아 SEO Foundation의 필수 범위가 아니다. 그대로 유지하고 기록만 한다(§15에 후속 작업으로 재확인).

---

## 9. /generate SEO 상태

`docs/SITEMAP.md` §4가 P0로 분류한 그대로 유지했다 — `robots` noindex를 붙이지 않았다. 이번 Task에서 추가한 것은 `alternates.canonical: "/generate"` 하나뿐이며, `?dream=<id>` 쿼리로 접근해도 canonical이 고정됨을 실측 확인했다(§14). title/description은 Phase5의 기존 값을 그대로 유지했다.

---

## 10. 구조화 데이터 판단 (구현하지 않음, 판단만)

| 후보 | 현재 콘텐츠 구조에 적합한가 | 판단 |
|---|---|---|
| `WebSite` | 적합 — 사이트 전역에 하나만 있으면 되고 이미 있는 `metadataBase`/`SITE_NAME`으로 바로 구성 가능 | Phase8-2 후보 중 우선순위 최상(§17) |
| `BreadcrumbList` | 적합 — `/dream` → `/dream/category/[category]` → `/dream/[keyword]` 계층 구조가 실제로 존재 | Phase8-2 후보 |
| `Article` | **아직 부적합** — `dreams.interpretation`은 저자/게시일 등 Article이 요구하는 메타데이터가 DB에 없다(`created_at`은 있지만 "발행일"의 의미로 확정되지 않음, 실제 저자 개념 없음). 허위 구조화 데이터를 만들지 않기 위해 이번에 만들지 않는다 | 컬럼 의미가 명확해지기 전까지 보류 |
| `FAQPage` | **부적합** — 이 프로젝트에 실제 FAQ 콘텐츠/페이지가 없다(전수 확인, `/faq` 라우트 없음). 지시문 §8 "실제 FAQ가 없는데 FAQPage를 생성하지 않는다"를 그대로 지켰다 | FAQ 페이지 자체가 생기기 전까지 대상 아님 |

**이번 Task에서는 4개 후보 중 어느 것도 구현하지 않았다** — 지시문 §8이 "판단만 먼저"로 범위를 명시적으로 제한했고, 대규모 구조화 데이터는 Phase8-2 이후로 분리하는 것이 원래 지시였다.

---

## 11. 검색엔진 정책상 문제 여부

지시문 §9가 금지한 항목 전부 확인:

| 금지 항목 | 위반 여부 |
|---|---|
| 키워드 반복 삽입 | 없음 — 새로 작성한 텍스트는 title template 문구(`%s \| Luck Platform`)와 기존 description 재사용뿐 |
| 숨겨진 텍스트 | 없음 |
| 의미 없는 페이지 대량 생성 | 없음 — sitemap은 실제 DB 데이터(25개 꿈, 7개 카테고리)만 반영, 존재하지 않는 URL을 만들지 않음 |
| doorway page | 없음 |
| 동일 콘텐츠 복제 | 없음 — 오히려 `/generate` canonical로 중복 신호를 줄임 |
| 허위 structured data | 없음 — 구조화 데이터 자체를 구현하지 않음(§10) |
| 사용자에게 안 보이는 SEO용 콘텐츠 | 없음 |
| 검색엔진/사용자에게 다른 콘텐츠 제공(cloaking) | 없음 — metadata만 다루고 본문 렌더링 로직은 전혀 건드리지 않음 |

**위반 없음.**

---

## 12. 기존 기능 회귀 여부

실측(§14) 기준:

- `/dream`, `/dream/[키워드]`, `/dream/category/[카테고리]` 정상 렌더링, 존재하지 않는 keyword `404` 유지.
- `/generate?dream=1`의 Phase7-3 배너("'돼지꿈' 꿈과 연결된 번호예요")와 `/dream/[keyword]`의 두 CTA("이 꿈으로 번호 생성하기", "이 꿈 기록하기") 정상 유지.
- `/my/journal`의 기존 `noindex` 메타(Phase4)가 title template 적용 후에도 그대로 유지됨(개별 페이지의 `robots` 지정이 layout 기본값을 정상적으로 덮어씀).
- `/onboarding` 비로그인 접근 시 `307` 리다이렉트 그대로 유지(무수정 확인).
- `favicon.ico` `200` 유지.
- `lib/api/dreams.ts`, `generateNumbers()`, `POST /api/numbers`, `POST /api/journal/dreams`, `registerDrawAndMatchUserNumbers()`, `proxy.ts`, 모든 RLS/Migration — **전부 무수정**(`git status`로 확인).

**회귀 없음.**

---

## 13. lint/type-check/test/build 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과, 경고 0건 |
| `npm run type-check` | 통과 |
| `npm test` | 통과 — 12 test files, **168 tests**(변경 없음 — metadata/robots/sitemap은 이 프로젝트의 jsdom 없는 vitest 설정으로 유닛테스트 대상이 아니라 실제 HTTP 검증으로 대체, §14) |
| `npm run build` | 통과. `/robots.txt`·`/sitemap.xml`이 **정적(`○`)** 라우트로 생성되고 `/sitemap.xml`에 `Revalidate: 1h`가 실제로 적용됨을 빌드 출력에서 직접 확인(§7의 설계가 이론이 아니라 실측으로 검증됨) |

---

## 14. 실제 HTTP 검증 결과

로컬 dev 서버 기준 실측:

| 검증 | 결과 |
|---|---|
| `GET /robots.txt` | `200`, `Disallow: /my/`, `/login`, `/onboarding`, `/api/`, `/ui-preview` 전부 확인, `Sitemap:` 라인 포함 |
| `GET /sitemap.xml` | `200`, `content-type: application/xml`, 총 **35개** `<url>`(정적 3 + 카테고리 7 + 꿈 25, 실제 DB와 정확히 일치) |
| sitemap 제외 대상 검증 | `/my/`, `/login`, `/onboarding`, `/api/`, `/ui-preview`, `admin` 문자열 전부 **0건** |
| `GET /` | `200`, `<title>Luck Platform</title>`, `robots: index, follow` |
| `GET /dream` | `200`, `<title>꿈해몽 \| Luck Platform</title>` |
| `GET /dream/category/동물` | `200`, `<title>동물 꿈해몽 \| Luck Platform</title>` |
| `GET /dream/돼지꿈` | `200`, `<title>돼지꿈 해몽 \| Luck Platform</title>`, description이 실제 해몽 본문 앞부분과 일치 |
| `GET /generate` | `200`, `<title>번호 생성 \| Luck Platform</title>`, `<link rel="canonical" href=".../generate">` |
| `GET /generate?dream=1` | `200`, canonical이 그대로 `/generate`(쿼리 없음) 유지, 배너 정상 표시 |
| `GET /login` | `200`, `<title>로그인 \| Luck Platform</title>`, `robots: noindex, nofollow` |
| `GET /my/journal` | `200`, `<title>행운 다이어리 \| Luck Platform</title>`, `robots: noindex, nofollow`(기존 값 유지) |
| 존재하지 않는 dream keyword | `404` |
| `GET /onboarding`(비로그인) | `307`(기존과 동일) |
| `GET /favicon.ico` | `200` |

---

## 15. 발견된 문제

새로 발견된 결함은 없다. 이번 구현 과정에서 확인·결정한 사항:

- **`/login`이 SITEMAP.md P3(noindex) 분류와 실제 코드가 불일치했던 것을 실측으로 확인하고 이번 Task 범위 안에서 수정했다** — `getCurrentUser()` 확인이나 redirect 없이 누구에게나 렌더링되는 유일한 P3 경로라 실제로 색인될 위험이 있었다(§1). `/onboarding`은 같은 목록에 없고, 비로그인 크롤러는 즉시 `redirect("/")`되어 콘텐츠를 볼 수 없으므로 최소 수정 원칙에 따라 손대지 않았다(§9).
- **OG/Twitter 제목·설명이 페이지별로 다르지 않고 전부 "Luck Platform"으로 고정된다** — Next.js 메타데이터 트리 병합은 자식 페이지가 `openGraph` 객체를 직접 정의하지 않으면 부모(layout)의 `openGraph` 전체를 그대로 쓰고, 페이지의 `title` 문자열을 자동으로 `openGraph.title`에 반영해주지 않는다(문서화된 Next.js 동작, 버그 아님). 카카오톡/트위터 공유 시 "돼지꿈 해몽" 대신 "Luck Platform"이 뜨는 것은 아직 남아있는 한계다 — Foundation 범위를 넘는 페이지별 작업이라 이번에 고치지 않고 §17에 다음 작업으로 제안한다.

---

## 16. Critical / High / Medium / Low

| 등급 | 건수 | 내용 |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 0 | — |
| Low | 1 | §15: 페이지별 OG/Twitter title이 전역 기본값으로 고정됨(공유 미리보기 품질 저하, 기능/보안 영향 없음) |

---

## 17. Phase8-2에서 해야 할 가장 중요한 작업 1개

**Dream 상세 페이지(`/dream/[keyword]`)에 페이지별 `openGraph`/`twitter` 메타데이터를 추가한다.**

이유: 이번 Task의 유일한 잔여 이슈(§15)를 직접 해결하고, 이 프로젝트에서 카카오톡 공유가 이미 로드맵 Must 항목(`ROADMAP.md` §1 "카카오 공유")으로 계획돼 있어 — 공유 시 뜨는 미리보기 제목/설명이 실제로 SEO/바이럴 유입에 직결되는 첫 접점이다. `generateMetadata()`가 이미 `dream.keyword`/`dream.interpretation`을 계산해 두고 있으므로(Phase7-2, 무수정), 그 값을 `openGraph`/`twitter` 객체에도 함께 넣기만 하면 되는 가장 작고 명확한 단위 작업이다.

---

## 18. Phase8-2 착수 가능 여부

**READY.** Critical/High/Medium 결함 없음, robots/sitemap/metadata 전부 실측 정상, 기존 기능 회귀 없음, `lint`/`type-check`/`test`/`build` 전부 통과. 불필요한 production 코드 변경 없이 §17의 작업 종료 조건을 모두 만족해 이번 Task를 여기서 종료한다.
