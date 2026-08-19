# Final Domain Selection, Connection & Public Launch Finalization — 진행 보고서

Phase10-11. 최종 도메인 후보를 실제 조사(WHOIS/RDAP)하고 운영자가 선택했지만, **선택된
도메인을 아직 구매하지 않은 상태**라 이번 보고서는 `WAITING_FOR_DOMAIN_PURCHASE` 단계에서
작성한다. 도메인 구매 전에는 `NEXT_PUBLIC_SITE_URL`/canonical/Kakao redirect/sitemap
host를 임의로 바꾸지 않는다는 원칙을 그대로 지켰다 — 이번 Task에서 관련 코드는 전혀
수정하지 않았다.

## 0. 브랜드명 확인

지시문의 "Lucky Platform"은 오타였고, 실제 source of truth는 `lib/constants/index.ts`의
`SITE_NAME = "Luck Platform"`(y 없음)임을 운영자에게 직접 확인했다(재브랜딩하지 않음).
이후 모든 도메인 후보 조사는 "Luck Platform" 기준으로 진행했다.

## 1. Domain Candidate Research

실제 WHOIS(raw TCP, `whois.verisign-grs.com`/`whois.kr`) + RDAP(`rdap.verisign.com`,
Google `.app` RDAP, Radix `.site` RDAP) 조회로 확인한 결과(추측 없음):

| 후보 | Availability | 근거 |
|---|---|---|
| luckplatform.com | **TAKEN** | WHOIS: registrar name.com, 등록일 2025-11-14. 등록인 비공개, 실서비스 흔적 없음 |
| luckplatform.net | AVAILABLE | WHOIS: "No match" |
| luckplatform.kr | AVAILABLE | WHOIS(whois.kr): "등록되어 있지 않습니다" |
| **luckplatform.co.kr** | **AVAILABLE** | WHOIS(whois.kr): "등록되어 있지 않습니다" |
| luckplatform.app | AVAILABLE | RDAP(Google registry): 404 |
| luckplatform.site | AVAILABLE | RDAP(Radix): 404 |

상표 충돌 간이 검색("Luck Platform" 관련 웹 검색) 결과 명백한 충돌 없음(정식 상표
법률조사 아님 — 법적 사용 가능성을 보장하지 않는다는 점을 운영자에게 별도 고지함).

## 2. 후보 비교 (최종 3~5개, 운영자에게 제시)

| 후보 | 기억성 | 브랜드성 | SEO 확장성 | 단점 | 추천 순위 |
|---|---|---|---|---|---|
| luckplatform.kr | 높음(짧음) | 높음 | 좋음(로또 종속 없음, 운세·꿈·행운 전반 커버) | 없음 | **1순위(Claude 추천)** |
| luckplatform.co.kr | 중간(길이 김) | 높음 | 좋음 | `.kr`보다 타이핑 길고 번거로움 | 2순위 |
| luckplatform.app | 중간 | 높음 | 좋음 | 일반 사용자에게 `.app` TLD가 낯설 수 있음 | 3순위 |
| luckplatform.com | — | — | — | 이미 타인이 등록해 사용 불가 | 후보 제외 |
| luckplatform.net | 낮음 | 낮음 | 보통 | 소비자 브랜드 인지도 약함, 대안일 뿐 | 4순위(참고용) |

## 3. Claude 추천 1순위

**luckplatform.kr** — 브랜드명과 정확히 일치하면서 가장 짧고, 한국 서비스에 가장
자연스러운 TLD. 도메인 자체를 구매하지는 않았다.

## 4. 선택된 최종 도메인

운영자가 **`luckplatform.co.kr`**을 선택했다(추천 1순위는 `.kr`이었으나 운영자가
`.co.kr`을 최종 결정 — 두 후보 모두 위 조사 기준 정상 등록 가능 상태였다).

## 5. 도메인 보유 상태

운영자 확인: **아직 구매 전.** Claude는 도메인을 대신 구매하지 않았다(지시문 원칙).

## 6. 이번 Task 처리 범위

도메인이 실제로 연결되기 전까지는 아래가 전부 `PENDING`이다 — 코드/설정을 미리
바꾸지 않았다.

