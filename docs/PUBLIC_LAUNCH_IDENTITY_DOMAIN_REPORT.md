# Public Launch Identity & Domain Finalization — 완료 보고서

Phase10-10. 공개 출시 전 필요한 운영자 표시정보·문의 채널·최종 도메인·Kakao Production
redirect·SITE_URL/metadata/canonical 설정을 실제 운영값 기준으로 정리한다. 이번 Task
에서 Claude가 코드만으로 처리 가능한 부분은 전부 마쳤고, 운영자가 실제로 결정한 값
(사업자 상태/공개 표시명/공개 문의 이메일)을 반영했다. **최종 커스텀 도메인은 운영자가
아직 미정이라고 확인**해, 도메인에 의존하는 항목(Kakao Developers 등록, 최종
canonical/sitemap 재배포, 최종 E2E)은 PENDING으로 남긴다.

## 1. 기존 공개 정보 전수 감사

Footer, `/about`, `/terms`, `/privacy`, `/contact`(존재 여부), Header, `app/layout.tsx`
metadata/JSON-LD, `app/robots.ts`, `app/sitemap.ts`, `NEXT_PUBLIC_SITE_URL` 사용처
전체, Kakao callback/login 코드, `.env.example`을 전수 검색했다. 검색 패턴: 대표자/
운영자/사업자/사업자등록번호/연락처/이메일/주소/문의/고객센터/개인정보 보호/localhost/
vercel.app/example.com/TODO/placeholder, 이메일 형태 정규식(`@[...]`), 전화번호 형태
정규식.

결과: **가짜/임시 운영정보 0건.** `/contact` 페이지는 존재하지 않았고, `app/privacy/
page.tsx` §8이 이미 "문의 채널을 아직 마련하지 못했다"고 정직하게 명시하고 있었다 —
이 항목이 유일하게 실제로 비어 있던 부분이다.

## 2. Placeholder Audit

| 패턴 | 결과 |
|---|---|
| 가짜 이메일/전화번호 | 0건 |
| "대표자"/"사업자등록번호" 등에 채워진 임의 값 | 0건 (섹션 제목으로만 존재, 실값 없음) |
| localhost/vercel.app/example.com이 사용자 화면에 하드코딩 | 0건 (전부 `NEXT_PUBLIC_SITE_URL` 환경변수 기반) |
| TODO/placeholder 텍스트 | 0건 |
| "CodeBlue" 등 미확인 운영주체 표현 | 0건 |

## 3. 운영 주체 상태

운영자가 직접 확인: **미등록 개인**(사업자 등록 없이 개인 자격으로 운영). 현재 서비스에
결제/판매 기능이 전혀 없어(코드 전수 확인) 전자상거래법상 통신판매업자 정보 표시
의무와는 무관하다 — 대표자 실명·사업자등록번호·사업장 주소는 이번 Task에서도 요구/생성
하지 않았다.

## 4. 확정된 공개 운영정보

| 항목 | 값 | 근거 |
|---|---|---|
| 공개 운영자/상호 표시명 | **Luck Platform**(기존 브랜드명과 동일) | 운영자 확인 |
| 사업자 등록 상태 | 미등록 개인 | 운영자 확인 |
| 사업자등록번호 | 해당 없음(N/A) | 미등록 개인 + 결제 기능 없음 |
| 공개 전화번호 | 요구하지 않음(N/A) | §34 최소주의 — 현재 서비스 구조상 불필요, 운영자도 별도 제공 안 함 |
| 공개 주소 | 요구하지 않음(N/A) | 동일 이유 |

## 5. 문의 채널

**공개 문의 이메일**: `yeo090110@gmail.com`(운영자 직접 제공, 실제 소유 확인됨). 별도
문의 폼/DB 테이블/Resend 연동은 만들지 않았다 — mailto 링크 하나로 충분(§30 운영비
최소화 원칙). `lib/constants/index.ts`의 `SITE_CONTACT_EMAIL` 상수 하나로 관리하며
Footer와 Privacy §8 두 곳에서만 재사용한다(중복 하드코딩 없음).

