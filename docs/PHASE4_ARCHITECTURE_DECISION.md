# PHASE4 ARCHITECTURE DECISION

> Phase4-0 Gate. 코드/Migration/RLS/컴포넌트를 전혀 수정하지 않았다 — 이 문서는 의사결정만 담는다. 모든 "결정"은 다음 Implementation Task에서 별도로 구현해야 하며, 이 Task 자체는 그 구현을 수행하지 않는다.

---

## 1. Decision Summary

Phase4는 [[EXECUTION_PLAN]] 기준 **"행운 다이어리(틀)"** — 읽기 전용 골격(빈 상태 포함)만 만든다. 사용자가 이번 지시문에서 제안한 "다이어리 작성/수정" 범위는 EXECUTION_PLAN 원문과 충돌하며(§2 참조), EXECUTION_PLAN을 우선 적용해 **작성/수정 UI는 Phase4에 포함하지 않는다**고 결정했다. `/my` 인증 정책은 **Option B**(다이어리 허브만 비로그인에 가치설명 노출, 나머지 하위 페이지는 기존처럼 즉시 보호)로 결정했다 — 단, 이 결정을 실행하려면 `proxy.ts` 코드 변경이 필요하고 이번 Task는 그 변경을 수행하지 않는다. DB는 기존 스키마로 완전히 충분해 신규 migration이 필요 없다. Fortune은 Phase4와 분리해 향후 별도 Phase로 배정한다. color-danger/success는 Phase4에서 "보완 사용"(사용 조건부 허용)으로 결정했다.

---

## 2. Phase4 Scope

### ⚠️ 충돌 발견: 이번 지시문의 제안 범위 vs EXECUTION_PLAN 원문

이번 지시문은 Phase4 포함 항목으로 "다이어리 목록/**작성**/**수정**/상세"를 제시했다. 그러나 [[EXECUTION_PLAN]] Phase4 원문(구현 순서 1~6, 생성 파일 목록)을 다시 대조한 결과, 실제로는 다음과 같이 **쓰기 기능이 전혀 없다**:

| 기능 | EXECUTION_PLAN상 실제 배정 Phase | 근거 |
|---|---|---|
| 번호 생성 결과 자동 저장(`user_numbers` INSERT) | **Phase5** | "로그인 시 자동 저장" — Phase5 구현순서 4번 |
| 당첨 대조 결과 반영(`user_numbers` UPDATE) | **Phase6** | 당첨 확인 배치 로직 |
| 개인 꿈 기록 작성 폼(`dream_journal_entries` INSERT) | **Phase7** | "개인 꿈 기록 폼 → 다이어리 '내 꿈 기록' 실데이터 연결"이 Phase7 수정 파일 목록에 명시 |
| 다이어리 항목 수정/삭제 UI | **어느 Phase에도 명시되지 않음** | RLS(`0008`)는 `user_numbers`/`dream_journal_entries`에 이미 UPDATE/DELETE 정책까지 걸어뒀지만, 이를 사용하는 화면은 EXECUTION_PLAN 어디에도 계획되어 있지 않다 |
| 개별 항목 상세 페이지(`/my/journal/history/[id]` 등) | **SITEMAP에 정의된 URL 자체가 없음** | [[SITEMAP]] §1은 `/my/journal/history`(목록)까지만 정의하고 개별 상세 URL은 없다 |

**결론(문서 근거 기반, 임의 해석 아님)**: Phase4는 "목록/빈 상태 UI + 조회 함수"만 만든다. "작성/수정/상세"는 Phase4 범위가 아니며, 이 지시문의 제안과 EXECUTION_PLAN이 충돌하는 지점이므로 EXECUTION_PLAN을 우선 적용한 것으로 기록한다. 이 판단이 틀렸다면(즉 정말 작성/수정까지 Phase4에서 원한다면) 사용자가 명시적으로 EXECUTION_PLAN을 개정하는 별도 승인이 필요하다.

### Phase4 포함 (확정)

