# Final Domain Pre-Purchase Launch Preparation — 완료 보고서

Phase10-11A. `luckplatform.co.kr` 구매를 아직 하지 않은 상태에서, 구매 즉시 최소한의
외부 설정만으로 Production Launch Finalization(Phase10-11B)에 들어갈 수 있도록 코드·
설정·문서 준비를 최대한 끝낸다. 도메인을 구매하지 않았고, DNS를 건드리지 않았고,
현재 Production(`https://lotto-blue-sigma.vercel.app`)의 `NEXT_PUBLIC_SITE_URL`/
canonical/Kakao redirect도 전혀 바꾸지 않았다.

## 1. Target Domain

`luckplatform.co.kr` — Phase10-11에서 운영자가 최종 선택했으나 아직 미구매
(`WAITING_FOR_DOMAIN_PURCHASE` 상태 유지).

## 2. Domain Dependency Audit

repo 전체를 재감사했다(Phase10-10 이후 변경분 포함). `NEXT_PUBLIC_SITE_URL`/
`getSiteUrl()`/`metadataBase`/canonical/robots/sitemap/OG/Twitter/JSON-LD/Kakao
callback을 사용하는 곳을 전수 확인한 결과, 우리 자신의 프로덕션 호스트를 하드코딩한
곳은 **0건**이다. 발견된 모든 `http(s)://` 리터럴은 다음 셋 중 하나였다:

- 제3자 엔드포인트(카카오 OAuth 서버, `schema.org`, 로또 소스 `lottis.kr`/`datalotto.kr`/
  `dhlottery.co.kr` — Lotto 시스템은 이번 Task에서 수정 금지 대상이라 그대로 둠)
- 테스트 픽스처(`example.com`, `example.supabase.co` — 억지로 제거하지 않음)
- 실행 시점에 브라우저의 실제 origin을 그대로 쓰는 동적 값: `components/fortune/
  DailyFortuneCard.tsx`의 공유 링크가 `window.location.origin + "/fortune"`을 사용 —
  이건 env나 코드 수정 없이도 도메인 전환 시 자동으로 새 도메인을 가리키게 된다.

## 3. Current Production 보호

이번 Task에서 `NEXT_PUBLIC_SITE_URL`, Vercel 환경변수, DNS, Kakao Developers Console
을 전혀 건드리지 않았다. `git diff`에 프로덕션 동작에 영향을 주는 값 변경이 없음을
§24(회귀 확인)에서 실제 라이브 사이트 호출로 재확인했다.

## 4. getSiteUrl() Coverage 재감사

Phase10-10에서 통일한 7개 호출부(`app/layout.tsx`, `app/sitemap.ts`, `app/robots.ts`,
`lib/auth/kakao.ts`, `app/dream/[keyword]/page.tsx`, `app/dream/[keyword]/[situation]/
page.tsx`, `app/guide/[topic]/page.tsx`)가 여전히 `getSiteUrl()` 하나로 통일되어 있음을
재확인했다. 새로 추가된 호출부는 없다(추가할 필요도 없었다 — §2에서 하드코딩 0건 확인).

## 5. Final Domain Readiness Test

`lib/utils/env.ts`의 `getSiteUrl()`에 **trailing slash 가드**를 신규 추가했다 —
`app/sitemap.ts`/`app/robots.ts`/`lib/auth/kakao.ts`가 이 값을 `${getSiteUrl()}/path`
형태로 단순 문자열 결합하기 때문에, 끝에 `/`가 붙은 값이 들어오면 이중 슬래시
(`https://example.com//dream`)가 조용히 생길 수 있었다. Vercel 배포 환경에서만
fail-fast로 막는다(로컬 개발은 그대로 허용, 기존 정책과 동일).

`lib/utils/env.test.ts`에 `luckplatform.co.kr`을 실제 입력값으로 쓰는 테스트 3개를
추가해, **실제로 도메인을 소유/연결하지 않고도** 이 값이 코드 구조에서 문제없이
통과할 것임을 미리 증명했다:

