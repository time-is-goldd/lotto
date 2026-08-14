# Phase10-3 — 법적/서비스 안내 공개 페이지 구현 보고서

> DB/API/Migration/RLS를 전혀 수정하지 않았다(전수 확인: `npx supabase migration list` 결과 `0001`~`0015` 변화 없음, 신규 migration 파일 없음). FAQ/Guide 구현(Phase10-1/10-2)을 재건드리지 않았다. synthetic draws 교체·운영 admin 등록·Kakao E2E·배포는 이번 Task 범위가 아니다. 법적 내용은 전부 실제 코드/스키마 조사 결과를 근거로만 작성했고, 확인되지 않는 운영자 정보는 임의로 채우지 않았다.

---

## 1. 실제 문서상 Must Route

`docs/EXECUTION_PLAN.md` Phase10 §3("생성할 파일") + §5(구현순서 1번, "이용약관/개인정보처리방침/서비스소개 작성 — 법적 최소 요건, ROADMAP MVP Must"):

```
app/terms/page.tsx
app/privacy/page.tsx
app/about/page.tsx
```

`docs/ROADMAP.md` §1 Must 표: "이용약관/개인정보처리방침/19세 미만 이용제한 고지 | 법적 최소 요건" — terms/privacy가 명시적 Must다. about은 이 표에 별도 행으로 없지만 EXECUTION_PLAN §3의 구체적 파일 목록에 포함되어 있고, `docs/SITEMAP.md` §1("/notice, /about, /terms, /privacy 기존과 동일")과 §4(about을 P2로 명시)가 이미 실존 route로 다루고 있어 함께 구현했다.

`/company`, `/policy`, `/legal`, `/disclaimer` 등 문서에 없는 route는 만들지 않았다.

---

## 2. 생성/수정 파일

**신규**: `app/terms/page.tsx`, `app/privacy/page.tsx`, `app/about/page.tsx`, `docs/PHASE10_LEGAL_PAGES_REPORT.md`(본 보고서).

**수정**:
- `components/layout/Footer.tsx` — 기존에 비어 있던 `<nav aria-label="정책 및 안내" />`(주석: "이용약관·개인정보처리방침 등 실제 링크는 그 페이지가 생기는 Phase에 채운다")를 실제 3개 링크로 채웠다. Footer의 나머지 구조(레이아웃/스타일)는 그대로 유지.
- `app/sitemap.ts` — `/about`/`/terms`/`/privacy` 3개 정적 URL 추가(§11).

**수정하지 않은 파일**(전수 확인): `app/faq/page.tsx`, `app/guide/[topic]/page.tsx`, `lib/api/content.ts`, `lib/api/admin/content.ts`, `app/api/admin/content/*`, `supabase/migrations/*`, `components/navigation/BottomNavigation.tsx`, `components/navigation/GlobalNav.tsx`, `components/layout/Header.tsx`, `app/layout.tsx`, `app/robots.ts`.

**검증 중 임시로 사용하고 전부 삭제한 것**(흔적 없음): `app/api/jtest/route.ts`, 테스트 Auth 계정 1개(kakaoId 990964001), `admins` 테스트 행 1개.

---

## 3. Terms 구현 여부

**구현했다.** `app/terms/page.tsx`, 9개 섹션(목적/회원가입 및 이용 자격/서비스 제공 및 변경/이용자의 의무/이용자가 남긴 기록/번호 생성·꿈해몽·행운 다이어리 서비스의 성격/서비스 중단 및 이용계약 해지/책임의 제한/약관의 변경). §9에서 근거를 상세히 기록한다.

## 4. Privacy 구현 여부

**구현했다.** `app/privacy/page.tsx`, 9개 섹션(수집 항목/이용 목적/보관 및 삭제/외부 서비스/쿠키·세션/이용자의 권리/19세 미만 이용 제한/문의 방법/정책 변경). §8/§13/§14에서 근거와 한계를 상세히 기록한다.

## 5. About 구현 여부