- Vercel custom domain 연결, DNS
- HTTPS/www-apex 정책 확정
- `NEXT_PUBLIC_SITE_URL` 갱신 및 재배포
- `getSiteUrl()` 최종 도메인 기준 재검증
- canonical / sitemap / robots / OG host 전수 검증
- Kakao Developers Console 등록 및 최종 E2E
- Search Advisor / Search Console 등록

## 7. Kakao Developers 설정 — 사전 계산(도메인 구매 후 그대로 사용 가능)

`lib/auth/kakao.ts`의 `getKakaoRedirectUri()` = `${getSiteUrl()}/api/auth/kakao/callback`,
실제 handler는 `app/api/auth/kakao/callback/route.ts`(`GET`)임을 코드로 재확인했다.
`luckplatform.co.kr`이 최종 확정되면 등록할 값은 다음과 같다 — **도메인이 실제로
연결·검증되기 전에는 Kakao 콘솔에 먼저 등록하지 않는 것을 권장**(연결 전 등록해도 무해
하지만, 검증 없는 값을 먼저 남겨두는 것보다 연결 확인 후 등록하는 순서가 안전하다):

- **Redirect URI**: `https://luckplatform.co.kr/api/auth/kakao/callback`
- **사이트 도메인**: `https://luckplatform.co.kr`

## 8. Vercel 연결 절차 (도메인 구매 후 운영자가 진행할 단계)

Claude가 이 세션에서 Vercel에 로그인된 상태가 아니라(Vercel CLI는 `npx vercel`로 사용
가능하지만 인증 세션 없음) 실제 연결은 운영자가 Vercel 대시보드 또는 `vercel domains add`
CLI로 직접 수행해야 한다. 절차:

1. 도메인 구매(registrar는 운영자 선택 — 강제하지 않음)
2. Vercel 프로젝트 → Settings → Domains → `luckplatform.co.kr` 추가
3. Vercel이 안내하는 DNS 레코드를 registrar에 등록(`.co.kr`은 KISA 산하 등록대행사를
   통하므로 등록대행사 콘솔에서 A 레코드 또는 네임서버 위임 중 Vercel이 제시하는 방식을
   그대로 따르면 된다 — 실제 값은 Vercel이 도메인 추가 시점에 생성해주므로 지금 미리
   추측해 적지 않는다)
4. `www.luckplatform.co.kr`도 함께 추가하고 **apex(`luckplatform.co.kr`)를 canonical로,
   `www`는 apex로 redirect** — Vercel Domains 설정의 "Redirect to" 옵션으로 코드 변경
   없이 처리 가능(현재 `next.config.ts`에 별도 redirect 로직 없음, 추가할 필요도 없음)
5. HTTPS/인증서는 Vercel이 자동 발급 — 별도 조치 불필요

## 9. NEXT_PUBLIC_SITE_URL 갱신 계획

연결 확인 후: Vercel 프로젝트 환경변수(Production + Preview)에서
`NEXT_PUBLIC_SITE_URL=https://luckplatform.co.kr`로 갱신 → 재배포. 로컬 `.env.local`은
계속 `http://localhost:3000` 유지(변경 대상 아님).

## 10. getSiteUrl() 검증 계획

Phase10-10에서 만든 `lib/utils/env.ts`의 `getSiteUrl()`은 Vercel 배포 환경에서 값이
https이고 localhost가 아님을 이미 강제한다 — `https://luckplatform.co.kr`은 이 조건을
그대로 만족하므로 추가 코드 수정 없이 정상 통과할 것으로 확인된다(단위테스트로 이미
검증된 로직, §14 참조).

## 11~14. canonical / sitemap / robots / OG — PENDING

도메인 연결 전이라 검증하지 않았다. `app/layout.tsx`(metadataBase), `app/sitemap.ts`,
`app/robots.ts`, 각 페이지의 breadcrumb JSON-LD가 전부 `getSiteUrl()` 하나에서
파생되므로(Phase10-10에서 이미 통일 완료) 도메인 연결 후 재배포만 하면 코드 변경 없이
자동으로 `luckplatform.co.kr` 기준으로 전환된다.

## 15. Final Kakao E2E — PENDING

도메인 연결 + Kakao 콘솔 등록 후 운영자 실제 계정으로 1회 검증 필요(logout → 최종 도메인
`/login` → Kakao → callback → 기존 계정과 동일 UUID → `/fortune`/`/my/journal`/`/admin`).

## 16. Duplicate Auth/Profile — PENDING

