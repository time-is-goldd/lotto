# Phase8 Final Audit — SEO

> AUDIT ONLY. 코드/DB/Migration/RLS를 전혀 수정하지 않았다(전수 확인: 이번 Task로 변경된 파일은 본 보고서 1개뿐, `git status`로 확인). Phase8-0~8-4가 이미 결정한 사항은 재조사하지 않고 실제 코드/실제 HTTP 응답으로 재검증만 했다.

---

## 1. 감사 범위

- Phase8-0(Pre-Implementation Audit) — 결정사항(EXECUTION_PLAN 우선, 외부 자동수집 별건)이 실제로 지켜졌는지
- Phase8-1(Global metadata/robots/sitemap)
- Phase8-2(Dream 페이지 OG/Twitter)
- Phase8-3(`/dream/[keyword]` BreadcrumbList JSON-LD)
- Phase8-4(전역 WebSite JSON-LD)
- Phase7 및 기존(Phase4~6) 기능과의 회귀 여부
- 실제 dev 서버 HTTP 응답 + `npm run build` 결과 기준 검증(source grep만으로 판정하지 않음)

---

## 2. Phase8 완료 기준별 PASS/CONDITIONAL/FAIL

`docs/EXECUTION_PLAN.md` Phase8의 명시적 "완료 기준" 4개를 그대로 대조한다(Phase8-0가 이미 이 섹션을 "SEO"로 확정, ROADMAP macro-Phase8과 혼동하지 않음 — 재조사하지 않고 인용):

| 완료 기준 | 판정 | 근거 |
|---|---|---|
| `/sitemap.xml`, `/robots.txt` 정상 응답 | **PASS** | 실측 §5/§13, 둘 다 `200` |
| 주요 페이지 메타/JSON-LD를 **Rich Results Test로 확인** | **FAIL(미수행)** | Google Rich Results Test(`search.google.com/test/rich-results`)는 대화형 웹 도구로 이 환경에서 실행할 수 없고, 애초에 `localhost` URL로는 제출 자체가 불가능하다(공개 배포 URL 필요) — 구조적으로 배포 이후에만 수행 가능한 항목. JSON-LD 구조 자체(스키마 필드/타입/값)는 이번 감사가 실제 HTTP 응답으로 전수 검증했다(§8/§9) |
| `/my/journal/*` noindex 확인 | **PASS** | 실측 §12, 모든 `/my/journal/*` 페이지 `noindex, nofollow` 유지 |
| **Search Console/서치어드바이저 등록 완료** | **FAIL(미수행)** | Phase8-1이 이미 명시적으로 범위 제외(`docs/PHASE8_SEO_FOUNDATION_REPORT.md` §15 "Google Search Console 연동... 이것들은 Phase8 후속 작업"). 실제 소유권 확인·계정 등록이 필요한 운영 행위로, 배포된 실제 도메인이 있어야 가능하다 |

**4개 중 2개 미충족.** 둘 다 "코드 결함"이 아니라 "이 개발 환경에서 물리적으로 수행 불가능하거나 배포 이후에만 가능한 운영 행위"다 — Phase8-1이 착수 시점에 이미 이렇게 판단해 범위에서 제외했고, 이번 감사도 같은 결론에 도달했다(새로 발견한 문제가 아니라 기존에 이미 알려진 제외 항목의 재확인).

---

## 3. Global metadata 감사 — **PASS**

`app/layout.tsx` 실제 코드 + `/` 실측:

| 항목 | 코드 | 실측(`GET /`) |
|---|---|---|
| `metadataBase` | `new URL(getEnv("NEXT_PUBLIC_SITE_URL"))` | WebSite JSON-LD `url` 필드로 간접 확인(`http://localhost:3000/`), 정확 |
| title template | `{ default: SITE_NAME, template: "%s \| Luck Platform" }` | `/`은 `<title>Luck Platform</title>`(template 미적용, default만), `/dream`은 `<title>꿈해몽 \| Luck Platform</title>`(template 적용) — 두 동작 모두 실측으로 정확히 확인 |
| description | `SITE_DESCRIPTION` 상수 | `<meta name="description" content="행운을 기록하고, 관리하고, 공유하는 플랫폼"/>` 일치 |
| 기본 robots | `{ index: true, follow: true }` | `<meta name="robots" content="index, follow"/>` 일치(`/`), 개별 페이지가 오버라이드하는 곳(`/login`, `/my/journal`)은 `noindex, nofollow`로 정확히 대체됨 |
| OpenGraph 기본값 | `type/siteName/title/description/locale` | `/`, `/dream`, `/generate` 등에서 `og:site_name: "Luck Platform"`, `og:locale: "ko_KR"` 실측 확인 |
| Twitter 기본값 | `card: "summary"` + title/description | 실측 확인(하위 문서 §7) |