**구현했다.** `app/about/page.tsx`. 법률 문서가 아니라 서비스 소개이므로 실제 구현된 기능(번호 생성/꿈해몽/행운 다이어리/당첨 확인/FAQ·가이드)만 나열했다. "AI가 예측", "당첨 확률 상승", "검증된 번호" 같은 과장 표현은 사용하지 않았고, 번호 생성이 무작위라는 사실을 그대로 유지해 서술했다.

---

## 6. 실제 서비스 데이터 처리 조사 결과

Privacy 작성 전 실제 코드/schema를 전수 조사했다(추측 없음).

| 영역 | 실제 확인 내용 |
|---|---|
| 인증 | 카카오 OAuth만 실제 로그인 UI로 노출됨(`app/login/page.tsx`에 카카오 버튼만 존재, 이메일/비밀번호 가입 폼 없음). `lib/auth/kakao.ts`는 카카오 기본 동의항목(닉네임·프로필)만 사용하고, Supabase Auth 식별자로 쓰기 위한 합성(non-deliverable) 이메일(`kakao-{id}@users.noreply.luckplatform.local`)을 내부적으로만 생성한다 — 실제 이메일/전화번호를 카카오로부터 수집하지 않는다. |
| profiles | `id`(auth.users 참조), `provider`, `nickname`, `birth_date`(필수), `gender`(선택), `birth_time`(선택), `age_verified`(서버 계산), `marketing_opt_in`, `privacy_public_default`, `best_win_rank_ever`, `status` (`0001_profiles.sql` 원문 확인) |
| 사용자 기능 데이터 | `user_numbers`(생성/저장 번호, 자진 기록 구매여부·구매금액·메모, 당첨 대조 결과), `dream_journal_entries`(개인 꿈 기록, 완전 비공개 RLS), `notifications`(당첨 결과 알림 — `lib/api/notifications.ts` 확인 결과 **사이트 내 알림만 실제 구현**, 이메일/웹푸시는 `notification_deliveries` 테이블만 존재하고 실제 발송 코드 없음) |
| **미구현으로 확인된 기능** | `fortune_results`(운세) 테이블은 존재하지만 `app/fortune/*` 라우트 자체가 없고, `app/my/journal/fortune-history/page.tsx`가 "운세 생성 기능 준비 중" 배지와 함께 조회만 제공 — **현재 실제로 운세 관련 개인정보를 수집하는 코드 경로가 없다.** Privacy에 운세 관련 수집 항목을 넣지 않았다. |
| 쿠키/세션 | Supabase 인증 세션 쿠키(`sb-<ref>-auth-token`, `@supabase/ssr`), 카카오 로그인 CSRF 방지용 임시 쿠키(`kakao_oauth_state`, `lib/auth/kakao.ts`). analytics/광고 SDK는 전체 코드베이스 `grep`(analytics/gtag/GoogleAnalytics/adsbygoogle/facebook/pixel/amplitude/mixpanel/hotjar) 결과 **0건**. |
| 외부 서비스 | `.env.example`/실제 `getEnv()` 호출처 기준 Supabase(Auth+DB), Vercel(호스팅), Kakao(로그인) 3곳뿐. |
| 미처리 항목(확인) | 결제/카드정보, 위치정보, 연락처 업로드, 광고 추적, 마케팅 이메일 발송(코드 없음) — 전부 코드에 존재하지 않음을 확인했다. |
| **회원 탈퇴** | `docs/DATABASE_SCHEMA.md` §7이 "익명화 후 상태 전환(A안)"을 설계로 확정해 두었지만, **실제 코드에는 탈퇴/삭제 API가 전혀 구현되어 있지 않다**(`app/api/profile/route.ts`는 GET/POST/PUT만 존재, DELETE 없음; `withdraw`/`탈퇴`/`익명화` 문자열 전수 검색 결과 실제 기능 코드 0건). Privacy §14에서 "Before Launch Required Information"이 아니라 **정확한 현재 상태**로 정직하게 기술했다(§13 참조). |

---

## 7. 개인정보처리방침 작성 근거

각 섹션은 위 §6 조사 결과에서 1:1로 도출했다 — 추측으로 채운 문장이 없다.

