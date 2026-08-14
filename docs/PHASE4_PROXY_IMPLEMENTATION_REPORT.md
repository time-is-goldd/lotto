# PHASE4 PROXY OPTION B IMPLEMENTATION REPORT

> `docs/PHASE4_ARCHITECTURE_DECISION.md` §3(Option B)을 실제 코드에 반영한 결과다. `proxy.ts` **1개 파일만** 수정했다. DB/RLS/API/`lib/auth/*`/`lib/api/*`/`app/page.tsx`/`app/my/*`/컴포넌트/OAuth/온보딩/DESIGN_SYSTEM.md는 전혀 건드리지 않았다.

---

## 1. 목표

`/my/journal`(다이어리 허브) 및 그 하위 경로에 한해 `proxy.ts`의 즉시 로그인 리다이렉트를 예외 처리해, 향후 페이지 자체가 비로그인 사용자에게 가치설명 화면을 보여줄 수 있는 통로를 연다. 그 외 `/my/*`는 기존 보호를 그대로 유지한다.

---

## 2. 기존 정책 (재확인)

착수 전 `proxy.ts` 원문을 다시 읽고 `docs/PHASE3_PROXY_ROUTE_FIX_REPORT.md`(지시문이 언급한 "PHASE4_PROXY_ROUTE_FIX_REPORT.md"라는 파일은 실제로 존재하지 않아, 실제 파일명인 이 문서로 대체 확인했다)와 대조했다.

- `PROTECTED_PATHS = ["/onboarding", "/my"]`, `matchesPath()`는 정확히 일치 또는 `경로/` 하위 전체를 매칭.
- `config.matcher = ["/onboarding/:path*", "/my/:path*", "/login"]`.
- `getCurrentUser()`(anon 세션 재검증)로 로그인 여부만 확인, `hasProfile()`(anon 클라이언트로 `profiles` 직접 조회, service_role 미사용)로 profile 존재 여부만 별도 확인.
- 비로그인 + 보호 경로 → `loginUrl.searchParams.set("next", pathname)` 후 `/login?next=<경로>`로 307.
- **충돌 지점**: `/my`로 시작하는 모든 경로가 예외 없이 위 리다이렉트 대상이었다 — `docs/PHASE4_ARCHITECTURE_DECISION.md` §3이 요구하는 "다이어리 허브만 공개 진입" 요구와 정확히 여기서 어긋났다(이전 감사에서 이미 확인한 지점, 이번 Task 착수 전 재확인만 함).

---

## 3. 변경 정책

| 경로 | 변경 전 | 변경 후 |
|---|---|---|
| `/my/journal` | 비로그인 → `/login?next=%2Fmy%2Fjournal` | **비로그인도 통과**(proxy가 아무 검사 없이 바로 다음 단계로 넘김) |
| `/my/journal/*`(history, dreams, results, calendar, fortune-history 등 전부) | 비로그인 → `/login?next=...` | **비로그인도 통과** |
| `/my/profile`, `/my/notifications`, `/my/<그 외 전부>` | 비로그인 → `/login?next=...` | **변경 없음** — 그대로 즉시 리다이렉트 |
| `/onboarding`, `/login` | 기존 로직 | **변경 없음** |

---

## 4. 변경 파일

`proxy.ts` 1개. (`git status`/`git diff`로 재확인 — §9)

---

## 5. 구현 상세

기존 `PROTECTED_PATHS` 배열과 매칭 로직 구조는 그대로 두고, "공개 예외" 목록을 별도 상수로 명시적으로 분리해 추가했다 — 문자열 하드코딩이나 조건문 분기 남발 대신, 향후 예외 경로가 늘어나도 이 배열에 한 줄만 추가하면 되도록 구조를 통일했다.

```ts
const PROTECTED_PATHS = ["/onboarding", "/my"];
const LOGIN_PATH = "/login";

// docs/PHASE4_ARCHITECTURE_DECISION.md §3 Option B: ...(주석 전문은 실제 코드 참조)
const PUBLIC_EXCEPTIONS = ["/my/journal"];
```

```ts
const isProtected =
  PROTECTED_PATHS.some((path) => matchesPath(pathname, path)) &&
  !PUBLIC_EXCEPTIONS.some((path) => matchesPath(pathname, path));
```

