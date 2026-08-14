# Phase8-4 전역 WebSite JSON-LD 구현 보고서

> Phase8-1(`docs/PHASE8_SEO_FOUNDATION_REPORT.md`)/Phase8-2(`docs/PHASE8_DREAM_SEO_METADATA_REPORT.md`)/Phase8-3(`docs/PHASE8_BREADCRUMB_JSONLD_REPORT.md`)가 확정한 metadata/OG/Twitter/canonical/robots/sitemap/BreadcrumbList 구현을 그대로 두고, `app/layout.tsx`에 사이트 전역 `WebSite` JSON-LD를 1회만 추가했다.

---

## 1. 생성/수정 파일

**수정**: `app/layout.tsx`뿐이다 — `websiteJsonLd`/`websiteJsonLdScript` 상수 2개 추가, `<body>` 첫 자식으로 `<script type="application/ld+json">` 1개 추가.

**신규**: 본 보고서(`docs/PHASE8_WEBSITE_JSONLD_REPORT.md`) 1개뿐.

**미변경**: `app/robots.ts`, `app/sitemap.ts`, `app/dream/[keyword]/page.tsx`(`generateMetadata()`와 `buildBreadcrumbJsonLd()` 전부 무수정), `app/dream/page.tsx`, `app/dream/category/[category]/page.tsx`, `components/dream/DreamCard.tsx`, `lib/api/dreams.ts`, `app/generate/page.tsx`, `app/login/page.tsx` — 전부 `git status`/코드 검토로 무수정 확인. Migration/RLS/`proxy.ts`/디자인 토큰도 건드리지 않았다.

---

## 2. WebSite JSON-LD 구조

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Luck Platform",
  "url": "http://localhost:3000/"
}
```

`RootLayout` 함수 바깥, 모듈 최상단에서 한 번만 계산해 상수로 만들었고(`websiteJsonLd`), 그 문자열화 결과(`websiteJsonLdScript`)를 `<body>`의 첫 자식으로 렌더링했다 — 모든 페이지가 이 레이아웃을 공유하므로 페이지별로 반복 추가하지 않는다(지시문 §3). `potentialAction`/`SearchAction`은 추가하지 않았다 — 이 프로젝트에 검색 기능 자체가 없어(전수 확인, `/search` 등 관련 라우트/컴포넌트 없음) 지시문 §4가 요구한 "실제 검색 URL 계약이 코드로 확인될 때만" 조건을 만족하지 못한다.

---

## 3. SITE_NAME/SITE_URL 재사용 방식

| 필드 | 값 출처 |
|---|---|
| `name` | `SITE_NAME`(`lib/constants/index.ts`) — Phase8-1/8-2/8-3가 이미 같은 파일에서 import해 쓰고 있는 것과 동일한 상수, 새로 import만 추가(이미 import돼 있었음) |
| `url` | `metadataBase.href` — Phase8-1이 이미 이 파일 상단에서 `new URL(getEnv("NEXT_PUBLIC_SITE_URL"))`로 계산해 둔 `metadataBase`(`URL` 인스턴스)를 그대로 재사용. `getEnv("NEXT_PUBLIC_SITE_URL")`을 다시 호출하지 않았다 — 이미 계산된 값의 `.href`만 꺼내 썼다 |

새 환경변수, 새 SEO 유틸 파일, 새 상수 파일을 만들지 않았다 — 지시문 §3의 명시적 요구를 그대로 지켰다.

---

## 4. JSON-LD 안전성 검토

`SITE_NAME`(하드코딩된 상수 문자열)과 `metadataBase`(빌드/배포 시점 환경변수)는 둘 다 **사용자 입력이 흘러들어올 경로가 없는 값**이다 — `app/dream/[keyword]/page.tsx`(Phase8-3)의 `dream.keyword`(관리자 입력, 향후 CRUD 예정)와 성격이 다르다. 따라서 원칙적으로 `</script>` 조기 종료 위험이 이번 값들에는 실질적으로 없다.

그럼에도 지시문 §7이 "Phase8-3과 동일한 수준의 방어를 적용"하라고 명시해, `JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c")`로 동일한 방어를 적용했다 — 이유는 향후 `SITE_NAME`이 관리자 설정값 등 외부에서 바뀔 수 있는 값으로 바뀌더라도 이 방어가 이미 존재하는 상태를 유지하기 위함이다(보고서 §2의 주석에 근거 기록). `'use client'`는 추가하지 않았다 — 정적 `<script>` 태그는 서버 컴포넌트에서 그대로 렌더링된다.