- "수집하는 개인정보 항목"(§1): `0001_profiles.sql`/`0002_draws_user_numbers.sql`/`0004_dream_journal_entries.sql` 원문 컬럼과 `lib/auth/kakao.ts`의 실제 동의항목 범위를 그대로 반영.
- "제3자 제공 및 처리위탁"(§4): `.env.example`과 실제 `getEnv()` 사용처 3곳(Supabase/Vercel/Kakao)만 나열, 그 외 "제공하지 않는다"고 단정한 것은 코드 전수 검색으로 확인된 사실이다.
- "쿠키"(§5): 실제 쿠키 2종(세션/카카오 CSRF)만 명시, analytics 쿠키는 코드 부재를 근거로 "사용하지 않는다"고 명시했다(추측이 아니라 grep 결과).
- "보관 및 삭제"(§3), "이용자의 권리"(§6): 탈퇴/삭제 기능이 실제로 없다는 사실을 그대로 서술하고, 요청은 "문의 방법"(§8)으로 안내하도록 연결했다 — 존재하지 않는 자동 삭제/보관기간을 확정적으로 서술하지 않았다(지시문 §13 원칙).

## 8. 이용약관 작성 근거

- "회원가입 및 이용 자격": `lib/constants/index.ts`의 `PROFILE_MIN_AGE`(19)를 그대로 재사용해 코드와 문서 값이 어긋나지 않게 했다.
- "이용자가 남긴 기록": `dream_journal_entries`가 RLS로 완전 비공개(`auth.uid() = user_id`)임을 실제 정책(`0008_rls_policies.sql`)에서 재확인해 반영했다.
- 현재 코드에 없는 기능(커뮤니티, 결제, 배틀 등)은 약관에 넣지 않았다.

## 9. 로또 관련 면책 표현

`/terms` §6("번호 생성·꿈해몽·행운 다이어리 서비스의 성격")에 지시문 §6이 요구한 4개 핵심 의미를 전부 담았다:
1. 생성 번호는 무작위이며 당첨 보장 없음
2. 꿈해몽/추천번호/통계는 참고·오락 목적, 예측 정확성 보장 없음
3. 실제 구매/결과는 이용자 판단, 공식 결과는 복권 발행 기관 기준
4. 서비스는 복권 판매자가 아니며 공식 사업자와 무관

`/about`에는 같은 문구를 반복하지 않고 한 문장으로 요약한 뒤 `/terms`로 링크해 지시문의 "과도한 반복 금지" 원칙을 지켰다.

---

## 10. Metadata

세 페이지 모두 `title`/`description`/`alternates.canonical`/`openGraph`(siteName/locale 재지정 포함)/`twitter`를 정적 `export const metadata`로 구현했다(콘텐츠가 DB에 의존하지 않아 `app/faq/page.tsx`와 동일하게 `generateMetadata()`가 아닌 정적 객체로 충분). 실측(§15) 결과 `og:site_name`(`Luck Platform`)/`og:locale`(`ko_KR`)이 세 페이지 전부에서 정상 존재함을 확인해 Phase8-2의 회귀를 재발시키지 않았다.

## 11. Sitemap

`docs/SITEMAP.md` §1이 `/about`/`/terms`/`/privacy`를 "`/notice, /about, /terms, /privacy` 기존과 동일"로 한 그룹으로 묶고, §4가 그중 `/about`을 P2(공개 색인)로 명시한다. `/terms`/`/privacy`는 P0~P3 표에 개별 항목이 없지만, `/admin/*`·`/my/*`처럼 noindex 근거가 되는 어떤 문서 표기도 없어(전수 확인) 기본 색인 정책(`app/layout.tsx` robots 기본값 `index: true, follow: true`)을 그대로 따르는 공개 페이지로 판단해 셋 다 sitemap에 포함했다. `/notice`는 이번 Task 구현 대상이 아니라 제외했다.

`app/sitemap.ts`의 기존 `dream`/`category`/`faq`/`guide` 생성 로직은 재설계하지 않고 `staticEntries` 배열에 3개 항목만 추가했다.

---

## 12. Footer 연결