---

## 4. robots 감사 — **PASS**

실제 `GET /robots.txt` 응답(§13):

```
User-Agent: *
Allow: /
Disallow: /my/
Disallow: /login
Disallow: /onboarding
Disallow: /api/
Disallow: /ui-preview

Sitemap: http://localhost:3000/sitemap.xml
```

`docs/SITEMAP.md` §4 P3 목록과 `proxy.ts`의 `PROTECTED_PATHS`를 그대로 반영한 것과 일치(Phase8-1 결정 재확인). `/my/journal/*`는 `Disallow: /my/`로 크롤 자체가 차단되고, 동시에 해당 페이지들 각각의 `<meta name="robots" content="noindex, nofollow"/>`도 실측으로 재확인했다(§12) — robots.txt(크롤 차단)와 페이지 noindex(색인 차단) 이중 방어가 그대로 유지됨.

---

## 5. sitemap 감사 — **PASS**

실제 `GET /sitemap.xml` 응답(§13) 기준:

| 확인 항목 | 결과 |
|---|---|
| 응답 상태 | `200` |
| `<url>` 총 개수 | **35개**(정적 3 + 카테고리 7 + 꿈 25) — 실제 DB(25개 꿈, 7개 카테고리, Phase7-1 이래 불변)와 정확히 일치 |
| 실제 DB 꿈 콘텐츠 반영 | 25개 keyword 전부 percent-encoding으로 정확히 포함(예: `%EB%8F%BC%EC%A7%80%EA%BF%88`=돼지꿈) |
| 실제 카테고리 반영 | 7개 카테고리 전부 포함(동물/사물/상황/신체/인물/자연/행동) |
| 보호 경로 포함 여부 | `/my/`, `/login`, `/onboarding`, `/api/`, `/ui-preview`, `admin` 문자열 **0건**(정규식 검색으로 확인) |
| 중복 URL 여부 | `sort \| uniq -d`로 검사, **중복 없음** |
| revalidate 정책 | 코드 `export const revalidate = 3600`(1시간) |
| 의도하지 않은 동적 DB 조회 발생 여부 | `npm run build` 결과 `○ /sitemap.xml` (**정적**, `Revalidate: 1h / Expire: 1y`)로 표시됨 — Phase8-1이 `cookies()` 없는 별도 anon 클라이언트로 이 문제를 해결한 설계가 빌드 결과로도 그대로 유지되고 있음을 재확인 |

---

## 6. canonical 감사 — **CONDITIONAL**

| 페이지 | canonical 태그 | 값 | 판정 |
|---|---|---|---|
| `/` | **없음** | — | 명시적 canonical 없음(암묵적 자기 자신, Next.js 표준 동작 — 유효하나 HTML에서 직접 검증 불가) |
| `/dream` | **없음** | — | 동일 |
| `/dream/category/동물` | **없음** | — | 동일 |
| `/dream/돼지꿈` | 있음 | `http://localhost:3000/dream/%EB%8F%BC%EC%A7%80%EA%BF%88` | **실제 요청 URL과 정확히 일치**(Phase8-2 구현, 재확인) |
| `/generate` | 있음 | `http://localhost:3000/generate` | **일치**, `?dream=1` 쿼리로 접근해도 동일 canonical 유지(Phase8-1, 재확인) |
| `/login` | **없음** | — | 명시적 canonical 없음 |

**CONDITIONAL 판정 이유**: `/generate`/`/dream/[keyword]`는 실제 쿼리 파라미터 중복 콘텐츠 위험이 있어 canonical을 명시했고 정확히 동작한다(**PASS**). 나머지 4개 페이지(`/`, `/dream`, `/dream/category/*`, `/login`)는 Phase8-1이 "쿼리 변형이 없어 canonical이 불필요하다"고 의도적으로 생략한 페이지들이며, 이는 유효한 SEO 관행(명시적 canonical이 없으면 검색엔진은 요청 URL 자체를 canonical로 취급)이지만 **HTML만으로는 검증할 대상 자체가 없어** "canonical이 실제 URL과 일치하는지 확인"이라는 지시문 §2-D의 문자 그대로의 요구를 6개 전부에 대해 만족시키지 못한다. 기능 결함이 아니라 설계 선택이므로 FAIL이 아니라 CONDITIONAL로 분류한다(§16 Medium 항목).