- `/my/journal` — 다이어리 홈(요약 카드, 빈 상태)
- `/my/journal/history` — 히스토리 목록 UI 틀(빈 상태)
- `/my/journal/results` — 당첨확인 결과 카드 틀(빈 상태)
- `/my/journal/calendar`, `/my/journal/dreams`, `/my/journal/fortune-history` — 최소 골격("준비 중" 정적 문구 허용, EXECUTION_PLAN 원문 그대로)
- `lib/api/journal.ts` — 조회 함수(지금은 빈 배열/널 반환, 이후 Phase에서 실제 연결)
- 비로그인 접근 시 가치설명 화면(§3 Option B)
- 기존 DB(Phase1에서 이미 생성된 4개 테이블) 조회만, 기존 인증(`getCurrentUser`/`getProfile`) 재사용

### Phase4 제외 (확정)

- 번호 생성, 운세(§7), 커뮤니티, 알림, 고급 통계, AI 기능, 외부 API — 이번 지시문 원안과 동일하게 확정
- **추가로 제외 확정**(§2 충돌 분석 결과): 다이어리 항목 작성/수정/삭제 UI, 개별 항목 상세 페이지, `/my/journal/stats`·`/my/journal/yearly-report`(EXECUTION_PLAN Phase4 파일 목록에 없음 — SITEMAP에는 있으나 이 URL을 만드는 Phase가 아직 지정되어 있지 않다. Phase4가 만들지 않는다는 뜻이지 SITEMAP이 틀렸다는 뜻은 아니다)

---

## 3. Authentication Architecture — `/my` 접근 정책 최종 결정

### 3-1. 실제 문서 3종 재대조 (추측 없이 원문 인용)

1. **[[INFORMATION_ARCHITECTURE]] §1.2 원문**: "비로그인 상태에서 '다이어리' 탭 클릭 시 빈 화면 대신 '로그인하면 번호·운세·꿈 기록이 모두 여기 쌓여요' 안내 화면 + 로그인 CTA 노출 (**단순 리다이렉트보다 가치 설명 우선**)." — 이 요구사항은 명시적으로 **"다이어리" 탭**, 즉 다이어리 허브(`/my/journal`) 진입점 하나를 가리킨다. `/my/journal/history`나 `/my/notifications` 같은 하위/타 개인화 페이지까지 확장하라는 서술은 없다.
2. **[[SITEMAP]] §1, §4**: `/my/journal` 및 그 하위 전체, `/my/notifications`, `/my/profile`을 하나의 `/my/*` 트리로 정의하고 전체를 P3(noindex) 등급으로 묶는다. 접근 정책(인증 요구 여부)에 대한 서술은 없다 — SITEMAP은 URL 구조 문서이지 인증 정책 문서가 아니다.
3. **`proxy.ts` 실제 코드** (재확인): `PROTECTED_PATHS = ["/onboarding", "/my"]`, `matchesPath()`가 `/my`로 시작하는 모든 경로를 예외 없이 매칭해 비로그인 시 무조건 `/login`으로 307 리다이렉트한다(37~61행 재확인, 변경 없음).

**결론**: 문서가 실제로 요구하는 것은 "`/my/*` 전체를 공개하라"가 아니라 **"다이어리 허브 진입점 하나만 가치설명을 보여주라"**는 훨씬 좁은 요구다. 이는 이번 감사가 스스로 제시한 Option B의 정의("일부 페이지는 공개 가치 설명... 실제 데이터 영역만 인증 보호")와 정확히 일치한다.

### 3-2. Option 비교