기존 `Footer.tsx`에 이미 "이용약관·개인정보처리방침 등 실제 링크는 그 페이지가 생기는 Phase에 채운다"는 주석과 함께 비어 있던 `<nav aria-label="정책 및 안내" />`가 있었다 — 그 자리를 실제 3개 링크(서비스 소개/이용약관/개인정보처리방침)로 채웠다. Footer의 레이아웃/스타일 자체는 재디자인하지 않았다. `BottomNavigation`/`GlobalNav`/`Header`는 문서 근거가 없어 수정하지 않았다(§14 회귀 검증에서 무변화 확인).

---

## 13. 운영자 정보 누락 여부

**누락 확인됨.** 저장소 전체(`README.md`, `package.json`, `.env.example`, `docs/*.md`)를 `사업자등록|대표자|법인명|회사명|contact@|support@` 등으로 전수 검색한 결과, 실제 운영자 성명/법인명/주소/전화번호/개인 이메일은 어디에도 존재하지 않는다. 유일하게 관련된 언급은 `docs/CRITICAL_REVIEW.md:178`("사업자정보(상호/대표자/사업자등록번호/통신판매신고번호) 표기 필수")로, 이는 이 프로젝트 스스로가 이미 "필요하다"고 인지만 해 둔 미해결 체크리스트 항목이다.

이번 구현에서는 `홍길동`/`example@email.com`/`TODO`/`추후 입력` 같은 가짜·placeholder 값을 화면에 노출하지 않았다 — `/privacy` "8. 문의 방법" 섹션은 "현재 서비스는 별도의 고객센터·문의 채널을 아직 마련하지 못했습니다. 문의 채널은 준비되는 대로 이 페이지를 통해 안내할 예정입니다."라는, 사실에 부합하는 문장으로 대체했다.

---

## 14. Before Launch Required Information

배포 전 실제 운영자가 직접 입력해야 하는 항목(가짜 값으로 대체 불가):

1. **개인정보 관련 문의 연락처**(이메일 또는 문의 채널) — `/privacy` "8. 문의 방법", "6. 이용자의 권리"(열람·정정·삭제 요청 접수처)에 필요.
2. **사업자 정보**(상호/대표자명/사업자등록번호/통신판매신고번호, 실제 사업자로 운영할 경우) — `docs/CRITICAL_REVIEW.md:178`이 이미 필요성을 기록해 둔 항목. 1인 비사업자 운영으로 시작한다면 이 항목 자체가 불필요할 수 있으나, 그 여부도 운영자의 결정이 필요하다.
3. **회원 탈퇴/개인정보 삭제 절차의 실제 구현 여부 결정** — 현재 코드에 탈퇴 기능이 없다(§6). Privacy에는 이 사실을 정직하게 반영해 뒀지만, 실제 서비스 운영 시작 전에 (a) 탈퇴 기능을 실제로 구현하거나 (b) 수동 처리 절차와 그 접수 채널을 확정해야 한다 — 둘 다 코드/정책 결정이 필요해 이번 Task 범위(페이지 구현)를 넘어선다.

이 3가지는 페이지 코드 구조가 아니라 **운영자가 결정·제공해야 하는 정보/정책**이므로, 이번 Task에서 임의로 확정하지 않았다.

---

## 15. 실제 HTTP 검증

`npm run dev` + 실제 원격 Supabase 프로젝트 기준(관리자 회귀 확인용 테스트 계정 1개, Phase2 이래 반복 사용해 온 `establishKakaoSupabaseSession()` + 임시 `app/api/jtest/route.ts` 패턴, 검증 종료 즉시 삭제).

| 페이지 | HTTP | H1 | title | description | canonical | OG(site_name/locale 포함) | Twitter | robots |
|---|---|---|---|---|---|---|---|---|
| `/about` | `200` | "서비스 소개" | "서비스 소개 \| Luck Platform" | 정상 | `/about` | 전부 존재 | 전부 존재 | `index, follow` |
| `/terms` | `200` | "이용약관" | "이용약관 \| Luck Platform" | 정상 | `/terms` | 전부 존재 | 전부 존재 | `index, follow` |
| `/privacy` | `200` | "개인정보처리방침" | "개인정보처리방침 \| Luck Platform" | 정상 | `/privacy` | 전부 존재 | 전부 존재 | `index, follow` |