위 E2E와 함께 확인 예정.

## 17. Account Withdrawal 회귀 확인

이번 Task에서 `lib/api/account/**`, `app/api/account/**`, `app/my/account/**`를 전혀
수정하지 않았다. §18(아래) 빌드 결과에 두 라우트가 정상 포함되어 컴파일 레벨 회귀가
없음을 재확인했다 — 실제 탈퇴 테스트는 반복하지 않았다.

## 18. Public Contact

Footer/Privacy의 `yeo090110@gmail.com`은 `lib/constants/index.ts`의
`SITE_CONTACT_EMAIL` 상수 기반으로 도메인과 무관하게 항상 동일하게 렌더링된다 — 이번
Task에서 추가 전화번호/주소/사업자번호를 만들지 않았다.

## 19. Lotto Source Health

이번 Task에서 관련 코드(official adapter/lottis/datalotto/consensus)를 전혀 수정하지
않았다. Phase10-7에서 확인된 상태(공식 소스 Vercel 런타임에서 BLOCKED)가 현재도 유효한
것으로 간주하며, 실제 재확인은 `/admin/draws` source health를 운영자 세션으로 직접
확인해야 한다(Claude는 이번 세션에서 프로덕션 admin 인증 세션이 없음).

## 20. Cron 상태

`PENDING_LIVE_CRON_OBSERVATION` — Vercel Cron 실행 로그는 Vercel 대시보드 접근 권한이
있는 운영자만 확인 가능하다. 이번 Task의 판정과 분리한다.

## 21. Fallback Flag

`LOTTO_SECONDARY_FALLBACK_ENABLED` 값을 이번 Task에서 변경하지 않았다 — OFF 유지.

## 22~23. Search Advisor / Search Console 준비 — PENDING

도메인이 실제로 연결되어야 의미가 있다. 이번 Task에서 계정 로그인/소유확인을 진행하지
않았다.

## 24. Secret Audit

`git status`/`git diff` 기준 이번 Task에서 코드 변경이 없어(§4~§21 전부 조사/계획
단계) 신규 시크릿 노출 위험도 없다. 기존 미커밋 변경분(Phase10-8~10-10)도 이전 Task들
에서 이미 스캔 완료 — 재스캔 결과 0건 유지.

## 25. Tests / Build

| 항목 | 결과 |
|---|---|
| ESLint | 0 errors, 0 warnings |
| TypeScript | 0 errors |
| Vitest | 561/561 passed(변경 없음, 이전 baseline과 동일) |
| `npm run build` | 성공 |

## 26. Production Smoke — PENDING(도메인 연결 후)

## 27. Production Data Safety

이번 Task는 코드/설정 변경이 없어 사용자 데이터에 영향을 줄 수 있는 작업 자체가
없었다. Phase10-9B 종료 시점 스냅샷(profiles=1, admins=1, user_numbers=21, draws=10)이
그대로 유효하다고 간주한다.

## 28. git 상태

Phase10-8~10-10에서 쌓인 미커밋 변경분 그대로이며, 이번 Task(Phase10-11)에서 추가된
코드 변경은 없다(조사·의사결정만 진행). 커밋/푸시하지 않았다.

| Phase | 파일 |
|---|---|
| Phase10-8(Account Withdrawal) | `app/api/account/`, `app/my/account/`, `components/account/`, `lib/api/account/`, `components/auth/ProfileMenu.tsx`, `docs/ACCOUNT_WITHDRAWAL_REPORT.md` |
| Phase10-9/9B(Dream SEO) | `app/dream/**`, `components/dream/**`, `lib/api/dreamSearch.*`, `supabase/migrations/0020_*.sql`, `supabase/migrations/0021_*.sql`, `docs/DREAM_SEO_*.md` |
| Phase10-10(Identity & Domain 준비) | `lib/utils/env.ts`(+test), `lib/constants/index.ts`, `components/layout/Footer.tsx`, `app/privacy/page.tsx`, `app/layout.tsx`, `app/robots.ts`, `app/sitemap.ts`, `lib/auth/kakao.ts`, `app/guide/[topic]/page.tsx`, `docs/PUBLIC_LAUNCH_IDENTITY_DOMAIN_REPORT.md`, `docs/VERCEL_DEPLOYMENT_REHEARSAL_REPORT.md` |
| Phase10-11(이번 Task) | `docs/FINAL_DOMAIN_PUBLIC_LAUNCH_REPORT.md`(신규, 코드 변경 없음) |