---

## 7. Dream metadata 감사 — **PASS**

`/dream/돼지꿈` vs `/dream/뱀꿈` 실측(§13):

| 필드 | 돼지꿈 | 뱀꿈 | 서로 다름 |
|---|---|---|---|
| title | `돼지꿈 해몽 \| Luck Platform` | `뱀꿈 해몽 \| Luck Platform` | ✓ |
| description | 돼지꿈 해몽 본문 발췌 | 뱀꿈 해몽 본문 발췌 | ✓ |
| canonical | `.../dream/%EB%8F%BC%EC%A7%80%EA%BF%88` | `.../dream/%EB%B1%80%EA%BF%88` | ✓ |
| og:title/description/url | 돼지꿈 값 | 뱀꿈 값 | ✓ |
| og:site_name | `Luck Platform`(동일, 정상) | `Luck Platform`(동일, 정상) | — |
| og:locale | `ko_KR`(동일, 정상) | `ko_KR`(동일, 정상) | — |
| twitter:title/description | 돼지꿈 값 | 뱀꿈 값 | ✓ |

10개 확인 대상 필드 전부 존재하고, 콘텐츠 종속 필드(title/description/canonical/og:title/og:description/og:url/twitter:title/twitter:description)는 실제로 페이지마다 다르며, 사이트 공통 필드(og:site_name/og:locale)는 두 페이지에서 동일하게 유지됨을 확인했다 — 정확히 의도된 동작.

---

## 8. BreadcrumbList JSON-LD 감사 — **PASS**

`/dream/돼지꿈` 실제 응답:

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
  {"@type":"ListItem","position":1,"name":"홈","item":"http://localhost:3000"},
  {"@type":"ListItem","position":2,"name":"꿈해몽","item":"http://localhost:3000/dream"},
  {"@type":"ListItem","position":3,"name":"돼지꿈","item":"http://localhost:3000/dream/%EB%8F%BC%EC%A7%80%EA%BF%88"}
]}
```

- `@type: BreadcrumbList` ✓, `itemListElement` **정확히 3개** ✓, position 1/2/3 정확 ✓, 순서(홈→꿈해몽→현재 keyword) 정확 ✓.
- position 3의 `item` URL(`http://localhost:3000/dream/%EB%8F%BC%EC%A7%80%EA%BF%88`)이 §6에서 확인한 해당 페이지의 **canonical과 문자 그대로 일치**함을 재확인.
- 다른 페이지(`/`, `/dream`, `/dream/category/동물`, `/generate`, `/login`, `/my/journal`)에서 script 태그 개수를 전수 확인한 결과 전부 **1개**(WebSite만) — BreadcrumbList가 불필요하게 다른 페이지에 출력되지 않음(§13).
- 404(존재하지 않는 keyword)에서는 script 태그 자체가 **0개** — BreadcrumbList도 WebSite도 렌더링되지 않음(§10에서 상세).

---

## 9. WebSite JSON-LD 감사 — **PASS**

`/`, `/dream`, `/generate`에서 동일한 내용 실측 확인:

```json
{"@context":"https://schema.org","@type":"WebSite","name":"Luck Platform","url":"http://localhost:3000/"}
```

- `@type: WebSite` ✓, `name`이 실제 `SITE_NAME`("Luck Platform") ✓, `url`이 실제 `NEXT_PUBLIC_SITE_URL` ✓.
- 페이지별 중복 생성 없음 — 모든 일반 페이지에서 WebSite script 태그가 **정확히 1개**(§13 전수 확인).
- `/dream/돼지꿈`에서 WebSite(1개) + BreadcrumbList(1개) = **정확히 2개**로 의도대로 공존(§8).

---

## 10. 404 감사 — **PASS(특이사항 있음, 기록)**