| 기준 | A(현행, 전체 보호) | **B(허브만 예외)** | C(전체 hybrid) |
|---|---|---|---|
| 보안 | 최고 — 예외 없음 | 높음 — 예외가 `/my/journal` 허브 1곳으로 통제됨, 나머지는 여전히 기본 차단 | 낮음~중간 — 모든 `/my/*` 페이지가 각자 인증 로직을 구현해야 해 실수로 보호 누락 위험 증가(defense-in-depth 상실) |
| UX | 낮음 — 비로그인 사용자가 다이어리 탭을 눌러도 설명 없이 로그인 화면으로 튕겨나감, 문서 요구사항 미충족 | 높음 — 문서가 요구하는 전환 흐름을 정확히 구현 | B와 동일한 효과를 더 넓은 범위에서 내지만 그 넓은 범위가 실제로는 필요 없음(과설계) |
| SEO | 무관(noindex 확정) | 무관(noindex 유지, 이 결정은 인덱싱 여부를 바꾸지 않음) | 무관 |
| 구현 복잡도 | 없음(이미 구현됨) | 낮음 — `proxy.ts`에 단일 예외 경로 추가 + 허브 페이지가 `Header.tsx`와 동일한 `getCurrentUser()` 분기 패턴 재사용 | 높음 — 모든 하위 페이지가 개별 인증 분기 필요 |
| 유지보수 | 최고(단일 규칙) | 중간(예외 1건, 문서화로 관리 가능) | 낮음(반복 로직, 일관성 저하) |
| Phase4 정합성 | **낮음 — Phase4 자신의 완료 기준("비로그인 시 가치설명 화면 노출")을 위반** | 높음 — 완료 기준 그대로 충족 | 과잉 — 다이어리 허브 하나만 필요한데 전체 구조를 바꿈 |
| Phase5+ 확장성 | 낮음 — 향후 유사 랜딩(예: 운세 소개)마다 같은 문제 반복 | 높음 — "공개 랜딩 + 로그인 시 실데이터" 패턴의 재사용 가능한 선례가 됨 | 낮음 — 더 복잡한 기반 위에 계속 쌓아야 함 |

**"기존 Phase2 설계를 존중해야 한다"는 이유만으로 A를 자동 선택하지 않았다** — Phase2가 확정한 것은 "인증 메커니즘"(카카오 로그인, RLS, `getCurrentUser`)이지 "`/my/*` 전체를 무조건 리다이렉트한다"는 세부 라우팅 규칙이 아니다. `proxy.ts`의 현재 구현은 Phase3 착수 시점에 [[PHASE3_PROXY_ROUTE_FIX_REPORT]]가 "경로 문자열만 SITEMAP과 일치시키는" 작업으로 만든 것이지, 이 가치설명 요구사항을 검토하고 내린 결정이 아니었다(그 시점엔 다이어리 페이지 자체가 없어 검토 대상이 아니었음).

### 3-3. 최종 결정: **Option B**

- `/my/journal`(허브, 정확히 이 경로만) — **`proxy.ts` 보호 대상에서 제외**한다. 페이지 자체가 Server Component에서 `getCurrentUser()`로 분기: 비로그인 → 가치설명+로그인 CTA, 로그인 → 실제 다이어리 요약(빈 상태 포함).
- `/my/journal/history`, `/my/journal/results`, `/my/journal/calendar`, `/my/journal/dreams`, `/my/journal/fortune-history`, `/my/notifications`, `/my/profile` — **기존 그대로 `proxy.ts` 보호 유지**(예외 없는 즉시 리다이렉트).
- **이 결정은 `proxy.ts` 코드 변경을 요구한다 — 이번 Task에서 수행하지 않는다.** 구현은 별도 Task(§12 Phase4-0.5)로 분리한다.

---

## 4. Routing Architecture

- 신규 route 6개(§2 포함 목록) — 전부 [[SITEMAP]]에 이미 정의된 경로, 신규 URL 설계 불필요.
- `proxy.ts` matcher(`app/onboarding/:path*`, `/my/:path*`, `/login`) 자체는 변경 불필요 — `/my/journal` 예외는 matcher 안에서 로직 분기로 처리하거나(예: `PROTECTED_PATHS` 매칭 후 정확히 `/my/journal`이면 통과시키는 예외 조건 추가), matcher에서 `/my/journal`을 제외하고 개별 하위 경로만 나열하는 방식 중 하나를 §12 구현 Task에서 선택한다 — 이번 Task는 어느 구현 방식이 낫은지까지는 결정하지 않는다(코드 변경 자체가 범위 밖이므로).
- 기존 route(`/login`, `/onboarding`, `/ui-preview`, `/api/*`)와 충돌 없음(재확인).

---

## 5. Database Architecture

### 5-1. Phase4가 실제로 필요로 하는 테이블

