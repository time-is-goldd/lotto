# PHASE5-3 GENERATE UI REPORT — `/generate` 번호 생성 화면

> Phase5-1(`generateNumbers()`)과 Phase5-2(`POST /api/numbers`)를 실제 화면에서 연결했다. 번호 삭제/수정/당첨확인/통계/공유/커뮤니티/AI추천/꿈·운세 연동/커스텀 생성/여러 게임/횟수·개수 제한/rate limit/`session_id`/새 DB·Migration·RLS/새 인증 시스템은 전혀 구현하지 않았다.

---

## 1. 생성/수정 파일

| 파일 | 종류 |
|---|---|
| `app/generate/page.tsx` | 신규 — `/generate` 페이지(Server Component) |
| `components/generate/NumberGenerator.tsx` | 신규 — 유일한 Client Component |
| `components/generate/generatorSaveLogic.ts` | 신규 — 렌더링과 무관한 순수 로직(테스트 가능하게 분리) |
| `components/generate/generatorSaveLogic.test.ts` | 신규 — 단위 테스트 5건 |
| `docs/PHASE5_GENERATE_UI_REPORT.md` | 신규 — 본 보고서 |

`lib/logic/generateNumbers.ts`, `lib/api/numbers.ts`, `app/api/numbers/route.ts`, `proxy.ts`, `app/my/*`(Phase4), 기존 인증 코드는 전혀 수정하지 않았다(파일 수정 시각 직접 대조로 재확인, §14).

---

## 2. `/generate` 경로 확정 재확인

`docs/PHASE5_PRE_IMPLEMENTATION_AUDIT.md`가 이미 판단한 대로, 실제 코드(Home/`BottomNavigation`/`GlobalNav`가 전부 `/generate`를 가리킴, 재확인)를 기준으로 `/generate`를 그대로 사용했다. `SITEMAP.md` §1의 `/generate/auto`는 구현하지 않았다 — 여전히 열린 Decision(§16)으로 남겨둔다.

---

## 3. `/generate` UX 흐름

```
페이지 진입(서버) → generateNumbers() 1회 실행(서버) → 결과를 prop으로 클라이언트에 전달
   → 화면에 6개 번호 즉시 표시(추가 클릭 없이 바로 확인 가능)
   → [로그인+profile 있음] 자동으로 POST /api/numbers
   → "다시 생성하기" 클릭 → 클라이언트에서 generateNumbers() 재실행 → 결과 교체 → (로그인 상태면) 다시 자동 저장
```

**"첫 진입 시 즉시 표시" vs "버튼을 눌러야 생성" 중 즉시 표시를 선택한 근거**: 지시문 §4가 "기존 문서/UX 설계가 있다면 그것을 우선하되, 아니면 하나를 선택"이라고 명시했다. Home 페이지의 CTA 문구가 이미 "번호 생성하기"(동사형 행동 지시)이고 사용자는 그 문구를 보고 클릭해 `/generate`에 도착한다 — 도착하자마자 "그 약속이 이미 이행된" 결과를 보여주는 편이 별도 클릭을 다시 요구하는 것보다 자연스럽다고 판단했다. 이 판단은 추측이 아니라 "즉시 표시/버튼 클릭 둘 다 허용된다"는 지시문의 명시적 옵션 중 하나를 고른 것이다.

**"화면에 표시되지 않은 버전"이 없다**: 위 흐름 어디에도 로딩 스피너 뒤에 번호가 나중에 나타나는 구간이 없다(§7에서 이 설계의 이유를 설명) — 페이지가 열리는 순간 이미 유효한 6개 번호가 존재한다.

---

## 4. `generateNumbers()` 연결 방식

`import { generateNumbers } from "@/lib/logic/generateNumbers"` — Phase5-1의 함수를 수정 없이 그대로 사용한다. 호출부는 정확히 2곳뿐이다:

