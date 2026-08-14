# Phase8-2 Dream 상세 페이지 SEO Metadata 구현 보고서

> Phase8-1(`docs/PHASE8_SEO_FOUNDATION_REPORT.md`)이 확정한 전역 metadata/robots/sitemap/canonical 구조를 그대로 두고, `/dream/[keyword]`의 `generateMetadata()`만 페이지별 Open Graph/Twitter로 확장했다. 재감사 없이 Phase8-1에서 확정된 구조를 그대로 기반으로 작업했다.

---

## 1. 생성/수정 파일

**수정**: `app/dream/[keyword]/page.tsx`뿐이다(`SITE_NAME` import 1줄 추가, `generateMetadata()` 확장).

**신규**: 본 보고서(`docs/PHASE8_DREAM_SEO_METADATA_REPORT.md`) 1개뿐.

**미변경**: `lib/api/dreams.ts`(조회 계약 무수정), `app/dream/page.tsx`, `app/dream/category/[category]/page.tsx`, `app/layout.tsx`, `app/robots.ts`, `app/sitemap.ts`, `app/generate/page.tsx`, `app/login/page.tsx`, 페이지 본문 렌더링 로직(제목 아래 `h1`/해몽 본문/추천번호/CTA 2개) — 전부 `git status`/코드 검토로 무수정 확인.

---

## 2. 페이지별 metadata 구현 내용

```ts
const title = `${dream.keyword} 해몽`;                       // Phase7-2 기존 값 그대로
const description = dream.interpretation.slice(0, 100);      // Phase7-2 기존 값 그대로
const path = `/dream/${encodeURIComponent(dream.keyword)}`;  // components/dream/DreamCard.tsx와 동일 인코딩

{
  title,
  description,
  alternates: { canonical: path },
  openGraph: { title, description, url: path, type: "article", siteName: SITE_NAME, locale: "ko_KR" },
  twitter: { card: "summary", title, description },
}
```

- title/description은 **새로 짓지 않고** Phase7-2가 이미 정한 값을 그대로 OG/Twitter에도 재사용했다 — 지시문 §1이 예시로 든 "돼지꿈에 대한 해몽과 관련 로또 번호를 확인해보세요" 같은 템플릿 문장을 새로 만들지 않은 이유는, 25개 페이지 각각 실제 해몽 본문에서 뽑은 문구가 이미 페이지마다 자연히 달라 더 나은 SEO 신호이고(§5 "동일 keyword 반복"/"부자연스러운 문장" 금지와 정확히 반대 방향이 되는 것을 피함), 기존 브랜드 톤을 그대로 존중하라는 지시(§1)에도 맞기 때문이다.
- `type: "article"`을 선택했다 — 개별 꿈 해몽 본문은 독립된 콘텐츠 단위이고, 프로젝트에 다른 OG 타입(product/profile 등)을 쓸 이유가 없다.
- `card: "summary"`(이미지 없는 상태이므로 `summary_large_image`를 쓰지 않음, Phase8-1과 동일한 판단).

---

## 3. 기존 전역 metadata와의 병합 결과

**실측으로 발견하고 즉시 수정한 것 하나**: 페이지가 자신의 `openGraph` 객체를 정의하면 Next.js는 `app/layout.tsx`의 전역 `openGraph`를 필드 단위로 병합하지 않고 **완전히 대체**한다 — 처음 구현 후 curl로 확인한 결과 `og:site_name`/`og:locale`이 사라져 있었다. 지시문 §2 "siteName이 이미 전역 설정되어 있다면 중복 정의하지 않고 기존 설정을 재사용"을 실제로 만족시키려면 "코드에서 다시 안 쓴다"가 아니라 "같은 값을 다시 채워 넣어야 렌더링 결과에 남는다"는 뜻이었다 — `SITE_NAME` 상수를 import해 `openGraph.siteName`에 명시적으로 재사용하는 것으로 수정했다(새 문자열을 짓지 않고 기존 상수를 그대로 가져다 씀). 수정 후 `og:site_name: "Luck Platform"`, `og:locale: "ko_KR"`이 정상 렌더링됨을 재확인했다(§5).

`metadataBase`(Phase8-1)는 그대로 상속되어 `path`(상대 경로)가 `canonical`/`og:url`에서 자동으로 절대 URL로 해석됐다 — 이 페이지에서 새로 설정할 필요가 없었다.

`robots`은 이 페이지에서 지정하지 않았다 — Phase8-1이 설정한 layout 기본값(`index: true, follow: true`)을 그대로 상속받아 공개 콘텐츠로서 계속 색인 허용 상태다(의도와 일치, 변경 불필요).

---

## 4. 404 처리

존재하지 않는 keyword는 페이지 본문의 기존 `notFound()`를 그대로 유지했다(무수정). `generateMetadata()`가 꿈을 찾지 못하면 `{ title: "꿈해몽" }`만 반환하고 `canonical`/`openGraph`/`twitter`는 채우지 않는다 — 존재하지 않는 리소스를 가리키는 정상 페이지용 메타데이터를 만들지 않기 위한 안전장치다.

실측(§5)으로 확인한 실제 동작: 존재하지 않는 keyword 요청은 `404` 상태 코드를 반환하고, 렌더링된 `<head>`는 이 페이지의 `generateMetadata()` 반환값이 아니라 Next.js의 not-found 경계가 상위 레이아웃의 기본 metadata(`title: "Luck Platform"`, `og:type: "website"` 등)로 폴백한 결과였다 — **정상 페이지처럼 보이는 metadata가 404 응답에 노출되는 사례는 없었다.**

---

## 5. 실제 HTTP 검증 결과