---

## 5. 실제 HTTP 검증 결과

로컬 dev 서버 기준 실측. `<script type="application/ld+json">` 실제 개수는 `grep -c`(줄 단위 카운트라 한 줄짜리 HTML에서는 부정확함을 확인)가 아니라 `grep -o "<script type=\"application/ld+json\">" | wc -l`(실제 occurrence 카운트)로 재검증했다.

| 항목 | 결과 |
|---|---|
| **A. `/`** | `200`. `<script type="application/ld+json">` **1개**. `@type: "WebSite"`, `name: "Luck Platform"`(실제 `SITE_NAME`), `url: "http://localhost:3000/"`(실제 `NEXT_PUBLIC_SITE_URL`) |
| **B. `/dream`** | `200`. script 태그 **정확히 1개**(WebSite만, BreadcrumbList 없음 — 의도대로) |
| **C. `/dream/돼지꿈`** | `200`. script 태그 **정확히 2개**(WebSite 1개 + BreadcrumbList 1개), 기존 title/description/canonical/OG/Twitter 전부 유지(§7) |
| **D. `/generate`** | `200`. WebSite script 1개, `canonical: .../generate` 그대로 유지 |
| **E. `/login`** | `200`. WebSite script 1개, `robots: noindex, nofollow` 그대로 유지 |
| **F. 404**(`/dream/없는꿈999`) | `404`(상태 코드 정상, 기존 동작 무변경). **아래 §6에 상세 기록 — 실제 HTML에는 script 태그가 렌더링되지 않고, React Server Component 하이드레이션 payload(`self.__next_f.push` 스트림) 안에만 직렬화된 형태로 존재했다.** |

---

## 6. BreadcrumbList와의 공존 검증 + 404 특이사항

- 정상 페이지에서 WebSite(전역, layout)와 BreadcrumbList(page-local, `/dream/[keyword]`만)가 서로 다른 개수로 정확히 공존함을 §5-B/C에서 실측 확인했다 — `/dream`은 1개(WebSite), `/dream/돼지꿈`은 2개(WebSite+BreadcrumbList), 다른 페이지에서 BreadcrumbList가 잘못 새어나오지 않았다.
- **404 페이지의 실제 렌더링 결과(지시문 §8-F가 명시적으로 요구한 실측)**: `<script type="application/ld+json">...</script>` 형태의 **실제 렌더링된 태그는 HTML에 존재하지 않았다.** `application/ld+json` 문자열 자체는 응답에 1회 등장했는데, 그 위치는 Next.js가 하이드레이션을 위해 내려보내는 RSC(React Server Component) flight data 직렬화 문자열(`\"type\":\"application/ld+json\"...`) 안이었다 — 실제 `<body>`에 마운트된 `<script>` 요소가 아니었다. (정상 페이지 4곳은 전부 실제 `<script>` 태그가 렌더링되면서 **추가로** RSC payload에도 같은 내용이 echo되어 `application/ld+json` 문자열이 2회 나타났다 — 404만 1회였다는 점에서 이 차이가 우연이 아님을 재확인했다.)
- 이 차이는 이번 Task에서 의도적으로 만든 것이 아니라 **Next.js의 not-found 렌더링 경로가 이 레이아웃을 정상 페이지와 다르게 처리하는 기존 프레임워크 동작**으로 보인다(원인 코드를 이번 Task 범위에서 더 깊이 추적하지 않았다 — 지시문 §11 "기존 404 동작을 변경하지 않는다"에 따라 이 동작 자체를 건드리지 않았다).
- **결과적으로 이 동작은 SEO 관점에서 바람직한 부작용이다** — 검색엔진 구조화 데이터 가이드는 일반적으로 오류 페이지에 구조화 데이터를 넣지 않을 것을 권장하는데, 실제로 404 페이지에는 (RSC payload 안에만 존재할 뿐) 크롤러가 파싱하는 실제 HTML `<script>` 태그로는 노출되지 않았다. 다만 이것이 "설계된 방어"가 아니라 "관찰된 프레임워크 동작"이라는 점을 명확히 구분해 기록한다 — 향후 Next.js 버전이 바뀌면 이 동작이 달라질 수 있다.