| 테이블 | Phase4 필요 여부 | 근거 |
|---|---|---|
| `user_numbers` | **필요** | history/results 목록·요약 조회 대상 |
| `dream_journal_entries` | **선택적** | `dreams` 골격 페이지가 EXECUTION_PLAN상 "준비 중" 정적 문구만으로도 충족 가능 — 실제 카운트/미리보기를 보여줄지는 구현 Task에서 결정 |
| `fortune_results` | **선택적** | 상동, `fortune-history` 골격 페이지 |
| `user_period_stats` | **불필요** | `/my/journal/stats`, `/my/journal/yearly-report`는 EXECUTION_PLAN Phase4 파일 목록에 없음(§2) — 이번 Phase가 만들지 않는 페이지의 테이블이므로 사용 안 함 |

### 5-2. `dream_journal_entries` 상세 (실제 `0004_dream_journal_entries.sql` 원문 재확인)

| 항목 | 실제 값 |
|---|---|
| 컬럼 | `id`(bigint PK), `user_id`(uuid NOT NULL), `entry_date`(date NOT NULL), `dream_text`(text NOT NULL), `linked_dream_id`(bigint NULL), `created_at`(timestamptz NOT NULL DEFAULT now()) |
| NOT NULL | `user_id`, `entry_date`, `dream_text` |
| DEFAULT | `created_at`만 `now()`. 다른 컬럼 DEFAULT 없음 |
| FK | `user_id → profiles(id)`(NO ACTION), `linked_dream_id → dreams(id)`(NO ACTION, NULL 허용) |
| UNIQUE | 없음 |
| created_at | 있음(NOT NULL DEFAULT now()) |
| updated_at | **없음** — 주석에 "§3.6에 명시되지 않음"으로 의도적 생략 확인 |
| RLS | `0008`에서 `dream_journal_entries_select_own`/`insert_own`/`update_own`/`delete_own` 4개 정책 전부 이미 존재(`auth.uid() = user_id`) |

### 5-3. Schema Decision

**기존 schema로 완전히 충분하다 — Phase4는 물론, 이번 지시문이 제안했던 "작성/수정" 범위(§2에서 제외 확정했지만)까지 가정해도 스키마 자체는 이미 지원 가능하다**(INSERT/UPDATE RLS가 이미 걸려 있음, `updated_at` 부재는 기능 동작에 지장 없음). **Migration을 추가하지 않는다.** "Schema Decision Required"로 보고할 항목 없음.

---

## 6. Migration Policy

### 6-1. 실제 상태 재확인 (파일 시스템 + Supabase 원격 프로젝트 직접 조회)

- 로컬 파일: `0001, 0002, 0003, 0004, 0005, 0006, 0007, 0008, 0009, 0010, 0011, 0013` (12개, `0012` 결번)
- **원격 프로젝트 실제 적용 이력**(`npx supabase migration list`로 직접 조회, 읽기 전용): `local`/`remote` 컬럼이 12개 전부 정확히 일치. **로컬/원격 불일치 없음.**
- 중복 번호 없음. `0012`는 [[EXECUTION_PLAN]] Phase9가 `admin_flag.sql`용으로 예약해둔 결번이며, 아직 아무도 사용하지 않았다(Phase9 미착수).

### 6-2. Phase4가 사용할 다음 번호

**`0014`.** ([[EXECUTION_PLAN]] Phase4 §3 각주가 서술한 "`0011_journal_summary_view.sql`"은 이미 `0011_profiles_auth_protection.sql`(Phase2 산출물)로 선점되어 있고, `0012`도 Phase9 몫으로 이미 이름이 정해져 있어 Phase4가 가져다 쓸 수 없다.)

### 6-3. 생성 조건

§5-3에 따라 **Phase4는 migration이 필요 없다.** `0014`는 "만약 나중에 Phase4 범위에서 스키마 변경이 필요하다고 판단되는 경우에만" 사용할 번호로 기록해두는 것이며, 이번 Task도 다음 Implementation Task도 실제로 생성하지 않는다.

---

## 7. Fortune Scheduling Decision