## 6. Footer

`components/layout/Footer.tsx`에 mailto 링크 한 줄만 추가했다. 기존 구조(SITE_NAME +
정책 링크 3개 + copyright)는 그대로 유지 — 대규모 redesign 없음.

## 7. About

기존 내용(실제 기능만 서술: 번호생성/꿈해몽/오늘의 행운/행운 다이어리/당첨 확인/FAQ)이
이미 정확해 수정하지 않았다. AI 당첨예측·Premium·Community 등 존재하지 않는 기능 언급
없음(감사로 재확인).

## 8. Privacy

§8(문의 방법)을 "채널 미비" 안내에서 실제 이메일 접수 안내로 교체했다. 그 외
섹션(수집 항목/이용 목적/보관·삭제/외부 서비스/쿠키/이용자 권리/19세 제한/변경 안내)은
Phase10-8 Account Withdrawal 반영분을 포함해 이미 실제 구현과 일치해 수정하지 않았다.
대표자명·사업자정보는 여전히 넣지 않았다(§3의 이유와 동일, 결제 기능 없음).

## 9. Terms

운영 주체 표시명이 기존 브랜드명(`SITE_NAME`)과 동일하다고 확인되어 별도 수정이
필요하지 않았다. 이미 로또 당첨 비보장·참고/오락 목적·과도하지 않은 면책 문구 수준을
유지 중임을 재확인했다.

## 10. 최종 도메인 현황

- Vercel 기본 배포 URL: `https://lotto-blue-sigma.vercel.app`
- Custom domain 연결: **없음**
- 현재 `NEXT_PUBLIC_SITE_URL`(Production/Preview): `https://lotto-blue-sigma.vercel.app`
  (Phase10-7에서 localhost 버그 수정 후 유지 중, 이번 Task에서 재확인만 하고 변경하지 않음)
- 로컬 `.env.local`/`.env.example`의 `NEXT_PUBLIC_SITE_URL`: `http://localhost:3000`(정상 — 로컬 개발용)

## 11. Custom Domain 미확정

운영자가 최종 도메인을 **미정**이라고 확인했다. Claude가 임의로 도메인을 선택하거나
구매하지 않았다. 도메인 선택 시 참고할 수 있는 일반적 체크 항목(실제 구매 가능 여부는
추측하지 않음):

- 기존 브랜드명("Luck Platform")과 발음/기억이 이어지는 문자열인지
- `.kr`/`.com` 등 TLD는 한국 이용자 대상 서비스임을 고려해 판단
- 카카오 로그인 재등록·SEO 재색인이 다시 필요하므로, 이후 자주 바꾸지 않을 값으로 결정하는 것이 유리

## 12. Domain 결정 후 자동 반영되는 영역 (이미 준비 완료)

`NEXT_PUBLIC_SITE_URL` 환경변수 하나만 바꾸면 아래가 전부 자동으로 새 도메인을 쓴다 —
domain 문자열이 여러 파일에 중복 하드코딩되어 있지 않음을 이번 Task에서 확인·정리했다.

- `metadataBase`(canonical/OG의 상대경로 절대화, `app/layout.tsx`)
- `app/sitemap.ts`(Parent/Situation/카테고리/가이드 URL 전체)
- `app/robots.ts`(sitemap 필드)
- `lib/auth/kakao.ts`의 `getKakaoRedirectUri()`
- `app/dream/[keyword]/page.tsx`, `app/dream/[keyword]/[situation]/page.tsx`,
  `app/guide/[topic]/page.tsx`의 BreadcrumbList JSON-LD

## 13. localhost 재발 방지 (신규 안전장치)

Phase10-7에서 Production `NEXT_PUBLIC_SITE_URL`이 9일간 `localhost:3000`으로 방치됐던
사고의 재발 방지 장치를 `lib/utils/env.ts`에 추가했다.