- `matchesPath()` 자체는 수정하지 않았다 — 기존 함수를 `PUBLIC_EXCEPTIONS` 판정에도 그대로 재사용해 "정확히 일치 또는 하위 경로" 판정 기준을 두 목록이 항상 동일하게 유지하도록 했다.
- `config.matcher`는 **변경하지 않았다** — `/my/:path*`가 이미 `/my/journal`을 포함하므로 proxy 함수 자체는 여전히 이 경로에서 실행된다. 다만 내부에서 `isProtected`가 `false`가 되어 `if (!isProtected && !isLoginPage) return NextResponse.next();`(가장 첫 분기)에서 즉시 통과한다 — `getCurrentUser()` 호출조차 일어나지 않는다.
- `hasProfile()`, `/login`·`/onboarding` 리다이렉트 로직, `next` 파라미터 생성 로직은 **한 글자도 수정하지 않았다.**

---

## 6. Security Considerations

**"proxy 공개 허용 ≠ 데이터 접근 허용"을 명확히 구분한다.**

- 이번 변경은 `/my/journal*`에 대해 **"페이지 진입"을 막지 않을 뿐**이다. proxy는 이 경로에 대해 이제 아무 검사도 하지 않으므로(로그인 여부조차 확인하지 않음), 실제로 개인 데이터를 보여줄지 말지는 전적으로 **그 페이지 자신의 서버 코드**(Phase4-1/4-2에서 구현 예정)가 `getCurrentUser()`를 다시 호출해 판단해야 한다 — 이번 Task는 그 페이지 로직을 만들지 않았다(범위 밖).
- 설령 향후 그 페이지 코드가 실수로 로그인 확인을 빠뜨리고 `user_numbers`/`dream_journal_entries`를 조회하더라도, `0008_rls_policies.sql`의 RLS(`auth.uid() = user_id`)가 `anon` 역할에는 애초에 그 정책을 부여하지 않아 행 자체가 반환되지 않는다 — proxy의 공개 허용과 RLS의 데이터 격리는 **완전히 독립된 두 개의 방어선**이며, 이번 변경은 그중 첫 번째(진입 게이트)만 조정했을 뿐 두 번째(데이터 격리)는 전혀 건드리지 않았다.
- 이번 Task에서 `service_role`을 사용하는 코드를 추가하지 않았다(`proxy.ts` 전체에서 여전히 `service_role` 미사용, grep으로 재확인). 데이터 조회 코드 자체도 추가하지 않았다.
- `/my/profile`, `/my/notifications` 등 나머지 `/my/*`는 이번 변경으로 전혀 영향받지 않는다 — §7 Test Matrix에서 실측 확인.
- `next` 파라미터: `/my/journal*`는 이제 리다이렉트 자체가 발생하지 않으므로 `next` 값도 설정되지 않는다(설계상 당연한 결과). 나머지 보호 경로의 `next` 생성 로직은 손대지 않았다.

---

## 7. Test Matrix

실제 Supabase 프로젝트를 대상으로(카카오 API는 호출하지 않고 `establishKakaoSupabaseSession()`으로 세션만 발급하는 임시 Route Handler `app/api/dev-test-login/route.ts` 사용, 검증 후 즉시 삭제 — §10 참조) 실측했다.

| 상태 | `/my/journal` | `/my/profile` | `/my/notifications` |
|---|---|---|---|
| 비로그인 | `404`(**proxy 통과, 페이지 미구현이라 404** — 리다이렉트 아님, `Location` 헤더 없음 확인) | `307 → /login?next=%2Fmy%2Fprofile` | `307 → /login?next=%2Fmy%2Fnotifications` |
| 로그인+profile 없음 | `404`(상동, 여전히 리다이렉트 없이 통과) | `404`(proxy 통과 — 기존 정책과 동일, `PHASE3_PROXY_ROUTE_FIX_REPORT.md` §5의 "profile 없는 사용자 → /my/profile: 프록시 통과, 404" 그대로 재현) | (동일 패턴, 별도 표기 생략) |
| 로그인+profile 있음 | `404`(상동) | `404`(proxy 통과, 기존과 동일) | (동일 패턴) |
| 로그아웃 | `404`(상동 — 로그아웃 여부와 무관하게 항상 통과) | `307 → /login?next=%2Fmy%2Fprofile`(보호 즉시 재개, 실측 확인) | (동일 패턴 확인) |

추가로 `/my/journal/history`, `/my/journal/dreams`(`/my/journal/*` 대표 샘플)도 비로그인 상태에서 `/my/journal`과 동일하게 `404`(리다이렉트 없음)임을 확인했다 — 접두사 매칭이 하위 경로 전체에 일관 적용됨을 실측으로 검증.

`/my/anything-else`(존재하지 않는 임의 `/my/*` 경로)는 비로그인 시 `307 → /login?next=%2Fmy%2Fanything-else`로, `PUBLIC_EXCEPTIONS`에 없는 `/my/*`는 여전히 보호됨을 확인했다.