### 근거 재확인
- [[ROADMAP]] §1: "AI 운세 번호(간소화 버전)"는 **Should** 등급.
- [[INFORMATION_ARCHITECTURE]] §1.1/§1.2: 운세는 GNB·하단탭 5개 중 하나로, 이미 핵심 내비게이션 항목.
- [[EXECUTION_PLAN]] Phase0~10 원문 재검색 결과 `/fortune` 자체(입력·계산·결과 페이지)를 만드는 Phase는 **여전히 없음**([[PHASE3_UI_ARCHITECTURE_PLAN]] §7-2가 이미 발견한 것과 동일 — 재확인만 함, 그 사이 해결되지 않았다).
- `fortune_results` 테이블/RLS는 Phase1에서 이미 생성되어 대기 중.

### 분류: **B. Phase4와 분리해서 향후 별도 Phase로 배정**

- **A(Phase4에 포함) 기각 사유**: 이번 지시문 §3 자체가 "운세"를 Phase4 제외 목록에 명시했고, Phase4는 "다이어리 틀"(읽기 전용 골격)이라는 정체성과도 맞지 않는다 — 실제 운세 계산 로직(신규 기능 로직)을 만드는 것은 "틀만 만든다"는 Phase4 원칙에 위배된다.
- **C(navigation에서 제거) 기각 사유**: `GlobalNav`/`BottomNavigation`은 Phase3-6/3-7에서 이미 구현·실측 검증을 마친 컴포넌트다. 지금 제거하려면 컴포넌트 수정이 필요한데 이는 이번 Task 범위(컴포넌트 수정 금지) 밖이다. 또한 운세는 [[INFORMATION_ARCHITECTURE]]가 "더보기"급이 아니라 핵심 5탭 중 하나로 의도적으로 배치한 기능이라, 단지 아직 안 만들어졌다는 이유로 내비게이션에서 빼는 것은 제품 방향과 맞지 않는다(임시 404는 이미 Phase3 보고서들이 알려진 문제로 기록해둔 상태).
- **B 권장**: 운세 전용 Phase(가칭 "Phase4.5-운세" 또는 Phase5 이후 임의 지점)를 신설해야 한다는 [[PHASE3_UI_ARCHITECTURE_PLAN]] §7-2의 권고를 그대로 재확인한다. **이번 Task는 그 Phase를 언제 어디에 넣을지까지는 결정하지 않는다** — "Phase4와 별개"라는 분류만 확정한다.

---

## 8. Accessibility / Color Decision

### 8-1. 실제 수치 재확인 ([[PHASE3_MAINTENANCE_REPORT]] §5 원문)

| 조합 | 대비율 | 실제 사용처 |
|---|---|---|
| `text-danger` on `bg-base`(white) | 4.429:1 | `Input`/`Textarea` 에러 텍스트(`text-caption`, 14px) |
| white on `bg-danger`(solid) | 4.429:1 | `Button` destructive variant |
| `text-danger` on `bg-danger/10` | 3.838:1 | `Badge` danger variant |
| `text-success` on `bg-success/10` | 2.951:1 | `Badge` success variant |

### 8-2. 4가지 질문에 대한 답

1. **Phase4에서 직접 사용해도 되는가?** — 조건부. 위 4개 조합 모두 일반 텍스트(14~16px, non-bold) 기준 WCAG AA(4.5:1) 미달이며, `success`는 3:1(큰 텍스트 기준)조차 미달이다. **작은 텍스트(caption/body 크기)에 그대로 쓰면 안 된다.**
2. **색상만으로 상태를 전달하지 않는 방법**: `Badge`/`ResultCard`가 이미 텍스트 라벨(예: "당첨"/"미당첨")을 항상 동반하는 구조라 WCAG 1.4.1(색상 단독 전달 금지) 자체는 위반하지 않는다 — 문제는 1.4.1이 아니라 **1.4.3(대비 자체 부족)**이다. 아이콘을 추가해도 텍스트 자체의 명도 대비 수치는 바뀌지 않는다 — 아이콘은 1.4.1 보완책이지 1.4.3 해결책이 아니다.
3. **아이콘/보조 라벨로 보완 가능한가?** — 부분적으로만. 실제 근본 해결은 WCAG 큰 텍스트 기준(3:1, 18.66px 이상 Bold 또는 24px 이상 Regular)을 만족시키는 것뿐이다. `color-danger`(4.429:1)는 큰 텍스트 기준을 이미 통과하므로, **당첨확인 헤드라인처럼 크고 굵은 텍스트에 한해서만 사용을 허용**하면 토큰을 바꾸지 않고도 그 자리에서는 실질적으로 AA를 충족한다. 단 `color-success`(2.951:1, 큰 텍스트 기준도 미달)는 이 방법으로도 구제되지 않는다.
4. **근본적으로 토큰 수정이 필요한가?** — 그렇다, 특히 `color-success`는 어떤 사용 방식으로도 구제되지 않는다. 하지만 이번 Task와 다음 Implementation Task 모두 [[DESIGN_SYSTEM]] 토큰 값을 수정할 권한이 없다.