| 케이스 | 결과 |
|---|---|
| `/dream/nonexistent-keyword` | **`404`**(Next.js 기본 404), `<title>Luck Platform</title>`(레이아웃 기본값 폴백, 가짜 dream 메타데이터 없음), 실제 렌더링된 `<script type="application/ld+json">` **0개**(WebSite/BreadcrumbList 둘 다 미노출) |
| `/dream/category/nonexistent-category` | **`200`**(404 아님) — `<title>nonexistent-category 꿈해몽 \| Luck Platform</title>`, 본문에 "아직 등록된..." EmptyState 표시 |

두 번째 케이스는 결함이 아니다 — `docs/PHASE7_DREAM_BROWSE_UI_REPORT.md`가 이미 문서화한 **의도된 설계**(§9 근거): `category`는 자유 텍스트 필터라 존재하지 않는 값이어도 에러가 아니라 EmptyState로 처리한다(`keyword`는 PK 조회라 `notFound()`, `category`는 필터라 다른 처리 — 두 라우트의 의미가 다름). 이번 감사에서 실측으로 재확인만 했다.

첫 번째 케이스의 "실제 렌더링된 JSON-LD 0개" 현상은 Phase8-4가 이미 발견·기록한 Next.js not-found 렌더링 경로의 프레임워크 동작(RSC payload에는 직렬화되지만 실제 `<body>`에 마운트되지 않음)과 정확히 동일하게 재현됨을 이번 감사에서 재확인했다 — 새로운 문제 아님, SEO 관점에서 오히려 바람직한 부작용(오류 페이지에 구조화 데이터 미노출).

---

## 11. SEO 보안 감사 — **PASS**

지시문 §3의 5개 항목:

1. **JSON-LD 안에 user_id/session/Supabase 내부 정보/관리자 정보/민감정보**: 이번 감사에서 실제로 가져온 5개 페이지의 JSON-LD 블록 전체를 `user_id|session|supabase|admin|service_role|password|token` 키워드로 스캔 — **0건**. WebSite/BreadcrumbList 모두 공개 상수(`SITE_NAME`)·공개 환경변수(`NEXT_PUBLIC_SITE_URL`)·공개 콘텐츠(`dream.keyword`)만 담고 있음을 코드로도 재확인.
2. **`<script>` escape/XSS 문제**: `app/dream/[keyword]/page.tsx`(Phase8-3)와 `app/layout.tsx`(Phase8-4) 둘 다 `JSON.stringify(...).replace(/</g, "\\u003c")` 방어가 실제 코드에 그대로 존재함을 확인(§9/§3 코드 인용).
3. **`<` 방어 유지 여부**: 위와 동일 — Phase8-3/8-4 두 지점 모두 유지되고 있음을 코드 직접 확인.
4. **WebSite JSON-LD가 기존 global metadata를 파괴하는지**: `app/layout.tsx`의 `metadata` export(§3)와 `websiteJsonLd`/`<script>` 추가는 서로 다른 메커니즘(Next.js Metadata API vs 직접 렌더링된 `<script>` 태그)이라 상호 간섭 경로 자체가 없다 — 실측으로도 `/`의 title/description/robots/OG/Twitter가 Phase8-1 이후 전부 그대로임을 확인(§3).
5. **Phase8-2 `og:site_name`/`og:locale` 소실 문제 재발 여부**: `/dream/돼지꿈`·`/dream/뱀꿈` 둘 다 `og:site_name: "Luck Platform"`, `og:locale: "ko_KR"`이 정확히 존재함을 실측 확인(§7) — **해결된 상태가 최종까지 유지되고 있다.**

---

## 12. Phase7/기존 기능 회귀 감사 — **PASS**

실제 HTTP 응답 기준(§13):

| 대상 | 결과 |
|---|---|
| `/` | `200` |
| `/dream` | `200`, JSON-LD 1개(WebSite만) |
| `/dream/category/동물` | `200` |
| `/dream/돼지꿈` | `200`, 전체 metadata+JSON-LD 2개 정상 |
| `/generate` | `200`, canonical 유지, `?dream=1` 쿼리로도 canonical 불변(재확인) |
| `/login` | `200`, `noindex, nofollow` 유지 |
| `/my/journal` | `200`, `noindex, nofollow` 유지 |
| `/my/journal/dreams` | `307`(비로그인 리다이렉트, 기존과 동일) |
| `/my/journal/history` | `307`(동일) |
| `/my/journal/fortune-history` | `307`(동일) |
| `POST /api/numbers`(비로그인) | `401 UNAUTHORIZED`(기존과 동일) |
| `POST /api/admin/draws`(비로그인) | `401 UNAUTHORIZED`(기존과 동일) |