- `https://luckplatform.co.kr`(trailing slash 없음) → 정상 통과
- `https://luckplatform.co.kr/`(trailing slash 있음) → 즉시 에러(새로 추가한 가드가 작동)
- `https://www.luckplatform.co.kr` → 값 자체는 통과하지만, www를 canonical로 쓰면 안
  된다는 정책은 코드가 아니라 Vercel Domains 리다이렉트 설정으로 강제한다는 점을
  테스트 주석으로 명시

## 6. localhost 재발 방지 회귀 확인

기존 Phase10-10 안전장치(localhost/127.0.0.1 금지, https 강제)가 여전히 정상 동작함을
테스트로 재확인했다(9개 케이스 전부 통과, §5의 신규 3개 포함 총 13개).

## 7. Target Domain Validation

`new URL("https://luckplatform.co.kr")` 기준 문법적으로 유효한 URL이고, HTTPS origin
구성이 가능하며, trailing slash 없는 형태가 이 프로젝트의 기존 컨벤션과 일치함을
확인했다. **도메인 소유 여부는 별개이며(§1 미구매 유지), 이 검증은 순수 문자열/URL
구조 검증일 뿐이다.**

## 8~10. Apex/www 정책, Vercel 연결, DNS 절차

`docs/DOMAIN_CONNECTION_RUNBOOK.md`(신규)에 전체 절차를 정리했다. 핵심 결정:

- **Canonical: apex(`https://luckplatform.co.kr`)**, `www`는 apex로 redirect
- www redirect는 애플리케이션 코드(middleware/`next.config.ts`)가 아니라 **Vercel
  Domains의 "Redirect to" 설정**으로 처리 — 코드 변경 불필요
- 실제 DNS 레코드 값(A/CNAME)은 지금 하드코딩하지 않았다 — Vercel이 도메인 추가
  시점에 제시하는 값을 그대로 쓰도록 절차만 고정

## 11. Kakao Final Values

`lib/auth/kakao.ts`의 `getKakaoRedirectUri()` = `${getSiteUrl()}/api/auth/kakao/callback`,
실제 handler는 `app/api/auth/kakao/callback/route.ts`(`GET`)임을 코드로 재확인했다
(Phase10-10/11에서 이미 확인한 것과 동일 — 변경 없음).

- **사이트 도메인**: `https://luckplatform.co.kr`
- **Redirect URI**: `https://luckplatform.co.kr/api/auth/kakao/callback`

## 12. Kakao Console Runbook + JavaScript SDK 여부

`docs/DOMAIN_CONNECTION_RUNBOOK.md` 7단계에 5분 내로 처리 가능한 수준으로 정리했다.
**JavaScript SDK 도메인 등록은 필요 없다** — `NEXT_PUBLIC_KAKAO_JS_KEY`/Kakao JS
SDK 관련 코드를 전수 재검색했으나 실제 사용처 0건(Phase10-7에서 이미 발견된 사실을
재확인, 카카오 로그인은 100% 서버사이드 REST 플로우).

## 13. 기존 Kakao 설정 보존

런북 7단계에서 기존 Vercel 기본 도메인의 Redirect URI/사이트 도메인을 **지우지 않고
새 값을 추가만** 하도록 명시했다 — 전환 기간 중 로그인이 끊기는 window가 없다.

## 14~17. Canonical/Sitemap/Robots/OpenGraph/JSON-LD Readiness

전부 `getSiteUrl()` 하나에서 파생되므로(§4) `NEXT_PUBLIC_SITE_URL`이 최종 도메인으로
바뀌고 재배포되는 순간 코드 변경 없이 자동 전환된다 — 이번 Task에서 별도로 고칠
부분이 없었다. 단, **실제 라이브 확인 중 중요한 발견**이 있었다(§18).