### 8-3. 결정: **Phase4에서 보완 사용**

Phase4-3(journal 컴포넌트 구현, 다음 다음 Task) 착수 시 아래 사용 정책을 따른다 — 코드는 지금 작성하지 않는다:
- 당첨확인처럼 크고 굵은(대략 `text-h2` 이상, bold) 헤드라인에는 `color-danger` 텍스트 사용을 허용한다(3:1 큰 텍스트 기준 통과).
- `color-success`는 텍스트 색상으로 단독 사용하지 않는다 — 작은 배지에 초록 텍스트를 쓰는 대신, `text-primary`/`text-text-primary` + "당첨" 텍스트 + (선택) 아이콘 조합으로 대체하거나, 배경을 진하게 채우고 흰 텍스트로 반전하는 등 §8-2에서 구제되지 않는다고 확인된 방식은 배제한다.
- 작은 크기(caption/body)로 success/danger를 표시해야 하는 자리에는 색상 텍스트 대신 아이콘+`text-text-primary` 조합으로 대체한다.
- **토큰 값 자체의 근본 수정은 Phase4 완료 후 별도 승인 Task로 넘긴다.**

---

## 9. API Contract

### 9-1. 기존 컨벤션 재확인 (`app/api/profile/route.ts` 원문)

- `getCurrentUser()` 우선 확인 → 없으면 `401 UNAUTHORIZED`
- 성공 응답 `{ data: ... }`, 에러 응답 `{ error: { code, message } }`(`ErrorCode` 유니온 타입)
- 도메인 에러는 커스텀 `Error` 서브클래스로 던지고 라우트에서 매핑
- `lib/auth/profile.ts`가 `service_role`을 쓰는 이유는 **`profiles` 테이블 자체가 `0011`에서 client INSERT/UPDATE RLS를 제거했기 때문**이지, "모든 API가 service_role을 써야 한다"는 일반 규칙이 아니다.

### 9-2. Phase4 API 계약 — REST 라우트가 아니라 `lib/api/journal.ts` 함수가 실질적 계약이다

[[EXECUTION_PLAN]] Phase4 파일 목록 자체가 `lib/api/journal.ts`(필수)와 `app/api/journal/summary/route.ts`(**옵션**)을 구분해뒀다. Phase4의 모든 페이지는 Server Component이므로(`Header.tsx`가 이미 `getCurrentUser()`/`getProfile()`을 직접 호출하는 것과 동일한 패턴), HTTP 왕복 없이 `lib/api/journal.ts` 함수를 서버에서 직접 호출하는 것이 이미 검증된 기존 패턴과 일치한다. 이번 지시문이 예시로 든 `GET/POST/PUT/DELETE /api/journal/[id]` REST 세트는 **Phase4 범위(읽기 전용 골격)와 맞지 않는다** — 쓰기 엔드포인트는 §2에서 확정한 대로 Phase4 대상이 아니다.