Phase4~7이 만든 인증 리다이렉트/401 응답/dream CTA/CRUD 계약 어디에도 변화가 없다 — **회귀 없음.**

---

## 13. 실제 HTTP 검증 결과 (원본 로그 요약)

로컬 dev 서버(포트 3000, 이번 세션에서 새로 정상 기동 확인, 유령 프로세스 없음) 기준. 지시문이 명시한 12개 URL 전부 실제로 요청했다: `/`, `/dream`, `/dream/category/동물`, `/dream/돼지꿈`, `/dream/뱀꿈`, `/dream/nonexistent-keyword`, `/dream/category/nonexistent-category`, `/generate`, `/login`, `/my/journal`, `/robots.txt`, `/sitemap.xml`. 추가로 회귀 확인을 위해 `/my/journal/dreams`, `/my/journal/history`, `/my/journal/fortune-history`, `POST /api/numbers`, `POST /api/admin/draws`도 요청했다. 전체 결과는 §3~§12에 항목별로 반영했다. `grep -c`가 한 줄짜리 HTML에서 실제 occurrence를 정확히 세지 못하는 것을 발견해(이전 Phase8-4에서도 동일 이슈 재확인) `grep -o ... | wc -l`로 모든 script 태그 개수를 재검증했다.

---

## 14. lint/type-check/test/build 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과, 경고 0건 |
| `npm run type-check` | 통과 |
| `npm test` | 통과 — 12 test files, **168 tests**(Phase8-1~4와 동일, 변화 없음) |
| `npm run build` | 통과. 라우트 **21개**(변화 없음), `/robots.txt`·`/sitemap.xml` **정적(`○`)**, `/sitemap.xml`은 `Revalidate: 1h / Expire: 1y` 유지, 나머지 19개 라우트는 `ƒ`(Dynamic, Phase7 SSG/ISR 미적용 Known Issue 그대로 — 이번 감사에서 손대지 않음). 예상치 못한 빌드 오류 없음 |

---

## 15. Critical / High / Medium / Low

| 등급 | 건수 | 내용 |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 3 | (1) EXECUTION_PLAN 완료 기준 "Rich Results Test 실제 확인" 미수행(§2, 배포 후에만 가능) (2) EXECUTION_PLAN 완료 기준 "Search Console/서치어드바이저 등록" 미수행(§2, 배포 후에만 가능, Phase8-1이 이미 범위 제외로 결정) (3) canonical이 6개 확인 대상 중 4개(`/`, `/dream`, `/dream/category/*`, `/login`)에 명시적으로 존재하지 않음(§6, 설계상 의도적 생략이나 지시문의 문자 그대로의 검증 요구를 완전히 충족하지는 못함) |
| Low | 1 | 404 페이지에서 WebSite JSON-LD가 RSC payload에만 존재하고 실제 렌더링된 `<script>`로는 노출되지 않는 프레임워크 동작(§10, 결함 아님 — SEO 관점에서 오히려 바람직) |

**Medium 3건 전부 "기능 결함"이 아니라 "완료 기준의 성격상 이 개발 환경/이번 Task 범위에서 완결 지을 수 없는 항목" 또는 "의도된 설계 선택"이다.** Phase9 착수를 막을 만한 Critical/High는 없다.

---

## 16. 기존 Known Issues와 신규 발견 문제 구분

### 기존 Known Issue(지시문 §7 목록) — 이번 감사에서 다시 발견했지만 신규 결함으로 승격하지 않음

| 이슈 | 이번 감사에서 재현 여부 |
|---|---|
| `/dream/*` SSG/ISR 미적용 | §14 빌드 결과로 재확인(19개 라우트 `ƒ`), 그대로 기록만 함 — 손대지 않음 |
| `color-danger`/`success` WCAG | 이번 감사 범위(SEO)와 무관, 재현 확인 안 함 |
| 번호 5색 미구현 | 무관 |
| `proxy.ts` vs Architecture Decision 문서 불일치 | 무관 |
| `/generate` vs `/generate/auto` | 무관 |
| Fortune Phase 미배정 | 무관 |
| 카카오 공유 Phase 미배정 | 무관 |
| Case C 완전 원자성 | 무관 |
| `user_numbers` 결과 위조 가능성 | 무관 |
| `admin_audit_logs` | 무관 |
| 연관 꿈 키워드 내부링크 | Phase8-1이 이미 Low로 기록한 것과 동일, 재발견 아님 |