1. `app/generate/page.tsx`(Server Component) — 최초 진입 시 **서버에서 1회** 호출, 결과를 `initialNumbers` prop으로 전달.
2. `components/generate/NumberGenerator.tsx`의 `handleRegenerate()` — "다시 생성하기" 클릭 시 **클라이언트에서** 호출.

**왜 최초 생성을 클라이언트(`useState` 초기값/`useEffect`)가 아니라 서버에서 하는가 — hydration mismatch 회피**: `generateNumbers()`는 `Math.random()` 기반이라 결과가 매번 다르다. 만약 Client Component의 `useState(() => generateNumbers())`나 `useEffect(() => setNumbers(generateNumbers()), [])`로 최초값을 만들면, **SSR 렌더링 시점(서버)과 하이드레이션 시점(클라이언트)에 각각 독립적으로 함수가 실행되어 서로 다른 번호가 나온다** — React가 서버 HTML과 클라이언트의 첫 렌더링 결과가 다르다고 판단해 hydration mismatch를 일으킨다. 실제로 구현 중 `useEffect`로 최초 생성을 시도했다가, 이 프로젝트의 ESLint 규칙(`react-hooks/set-state-in-effect`, "effect 안에서 곧바로 setState하지 말라")에 걸려 재설계했다 — 최종적으로 Server Component가 값 하나를 계산해 prop으로 흘려보내는 구조로 바꿔 **hydration mismatch와 lint 위반을 동시에, 우회 없이(eslint-disable 없이) 해결**했다. "다시 생성"은 순수한 클라이언트 이벤트라 이 문제와 무관하다.

`Math.random()`을 UI 코드에서 직접 사용한 곳은 없다(grep 재확인, §14).

---

## 5. 로그인/비로그인 동작

Server Component가 `getCurrentUser()`(`lib/auth/session.ts`) → `getProfile()`(`lib/auth/profile.ts`) 순서로 확인한다 — `components/layout/Header.tsx`가 이미 쓰는 것과 완전히 동일한 패턴(새 인증 함수 없음). 그 결과를 `"anonymous" | "profile-pending" | "ready"` 세 값 중 하나로만 요약해 Client Component에 내려준다 — Client Component는 Supabase를 전혀 조회하지 않는다.

| 상태 | `/generate` 접근 | 번호 생성 | 자동 저장 | 안내 문구 |
|---|---|---|---|---|
| 비로그인(`anonymous`) | 가능 | 가능 | 시도 안 함 | "로그인하면 생성한 번호가 다이어리에 자동으로 기록돼요" + `/login?next=/generate` 링크 |
| 로그인+profile 없음(`profile-pending`) | 가능 | 가능 | **시도 안 함** | "온보딩을 마치면 생성한 번호가 다이어리에 자동으로 기록돼요" + `/onboarding` 링크 |
| 로그인+profile 있음(`ready`) | 가능 | 가능 | 자동 저장 | 저장 상태 문구(§6) |

**`profile-pending`을 `anonymous`와 동일하게 "저장 시도 안 함"으로 처리한 근거**: `docs/PHASE5_PRE_IMPLEMENTATION_AUDIT.md` §5에서 실측한 대로 `user_numbers.user_id`가 `profiles`를 FK로 참조해, profile이 없는 계정으로 INSERT를 시도하면 **`23503`(FK violation)으로 확정적으로 실패한다.** 실패가 확실한 요청을 애초에 보내지 않고, 대신 Header와 동일한 어휘("온보딩")로 안내한다 — 새로운 정책이 아니라 이미 존재하는 제약을 반영한 것이다.

---

## 6. 자동 저장 동작

로그인+profile 있음 상태에서 번호가 화면에 나타나면(최초 진입 또는 "다시 생성" 이후) 자동으로 `POST /api/numbers`를 호출한다(요청 바디는 정확히 `{ "numbers": [...] }`, `generatorSaveLogic.ts`의 `buildSaveRequestPayload()`가 이 계약을 강제한다). 저장 상태는 번호 표시와 완전히 분리된 별도 state(`saveStatus`)로 관리하며, 아래 문구로만 구분한다(색상 구분 없음, §8):