| 함수(`lib/api/journal.ts`) | 인증 | 입력 | 출력 | service_role |
|---|---|---|---|---|
| `getSummary(userId)` | 호출측(페이지)이 `getCurrentUser()`로 이미 확인 | `userId: string` | 요약 통계(지금은 빈/0 값) | **불필요** — `user_numbers` RLS(0008)가 본인 행만 반환 |
| `getHistory(userId)` | 상동 | `userId: string` | `user_numbers[]`(지금은 `[]`) | 불필요 |
| `getResults(userId)` | 상동 | `userId: string` | 당첨확인 대상 `user_numbers[]`(지금은 `[]`) | 불필요 |
| `getFortuneHistory(userId)` | 상동 | `userId: string` | `fortune_results[]`(지금은 `[]`) | **불필요하지만 주의 필요** — `fortune_results`의 SELECT RLS는 `using(true)`(전체 공개, §8 [[PHASE4_PRE_IMPLEMENTATION_AUDIT]] 재확인)라 RLS가 본인 필터링을 해주지 않는다. 이 함수는 **반드시 쿼리에 `.eq("user_id", userId)`를 애플리케이션 레벨에서 명시**해야 한다 — 누락 시 전체 사용자의 운세 결과가 노출된다 |
| `getDreamJournal(userId)` | 상동 | `userId: string` | `dream_journal_entries[]`(지금은 `[]`) | 불필요 — RLS(0008)가 본인 행만 반환 |

- **에러 처리**: Phase4는 조회 전용이라 도메인 에러(404/409 등)가 사실상 없다 — DB 조회 실패(500)만 방어하면 된다.
- **`app/api/journal/summary/route.ts`(옵션)**: 지금 시점에 이 라우트가 필요한 실제 클라이언트 상호작용(예: 새로고침 없는 재조회)이 식별되지 않았다 — Phase4-1에서 실제로 필요해지기 전까지는 만들지 않는 것을 권장.

---

## 10. User Flow

### 신규 사용자
로그인 → `getProfile()` 존재 확인(있음) → `/my/journal` → `getHistory`/`getResults` 등이 빈 배열 반환 → `EmptyState` 표시(예: "아직 기록이 없어요, 번호 생성하러 가볼까요?" + `/generate` 링크). **"첫 다이어리 작성" 폼은 Phase4에 없다** — §2에서 확정한 대로 CTA는 항상 다른 Phase의 실제 생성 화면(`/generate` 등)으로 안내하는 링크일 뿐이다.

### 기존 사용자
로그인 → `/my/journal` → 데이터가 있으면(Phase5+ 이후 실제로 쌓인 데이터) 요약/목록 표시. **"상세/수정/삭제"는 Phase4에 없다** — §2에서 확정.

### 비로그인 사용자 (§3 Option B 결정 반영)
- `/my/journal` 진입 → `proxy.ts` 예외 통과 → 페이지가 직접 `getCurrentUser()` 확인 → 없음 → 가치설명 화면("로그인하면 번호·운세·꿈 기록이 모두 여기 쌓여요" + 로그인 CTA, [[INFORMATION_ARCHITECTURE]] §1.2 원문 문구 그대로 재사용).
- `/my/journal/history` 등 하위 경로에 비로그인으로 직접 접근 → `proxy.ts`가 기존 그대로 즉시 `/login?next=...`로 리다이렉트.

### 잘못된 접근 — 다른 사용자의 journal ID로 직접 접근
**Phase4 자체에는 이 시나리오가 존재하지 않는다** — §2에서 확정했듯 Phase4는 개별 리소스 상세 페이지(`/my/journal/history/[id]` 등)를 만들지 않는다. 그러나 Phase5+에서 이 기능이 생길 것을 대비해 원칙을 지금 정해둔다:
- **`404`로 응답한다(`403` 아님).** 근거: `0008`의 RLS 정책(`auth.uid() = user_id`)이 타인의 행을 조회 시점에 아예 걸러버리므로, 서버 코드 입장에서는 "존재하지만 내 것이 아님(403 대상)"과 "애초에 존재하지 않음(404 대상)"을 구분할 방법이 원천적으로 없다 — RLS가 이미 그 구분 자체를 지워버린다. 이 상황에서 억지로 403을 반환하려면 RLS를 우회하는 별도 조회(service_role)가 필요한데, 이는 "그 리소스가 존재하기는 한다"는 정보를 공격자에게 누설하는 것이라 OWASP 권고(정보 누출 최소화)에도 반한다. `id`가 순차 증가하는 `bigint`라 추측이 쉬운 점도 404 통일의 근거를 강화한다(존재 여부를 숨겨야 열거 공격의 효용이 없어진다).

---

## 11. Risk Register

