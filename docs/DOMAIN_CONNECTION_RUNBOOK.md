# Domain Connection Runbook — luckplatform.co.kr

Phase10-11A. `luckplatform.co.kr` 구매 완료 후 운영자가 그대로 따라 실행할 순서다.
DNS 레코드의 실제 값(A/CNAME/TXT 등)은 Vercel이 "Add Domain" 시점에 그때그때
생성해주므로 여기서는 하드코딩하지 않는다 — **Vercel이 그 시점에 보여주는 값이
유일한 source of truth**다.

## 전제

- Target domain: `luckplatform.co.kr` (apex를 canonical로 사용, §4 참조)
- 현재 Production은 `https://lotto-blue-sigma.vercel.app`(Vercel 기본 도메인)로 정상
  운영 중이며, 아래 절차를 시작하기 전까지 이 상태를 유지한다.
- 이 런북의 어떤 단계도 **도메인을 실제로 구매한 뒤에만** 실행한다.

## 현재 상태 — 임시 프로덕션 URL 확정(claude-code-luck-platform-fortune-domain-followup-prompt.md)

도메인 구매 전까지는 `https://lotto-blue-sigma.vercel.app`이 실제 공개 URL이다.
`NEXT_PUBLIC_SITE_URL`(Vercel Production 환경변수)이 정확히 이 값으로 설정되어 있는지
확인한다 — canonical/OG/JSON-LD/robots/sitemap이 전부 `lib/utils/env.ts`의
`getSiteUrl()` 하나에서 파생되므로(코드 변경 없음), 이 환경변수 값만 맞으면 나머지는
자동으로 맞다. 최종 도메인을 구매하면 아래 8단계에서 이 값 하나만 `luckplatform.co.kr`로
바꾸면 된다 — 지금은 그 단계를 실행하지 않는다.

## 순서 (반드시 이 순서대로 — §14 근거)

**Domain purchase → Vercel domain/DNS → HTTPS 정상 확인 → Kakao Console 등록 →
`NEXT_PUBLIC_SITE_URL` 갱신 → redeploy → 최종 E2E**

이 순서인 이유: `NEXT_PUBLIC_SITE_URL`을 가장 마지막에 바꾸는 것이 안전하다 — 그
값이 바뀌는 순간부터 sitemap/canonical/Kakao redirect가 전부 새 도메인을 가리키기
시작하므로, 새 도메인의 HTTPS와 Kakao 등록이 먼저 실제로 동작하는 상태여야
전환 순간에 로그인이 끊기지 않는다. DNS→HTTPS가 먼저 끝나야 Kakao 콘솔 등록도
의미가 있고, Kakao 등록이 끝나야 `NEXT_PUBLIC_SITE_URL`을 바꿔도 로그인이 안 깨진다.

### 1단계 — 도메인 구매

registrar는 운영자가 자유롭게 선택(강제하지 않음). `.co.kr`은 국내 등록대행사
(가비아/후이즈/카페24 등) 대부분에서 취급한다.

### 2단계 — Vercel에 도메인 추가

Vercel Dashboard → 해당 프로젝트 → Settings → Domains → `luckplatform.co.kr` 입력
후 Add. 이어서 `www.luckplatform.co.kr`도 동일하게 추가한다(§4 www 정책).

또는 CLI로:

```bash
vercel domains add luckplatform.co.kr
vercel domains add www.luckplatform.co.kr
```

(CLI는 Vercel 로그인 세션이 필요하다 — 이 세션에는 그 권한이 없어 실제 실행은
운영자가 해야 한다.)

### 3단계 — DNS 레코드 등록

Vercel이 도메인 추가 시점에 **A 레코드(apex용) 또는 네임서버 위임** 중 하나를
제시한다(Vercel의 최신 정책에 따라 달라질 수 있음). 등록대행사 DNS 관리 화면에서
Vercel이 보여주는 값을 그대로 입력한다 — 이 런북에 미리 적어둔 값을 쓰지 않는다.
`www` 서브도메인은 보통 CNAME으로 안내된다.

### 4단계 — Verification 대기 및 확인

DNS 전파는 수 분~수 시간 걸릴 수 있다. Vercel Domains 화면에서 두 도메인 모두
"Valid Configuration"으로 표시되는지 확인한다.

### 5단계 — www 정책 적용

Vercel Domains에서 `www.luckplatform.co.kr` 항목의 **"Redirect to"** 옵션을
`luckplatform.co.kr`(apex)로 설정한다 — apex가 canonical, www는 apex로 308/301
리다이렉트(§9). 애플리케이션 코드(`next.config.ts`, middleware)에는 별도 redirect
로직을 추가하지 않는다 — Vercel 플랫폼 레벨 설정만으로 충분하다.