- `saving`: "다이어리에 저장하고 있어요..." + `Spinner`
- `saved`: "다이어리에 저장했어요."
- `error`: "저장하지 못했어요. 다시 생성하면 다시 시도해요."

`role="status"`로 감싸 스크린리더가 상태 전환을 인지할 수 있게 했다(§10).

---

## 7. 저장 실패 처리

`saveStatus`가 `numbers`와 별개의 state이므로, 저장 요청이 실패(`fetch` reject 또는 `response.ok === false`)해도 **화면의 6개 번호는 그대로 남아있다** — `numbers` state를 저장 실패 시 초기화하거나 지우는 코드가 없다(코드 리뷰로 확인, §13). 실패 시 사용자는 "다시 생성하기"를 눌러 재시도할 수 있다(새 번호 + 새 저장 시도, 명시적으로 "저장만 재시도"하는 버튼은 만들지 않았다 — 이번 범위 밖의 별도 기능이 될 수 있어 최소 구조만 유지).

---

## 8. 중복 저장 방지

세 가지 장치를 함께 사용한다.

1. **값 기반 dedup 키(`toSaveKey`)**: 이미 저장을 "시도"한 `numbers` 값은 `savedKeyRef`에 기록해두고, 같은 값에 대해 두 번째로 저장을 시도하지 않는다. React Strict Mode가 effect를 마운트→클린업→재마운트로 두 번 실행해도(개발 모드), `useRef`는 이 사이클에서 초기화되지 않으므로 두 번째 실행은 `savedKeyRef.current === key`를 만나 곧바로 반환한다 — **개발 모드에서 저장 API가 중복 호출되지 않는다.**
2. **요청 세대 번호(`requestIdRef`)**: 사용자가 "다시 생성"을 빠르게 여러 번 눌러 이전 저장 요청이 아직 응답하지 않은 상태에서 새 요청이 나가면, 늦게 도착한 이전 응답이 `requestIdRef.current !== requestId` 검사에 걸려 상태를 덮어쓰지 못한다 — 항상 "가장 최근에 표시된 numbers"에 대한 저장 상태만 화면에 반영된다.
3. **서버 idempotency는 만들지 않았다** — 지시문 §7이 명시한 대로 이번 범위가 아니며, 각 `generateNumbers()` 실행 결과는 독립된 생성 결과로 취급해 매번 새 행으로 저장되는 것이 올바른 동작이다(같은 조합이 우연히 중복 생성되는 것은 도메인상 정상, `docs/PHASE5_PRE_IMPLEMENTATION_AUDIT.md` §11 재확인).

---

## 9. 디자인 시스템 준수 여부

- 번호 표시: `bg-primary`/`text-white`/`text-button`(전부 기존 토큰)로 원형(`rounded-full`) 배지 6개. **`DESIGN_SYSTEM.md` §4.2의 번호 구간별 5색 구분(1~10 노랑 등)은 구현하지 않았다** — 그 5개 색상이 `app/globals.css`의 `@theme`에 아직 CSS 변수로 등록되어 있지 않아(Phase3 감사에서 이미 확인된 공백, `docs/PHASE5_PRE_IMPLEMENTATION_AUDIT.md` §14), 이번 Task에서 새 색상을 추가하지 않기 위해 기존 `primary` 토큰 하나로 6개를 동일하게 표시했다. 구간별 색상 구분이 필요하면 먼저 토큰을 추가하는 별도 Decision이 필요하다(§16).
- `Button`(`buttonClassName("secondary","md")`), `Spinner` 재사용. `Card`/`Badge`/`EmptyState`는 이 화면의 UI 구조상 쓰일 자리가 없어 사용하지 않았다(억지로 끼워 넣지 않음).
- **`color-success`를 저장 성공 텍스트에 사용하지 않았다** — "저장했어요" 문구는 다른 두 상태(저장 중/실패)와 동일하게 `text-text-secondary`로만 표시한다. `color-danger`도 실패 문구에 사용하지 않았다(§3의 Phase3/4 대비 문제를 반복하지 않음).
- 새 색상/spacing/radius/shadow를 추가하지 않았다(grep 재확인 불필요할 만큼 기존 토큰 클래스만 사용).

