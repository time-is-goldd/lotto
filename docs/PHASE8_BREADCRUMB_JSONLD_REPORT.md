# Phase8-3 BreadcrumbList JSON-LD 구현 보고서

> Phase8-1(`docs/PHASE8_SEO_FOUNDATION_REPORT.md`)/Phase8-2(`docs/PHASE8_DREAM_SEO_METADATA_REPORT.md`)가 확정한 metadata/OG/Twitter/canonical/robots/sitemap 구현을 그대로 두고, `/dream/[keyword]`에 `BreadcrumbList` JSON-LD만 추가했다.

---

## 1. 변경 파일

**수정**: `app/dream/[keyword]/page.tsx`뿐이다 — `getEnv` import 1줄 추가, `buildBreadcrumbJsonLd()` 함수 신규 추가, 페이지 본문에 `<script type="application/ld+json">` 1개 추가.

**신규**: 본 보고서(`docs/PHASE8_BREADCRUMB_JSONLD_REPORT.md`) 1개뿐.

**미변경**: `app/dream/page.tsx`, `app/dream/category/[category]/page.tsx`, `components/dream/DreamCard.tsx`, `lib/api/dreams.ts`, `app/layout.tsx`, `app/robots.ts`, `app/sitemap.ts`, `app/generate/page.tsx`, `app/login/page.tsx`, `/dream/[keyword]`의 `generateMetadata()`(Phase8-2 산출물)와 화면 UI(제목/해몽 본문/추천번호/CTA 2개) — 전부 `git status` 및 코드 검토로 무수정 확인. Migration/RLS/`proxy.ts`/디자인 토큰도 전혀 건드리지 않았다.

---

## 2. BreadcrumbList 구현 구조

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "홈", "item": "<SITE_URL>" },
    { "@type": "ListItem", "position": 2, "name": "꿈해몽", "item": "<SITE_URL>/dream" },
    { "@type": "ListItem", "position": 3, "name": "<dream.keyword>", "item": "<SITE_URL>/dream/<encodeURIComponent(dream.keyword)>" }
  ]
}
```

- `buildBreadcrumbJsonLd(dream)` 함수를 `generateMetadata()`와 페이지 컴포넌트 사이에 추가하고, 페이지 컴포넌트가 이미 `notFound()`로 존재 여부를 확인한 **이후**(즉 `dream`이 반드시 존재하는 시점)에만 호출한다 — 존재하지 않는 keyword에 대해 BreadcrumbList가 만들어질 경로 자체가 없다(§5).
- position 1/2 이름("홈"/"꿈해몽")은 새 문구를 짓지 않고 `components/navigation/BottomNavigation.tsx`(`label: "홈"`)와 `components/navigation/GlobalNav.tsx`(`label: "꿈해몽"`)가 이미 화면에 쓰고 있는 문구를 그대로 재사용했다.
- position 3 이름은 `dream.keyword` 그대로 — 페이지 `<h1>`에 실제로 렌더링되는 값과 동일하다(지시문 §4 "JSON-LD는 실제 페이지 콘텐츠와 일치해야 한다").
- **XSS 방어**: `dream.keyword`는 관리자가 입력하는 값(현재는 seed, Phase9에서 CRUD 예정)이라 신뢰할 수 없는 입력으로 취급했다. `JSON.stringify()`는 따옴표는 이스케이프하지만 `</script>` 시퀀스는 그대로 두므로, `<`만 유니코드 이스케이프(`<`)해 `<script>` 태그 조기 종료를 원천 차단했다 — 지시문에 명시된 요구는 아니었지만 JSON-LD 임베딩의 잘 알려진 위험이라 발견 즉시 방어했다.
- `'use client'`를 추가하지 않았다 — 정적 `<script>` 태그는 서버 컴포넌트에서 그대로 렌더링 가능하다(지시문 §5).

---

## 3. URL/metadata 재사용 여부

| 값 | 재사용 출처 | 새로 만든 것 없음 확인 |
|---|---|---|
| 사이트 절대 URL(`siteUrl`) | `getEnv("NEXT_PUBLIC_SITE_URL")` — `app/layout.tsx`의 `metadataBase`가 쓰는 것과 정확히 동일한 환경변수/함수 | 새 환경변수·새 유틸 없음 |
| `/dream/<keyword>` 경로 인코딩 | `encodeURIComponent(dream.keyword)` — `components/dream/DreamCard.tsx:18`, 그리고 Phase8-2가 이미 `generateMetadata()`의 `canonical`/`og:url`에 쓴 것과 동일한 규칙 | 다른 인코딩 방식 도입 안 함 |
| "홈"/"꿈해몽" 문구 | `BottomNavigation.tsx`/`GlobalNav.tsx`의 기존 label | 새 문구 없음 |
| `SITE_NAME` | 이번 함수에서는 필요 없어(브레드크럼 이름에 사이트명이 들어가지 않음) 쓰지 않았다 — 이미 Phase8-2가 같은 파일의 `generateMetadata()`에서 import해 쓰고 있어 중복 import 없이 그대로 공존 | 해당 없음 |

`lib/api/dreams.ts`의 `getDreamByKeyword`/`getCachedDream` 호출부는 수정하지 않았고, `buildBreadcrumbJsonLd()`는 이미 조회된 `dream` 객체(페이지 컴포넌트가 이미 가진 값)를 인자로 받을 뿐 별도 조회를 하지 않는다 — 새 DB 호출이 추가되지 않았다.

---

## 4. 실제 HTTP 검증 결과

로컬 dev 서버 기준 실측(정상 페이지 2건):

| 페이지 | 결과 |
|---|---|
| `/dream/돼지꿈` | `200`. JSON-LD `@type: BreadcrumbList`, `itemListElement` 3개, position 1/2/3 정확, `item`이 각각 `http://localhost:3000`, `http://localhost:3000/dream`, `http://localhost:3000/dream/%EB%8F%BC%EC%A7%80%EA%BF%88`(canonical/og:url과 동일한 URL), position 3 `name: "돼지꿈"`이 실제 `<h1>돼지꿈</h1>`과 일치 |
| `/dream/뱀꿈` | `200`. 동일 구조, position 3의 `name`/`item`이 "뱀꿈"/`.../dream/%EB%B1%80%EA%BF%88`로 돼지꿈과 **다름**(페이지별로 정확히 달라짐 확인) |