## 18. 발견된 이슈 — sitemap.xml ISR 캐시 staleness (도메인과 무관, 정보성)

현재 라이브 프로덕션(`https://lotto-blue-sigma.vercel.app`)의 `/sitemap.xml`을 실측한
결과:

- `X-Vercel-Cache: HIT`, `Age: 53980`(약 15시간), `Last-Modified: 2026-08-14 15:12:32 UTC`
- URL 개수 **141개** — parent 25 / situation 108 / category 7 / static+guide 나머지
- 반면 실제 DB(같은 프로젝트, service_role로 직접 조회)는 `dreams=61`,
  `dream_situations=396` — Dream SEO Wave2까지 반영된 현재 상태

즉 `/sitemap.xml`(`revalidate = 3600` ISR)이 **DB 최신 상태를 아직 반영하지 못한
15시간 이상 된 캐시 스냅샷**을 계속 서빙 중이었다. 반면 `/dream/[keyword]` 개별
페이지는 `lib/supabase/server.ts`(cookies() 사용)를 통해 완전 동적으로 렌더링되므로
`곰꿈`(Wave2 신규 Parent) 페이지가 정상적으로 200을 반환하는 것도 함께 확인했다 — DB
자체는 최신인데 캐시된 sitemap만 뒤처져 있는 상태다.

**이번 Task의 domain readiness와는 무관**하지만(sitemap 코드 자체는 정상이며 도메인이
바뀌어도 그대로 동작함), 방치하면 검색엔진이 새 Parent/Situation을 오랫동안 못 찾을
수 있어 기록해둔다. 대응:

- `scripts/smoke-check.mjs`에 sitemap URL 개수 + 캐시 상태(`X-Vercel-Cache`/`Age`)를
  출력하는 로직을 추가해 이런 staleness를 앞으로 자동으로 눈에 띄게 만들었다.
- `docs/DOMAIN_CONNECTION_RUNBOOK.md` 10단계에 "재배포 후 sitemap URL 개수가 실제
  DB와 맞는지 확인" 절차를 명시했다 — Phase10-11B의 재배포가 이 캐시를 자연스럽게
  새로 생성하므로 별도 조치 없이 해소될 가능성이 높지만, 확인 절차를 빠뜨리지
  않도록 명문화했다.
- 이번 Task에서 프로덕션에 강제 재배포/캐시 무효화를 실행하지는 않았다(운영자
  승인 없는 프로덕션 조작 금지 원칙).

## 19. Naver Search Advisor / 20. Google Search Console Runbook

`docs/SEARCH_ENGINE_REGISTRATION_RUNBOOK.md`(신규)에 정리했다. Google은 **URL-prefix
property**를 추천(DNS 추가 작업 없이 `metadata.verification`만으로 소유확인 가능,
www를 apex로 리다이렉트하는 이 프로젝트 구조와 Domain property의 이점이 크게
겹치지 않음). 두 서비스 모두 sitemap 제출 + 대표 URL 8개 수동 색인 요청으로
충분하며, 396개 Situation을 개별 제출하지 않는다.

## 19-1. Final Smoke Checklist

`scripts/smoke-check.mjs`(신규, `npm run smoke -- <BASE_URL>`)로 반복 실행 가능하게
만들었다. 인증이 필요 없는 13개 대표 라우트(`/`, `/login`, `/generate`, `/fortune`,
`/dream`, 대표 Parent/Situation, `/faq`, `/about`, `/privacy`, `/terms`,
`/robots.txt`, `/sitemap.xml`)를 상태코드 + 호스트 일관성(localhost/vercel.app 잔존
여부) 기준으로 검사한다. 현재 임시 도메인 기준 **13/13 PASS** 확인(§24).

## 20-1. Final Kakao E2E Checklist (Phase10-11B에서 실행)