## 29. 남은 Launch Blocker

1. **`luckplatform.co.kr` 미구매** — 운영자가 구매해야 다음 단계 진행 가능.
2. 위 1번에 종속: Vercel 연결/DNS, `NEXT_PUBLIC_SITE_URL` 갱신, Kakao Developers 등록,
   최종 canonical/sitemap/robots/OG 검증, 최종 Kakao E2E, Search Console/Naver 서치어드바이저.
3. `PENDING_LIVE_CRON_OBSERVATION`, Lotto 공식 소스 상태 재확인 — 이번 Task와 별도.

## 30. 다음 작업 추천

운영자가 `luckplatform.co.kr`을 구매한 뒤 알려주면, 이 Phase10-11을 이어서: (a) Vercel
프로젝트에 도메인 연결(§8) → (b) `NEXT_PUBLIC_SITE_URL` 갱신·재배포(§9) → (c) Kakao
Developers Console 등록(§7) → (d) canonical/sitemap/robots/OG 전수 검증(§11~14) →
(e) 최종 Kakao E2E(§15~16) → (f) Public Launch Ready 최종 판정까지 진행한다.

---

## TASK REPORT — Final Domain & Public Launch

- Domain Candidates: luckplatform.kr(AVAILABLE), luckplatform.co.kr(AVAILABLE), luckplatform.app(AVAILABLE), luckplatform.com(TAKEN), luckplatform.net(AVAILABLE)
- Recommended Domain: luckplatform.kr(Claude 1순위 추천)
- Selected Domain: luckplatform.co.kr(운영자 최종 선택)
- Domain Owned: NO — WAITING_FOR_DOMAIN_PURCHASE
- Vercel Connected: NO(도메인 미구매로 PENDING)
- HTTPS: PENDING
- Canonical Host: PENDING(현재 임시 Vercel 도메인 `lotto-blue-sigma.vercel.app` 기준 유지)
- WWW Policy: 계획만 확정 — apex(`luckplatform.co.kr`) canonical, `www` → apex redirect(Vercel Domains 설정으로 처리, 코드 변경 불필요)
- NEXT_PUBLIC_SITE_URL: 변경 없음(`https://lotto-blue-sigma.vercel.app` 유지)
- Localhost Remaining: 없음(Phase10-10 `getSiteUrl()` fail-fast 유지)
- Vercel.app Canonical Remaining: 있음(도메인 연결 전까지 임시 도메인이 정상 canonical)
- Sitemap Host: PENDING(도메인 연결 후 자동 반영, 코드 이미 준비됨)
- Robots: PENDING(동일)
- OpenGraph: PENDING(동일)
- Kakao Site Domain: 계산 완료(`https://luckplatform.co.kr`), 등록은 PENDING
- Kakao Redirect URI: 계산 완료(`https://luckplatform.co.kr/api/auth/kakao/callback`), 등록은 PENDING
- Final Kakao E2E: PENDING
- Duplicate Auth/Profile: PENDING
- Account Withdrawal: 회귀 없음(코드 미변경, 빌드에 라우트 정상 포함 확인)
- Contact Email: yeo090110@gmail.com(변경 없음, 도메인과 무관하게 항상 표시)
- Lotto Official Source: BLOCKED(Phase10-7 상태 유지, 이번 Task에서 재확인 못함 — 운영자 세션 필요)
- Secondary Fallback: OFF(변경 없음)
- Cron: PENDING_LIVE_CRON_OBSERVATION
- Search Advisor Ready: NO(도메인 필요)
- Search Console Ready: NO(도메인 필요)
- Tests: 561/561 passed
- Build: success
- Production Smoke: PENDING(도메인 연결 후)
- User Data Changed: NO
- Secret Leak: 0건
- Commit: 하지 않음
- Public Launch Ready: **NO**
- Remaining Launch Blockers: `luckplatform.co.kr` 구매 필요(유일한 실제 블로커, 그 외 전부 구매 즉시 후속 진행 가능하도록 사전 준비 완료)
- 다음 작업: 정확히 1개. **운영자가 `luckplatform.co.kr`을 구매한 뒤 알려주면, Vercel 커스텀 도메인 연결부터 이어서 진행한다.**