---

## 10. 반응형 / 접근성 검증

**실측 근거 구분**: 이 환경에 실제 브라우저가 없어, 아래는 (a) 실제 서버 응답 HTML의 태그/클래스 직접 확인, (b) 소스 코드 구조 검토 중 하나에 기반한다 — "시각적으로 확인했다"는 주장은 하지 않는다.

- `Container`(`max-w-content px-6`, 기존 컴포넌트 그대로) 사용 — 새 전역 레이아웃 없음.
- 번호 배지 6개는 `flex flex-wrap justify-center gap-3`로 배치해 375px에서도 자동 줄바꿈되며 가로 overflow가 없다(고정폭 컨테이너 없이 flex-wrap만 사용, 코드 검토로 확인).
- `PageShell`/`Main`/`BottomNavigation`을 전혀 수정하지 않아 기존 `pb-16 md:pb-0` 정책이 그대로 유지된다 — `/generate`도 다른 페이지와 동일하게 감싸진다.
- `<h1>` 정확히 1개(응답 HTML `<h1 class="text-h1...">번호 생성</h1>` 확인).
- 번호 배지: `h-12 w-12`(48px, 44px 최소 터치 타겟 기준 충족). "다시 생성하기" 버튼: `buttonClassName("secondary","md")` = `h-11`(44px, 최소 기준 정확히 충족).
- "다시 생성하기"는 실제 `<button type="button">`(그 외 클릭 가능 요소 없음, grep 확인).
- 포커스: `Button`의 기존 `focus-visible` 패턴(재사용) + 안내 문구의 `<Link>`에도 동일한 `focus-visible:outline` 클래스를 직접 부여했다.
- 번호는 `<ol aria-label="생성된 번호">`(순서가 있는 의미 있는 목록 — 오름차순이라는 순서 자체가 의미를 가지므로 `<ul>`이 아니라 `<ol>` 선택).
- 저장 상태 전환은 `role="status"`(polite live region)로 스크린리더에 전달된다.
- 색상만으로 상태를 구분하지 않는다(§9).
- `aria-label`은 `<ol>` 하나에만 사용했다(남용 없음).

---

## 11. SEO / 메타데이터 검증

```ts
export const metadata: Metadata = {
  title: "번호 생성",
  description: "1~45 중 서로 다른 6개의 번호를 무작위로 뽑아드려요. 당첨 확률을 보장하지 않아요.",
};
```
`robots: { index: false }`를 넣지 않았다 — `SITEMAP.md` §4가 `/generate`를 P0(최우선 SEO) 페이지로 분류하므로 `/ui-preview`의 noindex 처리를 복사하지 않는다는 지시를 그대로 따랐다. 페이지 내용(번호 생성 도구 소개, 면책 문구)은 검색 노출에 문제가 없다.

---

## 12. 실제 Supabase 실측 결과 (이번 Task에서 신규 실행, 검증 후 전량 삭제)

카카오 API만 우회(`establishKakaoSupabaseSession()`)한 임시 라우트로 User A/B 계정을 만들었다.