### 이번 감사에서 새롭게 분류/명시한 것 (신규 "결함"이 아니라 기존에 각 Phase 보고서가 개별적으로 언급했던 것을 Phase8 전체 관점에서 종합 재확인)

- EXECUTION_PLAN 완료 기준의 Rich Results Test/Search Console 항목 미충족 — Phase8-1 보고서가 이미 "이번 Task 범위 아님"으로 개별 기록했던 것을, 이번 Final Audit이 "EXECUTION_PLAN 완료 기준 대조"라는 명시적 틀 안에서 다시 짚었다. **새로 발견한 문제가 아니라 이미 알려진 제외 항목의 공식적 재확인.**
- canonical 부분 미적용(§6) — Phase8-1 보고서의 "canonical 전략" 섹션에 이미 "`/generate` 외에는 canonical이 필요한 실제 중복 콘텐츠 사례가 없다"고 설계 근거가 기록돼 있었다. 이번 감사는 그 설계를 "완료 기준 미충족 가능성"의 관점에서 CONDITIONAL로 재평가했을 뿐, 코드 자체가 바뀐 것은 아니다.

---

## 17. Phase8 최종 판정

### CONDITIONAL PASS

**PASS 조건 미충족 근거**: EXECUTION_PLAN.md의 4개 명시적 완료 기준 중 2개(Rich Results Test 실제 확인, Search Console/서치어드바이저 등록)가 미충족 상태다.

**FAIL이 아닌 근거**: 이 2개 항목은 코드 결함이 아니라 "배포된 공개 URL이 있어야만 수행 가능한 운영 행위"이며, Critical/High 문제가 전혀 없고, 핵심 SEO 기능(metadata/robots/sitemap/canonical(부분)/JSON-LD 2종/noindex/OG/Twitter)이 실제 HTTP 응답 기준으로 전부 정상 동작함을 이번 감사가 실측으로 확인했다. Phase7/기존 기능 회귀도 없다.

**canonical 부분 미적용(§6, Medium)**은 Phase8-1이 이미 내린 의도적 설계 결정이라 FAIL로 볼 근거가 약하지만, 지시문이 명시적으로 6개 페이지 전부의 canonical 일치를 검증하라고 요구했고 그중 4개는 검증할 대상 자체가 없었다는 점에서 CONDITIONAL 판정에 함께 반영했다.

---

## 18. Phase9 착수 가능 여부

**READY.**

Phase9(관리자, `docs/EXECUTION_PLAN.md`)의 의존성은 "Phase 6(당첨확인 로직), Phase 7(꿈해몽 구조)"이며 Phase8을 의존성으로 명시하지 않는다. Phase8의 미충족 항목(Rich Results Test, Search Console 등록)은 Phase9의 어떤 파일/기능과도 접점이 없다 — Phase9이 만들 `/admin/*` 화면·`isAdmin()`·관리자 CRUD는 SEO 상태와 무관하게 독립적으로 착수 가능하다.

---

## 19. Phase9 착수 전 반드시 해결해야 할 사항

**없음.** Critical/High 문제가 없고, Phase9의 실제 의존성(Phase6/Phase7)은 이미 각각 CONDITIONAL PASS/PASS로 종료된 상태다.

---

## 20. 향후 별도 backlog로 남길 사항

1. **배포 후 필수**: Rich Results Test 실제 제출(`search.google.com/test/rich-results`, 실제 프로덕션 URL로), Google Search Console + 네이버 서치어드바이저 등록·소유권 확인 — EXECUTION_PLAN Phase8의 남은 완료 기준 2개, `docs/EXECUTION_PLAN.md` Phase10(배포) 단계 이후가 자연스러운 시점이다.
2. **선택**: `/`, `/dream`, `/dream/category/*`, `/login`에 명시적 self-referencing canonical 추가 여부 — 제품 결정 필요(§6). 추가해도 현재 동작을 바꾸지 않는 순수 보강이라 리스크는 낮다.
3. Phase8-1이 이미 기록한 항목(재인용, 새 항목 아님): 페이지별 OG 이미지 자산 부재, `/dream/*` SSG/ISR 미적용, 연관 꿈 키워드 내부링크 미구현.