1. 기존 세션 logout
2. `https://luckplatform.co.kr/login`
3. 카카오 로그인
4. callback 정상 처리
5. 기존과 동일한 Supabase user(UUID 동일)
6. 온보딩 화면 다시 뜨지 않음(이미 profile 존재)
7. `/fortune` 정상
8. `/my/journal` 정상
9. `/admin`(운영자 계정 기준) 정상

## 21. DB Duplicate Check (read-only)

Final E2E 전/후 실행할 절차:

```bash
node -e "
const fs=require('fs');
const env=fs.readFileSync('.env.local','utf8');
const get=(n)=>(env.match(new RegExp('^'+n+'=(.*)\$','m'))||[])[1]?.trim();
const url=get('NEXT_PUBLIC_SUPABASE_URL'), key=get('SUPABASE_SERVICE_ROLE_KEY');
(async()=>{
  const h={apikey:key,Authorization:'Bearer '+key,Prefer:'count=exact'};
  for (const t of ['profiles','admins']) {
    const r = await fetch(url+'/rest/v1/'+t+'?select=id&limit=1', {headers:h});
    console.log(t, r.headers.get('content-range'));
  }
})();
"
```

전/후 `profiles`/`admins` count가 동일하고, 운영자 계정 UUID가 로그인 전후로 같은지
확인한다(신규 행 생성 없이 기존 계정 재인증만 일어나야 함).

## 22. Account Withdrawal 유지

`lib/api/account/**`, `app/api/account/**`, `app/my/account/**`를 이번 Task에서
전혀 수정하지 않았다. `npm run build` 결과에 두 라우트가 정상 포함되어 회귀
없음을 재확인했다.

## 23. Lotto System / Fallback Flag

`official adapter`/`lottis`/`datalotto`/consensus/cron 관련 코드를 전혀 수정하지
않았다. `LOTTO_SECONDARY_FALLBACK_ENABLED`도 변경하지 않았다(OFF 유지). Cron 실행
로그는 Vercel 대시보드 접근 권한이 있는 운영자만 확인 가능해 `PENDING_LIVE_CRON_
OBSERVATION`으로 남긴다.

## 24. Secret Audit / 25. Tests·Build / 26. Current Production Regression

| 항목 | 결과 |
|---|---|
| Secret scan(이번 Task diff) | 0건 |
| ESLint | 0 errors, 0 warnings |
| TypeScript | 0 errors |
| Vitest | **565/565 passed**(기존 561 + `getSiteUrl` 관련 신규 4개) |
| `npm run build` | 성공 |
| 현재 라이브 프로덕션 smoke(`scripts/smoke-check.mjs` 실행) | **13/13 PASS** — 이번 Task의 로컬 변경이 프로덕션에 전혀 영향을 주지 않았음을 실제 호출로 확인 |

## 27. Migration

DB 스키마 변경 없음. `supabase/migrations/0001~0021` 그대로, 신규 마이그레이션
추가하지 않았다.

## 28. Production Data Safety

이번 Task는 코드/문서만 변경했고 프로덕션 env·DB에 어떤 조작도 하지 않았다 —
사용자 데이터 변경 0(변경할 수 있는 경로 자체가 없었음).

## 29. git 상태

커밋/푸시 하지 않았다. 이번 Task에서 추가/수정된 파일:

- 수정: `.env.example`, `lib/utils/env.ts`, `lib/utils/env.test.ts`, `package.json`
- 신규: `scripts/smoke-check.mjs`, `docs/DOMAIN_CONNECTION_RUNBOOK.md`,
  `docs/SEARCH_ENGINE_REGISTRATION_RUNBOOK.md`, `docs/DOMAIN_PREPURCHASE_READINESS_REPORT.md`
- 그 외는 전부 Phase10-8~10-11의 기존 미커밋 변경분(변경 없음)

`git diff --stat`: 16개 파일, +271/-38줄.

## 30. Domain-Purchase-Dependent Tasks (Phase10-11B에서 수행)