| 상태 | 검증 | 결과 |
|---|---|---|
| A. 비로그인 | `/generate` 접근 | `200`, 번호 6개가 **SSR 응답 HTML에 즉시 포함**(로딩 상태 없이) |
| A. 비로그인 | 저장 API 호출 여부 | 코드 검토로 확인(§5) — `authState !== "ready"`라 저장 effect가 즉시 반환, 실제로 `POST /api/numbers`를 호출할 코드 경로 자체가 실행되지 않음 |
| B. 로그인+profile 없음 | `/generate` 접근 | `200`, "온보딩을 마치면" 안내 문구 렌더링 확인(비로그인용 "로그인하면" 문구와 다름을 확인) |
| C. 로그인+profile 있음 | `/generate` 진입 시 서버가 계산한 `initialNumbers` | 응답 HTML에서 실제 값 추출: `[6, 10, 14, 23, 35, 42]` |
| C. | 클라이언트가 했을 자동 저장을 동일하게 재현(`POST /api/numbers`에 위 값 그대로 전송) | `201`, 응답 `numbers`가 요청과 동일 |
| C. | **저장된 행을 service_role로 직접 재조회** | `user_id`가 User A의 실제 uuid와 정확히 일치, `numbers`가 `[6,10,14,23,35,42]`로 SSR 표시값과 정확히 일치, `generation_method`는 `"auto"` |
| C. | User A 자신의 `/my/journal/history` | 방금 저장한 `6, 10, 14, 23, 35, 42`와 "자동 생성" 뱃지가 **Phase4 코드 수정 없이** 즉시 표시됨을 확인 |

**"화면 표시 numbers === POST payload numbers === DB 저장 numbers" 3중 일치를 실측으로 확인했다.**

---

## 13. User A/B 데이터 격리 결과

User B(로그인+profile 있음, 데이터 없음)로 `/my/journal/history`를 조회한 결과 User A가 방금 저장한 번호가 전혀 보이지 않고 `EmptyState`("아직 생성한 번호가 없어요")만 표시됨을 확인했다 — Phase4의 기존 RLS/조회 로직이 Phase5-3에서도 그대로 유효함을 재확인(새 코드를 추가하지 않았으므로 당연한 결과이지만 실측으로 재검증).

검증 후 테스트 계정 2개와 관련 데이터(`user_numbers`/`profiles`/기타)는 전량 삭제했다(`auth.users` `200`, 나머지 테이블 전부 `204`). 임시 라우트(`app/api/dev-test-login`)도 삭제했다.

---

## 14. 테스트 결과

`components/generate/generatorSaveLogic.test.ts` — **5건, 전부 통과**. `buildSaveRequestPayload`(정확히 `numbers` 키 하나만 포함, `user_id` 절대 미포함 — 지시문 §13 항목 5·6에 대응), `canAutoSave`(`ready`일 때만 `true` — 항목 2·3 관련 저장 게이팅), `toSaveKey`(동일 입력→동일 키, 다른 입력→다른 키 — 항목 7 "중복 저장 방지"의 기반 로직).

**React 컴포넌트 자체(상태/이펙트 오케스트레이션, 지시문 §13의 항목 1·4·7 중 렌더링이 필요한 부분)는 자동화 테스트를 작성하지 않았다** — `vitest.config.mts`가 `environment: "node"`이고 이 프로젝트에 `jsdom`/React Testing Library가 설치되어 있지 않음을 확인했다(지시문이 "억지로 새 테스트 프레임워크를 도입하지 않는다"고 명시). 대신:
- 렌더링과 무관한 순수 로직만 분리해 실제로 테스트했다(위).
- 상태 오케스트레이션(중복 저장 방지, 저장 실패 시 번호 유지, 재생성 시 교체)은 §7·§8에서 **코드 리뷰 근거**로 설명했다.
- 실제 저장/격리/화면-요청-DB 일치는 §12·§13의 **실제 Supabase 실측**으로 검증했다.

이번 Task는 단위 테스트와 실제 환경 검증을 명확히 분리해서 다뤘다(지시문 §13의 명시적 허용사항).

### 보안 grep 재확인

| 확인 항목 | 결과 |
|---|---|
| `service_role`/`SUPABASE_SERVICE_ROLE_KEY`(`app/generate`, `components/generate`) | 없음 |
| client-side `user_id` 전송 | 없음(매치된 것은 전부 주석/테스트 assertion으로, "포함 안 함"을 증명하는 코드) |
| `generateNumbers()`에 인자 전달 | 없음(항상 무인자 호출 2곳뿐) |
| 직접 Supabase 호출(`supabase/server`,`client`,`service`, `createClient`) | 없음 |
| `Math.random()` 직접 사용 | 없음(주석에서만 언급, 실제 호출은 `generateNumbers()` 경유만) |