**"route 없음 404" vs "proxy redirect" 구분**: 위 표의 모든 `404` 응답은 `curl -D -`로 응답 헤더를 직접 확인해 `Location` 헤더가 전혀 없는 순수 Next.js 404(라우트 미존재)임을 검증했다 — proxy가 리다이렉트를 발생시킨 적이 없다. `307` 응답은 전부 `Location: /login?next=...` 헤더를 동반하는 실제 proxy 리다이렉트다.

---

## 8. Regression Test

| 구분 | 경로 | 결과 |
|---|---|---|
| 공개 | `/` | `200` |
| 공개 | `/login` | `200` |
| 공개 | `/ui-preview` | `200` |
| 인증 | `/onboarding`(비로그인) | `307 → /login?next=%2Fonboarding` |
| 인증 | `/onboarding`(로그인+profile 있음) | `307 → /`(기존과 동일) |
| 인증 | `/login`(로그인+profile 있음) | `307 → /`(기존과 동일) |

전부 이전 보고서(`PHASE3_PROXY_ROUTE_FIX_REPORT.md`, `PHASE2_COMPLETION_REPORT.md`)가 기록한 동작과 동일함을 재확인했다 — 회귀 없음.

---

## 9. Validation

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 16개 테스트 통과(변경 없음 — `proxy.ts` 전용 테스트 파일은 이 프로젝트에 존재하지 않으며, 이번 Task도 신규로 만들지 않았다. 기존 16개는 `lib/auth/*`/`lib/utils/*` 단위 테스트로 `proxy.ts`와 무관) |
| `npm run build` | 통과. 라우트 목록 변경 없음(`/`, `/login`, `/onboarding`, `/ui-preview`, API 4개, `_not-found`) |
| `git status`(허용 파일 외 변경 확인) | `proxy.ts` 1개만 수정됨. 검증용 임시 파일(`app/api/dev-test-login/route.ts`, cleanup 스크립트)은 작업 종료 전 전부 삭제해 `git status`에 남지 않음 |
| `git diff -- proxy.ts` | 이번 세션 전체가 아직 커밋되지 않은 상태라 diff에는 Phase2~Phase3-0의 기존 구현분까지 함께 표시된다. 이번 Task에서 실제로 추가한 것은 `PUBLIC_EXCEPTIONS` 상수 선언(주석 포함)과 `isProtected` 계산식에 `&& !PUBLIC_EXCEPTIONS.some(...)` 조건 추가, 이 두 지점뿐이다 |

---

## 10. 발견된 문제

- 지시문이 언급한 `docs/PHASE4_PROXY_ROUTE_FIX_REPORT.md`는 실제로 존재하지 않는다 — 실제 파일명은 `docs/PHASE3_PROXY_ROUTE_FIX_REPORT.md`다(§2에서 이미 대체 확인). 문서를 수정하지는 않았다.
- 검증 중 curl로 한글 문자열(닉네임, profile 생성 body)을 전달할 때 로컬 Windows/Git Bash 환경의 로케일 인코딩 문제로 터미널에 표시되는 한글이 깨지는 현상을 다시 확인했다(이전 Task에서도 동일 현상 발생) — 이는 이 검증 스크립트/터미널 환경의 인코딩 문제이며 애플리케이션 코드의 결함이 아니다. profile 생성 자체는 `201`로 정상 처리됨을 상태 코드로 확인했다.
- 테스트 계정(`kakao-999999902@users.noreply.luckplatform.local`)과 그 profile은 검증 직후 `auth.users`/`profiles` 양쪽 모두 service_role REST 호출로 완전히 삭제했다(`profiles 삭제 status: 204`, `auth.users 삭제 status: 200` 확인). 민감정보(실제 카카오 계정 정보 등)는 애초에 다루지 않았다 — 합성 이메일과 테스트용 닉네임만 사용했다.
- 그 외 새로 발견된 코드 결함은 없다.

---

## 11. Phase4-1 Ready 여부

**Ready.** `docs/PHASE4_ARCHITECTURE_DECISION.md` §3 Option B가 실제 코드로 반영되었고, `/my/journal*`의 공개 진입과 나머지 `/my/*`의 기존 보호가 실제 Supabase 프로젝트 대상 실측으로 모두 검증되었다. lint/type-check/test/build 전부 통과, 허용된 파일(`proxy.ts`) 외 변경 없음, 테스트 계정/임시 파일 전량 삭제 확인. Phase4-1(Diary Read Service / API Contract 구현)로 바로 진행 가능하다.