### 6단계 — HTTPS 확인

Vercel이 Let's Encrypt 인증서를 자동 발급한다. 브라우저로 `https://luckplatform.co.kr`
접속 시 인증서 오류 없이 로드되는지, `http://luckplatform.co.kr`이 자동으로
`https://`로 리다이렉트되는지 확인한다(둘 다 Vercel 기본 동작).

### 7단계 — Kakao Developers Console 등록

**아직 `NEXT_PUBLIC_SITE_URL`을 바꾸기 전에** 먼저 진행한다(기존 Vercel 기본 도메인
로그인이 이 시점까지 계속 정상 동작해야 하므로, 기존 Redirect URI는 지우지 않고
새 값을 추가만 한다). 정확한 메뉴/값은 `docs/KAKAO_CONSOLE_RUNBOOK.md`(아래 섹션에
동일 내용 포함) 참고:

- 카카오 로그인 → Redirect URI에 `https://luckplatform.co.kr/api/auth/kakao/callback` **추가**(기존 값 유지)
- 플랫폼 → Web → 사이트 도메인에 `https://luckplatform.co.kr` **추가**(기존 값 유지)

### 8단계 — NEXT_PUBLIC_SITE_URL 갱신

Vercel 프로젝트 Settings → Environment Variables → `NEXT_PUBLIC_SITE_URL`을
**Production**과 **Preview** 둘 다 `https://luckplatform.co.kr`로 갱신한다(트레일링
슬래시 없이 — `lib/utils/env.ts`의 `getSiteUrl()`이 이를 강제한다).

### 9단계 — Redeploy

`NEXT_PUBLIC_*` 값은 빌드 타임에 고정되므로 값 변경만으로는 반영되지 않는다 —
Vercel Dashboard에서 최신 배포를 "Redeploy"하거나 새 커밋을 푸시해야 한다. DB
마이그레이션은 필요 없다(migrations 0001~0021 그대로).

### 10단계 — 최종 검증

`docs/DOMAIN_PREPURCHASE_READINESS_REPORT.md`의 "Final Smoke Checklist"와
"Final Kakao E2E Checklist"를 그대로 실행한다.

**sitemap.xml URL 개수를 반드시 확인한다.** `/sitemap.xml`은 `revalidate = 3600`
(ISR)이라 재배포 직후 첫 응답은 이전 배포의 캐시된 스냅샷일 수 있다 — Phase10-11A
사전 점검에서 실측한 결과, 현재 임시 도메인의 sitemap이 **15시간 이상 지난 캐시**를
계속 서빙하고 있었고(`X-Vercel-Cache: HIT`, `Age` 5만초대) URL 개수도 141개로
실제 DB(당시 61 Parent/396 Situation 기준 474개 예상)보다 훨씬 적었다. 재배포 후:

```bash
node scripts/smoke-check.mjs https://luckplatform.co.kr
```

를 실행해 `sitemap.xml: N URLs` 줄의 N이 그 시점 실제 DB의
`dreams`+`dream_situations`+카테고리 수+정적 8과 맞아떨어지는지 확인한다. 맞지 않으면
`/sitemap.xml`을 몇 차례 더 요청해 백그라운드 재생성을 유도하거나, 급하면 Vercel에서
한 번 더 Redeploy한다.

### 11단계 — 전환 완료 후 정리(선택)

새 도메인 로그인이 안정적으로 동작하는 것을 며칠 확인한 뒤, 원한다면 Kakao
콘솔에서 예전 Vercel 기본 도메인 Redirect URI/사이트 도메인을 제거해도 된다
(제거하지 않아도 보안·기능상 문제는 없다 — 운영자 선택 사항).

## www/apex 정책 요약

| 항목 | 값 |
|---|---|
| Canonical | `https://luckplatform.co.kr`(apex, www 없음) |
| www 처리 | `https://www.luckplatform.co.kr` → apex로 redirect(Vercel Domains 설정) |
| 적용 위치 | Vercel 플랫폼 설정만 — 애플리케이션 코드 변경 없음 |

## 참고 — 지금 하드코딩하지 않은 이유

Vercel이 실제로 요구하는 A 레코드 IP나 위임 네임서버 값은 도메인을 추가하는
시점의 Vercel 플랫폼 상태에 따라 달라질 수 있어(운영자가 소유하지 않은 도메인에
대해 값을 미리 추측하면 오히려 잘못된 값을 등록하게 될 위험이 있다), 이 런북은
"Vercel이 보여주는 값을 그대로 쓴다"는 절차만 고정하고 값 자체는 고정하지 않는다.
