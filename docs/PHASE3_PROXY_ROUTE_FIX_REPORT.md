# PHASE3-0 PROXY ROUTE FIX 보고서

> [[PHASE3_UI_ARCHITECTURE_PLAN]] §2.2/§7-1이 발견한 "`proxy.ts` 보호 경로와 [[SITEMAP]] 실제 경로 불일치"를 해소한 결과다. Phase2 인증 Architecture([[PHASE2_AUTH_DECISION]])는 변경하지 않았고, `proxy.ts` 외 파일은 수정하지 않았다.

---

## 1. 발견 원인

[[PHASE2_PROXY_REPORT]](Phase2-6)가 `proxy.ts`의 보호 경로를 `/onboarding`, `/mypage`, `/dream-journal`, `/notifications`로 구현했다. 이 네 경로는 당시 Task 지시문이 문자 그대로 준 이름이었으나, [[SITEMAP]]이 이미 확정해둔 실제 개인화 영역 URL 트리(`/my/profile`, `/my/journal/dreams`, `/my/journal/history`, `/my/notifications` 등, 전부 `/my` 하위)와 전혀 다른 이름이었다. [[PHASE2_PROXY_REPORT]] §5도 이 불일치를 "다음 Phase에서 처리할 사항"으로 이미 남겨뒀고, [[PHASE3_UI_ARCHITECTURE_PLAN]] §2.2가 실제 경로를 다시 대조해 "Phase3가 `/my/*` 하위에 실제 페이지를 만들면 `proxy.ts`가 그 경로를 전혀 보호하지 못하는 상태"임을 확인했다. 즉 지금까지는 `/mypage`/`/dream-journal`/`/notifications`라는 **존재하지 않는 경로**를 보호하고 있었을 뿐, 실제로 만들어질 개인화 페이지는 로그인 없이도 접근 가능한 상태였다(단, 아직 그 페이지들 자체가 없어 실제 데이터 노출 사고는 없었다 — §4 참조).

---

## 2. 수정 파일

`proxy.ts` **1개만** 수정했다. 다른 파일은 전혀 건드리지 않았다(`lib/auth/session.ts`, `lib/auth/profile.ts`, `lib/supabase/server.ts`, `app/api/auth/**` 등 인증 관련 파일 모두 변경 없음 — Phase2 Decision 그대로 유지).

---

## 3. 변경된 matcher

| 항목 | 변경 전 | 변경 후 |
|---|---|---|
| `PROTECTED_PATHS` | `["/onboarding", "/mypage", "/dream-journal", "/notifications"]` | `["/onboarding", "/my"]` |
| `config.matcher` | `["/onboarding/:path*", "/mypage/:path*", "/dream-journal/:path*", "/notifications/:path*", "/login"]` | `["/onboarding/:path*", "/my/:path*", "/login"]` |

**개별 경로를 나열하지 않고 `/my` 접두사 하나로 묶은 이유**: [[PHASE3_UI_ARCHITECTURE_PLAN]] §2.1이 이미 `/my/*` 전체를 하나의 `(protected)` 영역으로 묶기로 결정했고, [[SITEMAP]]에는 `/my/profile`·`/my/notifications`·`/my/journal/{history,results,calendar,dreams,fortune-history,stats,yearly-report}` 등 앞으로 계속 늘어날 하위 경로가 이미 정의되어 있다. 세 개(`/my/profile`, `/my/journal/dreams`, `/my/notifications`)만 나열하면 Phase4~6에서 `/my/journal/history` 같은 새 페이지가 생길 때마다 `proxy.ts`를 또 고쳐야 한다 — 접두사 매칭으로 한 번에 해결해 재발을 막았다.

**옛 별칭 경로(`/mypage`, `/dream-journal`, `/notifications`) 처리 판단**: **완전히 제거했다.** [[SITEMAP]] 어디에도 이 세 경로가 실제 페이지로 정의되어 있지 않고, 현재 코드베이스에도 이 경로에 대응하는 페이지 파일이 없다(직접 확인). 유지할 이유가 없는 죽은 설정이라 판단해 삭제했다([[AI_ENGINEERING_CONSTITUTION]] §3 "사용하지 않는 코드 방치 금지").

`getCurrentUser()` 호출 방식, `hasProfile()`(anon 클라이언트 기반 존재 확인, service_role 미사용), `/login`·`/onboarding` 리다이렉트 로직은 전혀 수정하지 않았다 — matcher 배열 값만 바뀌었다.

---

## 4. 보안 영향 분석