---

## 5. 404 검증 결과

존재하지 않는 keyword(`/dream/없는꿈999`) 요청 → **`404`**, 응답 HTML 전체에 `application/ld+json` 문자열이 **0건**(`grep -c` 실측, 매치 없음으로 exit code 1 재확인) — 정상 콘텐츠용 BreadcrumbList가 404 응답에 잘못 출력되지 않음을 확인했다.

---

## 6. SEO metadata 회귀 검증 결과

`/dream/돼지꿈`에서 다음을 전부 재확인했다 — **Phase8-2가 겪었던 "페이지별 `openGraph` 정의가 전역 필드를 대체해 `og:site_name`/`og:locale`이 소실되는 문제"가 재발하지 않았다**(이번 Task는 `generateMetadata()`를 전혀 건드리지 않았으므로 애초에 그 문제가 재현될 코드 변경 자체가 없었다 — 그래도 실측으로 재확인):

- `title`: `돼지꿈 해몽 | Luck Platform`
- `description`: 해몽 본문 앞부분(Phase8-2와 동일)
- `robots`: `index, follow`
- `canonical`: `.../dream/%EB%8F%BC%EC%A7%80%EA%BF%88`
- `og:title`/`og:description`/`og:url`/`og:site_name`(`Luck Platform`)/`og:locale`(`ko_KR`)/`og:type`(`article`) — 전부 존재, Phase8-2와 동일
- `twitter:card`/`twitter:title`/`twitter:description` — 전부 존재

추가로 다음 기존 페이지도 회귀 없이 확인했다:

| 페이지 | 결과 |
|---|---|
| `/login` | `noindex, nofollow` 유지 |
| `/generate` | `canonical: .../generate` 유지 |
| `/dream`(허브) | title 유지, **JSON-LD 없음**(이번 Task가 `/dream/[keyword]`에만 적용했으므로 의도대로 허브 페이지는 영향 없음) |
| `/dream/category/동물` | title 유지 |
| `/my/journal` | `noindex, nofollow` 유지 |
| `/my/journal/dreams`(비로그인) | `307` 리다이렉트 유지 |
| `/robots.txt` | `200`, Phase8-1과 동일 내용 |
| `/sitemap.xml` | `200`, `<url>` **35개**(변화 없음) |

---

## 7. lint/type-check/test/build 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과, 경고 0건 |
| `npm run type-check` | 통과 |
| `npm test` | 통과 — 12 test files, **168 tests**(Phase8-1/8-2와 동일 — 변화 없음). JSON-LD는 이 프로젝트의 jsdom 없는 vitest 환경에서 렌더링 유닛테스트 대상이 될 수 없어 신규 테스트를 추가하지 않았다(지시문 §9와 동일한 이유로 실제 HTTP 검증으로 대체) |
| `npm run build` | 통과. 라우트 목록/렌더링 방식(`ƒ`/`○`) 변화 없음 — `/sitemap.xml`은 여전히 정적, `Revalidate: 1h` 유지 |

---

## 8. 발견된 문제와 처리 여부

새로 발견된 Critical/High 문제는 없다. 구현 중 스스로 확인·방어한 사항 1건:

- **JSON-LD `</script>` 조기 종료 위험**(§2) — 지시문에 명시적으로 요구되지는 않았지만, `dream.keyword`가 신뢰할 수 없는 입력(관리자 작성, 향후 CRUD 예정)이라는 점을 감안해 `dangerouslySetInnerHTML`에 넣기 전 `<`를 유니코드 이스케이프하는 방어를 선제적으로 추가했다. 발견 즉시 처리 완료, 별도 후속 조치 불필요.

---

## 9. Phase8-4 착수 가능 여부

**READY.** Critical/High/Medium 문제 없음, 404에서 잘못된 JSON-LD 노출 없음, Phase8-1/8-2가 확정한 모든 SEO metadata(canonical/OG/Twitter/robots/noindex/sitemap)가 전부 실측으로 회귀 없이 유지됨을 확인했다. `lint`/`type-check`/`test`/`build` 전부 통과.