로컬 dev 서버 기준 실측(포트 충돌로 이전 세션의 유령 프로세스가 3000번을 점유해 처음 한 번 엉뚱한 서버에 요청이 갔던 것을 발견 즉시 정리하고 재검증했다 — 아래는 정리 후 결과):

| 검증 | 결과 |
|---|---|
| `GET /dream/돼지꿈` | `200`, `<title>돼지꿈 해몽 \| Luck Platform</title>`, description이 실제 해몽 본문과 일치, `canonical: .../dream/%EB%8F%BC%EC%A7%80%EA%BF%88`, `og:title/description/url/type/site_name/locale` 전부 존재, `twitter:card/title/description` 전부 존재 |
| `GET /dream/뱀꿈`(다른 keyword) | `200`, title/description/canonical이 돼지꿈과 **다름**(각 페이지 실제 콘텐츠 반영 확인) |
| 존재하지 않는 keyword | `404`, `<head>`가 정상 페이지처럼 위장되지 않고 레이아웃 기본값으로 폴백(§4) |
| `GET /login` | `200`, `robots: noindex, nofollow` 그대로 유지 |
| `GET /generate` | `200`, `canonical: .../generate` 그대로 유지 |
| `GET /dream`(허브) | `200`, `<title>꿈해몽 \| Luck Platform</title>` 회귀 없음 |
| `GET /dream/category/동물` | `200`, `<title>동물 꿈해몽 \| Luck Platform</title>` 회귀 없음 |
| `GET /robots.txt` | `200`, Phase8-1 내용과 동일 |
| `GET /sitemap.xml` | `200`, `<url>` **35개**(변화 없음, Phase8-1과 동일) |

---

## 6. 기존 SEO/Phase4~7 회귀 여부

- Phase8-1의 전역 metadata(`metadataBase`, title template, robots 기본값, `/login` noindex, `/generate` canonical), `robots.ts`, `sitemap.ts` — 전부 실측으로 무변화 확인(§5).
- `/dream/[keyword]` 페이지 본문(`h1`, 해몽 본문, 추천 번호, "이 꿈으로 번호 생성하기"/"이 꿈 기록하기" CTA)은 코드 자체를 건드리지 않았다 — 렌더링 결과도 변화 없음(curl로 페이지 본문 확인, `<h1>돼지꿈</h1>` 등 기존 그대로).
- `lib/api/dreams.ts`의 `getDreamByKeyword`/`getDreamNumbers` 호출부와 `cache()` 래핑도 무수정 — 조회 계약 변경 없음.
- 새 migration/RLS/API Route 없음. `service_role` 사용 없음(이 페이지는 애초에 공개 콘텐츠 조회만 하므로 필요 없음, 무변경).

**회귀 없음.**

---

## 7. lint/type-check/test/build 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과, 경고 0건 |
| `npm run type-check` | 통과 |
| `npm test` | 통과 — 12 test files, **168 tests**(변화 없음 — metadata는 이 프로젝트의 jsdom 없는 테스트 환경으로 유닛테스트 대상이 아니라 실제 HTTP 검증으로 대체, 지시문 §9 "단순히 테스트 숫자를 늘리기 위한 테스트는 만들지 않는다"와 일치) |
| `npm run build` | 통과. 라우트 목록/렌더링 방식(`ƒ`/`○`) 변화 없음 — `/sitemap.xml`은 여전히 정적, `Revalidate: 1h` 유지 |

---

## 8. 발견된 문제

- **`og:site_name` 소실 문제(발견 즉시 수정, §3)** — 새로 발견된 결함이지만 이번 Task 범위 안에서 바로 고쳤다. 향후 다른 페이지에 페이지별 `openGraph`를 추가할 때도 같은 함정(전역 값이 자동 상속되지 않음)이 반복될 수 있다는 점을 기록해 둔다.
- 그 외 새로 발견된 결함 없음. `/dream/*`의 SSG/ISR 미적용(Phase7 Known Issue)은 이번에도 재현만 확인했을 뿐 손대지 않았다(지시문 §10 범위 통제 그대로 준수).

---

## 9. Phase8-3 착수 가능 여부

**READY.** Critical/High/Medium 결함 없음(§8의 1건은 발견 즉시 수정 완료), 기존 기능 회귀 없음, `lint`/`type-check`/`test`/`build` 전부 통과, 실제 HTTP 검증으로 페이지별 metadata·404 처리·기존 SEO 설정 유지를 전부 확인했다.

---

## 10. 다음 작업 추천

**구조화 데이터(JSON-LD) 중 `BreadcrumbList`를 `/dream/[keyword]`에 추가한다.**

이유: Phase8-1이 이미 판단해 둔 4개 후보(`WebSite`/`BreadcrumbList`/`Article`/`FAQPage`) 중 `BreadcrumbList`가 유일하게 이 프로젝트의 실제 콘텐츠 구조(`/dream` → `/dream/category/[category]` → `/dream/[keyword]`)와 정확히 일치하고, 지금 이 페이지가 이미 렌더링하고 있는 "← 전체 꿈해몽 보기" 링크가 사실상 breadcrumb 역할을 하고 있어 새로운 UI 없이 JSON-LD만 얹으면 된다. `Article`은 저자/발행일 개념이 DB에 아직 없어 허위 데이터가 될 위험이 있고(Phase8-1 §10에서 이미 보류 판단), `FAQPage`는 실제 FAQ 콘텐츠 자체가 없어 대상이 아니다. `WebSite`도 후보이지만 페이지 하나가 아니라 사이트 전역(`app/layout.tsx`) 작업이라 이번 Dream 상세 페이지 후속 작업과는 결이 다르다.