### Critical
없음 — 이전 감사([[PHASE4_PRE_IMPLEMENTATION_AUDIT]])가 발견한 유일한 Critical(R1, proxy.ts 충돌)은 §3에서 Option B로 **결정**했다. 단, 그 결정을 실행하는 코드 변경이 아직 존재하지 않는다는 사실 자체는 §13 Implementation Gate에서 별도로 반영한다.

### High
- **H1. proxy.ts Option B 미구현 상태** — 결정은 났으나 코드가 없다. `/my/journal` 페이지를 실제로 만들기 전에 반드시 구현되어야 한다(§13).
- **H2. Fortune 여전히 Phase 미배정** — §7에서 "Phase4와 분리"로만 분류, 실제 배정은 별도 결정 필요.
- **H3. color-success는 어떤 사용 방식으로도 AA를 만족하지 못함** — §8의 "보완 사용" 정책으로 당장은 우회 가능하지만 근본 해결이 아니다.
- **H4. 이번 지시문의 Phase4 범위 제안과 EXECUTION_PLAN 원문의 불일치**(§2) — 이번 Task에서 EXECUTION_PLAN을 우선 적용했지만, 사용자가 정말 작성/수정 기능을 Phase4에서 원한다면 EXECUTION_PLAN 자체를 개정하는 별도 승인이 필요하다.

### Medium
- **M1. `(protected)` route group 사용 여부 여전히 미결정** — 이번 Task 범위에서 다루지 않음(이전 감사 R6, 재확인만 함, 아직 미결).
- **M2. `next` 파라미터 OAuth 미왕복** — Phase4 하위 페이지(history 등) 리다이렉트 후 항상 홈으로 이동하는 문제, 여전히 미해결(Phase2 잔여).
- **M3. 로그인했지만 온보딩 미완료 상태의 `/my/journal` 접근 시나리오** — 여전히 명시적으로 정의되지 않음(이전 감사 R8 재확인, 이번 Task에서도 결론 내지 않음 — Phase4-0.5 구현 시 함께 결정 권장).

### Low
- GNB/BottomNavigation 메뉴 구성 차이, "더보기" 미구현 — 기존 발견 재확인, Phase4와 무관.

---

## 12. Phase4 Implementation Sequence

```
Phase4-0.5  proxy.ts Option B 구현          ← 다음 Task, 최우선(H1 해소)
   ↓ (이 코드 변경 없이는 /my/journal 허브를 올바르게 만들 수 없다)
Phase4-1    API 계약/서비스 구현             (§9의 함수 시그니처를 lib/api/journal.ts로 구현 + 테스트)
   ↓
Phase4-2    페이지 골격 6개 + EmptyState     (§2 포함 목록, §10 User Flow 그대로 반영)
   ↓
Phase4-3    journal 전용 컴포넌트            (JournalSummaryCard/NumberHistoryList/ResultCard, §8 색상 정책 적용)
   ↓
Phase4-4    실 데이터 연결 검증              (fortune_results의 user_id 필터 누락 여부 특히 중점 검증, §9)
   ↓
Phase4-5    Phase4 Audit                    (Phase3-8과 동일 형식)
```

---

## 13. Implementation Gate

### **CONDITIONAL READY**

모든 Critical/High 의사결정(§3 인증 정책, §2 범위, §5/6 DB, §7 Fortune, §8 색상)이 이번 Task에서 확정되어 더 이상 "결정 대기" 상태인 항목은 없다. 그러나 그중 하나(§3 Option B)는 **결정과 동시에 실행을 요구하는 코드 변경**이며, 이번 Task 원칙(결정과 구현 분리)에 따라 아직 구현되지 않았다. 따라서 Phase4의 전체 페이지 골격(특히 `/my/journal` 허브)을 바로 시작하면 재작업이 발생한다 — **proxy.ts 변경이 선행되어야 CONDITIONAL이 풀리고 READY가 된다.**

**다음 Task**: **Phase4-0.5 — proxy.ts Option B 구현.** 범위는 정확히 다음 하나로 한정한다: `/my/journal`(정확히 이 경로만)을 `proxy.ts`의 즉시 리다이렉트 대상에서 제외하고, 그 외 모든 `/my/*` 경로는 현재 동작을 그대로 유지한다. 이 구현이 끝나면 Phase4-1(API 계약/서비스 구현)로 곧바로 진행 가능하다.