- `getSiteUrl()` 신규 함수: `process.env.VERCEL === "1"`(Vercel이 배포된 모든 환경에
  자동으로 심는 값, Preview/Production 구분 없음)일 때만 `NEXT_PUBLIC_SITE_URL`이
  유효한 `https` URL이고 `localhost`/`127.0.0.1`/`0.0.0.0`이 아님을 강제 검증 — 어긋나면
  즉시 에러를 던진다.
- 로컬 `next dev`/`next build`는 `process.env.VERCEL`이 없어 그대로 통과한다 — 로컬
  워크플로우를 깨뜨리지 않는다(과도한 validator 금지 원칙 준수).
- 기존 `getEnv("NEXT_PUBLIC_SITE_URL")` 직접 호출 7곳(`app/layout.tsx`, `app/sitemap.ts`,
  `app/robots.ts`, `lib/auth/kakao.ts`, `app/dream/[keyword]/page.tsx`,
  `app/dream/[keyword]/[situation]/page.tsx`, `app/guide/[topic]/page.tsx`)을 전부
  `getSiteUrl()`로 통일했다.

## 14. Production URL Validator 테스트

`lib/utils/env.test.ts`에 7개 케이스 추가: 비-Vercel 환경 localhost 허용, Vercel에서
정상 https 통과, Vercel에서 localhost/127.0.0.1/http/잘못된 URL/누락 값 각각 에러.
전부 통과.

## 15. metadata/canonical

`app/layout.tsx`의 `metadataBase`, 각 페이지의 `alternates.canonical`은 전부
`getSiteUrl()` 기반이라 도메인 확정 시 재배포만 하면 자동 반영된다. 코드 변경은
이번 Task에서 이미 완료 — 도메인 확정 후 추가 코드 수정 불필요.

## 16. sitemap / 17. robots / 18. OpenGraph

셋 다 `getSiteUrl()` 하나에서 파생되는 완전 동적 구조(코드 변경 없음, §12 참조)이며,
현재는 임시 Vercel 도메인(`lotto-blue-sigma.vercel.app`) 기준으로 정상 동작 중임을
로컬 빌드로 재확인했다. 최종 도메인 확정 후 실제 배포 상태에서 재검증이 필요하다
(§20 남은 작업).

## 19. Kakao callback

`lib/auth/kakao.ts`의 `getKakaoRedirectUri()` = `${getSiteUrl()}/api/auth/kakao/callback`,
실제 handler는 `app/api/auth/kakao/callback/route.ts`(`GET`)에 존재함을 코드로 확인했다.
최종 도메인이 `https://example.kr`이라면(예시일 뿐 실제 값 아님):

- **Redirect URI**: `https://example.kr/api/auth/kakao/callback`
- **Site Domain**(카카오 로그인 활성화 도메인): `https://example.kr`

## 20. Kakao Developers Operator Action — PENDING

도메인이 미정이라 이번 Task에서는 실행하지 않는다. **도메인이 정해지면** 운영자가
Kakao Developers Console에서:

1. 내 애플리케이션 → 카카오 로그인 → **Redirect URI**에 `https://{최종도메인}/api/auth/kakao/callback` 추가(기존 Vercel 기본 도메인 URI는 당장 지우지 않아도 무방 — 전환 기간 중 병행 가능)
2. 앱 설정 → 플랫폼 → Web → **사이트 도메인**에 `https://{최종도메인}` 추가

이 두 가지 외에는 추가로 건드릴 메뉴가 없다.

## 21. 기존 Kakao 계정 보존

이번 Task에서 `lib/auth/kakao.ts`의 인증 로직·기존 `auth.users`/`profiles`/`admins`
행을 전혀 수정/삭제하지 않았다(수정한 것은 redirect URI를 만드는 `getKakaoRedirectUri()`
내부의 환경변수 접근 방식뿐, 반환값 형식은 동일).