세 페이지 모두 본문 섹션(terms/privacy 각 9개 `<h2>`, about 2개 섹션)이 실제 HTML에 그대로 존재함을 확인했다. Footer 링크(`href="/about"`, `href="/terms"`, `href="/privacy"`)가 홈페이지(`/`)에 정확히 1회씩 존재하고 각 링크가 가리키는 페이지가 전부 `200`임을 확인했다. `application/ld+json` WebSite JSON-LD가 세 페이지 모두 존재(`app/layout.tsx` 무수정, 전역 상속 확인).

## 16. 접근성

- `<h1>` 정확히 1개(페이지당) 확인.
- section heading 순서: `<h2>`가 1→9(terms/privacy)/1→2(about) 순서로 문서 순서와 일치, `aria-labelledby`로 각 `<section>`과 연결.
- 링크 텍스트는 "이용약관"/"개인정보처리방침"처럼 목적지를 명확히 설명(모호한 "여기" 등 사용 안 함).
- 별도 키보드 트랩 없는 순수 텍스트/링크 구성이라 키보드 접근에 문제 없음(새 interactive 위젯 없음).
- 텍스트 대비는 기존 디자인 토큰(`text-text-primary`/`text-text-secondary`, `docs/DESIGN_SYSTEM.md` §1 WCAG AA 대비 검증된 값)만 재사용해 새 대비 문제를 만들지 않았다.
- 본문에 `max-w-[720px]`를 적용해(terms/privacy) 긴 텍스트의 한 줄 길이를 읽기 좋은 폭으로 제한했다 — Container의 기존 최대 폭(1200px, 여러 컬럼 레이아웃용)과는 별개로 prose 전용 폭만 좁혔다.
- 불필요한 애니메이션 없음(전부 정적 Server Component, `'use client'` 없음).

## 17. 기존 기능 회귀

| 대상 | 결과 |
|---|---|
| `/`, `/faq`, `/guide/nonexistent-topic`(현재 guide 0건이라 404), `/dream`, `/dream/돼지꿈`, `/generate`, `/my/journal` | 전부 예상대로(`200`/`200`/`404`/`200`/`200`/`200`/`200`) |
| `/admin`, `/admin/faq`, `/admin/guides`(관리자 세션) | 전부 `200` |
| `/robots.txt`, `/sitemap.xml` | 전부 `200` |
| `/dream/돼지꿈` JSON-LD 개수 | `4`(기존과 동일 — WebSite+BreadcrumbList, RSC 하이드레이션 payload echo 포함 기존 관찰과 일치), canonical 무변화 |
| `/faq` JSON-LD | `2`(WebSite만, `content_entries` 0건이라 FAQPage 미출력 — Phase10-2 규칙 그대로 유지) |

**회귀 없음.**

---

## 18. lint/type-check/test/build

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과, 경고 0건 |
| `npm run type-check` | 통과 |
| `npm test` | **18 test files, 277 tests 전부 통과**(baseline과 동일 — 정적 법적 페이지는 Phase8/10-2와 동일하게 실제 HTTP 검증으로 대체, 신규 테스트 0건) |
| `npm run build` | 통과, **38개 라우트**(baseline 35 + `/about` + `/terms` + `/privacy`), 전부 `ƒ`(기존 사이트 전역 Header 쿠키 의존 특성, Phase10-2가 이미 기록한 것과 동일한 이유) |
| 클라이언트 번들 `service_role` 검사 | 0건 |
| `npx supabase migration list` | `0001`~`0015` 무변화, 신규 migration 없음(이번 Task 범위 준수) |

---

## 19. 발견된 문제

새로 발견된 Critical/High 결함은 없다. 기록할 사항:

- **작성 중 발견/즉시 수정한 오타**: `/about` 설명 문구에 조사 오류("Luck Platform가" → "Luck Platform이")와 `/privacy` 외부 서비스 목록에 문자 깨짐("웹サービス" → "웹 서비스")이 초안 작성 중 발생했으나, 실제 HTTP 검증 전 발견 즉시 수정하고 재검증했다(§15 결과는 수정 후 기준).
- **회원 탈퇴 기능 부재**(§6/§14) — 코드 결함이 아니라 애초에 구현되지 않은 기능이다. Privacy 페이지에 이 사실을 정직하게 반영했고, 배포 전 운영자의 정책/구현 결정이 필요한 항목으로 §14에 기록했다.
- **운영자 정보 부재**(§13/§14) — 코드 결함이 아니라 실제 운영자만 제공할 수 있는 정보의 부재다.

