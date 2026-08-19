# Search Engine Registration Runbook — luckplatform.co.kr

Phase10-11A. `luckplatform.co.kr` 연결과 `NEXT_PUBLIC_SITE_URL` 전환이 끝난 뒤(즉
`docs/DOMAIN_CONNECTION_RUNBOOK.md`의 10단계까지 완료한 뒤) 바로 실행할 수 있도록
정리한다. 도메인 소유 확인이 필요한 단계라 이번 Task에서는 실제 등록을 진행하지
않았다.

## Naver Search Advisor

Target: `https://luckplatform.co.kr`

1. https://searchadvisor.naver.com 에서 사이트 등록 → `https://luckplatform.co.kr` 입력
2. 소유확인 — Naver가 제공하는 방법 중 이 프로젝트에 가장 잘 맞는 것은 **HTML 파일 업로드
   방식보다 메타 태그 방식**이다(Next.js App Router는 `app/layout.tsx`의 `metadata.verification`
   필드로 코드 몇 줄만 추가하면 되고, `public/` 정적 파일을 별도로 배포·관리할 필요가 없다).
   Naver가 발급하는 인증 코드를 받으면 `app/layout.tsx`의 `metadata`에
   `verification: { other: { "naver-site-verification": "<발급코드>" } }` 형태로 추가한다 —
   이 값 자체는 도메인 소유 확인 후에만 발급되므로 지금 코드에 미리 넣지 않았다.
3. robots.txt 확인 — Naver Search Advisor의 "robots.txt 확인" 도구로
   `https://luckplatform.co.kr/robots.txt`가 정상 수집되는지 확인(코드는 이미 준비됨,
   `app/robots.ts`).
4. sitemap 제출 — "사이트맵 제출"에 `https://luckplatform.co.kr/sitemap.xml` 등록.
5. 핵심 URL 수집 요청 — 아래 §3 "대표 색인 요청 목록"에 있는 8~10개 URL만 "웹페이지 수집"
   으로 직접 요청한다. 396개 Situation을 개별 제출하지 않는다 — sitemap 제출로 충분하다.

## Google Search Console

Target: `https://luckplatform.co.kr`

**Domain property vs URL-prefix property 비교**:

| | Domain property | URL-prefix property |
|---|---|---|
| 커버 범위 | `luckplatform.co.kr`의 모든 서브도메인/프로토콜(http/https/www 포함) 통합 | 정확히 `https://luckplatform.co.kr`만 |
| 소유확인 방법 | DNS TXT 레코드만 가능 | HTML 태그/파일/Google Analytics/Google Tag Manager 등 다양 |
| 이 프로젝트 적합성 | www를 apex로 리다이렉트하는 구조(§9 www 정책)라 서브도메인 통합 이점이 크지 않음 | DNS 레코드를 추가로 만지지 않고 `metadata.verification`(위 Naver와 같은 방식)으로 바로 끝낼 수 있음 |

**추천: URL-prefix property.** DNS를 추가로 건드리지 않아도 되고, Naver Search
Advisor와 동일하게 `app/layout.tsx`의 `metadata.verification.google` 필드에 발급
코드를 추가하는 것만으로 소유확인이 끝난다 — 이미 `docs/DOMAIN_CONNECTION_RUNBOOK.md`
에서 DNS 작업을 최소화하기로 한 방향과 일관된다.

1. https://search.google.com/search-console 에서 속성 추가 → URL 접두어 →
   `https://luckplatform.co.kr` 입력
2. 소유확인 방법으로 "HTML 태그" 선택 → 발급된 메타 태그 값을 `app/layout.tsx`의
   `metadata.verification.google`에 추가(발급 후 진행 — 지금 코드에 미리 넣지 않음)
3. Sitemaps 메뉴에서 `sitemap.xml` 제출(`https://luckplatform.co.kr/sitemap.xml`)
4. URL 검사 도구로 §3의 대표 URL 각각에 대해 "색인 생성 요청"

## 대표 색인 요청 목록 (Naver/Google 공통)

sitemap 제출로 전체(도메인 연결 시점 기준 Parent 61 + Situation 396 + 카테고리 9 +
정적 페이지)는 자동으로 커버되므로, 초기 수집을 앞당기기 위한 수동 요청은 아래
핵심 URL만으로 충분하다.

1. `/` (홈)
2. `/dream` (꿈해몽 허브)
3. `/dream/돼지꿈` (Flagship Parent 대표)
4. `/dream/돼지꿈/돼지를-보는-꿈` (대표 Situation)
5. `/fortune` (오늘의 행운)
6. `/generate` (번호 생성)
7. `/faq`
8. `/about`

## 실행 시점

이 런북의 모든 단계는 **도메인 연결이 완료되고 `NEXT_PUBLIC_SITE_URL`이 최종
도메인으로 전환된 이후**에만 의미가 있다 — 지금 등록을 시도하면 아직
`luckplatform.co.kr`이 응답하지 않아 소유확인이 실패한다. `Phase10-11B` 완료 후
바로 이어서 진행하면 된다.