## 22. Production Login 최종 검증 계획 — PENDING

도메인 미확정으로 아직 실행할 수 없다. 도메인 확정 + Kakao 콘솔 등록 + 재배포 후:
logout → 최종 도메인 `/login` → Kakao → callback → 기존 계정과 동일 UUID 확인 →
`auth.users`/`profiles` 중복 0건 → `/fortune` → `/admin` 순으로 실제 운영자 Kakao
계정으로 1회 검증이 필요하다.

## 23. Sitemap Host / 24. Canonical Host / 25. OpenGraph URL — PENDING(도메인 확정 후)

현재는 임시 Vercel 도메인 기준으로 전부 정상(§16~18). 최종 도메인 확정 후 재배포 시
`/`, `/dream`, Parent/Situation 페이지, `/fortune`, `/faq`, `/about`을 포함한 sitemap
전체(현재 규모: Parent 61 + Situation 396 + 카테고리 9 + 정적 8 = 474 URL)가 새 도메인
기준으로 재검증돼야 한다 — 코드는 이미 준비돼 있어 도메인 값만 바뀌면 자동 반영된다.

## 26. Search Engine 준비 — PENDING(도메인 확정 후)

Naver Search Advisor 소유 확인·sitemap 제출, Google Search Console property 등록·sitemap
제출 모두 최종 도메인이 있어야 의미가 있다 — 이번 Task에서 계정 로그인/소유확인을
임의로 진행하지 않았다.

## 27. Dream 콘텐츠 추가 금지 준수

이번 Task에서 `dreams`/`dream_situations` 콘텐츠를 추가/수정하지 않았다(Parent 61 /
Situation 396 유지, Wave2 종료 시점 상태 그대로).

## 28. Lotto Sync / Cron 변경 금지 준수

`official adapter`/`lottis`/`datalotto`/consensus/fallback flag/cron schedule 전부
수정하지 않았다. `LOTTO_SECONDARY_FALLBACK_ENABLED`는 계속 OFF. 오늘 실제 토요일 Cron
관찰 결과는 이 Task의 PASS 판정과 분리해 `PENDING_LIVE_CRON_OBSERVATION`으로 별도
취급한다(운영자가 Vercel 로그로 직접 확인해야 하는 항목 — 이번 Task 범위 밖).

## 29. Account Withdrawal 회귀 확인

`lib/api/account/**`, `app/api/account/**`, `app/my/account/**`를 전혀 수정하지
않았다. `npm run build` 결과에 `/api/account`, `/my/account` 라우트가 정상 포함되어
컴파일 레벨 회귀가 없음을 확인했다 — Production 재삭제 테스트는 반복하지 않았다.

## 30. Secret Scan

이번 Task의 git diff(수정 14개 파일) + 신규/미확정 파일 전체(수정된 파일 목록 기준)를
대상으로 시크릿 패턴(`sk-*`, JWT형 토큰, `password=`, `secret=`, `CRON_SECRET=`값,
`SERVICE_ROLE_KEY=`값 등)을 스캔했다 — **0건**. 공개 이메일(`yeo090110@gmail.com`)은
운영자가 공개 문의처로 명시적으로 제공한 값이라 시크릿이 아니다.

## 31. Validation

| 항목 | 결과 |
|---|---|
| ESLint (`--max-warnings=0`) | 0 errors, 0 warnings |
| TypeScript (`tsc --noEmit`) | 0 errors |
| Vitest | **561/561 passed**(기존 554 + `getSiteUrl` 신규 테스트 7개) |
| `npm run build` | 성공, 전 라우트 정상 생성 |
| 로컬 dev 서버 스모크 | `/`, `/privacy`에서 mailto 링크 정상 렌더링 확인 |

## 32. Production Smoke — PENDING(도메인 확정 후)

도메인 확정 전이라 최종 도메인 기준 스모크 테스트는 수행하지 않았다. 임시 Vercel
도메인(`lotto-blue-sigma.vercel.app`) 기준으로는 Phase10-7에서 이미 검증됨.