---

## 20. Phase10-3 최종 판정

### PASS

Critical/High 결함 없음. EXECUTION_PLAN/ROADMAP/SITEMAP이 확정한 Must route 3개(terms/privacy/about)를 전부 구현했고, 실제 코드/스키마 조사에 기반한 내용만 작성했으며 가짜 운영자 정보나 보장성 문구를 넣지 않았다. Metadata/OG/Twitter/sitemap/Footer 연결까지 실측 검증했고 기존 기능(FAQ/Guide/Dream/관리자/SEO) 회귀가 없다. 다만 §14에 정리한 3가지 정보/정책은 실제 배포 전 운영자가 별도로 결정·제공해야 하므로, "코드 구현"과 "실제 법적 완결성"은 구분해서 판단해야 한다(§20 하단 명시).

**"법적으로 완벽하게 준수한다"고 보장하지 않는다** — 이 판정은 "지시문이 요구한 범위(문서 근거 기반 페이지 구현)를 완료했다"는 뜻이며, 실제 법적 유효성은 §14 정보가 채워지고 필요 시 전문가 검토를 거친 뒤에 판단할 사안이다.

---

## 21. Phase10-4 착수 가능 여부

**READY(조건부).** 코드 관점에서는 `docs/PHASE10_RELEASE_GATE.md` §14의 다음 단계(production 데이터/운영 준비)로 진행 가능하다. 다만 그 단계에서 실제 배포를 준비하려면 §14의 3가지(문의 채널/사업자 정보/탈퇴 정책)에 대한 운영자 결정이 최종 배포 전 필요하다는 점을 인지해야 한다 — 이 결정이 Phase10-4 착수 자체를 막지는 않는다(synthetic draws 교체, 운영 admin 등록 등은 이 정보와 독립적으로 진행 가능).

---

## 22. 다음 작업 추천

`docs/PHASE10_RELEASE_GATE.md` §14 순서상 다음은 **Production 데이터/운영 준비**(synthetic draws를 실제 최근 회차로 교체 + 운영 관리자 1명 등록)다. 코드 작업이 아니라 데이터/운영 작업이며, 이번 Task가 완성한 법적 페이지와 독립적으로 진행할 수 있다.

---

## TASK REPORT — Phase10-3

- **Required Routes**: `/terms`, `/privacy`, `/about` (EXECUTION_PLAN §3 + ROADMAP §1 Must 확인, `/company`·`/policy`·`/legal`·`/disclaimer` 등 문서 외 route 미생성)
- **Terms**: PASS
- **Privacy**: PASS
- **About**: PASS
- **Footer**: PASS (기존 placeholder nav에 3개 링크 연결, 레이아웃 무변경)
- **Metadata**: PASS (title/description/canonical/OG including site_name·locale/Twitter 전부 확인, Phase8-2 회귀 없음)
- **Sitemap**: PASS
- **Final Sitemap Count**: 39 (baseline 36 + `/about`/`/terms`/`/privacy` 3)
- **Operator Information Missing**: YES (성명/법인명/주소/전화번호/이메일 전부 저장소에 부재, §13)
- **Before Launch Required Information**: 문의 연락처, 사업자 정보(해당 시), 탈퇴/삭제 절차의 실제 구현 또는 수동 처리 정책(§14, 정확히 3개)
- **Security/Privacy Claims Verified**: YES (수집 항목/제3자/쿠키 관련 서술 전부 실제 코드·schema 대조 확인, 보장성 문구·근거 없는 확정 문구 없음)
- **Regression**: PASS
- **Tests**: PASS (277/277, 신규 없음)
- **Build**: PASS (38 routes)
- **Phase10-3**: PASS
- **Phase10-4 Ready**: YES
- **다음 작업**: Production 데이터/운영 준비(synthetic draws 교체 + 운영 관리자 등록) 1개