---

## 7. SEO metadata 회귀 검증

`/dream/돼지꿈`에서 다음을 전부 재확인했다 — **Phase8-2가 겪었던 "페이지별 `openGraph` 정의가 전역 필드를 대체해 `og:site_name`/`og:locale`이 소실되는 문제"가 재발하지 않았다**(이번 Task는 `generateMetadata()`를 전혀 건드리지 않았고 `layout.tsx`의 `metadata` export도 수정하지 않았으므로 애초에 그 경로가 재현될 코드 변경이 없었다 — 그래도 실측으로 재확인):

- `title`: `돼지꿈 해몽 | Luck Platform`
- `description`: 해몽 본문 앞부분(변화 없음)
- `robots`: `index, follow`
- `canonical`: `.../dream/%EB%8F%BC%EC%A7%80%EA%BF%88`
- `og:title`/`og:description`/`og:url`/`og:site_name`(`Luck Platform`)/`og:locale`(`ko_KR`)/`og:type`(`article`) — 전부 존재, Phase8-2/8-3과 동일
- `twitter:card`/`twitter:title`/`twitter:description` — 전부 존재
- `/login`의 `robots: noindex, nofollow`, `/my/journal`의 `robots: noindex, nofollow` — 전부 유지 확인

---

## 8. robots/sitemap 회귀

| 항목 | 결과 |
|---|---|
| `GET /robots.txt` | `200`, Phase8-1과 동일 내용(변화 없음) |
| `GET /sitemap.xml` | `200`, `<url>` **35개**(Phase8-1/8-2/8-3과 동일, 변화 없음) |

---

## 9. lint/type-check/test/build 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과, 경고 0건 |
| `npm run type-check` | 통과 |
| `npm test` | 통과 — 12 test files, **168 tests**(Phase8-1~3과 동일, 변화 없음 — JSON-LD는 이 프로젝트의 jsdom 없는 vitest 환경에서 유닛테스트 대상이 아니라 실제 HTTP 검증으로 대체) |
| `npm run build` | 통과. 라우트 목록 21개 전부 동일, 정적/동적 렌더링 표시(`ƒ`/`○`)도 이전과 완전히 동일 — `/sitemap.xml`은 여전히 정적, `Revalidate: 1h` 유지. 예상치 못한 변화 없음 |

---

## 10. 발견된 문제

새로 발견된 Critical/High 문제는 없다. 구현 중 실측으로 발견하고 그대로 기록만 한 사항 1건:

- **§6의 404 페이지 JSON-LD 렌더링 차이** — 결함이 아니라 프레임워크 동작 관찰 결과다. 정상 페이지와 다르게 404에서는 WebSite JSON-LD가 실제 `<script>` 태그로 렌더링되지 않고 RSC payload 안에만 존재했다. SEO 관점에서 오히려 바람직한 결과(오류 페이지에 구조화 데이터 미노출)라 수정하지 않았고, 지시문 §11에 따라 이 동작 자체를 바꾸는 시도도 하지 않았다.

이번 Task와 무관한 기존 Known Issue(SSG/ISR 미적용, WCAG, 번호 5색, `/generate` vs `/generate/auto`, Fortune, 카카오 공유, Case C, `user_numbers` 위조 가능성, `admin_audit_logs`, 연관 꿈 내부링크 등)는 이번 조사·구현 과정에서 재발견되지 않았고, 발견되지 않았으므로 별도로 다루지 않았다.

---

## 11. Phase8 다음 단계 착수 가능 여부

**READY.** Critical/High/Medium 문제 없음, WebSite/BreadcrumbList JSON-LD가 정확한 개수로 공존함을 실측 확인, Phase8-1~3이 확정한 모든 SEO metadata(canonical/OG/Twitter/robots/noindex/sitemap)가 회귀 없이 유지됨을 확인했다. `lint`/`type-check`/`test`/`build` 전부 통과.