1. 도메인 구매
2. Vercel Add Domain(apex + www) + DNS 반영 + Verification
3. www → apex redirect 설정(Vercel Domains)
4. HTTPS 정상 확인
5. Kakao Developers Console에 새 Redirect URI/사이트 도메인 **추가**(기존 값 유지)
6. `NEXT_PUBLIC_SITE_URL=https://luckplatform.co.kr`로 Production/Preview 갱신
7. Redeploy
8. `scripts/smoke-check.mjs https://luckplatform.co.kr` 실행 — sitemap URL 개수까지 확인(§18)
9. Final Kakao E2E(§20-1) + DB Duplicate Check(§21)
10. Naver Search Advisor / Google Search Console 등록(`docs/SEARCH_ENGINE_REGISTRATION_RUNBOOK.md`)
11. Public Launch Ready 최종 판정

## 31. 남은 Launch Blocker

1. **`luckplatform.co.kr` 미구매** — 유일한 실제 블로커. 그 외 모든 절차/코드/문서는
   구매 즉시 진행 가능하도록 준비 완료.
2. `PENDING_LIVE_CRON_OBSERVATION`(도메인과 무관, 별도 확인 필요).
3. sitemap ISR 캐시 staleness(§18) — 심각하지 않고 재배포 시 자연 해소 예상되나
   Phase10-11B에서 명시적으로 확인 필요.

---

## TASK REPORT — Domain Pre-Purchase Readiness

- Target Domain: luckplatform.co.kr
- Domain Purchased: NO
- Production Env Changed: NO
- Current Production Preserved: YES(실측 smoke 13/13 PASS)
- getSiteUrl Coverage: 7/7 호출부 통일 유지(신규 호출부 없음)
- Hardcoded Production Hosts: 0건
- Apex Policy: apex(`https://luckplatform.co.kr`)를 canonical로 확정
- WWW Policy: www → apex redirect(Vercel Domains 설정, 코드 변경 없음)
- Vercel Runbook: 작성 완료(`docs/DOMAIN_CONNECTION_RUNBOOK.md`)
- DNS Runbook: 작성 완료(실제 레코드 값은 구매 후 Vercel 제시값 사용)
- Kakao Site Domain Prepared: `https://luckplatform.co.kr`(계산 완료, 미등록)
- Kakao Redirect Prepared: `https://luckplatform.co.kr/api/auth/kakao/callback`(계산 완료, 미등록)
- Kakao JS Domain Required: NO(JS SDK 미사용 재확인)
- Canonical Ready: YES(코드 구조상, 재배포 즉시 자동 전환)
- Sitemap Ready: YES(코드 구조), 단 현재 임시 도메인 sitemap ISR 캐시 staleness 발견·기록(§18)
- Robots Ready: YES(코드 구조)
- OpenGraph Ready: YES(코드 구조)
- JSON-LD Ready: YES(코드 구조)
- Naver Runbook: 작성 완료(`docs/SEARCH_ENGINE_REGISTRATION_RUNBOOK.md`)
- Google Runbook: 작성 완료(동일 문서, URL-prefix property 추천)
- Smoke Checklist: 스크립트화 완료(`scripts/smoke-check.mjs`, `npm run smoke`)
- Final Kakao Checklist: 작성 완료(§20-1)
- Migration: 변경 없음(0001~0021 유지)
- Tests: 565/565 passed
- Build: success
- User Data Changed: NO
- Secret Leak: 0건
- Commit: 하지 않음
- Pre-Purchase Launch Preparation: **PASS**
- Public Launch Ready: NO
- Domain-Purchase-Dependent Tasks: §30 목록(11개 단계, 전부 Phase10-11B로 이관)
- Exact Next User Message: `luckplatform.co.kr 구매 완료했어. Phase10-11B 진행해줘.`
- 다음 작업: `Phase10-11B — Final Domain Cutover & Launch Verification`