- **변경 전**: `/my/profile`·`/my/journal/dreams`·`/my/notifications`(및 그 하위 경로 전부)가 **어떤 보호도 받지 않는 상태**였다. 다행히 이 경로에 대응하는 실제 페이지가 아직 하나도 구현되어 있지 않아(Phase3~6에서 구현 예정) 실제 데이터 노출로 이어진 사고는 없었다 — 하지만 Phase3 UI 작업이 이 경로에 페이지를 만드는 순간부터는 노출 위험이 실재했을 것이다. 이번 패치가 그 위험을 **사전에** 제거했다.
- **변경 후**: `/my/*` 전체가 비로그인 요청을 `/login?next=<경로>`로 차단한다. 새로 추가되는 `/my/*` 하위 페이지도 별도 조치 없이 자동으로 보호 대상에 포함된다.
- **영향받지 않는 것**: 공개 페이지(`/`, `/dream`, `/fortune` 등)는 matcher에 없어 이번에도 영향 없음. `service_role`은 이번 수정 전후 모두 `proxy.ts`에서 전혀 사용하지 않음(grep 재확인). `/login`·`/onboarding`의 profile 존재 여부 분기 로직도 변경 없음.
- **현재 정책(변경하지 않고 확인만 함)**: `/onboarding`과 `/login`만 "로그인+profile 여부"까지 분기하고, 그 외 `/my/*`는 "로그인 여부만" 확인한다 — 로그인했지만 profile이 없는 사용자가 `/my/profile` 등에 접근하면 (페이지가 구현되면) **차단되지 않고 통과**한다. 이는 [[PHASE2_PROXY_REPORT]]가 원래부터 설계한 범위(`/onboarding` 예외만 명시)와 동일한 정책이며, 이번 Task가 요구한 "인증 Architecture 변경 금지"에 따라 그대로 유지했다 — 필요하다면 향후 별도 승인 Task에서 `/my/*` 전체에도 profile 존재 확인을 추가할지 결정한다.

---

## 5. 검증 결과

실제 Supabase 프로젝트를 대상으로(카카오 API를 호출하지 않고 `establishKakaoSupabaseSession()`으로 세션을 발급하는 임시 검증용 라우트 사용 — 검증 후 라우트/테스트 계정 전량 삭제) 전부 실측했다.

### 1) 비로그인 상태

| 경로 | 결과 |
|---|---|
| `/my/profile` | `307` → `/login?next=%2Fmy%2Fprofile` |
| `/my/journal/dreams` | `307` → `/login?next=%2Fmy%2Fjournal%2Fdreams` |
| `/my/notifications` | `307` → `/login?next=%2Fmy%2Fnotifications` |
| `/my/journal/history`(지시문에 없었지만 향후 경로 패턴 검증용) | `307` → `/login?next=%2Fmy%2Fjournal%2Fhistory` — **접두사 매칭이 아직 만들지 않은 하위 경로까지 미리 보호함을 확인** |
| 옛 별칭(`/mypage`, `/dream-journal`, `/notifications`) | `404`(페이지 자체가 없어서 나는 404 — 더 이상 보호 대상도 아님, 의도된 결과) |

### 2) 로그인 상태

| 시나리오 | 결과 |
|---|---|
| profile 없는 사용자 → `/my/profile` | 프록시 통과(리다이렉트 없음), `404`(페이지 미구현이라 정상) |
| profile 없는 사용자 → `/onboarding` | `200`(정상 통과, 기존 동작 유지) |
| profile 생성 후 → `/my/profile`, `/my/journal/dreams` | 프록시 통과, `404`(페이지 미구현이라 정상) |
| profile 생성 후 → `/onboarding` | `307` → `/`(기존 동작 유지) |
| profile 생성 후 → `/login` | `307` → `/`(기존 동작 유지) |
| 로그아웃 후 → `/my/profile` | `307` → `/login?next=%2Fmy%2Fprofile`(세션 종료가 즉시 새 경로에도 반영됨을 확인) |

### 3) 공개 페이지

| 경로 | 결과 |
|---|---|
| `/` | `200`(변경 없음) |
| `/login` | `200`(비로그인 시 정상 노출, 변경 없음) |
| `/onboarding` | 위 표 참조(기존 동작 유지) |

### 4) 정적 Validation

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 16개 테스트 통과(변경 없음) |
| `npm run build` | 통과. 라우트 목록 변경 없음(검증용 임시 라우트는 삭제되어 빌드 산출물에 없음) |

---

## 6. Phase3 착수 가능 여부

**가능.** [[PHASE3_UI_ARCHITECTURE_PLAN]] §7-1이 "Phase3 착수 전 최우선 처리"로 지정한 유일한 Critical 리스크를 해소했다. `/my/*` 하위에 어떤 페이지를 추가하더라도 `proxy.ts`를 다시 고칠 필요 없이 자동으로 보호되므로, Phase3-1(Design Tokens)부터 순서대로 착수할 수 있다. 남아있는 리스크(Fortune Phase 미할당, Header의 세션 조회 렌더링 경계 설계 등)는 [[PHASE3_UI_ARCHITECTURE_PLAN]] §7에 이미 기록되어 있으며 이번 Task 범위가 아니다.