## 33. 남은 Launch Blocker

1. **최종 커스텀 도메인 미정** — 운영자 결정 대기(이번 Task에서 명시적으로 미정 확인).
2. 위 1번에 종속: Kakao Developers redirect URI/사이트 도메인 등록, 최종
   canonical/sitemap/OG 재검증, 최종 Kakao 로그인 E2E, Search Console/Naver 서치어드바이저
   등록 — 전부 도메인 확정 후 후속 작업.
3. `PENDING_LIVE_CRON_OBSERVATION` — 이번 Task와 무관하게 별도로 운영자가 확인해야 함.

**해소된 항목**: 운영자/사업자/연락처 정보 미확정(§3~§9), localhost 재발 방지 장치
부재(§13~14).

## 34. 다음 작업 추천

운영자가 최종 도메인을 결정하면 이 Phase10-10을 이어서 진행한다: (a) Vercel
`NEXT_PUBLIC_SITE_URL`을 새 도메인으로 갱신 후 재배포, (b) Kakao Developers Console에
redirect URI/사이트 도메인 등록(§20), (c) §22~26의 PENDING 항목을 실제로 검증.

---

## TASK REPORT — Public Launch Identity & Domain

- Operator Type: 미등록 개인
- Public Operator Name: Luck Platform(기존 브랜드명과 동일)
- Business Registration: 해당 없음(N/A — 미등록 개인, 결제 기능 없음)
- Public Contact: yeo090110@gmail.com
- Final Domain: **미정**(운영자 확인, OPERATOR ACTION REQUIRED로 남음)
- NEXT_PUBLIC_SITE_URL: `https://lotto-blue-sigma.vercel.app`(Production/Preview, 임시 Vercel 도메인)
- Production Localhost: 없음(Phase10-7에서 수정, 이번 Task에서 `getSiteUrl()` fail-fast 안전장치로 재발 방지 강화)
- Canonical Host: 임시 Vercel 도메인 기준 정상, 최종 도메인 확정 후 재검증 필요
- Sitemap Host: 임시 Vercel 도메인 기준 정상(474 URL), 최종 도메인 확정 후 재검증 필요
- Robots: 정상(disallow 목록 변경 없음)
- OpenGraph: 임시 Vercel 도메인 기준 정상
- Kakao Redirect URI: 계산식 확정(`{SITE_URL}/api/auth/kakao/callback`), 최종 값은 도메인 확정 후 결정
- Kakao Console Updated: NO(도메인 미정으로 PENDING)
- Final Kakao Login: PENDING
- Duplicate Auth/Profile: PENDING(최종 로그인 검증과 함께 확인 예정)
- Footer: 문의 이메일 추가 완료
- Privacy: §8 문의 방법 실제 이메일로 갱신 완료
- Terms: 변경 불필요(이미 정확)
- About: 변경 불필요(이미 정확)
- Secret Leak: 0건
- Tests: 561/561 passed
- Build: success
- Production Smoke: PENDING(도메인 확정 후)
- Search Console Ready: NO(도메인 필요)
- Naver Search Advisor Ready: NO(도메인 필요)
- Lotto Cron Live Observation: PENDING_LIVE_CRON_OBSERVATION(이번 Task와 분리)
- Launch Identity/Domain: **CONDITIONAL**(운영자 정보/문의 채널은 PASS, 도메인은 미정으로 대기)
- Remaining Launch Blockers: 최종 커스텀 도메인 확정 및 그에 종속된 Kakao 등록/최종 검증
- Public Launch Ready: NO
- 다음 작업: 정확히 1개. **운영자가 최종 커스텀 도메인을 확정하면 이 Task를 이어서 진행 — `NEXT_PUBLIC_SITE_URL` 갱신·재배포 후 Kakao Developers Console에 redirect URI/사이트 도메인을 등록하고 최종 로그인/sitemap/canonical을 검증한다.**