---

## 15. Validation 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과(구현 도중 `react-hooks/set-state-in-effect` 위반 1건을 발견해 §4의 구조 변경으로 근본 해결 — eslint-disable 없이 통과) |
| `npm run type-check` | 통과 |
| `npm test` | **67개 통과**(기존 62개 + 신규 5개) |
| `npm run build` | 통과. 라우트에 `/generate` 1개만 추가, 나머지 변경 없음 |
| 기존 페이지 회귀(`/`, `/login`, `/ui-preview`, `/onboarding`, `/my/journal`, `/my/journal/history`, `/my/journal/dreams`, `/my/journal/fortune-history`) | 전부 기존과 동일한 응답 확인 |
| `git status`(범위 확인) | 이번 Task의 실제 변경분은 `app/generate/page.tsx`, `components/generate/**`(신규 3개 파일), 본 보고서뿐임을 확인. `proxy.ts`/`app/my/*`/`lib/logic/generateNumbers.ts`/`lib/api/numbers.ts`/`app/api/numbers/route.ts`/기존 인증 코드는 파일 수정 시각 직접 대조로 전혀 손대지 않았음을 재확인 |
| 임시 테스트 라우트/파일 잔존 | 없음 |

---

## 16. 발견된 문제 / 문서 간 충돌

새로 발견된 코드 결함은 없다. 구현 과정에서 발견한 것은 결함이 아니라 **설계 제약**이었다: `react-hooks/set-state-in-effect` 린트 규칙과 "SSR-세이프한 클라이언트 전용 초기값" 패턴이 충돌할 수 있다는 점 — 이번에는 "서버에서 값을 계산해 prop으로 내려준다"는 더 나은 구조로 해결되어 실제 문제가 되지 않았지만, 향후 유사하게 서버와 값을 맞춰야 하는 클라이언트 상태가 필요할 때 참고할 수 있도록 기록해둔다.

문서 간 충돌은 이번 Task 범위에서 새로 발견되지 않았다 — `docs/PHASE5_PRE_IMPLEMENTATION_AUDIT.md`가 이미 식별한 5가지 Decision(`/generate` 경로, 여러 게임 생성, 저장개수 제한, 공유 기능 Phase 배정, `session_id` 사용 여부) 중 어느 것도 이번 UI 구현에서 새로운 충돌을 만들지 않았다. `DESIGN_SYSTEM.md` §4.2(번호 구간별 5색)를 구현하지 않은 것은 새 색상 토큰 추가가 필요한 사안이라 §9에서 별도로 기록했다(Decision 필요, 신규).

---

## 17. Phase5 완료를 위해 남은 작업

**Phase5-1(로직)·Phase5-2(API)·Phase5-3(UI)로 MVP 핵심 흐름("번호 생성 → 결과 확인 → 로그인 시 자동 저장 → 다이어리 반영")이 실제로 완성되고 실측 검증되었다.** `docs/EXECUTION_PLAN.md` Phase5의 완료 기준(비로그인 생성 정상 동작(저장 없이) / 로그인 생성 시 다이어리 히스토리에 즉시 반영 / CHECK 제약 위반 데이터가 생성되지 않음)을 전부 실측으로 재확인했다.

**Phase5 최종 Audit(Phase5-4)으로 넘어갈 준비가 되었다고 판단한다.** 남은 것은 새 기능 구현이 아니라 지금까지 쌓인 Decision 목록(§16 및 이전 Phase5-0~5-2 보고서의 항목들)을 한 번에 정리하는 종합 점검이다 — 특히 `/generate` vs `/generate/auto` 경로, 번호 구간별 색상 토큰 추가 여부(이번에 새로 확인됨), 여러 게임 생성 여부는 Phase5를 "완료"로 선언하기 전에 사용자가 확인하는 것을 권장한다.
