# PHASE5 PRE-IMPLEMENTATION AUDIT — 번호 생성(Generate)

> Phase5 착수 전 사전 감사 + 설계 결정 문서다. 프로덕션 코드/Migration/Schema/RLS/컴포넌트를 전혀 수정하지 않았다. 검증에 사용한 임시 라우트/스크립트/테스트 계정은 전부 삭제했다.

---

## 1. Audit 목적

Phase4(행운 다이어리)가 CONDITIONAL PASS로 종료된 상태에서, Phase5(번호 생성)를 실제로 구현하기 전에 DB/RLS/API/Design System/문서 정합성을 종합 점검하고, 구현 범위·저장 정책·서비스 계약을 미리 확정해 구현 도중 재작업이 발생하지 않도록 한다.

## 2. 기준 문서 (전부 원문 재확인)

`docs/EXECUTION_PLAN.md`(Phase5 원문 전체), `docs/ROADMAP.md`, `docs/SITEMAP.md`, `docs/INFORMATION_ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/DATABASE_SCHEMA.md`, `docs/PHASE4_FINAL_AUDIT_REPORT.md`, `docs/PHASE4_ARCHITECTURE_DECISION.md`, `docs/PHASE4_DIARY_READ_SERVICE_REPORT.md`, `docs/PHASE3_FINAL_AUDIT_REPORT.md`. 실제 코드는 `app/`, `components/`, `lib/api/`, `lib/types/`, `lib/auth/`, `lib/supabase/`, `supabase/migrations/`, `proxy.ts` 전체를 확인했다.

---

## 3. Phase5 범위 확정

### EXECUTION_PLAN.md Phase5 원문 요약(추측 없이 원문 그대로)

- **목표**: "번호를 생성하고, 로그인 상태면 자동으로 다이어리(`user_numbers`)에 기록되는 기능을 완성한다."
- **생성 파일**: `app/generate/page.tsx`, `components/lotto/NumberGenerator.tsx`, `components/lotto/NumberResultDisplay.tsx`(LottoBall 재사용), `lib/logic/generateNumbers.ts`(순수 함수)+테스트, `app/api/numbers/route.ts`(POST), `lib/api/numbers.ts`
- **수정 파일**: `lib/api/journal.ts`(**"실데이터 반영 최종 점검"** — 수정이 아니라 검증 항목으로 명시됨), 다이어리 히스토리 페이지(실데이터 렌더링 확인)
- **완료 기준**: 비로그인 생성 정상 동작(저장 없이) / 로그인 생성 시 다이어리 히스토리에 즉시 반영 / CHECK 제약 위반 데이터가 생성되지 않음
- **주의사항**: "당첨 확률 보장 없음" 문구 상시 노출 / **커스텀 생성(고정/제외번호)은 이번 Phase에 넣지 않는다 — 완전자동만**

### 범위 표

| 기능 | Phase5 포함 여부 | 근거 |
|---|---|---|
| 번호 생성 UI(`/generate`) | **포함** | EXECUTION_PLAN 생성 파일 목록 |
| 번호 생성 알고리즘(완전자동) | **포함** | `lib/logic/generateNumbers.ts`, "완전자동만으로 이 Phase를 끝낸다" |
| 번호 저장(로그인 시 자동) | **포함** | "로그인: POST /api/numbers → user_numbers INSERT" |
| 번호 조회(다이어리 히스토리) | **이미 완료(Phase4)** | `getRecentUserNumbers()`가 이미 실제 데이터 기준으로 검증됨(§6) |
| 번호 삭제 | **제외** | EXECUTION_PLAN 어디에도 없음, Phase4도 조회 전용으로 한정했음 |
| 당첨 확인 | **제외** | Phase6 명시 |
| 번호 통계 | **제외** | `user_period_stats`는 Phase4 감사에서도 이미 범위 밖으로 확정(`docs/PHASE4_ARCHITECTURE_DECISION.md` §5-1) |
| 공유(카카오) | **제외(단, 문서 공백 발견— §16 참조)** | EXECUTION_PLAN Phase5 파일 목록에 공유 UI가 없다. `share_cards`(0009)는 테이블/버킷만 Phase1에 만들어졌고 실제 UI를 만드는 Phase가 어느 문서에도 명시되어 있지 않다(Fortune과 동일한 유형의 "Phase 미배정" 공백) |
| 커뮤니티 | **제외** | ROADMAP Won't/Phase4(커뮤니티, 다른 번호체계) — 이 프로젝트의 Phase5(EXECUTION_PLAN 기준)와 무관 |
| AI 추천 | **제외** | "완전자동"만 명시, AI 관련 서술 없음 |
| 꿈 기반 번호 생성 | **제외** | `generation_method` enum에 `'dream'` 값이 이미 있지만, 실제 연동(`/generate?source=dream`)은 EXECUTION_PLAN **Phase7**에 명시됨 — Phase5는 `'auto'`만 사용 |
| 자동 생성 | **포함** | 위와 동일(핵심 기능) |
| 중복 제거(번호 내 6개 서로 다른 값) | **포함(도메인 규칙)** | §5, §10에서 DB CHECK로 이미 강제됨을 실측 확인 |
| 생성 이력 | **이미 완료(Phase4)** | 상동 |
| 커스텀 생성(고정/제외번호) | **명시적 제외** | "무리해서 넣지 않는다" |
| 여러 게임 동시 생성 | **문서에 없음 → Decision 필요** | §12 |

### 문서 충돌 발견 — `/generate` vs `/generate/auto`

`docs/SITEMAP.md` §1은 URL 트리에서 `/generate`(허브) 아래 `/generate/auto`(완전 자동 생성, MVP)를 하위 경로로 정의한다. 그런데:
1. `docs/EXECUTION_PLAN.md` Phase5는 `app/generate/page.tsx`를 생성 파일로 명시한다(`/generate/auto`가 아님).
2. **실제로 이미 구현·검증된 코드**(Phase3에서 만든 `app/page.tsx`의 FEATURES 배열, `components/navigation/BottomNavigation.tsx`, `components/navigation/GlobalNav.tsx`)가 전부 `/generate`를 직접 가리킨다(전부 grep으로 재확인).
3. `docs/SITEMAP.md` §4의 P0 우선순위 표 자체도 `/generate`(허브)를 나열하지, `/generate/auto`를 나열하지 않는다 — SITEMAP 문서 내부에도 §1(트리)과 §4(우선순위표) 사이에 미세한 불일치가 있다.

이번 지시문이 지정한 충돌 해소 순서(①실제 코드 ②EXECUTION_PLAN ③Architecture Decision ④ROADMAP)에 따르면 **①·②가 이미 일치하고 실제 코드가 그렇게 굳어져 있으므로, Phase5는 `/generate`를 그대로 사용하는 것이 맞다.** SITEMAP의 `/generate/auto` 서술은 보고만 하고 임의로 구현하지 않는다.

---

## 4. DB 구조 분석 — `user_numbers` (실제 `0002_draws_user_numbers.sql` 원문 재확인)

| 컬럼 | 타입/제약 | 확인 결과 |
|---|---|---|
| `id` | `bigint generated always as identity primary key` | PK |
| `user_id` | `uuid references public.profiles (id)`, NULL 허용 | 비회원 생성 지원(NULL) |
| `session_id` | `varchar(64)`, NULL 허용 | 비회원 추적용(현재 어떤 코드도 채우지 않음 — Phase5가 실제로 쓸지 결정 필요, §12) |
| `numbers` | `int[] not null check (public.is_valid_lotto_numbers(numbers))` | **아래 참조** |
| `generation_method` | `enum('auto','custom','dream','fortune') not null` | Phase5는 `'auto'`만 사용 |
| `related_dream_id`/`related_fortune_id` | `bigint`, NULL 허용, FK 없음(의도적) | Phase5는 사용하지 않음(둘 다 NULL로 INSERT) |
| `recommendation_reason` | `text`, NULL 허용 | Phase5는 사용하지 않음 |
| `is_purchased`/`purchase_amount` | `boolean/int not null default` | Phase5 범위 밖(Phase2 이후 확장 필드) |
| `memo` | `text`, NULL 허용 | Phase5는 사용하지 않음 |
| `target_round` | `int references draws(round)`, NULL 허용 | Phase5는 NULL(대조 대상 회차는 Phase6이 정함) |
| `is_public` | `boolean not null default true` | 기본값 그대로 사용 가능 |
| `match_count`/`win_rank`/`checked_at` | NULL 허용 | Phase6이 채움, Phase5는 NULL |
| `created_at` | `timestamptz not null default now()` | 정렬 기준(Phase4가 이미 사용 중) |

**"번호 6개" 규칙의 DB 강제 여부 — 실측 확인**: `public.is_valid_lotto_numbers(numbers)` 함수(0002에서 정의)가 `array_length=6`, `1~45 범위`, `count(distinct)=6`(중복 없음)을 SQL로 강제하며, 이번 감사에서 실제로 위반 데이터(7개 원소·범위초과, 중복 포함)를 INSERT 시도해 **둘 다 `23514`(check_violation)로 즉시 거부됨을 실측 확인했다.** 즉 이 도메인 규칙은 **애플리케이션이 아니라 DB 레벨에서 강제된다** — Phase5의 `generateNumbers()`가 버그로 잘못된 배열을 만들어도 DB가 최종 방어선 역할을 한다.

`DATABASE_SCHEMA.md` §3.3과 실제 SQL 비교 결과 **완전히 일치**(불일치 없음).

---

## 5. RLS / 보안 분석 — 실제 Supabase 프로젝트 실측 (이번 Task에서 신규 실행, 검증 후 전량 삭제)

카카오 API만 우회(`establishKakaoSupabaseSession()`)해 User A/B 계정을 만들고, **Supabase REST API에 anon key + 각자의 실제 JWT를 직접 실어** 요청했다(서버 코드를 거치지 않고 RLS 자체를 검증).

| 시나리오 | 결과 |
|---|---|
| User A: 자기 번호 INSERT | `201` 성공 |
| User A: 자기 번호 SELECT | `200`, 본인 행 반환 |
| User B: User A 번호 SELECT | `200`, **빈 배열**(0건) |
| User B: User A 번호 UPDATE 시도(`Prefer: return=representation`) | `200`, **빈 배열**(실제 0행 변경 — "0건이라 성공처럼 보이는" 함정을 `return=representation`으로 정확히 구분) |
| User B: User A 번호 DELETE 시도(`return=representation`) | `200`, **빈 배열**(실제 0행 삭제) |
| **재조회로 재확인**: User B의 시도 이후 User A 행이 그대로 존재하는지 | **원본 데이터 그대로 존재** — User B의 UPDATE/DELETE가 실제로 아무 영향도 주지 못했음을 이중 확인 |
| User A: 자기 번호 UPDATE(memo) | `200`, 실제 값 변경 확인 |
| 비로그인(anon): INSERT | `401`, RLS 정책 위반 메시지로 즉시 차단 |
| 비로그인(anon): SELECT | `200`, 빈 배열(0건) |
| 비로그인(anon): UPDATE/DELETE 시도 | `200`, 빈 배열(0건, 실제 변경 없음) |
| User A: 자기 번호 DELETE(정리) | `200`, 실제 삭제됨 |
| **CHECK 제약**: 7개 원소+범위초과 INSERT | `400`(`23514`) 거부 |
| **CHECK 제약**: 중복 원소 INSERT | `400`(`23514`) 거부 |
| **`user_id` 위조**: User A가 User B의 `user_id`로 INSERT 시도 | `403`(RLS policy violation) — **본인이 아닌 `user_id`로는 INSERT 자체가 불가능함을 실측 확인** |

**결론**: `user_numbers`의 RLS(`0008_rls_policies.sql`, 이미 존재, 이번 Task에서 전혀 수정하지 않음)는 Phase5가 필요로 하는 모든 시나리오(본인 CRUD 허용, 타인 차단, 비로그인 차단, `user_id` 위조 차단)를 이미 완전히 만족한다. **RLS 변경이 필요 없다.**

---

## 6. 번호 생성 알고리즘 분석

전체 코드베이스를 `generate`/`random`/`lotto`/`Math.random` 등으로 검색한 결과, **실제 번호 생성 로직은 어디에도 존재하지 않는다**(매치된 것은 전부 무관: `admin.generateLink`(Supabase Auth API), UI 텍스트 "번호생성"(nav 라벨), `is_valid_lotto_numbers`(DB 검증 함수), `total_generated`(통계 컬럼명)). **Phase5가 완전히 새로 만들어야 한다** — 재사용/수정 대상인 기존 구현이 없다.

### 균등 분포/보안 요구사항 판단

이 기능은 실제 추첨이나 금전적 이해관계가 걸린 난수가 아니라 **"사용자에게 후보 번호를 제안"하는 유틸리티**다. 조작 방지나 예측 불가능성이 서비스의 신뢰도를 좌우하는 진짜 추첨(`draws` 테이블, 관리자가 공식 결과를 입력하는 대상)과는 성격이 다르다. 따라서:
- **암호학적으로 안전한 난수(`crypto.getRandomValues` 등)는 불필요하다.** `Math.random()` 기반의 일반 PRNG로 충분하다 — 과설계다.
- 실행 위치는 **서버/클라이언트 어느 쪽이든 가능**(순수 함수, DB 접근 없음). 단, §7에서 설명하듯 "화면에 보여준 번호"와 "저장된 번호"가 반드시 같아야 하므로 **한 번만 생성하고 그 결과를 그대로 저장에 사용**해야 한다(재생성 금지).
- 재현성(동일 입력 → 동일 출력)은 필요 없다 — 매번 다른 결과가 나오는 것이 기능의 목적 자체다.
- **로또 번호 "예측"이나 "당첨 확률 향상" 같은 과학적 근거 없는 프레이밍은 설계에 넣지 않는다** — EXECUTION_PLAN 자신이 "당첨 확률 보장 없음" 문구를 상시 노출하라고 명시한 것과 정확히 같은 취지다.

---

## 7. Diary(Phase4) 연동 분석

- `user_numbers`에 INSERT되는 즉시, `lib/api/journal.ts`의 `getRecentUserNumbers()`(정렬: `created_at desc`)가 다음 조회 시점에 자동으로 포함한다 — **이 함수는 이미 실제 Supabase 프로젝트에서 시딩한 데이터로 정상 동작이 검증되어 있다**(`docs/PHASE4_DIARY_READ_SERVICE_REPORT.md` §10, `docs/PHASE4_FINAL_AUDIT_REPORT.md` §2). Postgres는 커밋된 INSERT를 다음 SELECT에서 즉시 반영하므로("즉시 반영"의 의미가 실시간 구독이 아니라 재조회 시 최신 상태를 보는 것이라면) 별도 캐시 무효화 로직이 필요 없다.
- `generation_method`은 Phase4의 히스토리 페이지가 이미 `GENERATION_METHOD_LABEL`(`auto`/`custom`/`dream`/`fortune` 매핑)로 표시 준비가 되어 있다(`app/my/journal/history/page.tsx`, 재확인) — Phase5가 `'auto'` 값으로 INSERT하면 **코드 수정 없이 "자동 생성" 뱃지로 그대로 표시된다.**
- **결론: Phase5는 Phase4 코드(`lib/api/journal.ts`, `app/my/journal/history/page.tsx`, `components/journal/*`)를 전혀 수정하지 않고 완료할 수 있다.** EXECUTION_PLAN이 "수정할 파일"로 적어둔 것은 실제 코드 변경이 아니라 "완료 후 재검증" 항목이며, 그 재검증은 Phase4 감사 과정에서 이미 실측으로 마쳤다.

---

## 8. API / Service 계약 제안 (설계만, 구현 안 함)

기존 `app/api/profile/route.ts`의 컨벤션(`getCurrentUser()` 우선 확인 → `{ data }`/`{ error: { code, message } }` 응답 형태 → 도메인 에러는 커스텀 `Error` 서브클래스)을 그대로 따른다.

### `lib/logic/generateNumbers.ts` — 순수 함수

- **입력**: 없음(향후 옵션 확장 여지만 열어둠, 이번 Phase는 파라미터 없이 완전자동)
- **출력**: `number[]`(정확히 6개, 오름차순 정렬 권장 — DB에는 정렬 여부와 무관하게 저장 가능하지만 화면/데이터 일관성을 위해 정렬해서 반환하는 것을 권장)
- **위치**: 프레임워크 비의존 순수 함수 — Client/Server Component 어디서든 동일하게 호출 가능
- **에러 처리**: 없음(항상 유효한 값을 반환하도록 구현하는 것이 함수의 책임)

### `lib/api/numbers.ts` — 저장 서비스(Phase4의 `lib/api/journal.ts`와 동일 패턴)

`saveUserNumbers(numbers: number[]): Promise<UserNumberEntry>`
- **인증**: 함수 내부에서 `getCurrentUser()` 호출, 없으면 에러(호출 자체가 "로그인 사용자만 저장" 전제) — **`userId`를 파라미터로 받지 않는다**(Phase4 패턴과 완전히 동일).
- **입력 검증**: `numbers`가 정확히 6개, 1~45 범위, 중복 없음을 애플리케이션 레벨에서도 검증(DB CHECK와 이중 방어 — DB 에러(`23514`)를 그대로 사용자에게 노출하지 않기 위함).
- **Supabase client**: `lib/supabase/server.ts`(anon+세션) — **service_role 불필요**. RLS(§5)가 이미 본인 INSERT만 허용하므로 인증된 세션 클라이언트로 충분하다.
- **에러 처리**: 검증 실패 → 도메인 에러(예: `NumbersValidationError`) → 호출부에서 400. DB 에러 → 그대로 throw(민감정보 미노출은 응답 매핑 단계에서 처리).

### `app/api/numbers/route.ts` — POST Route Handler

- **호출 위치**: Route Handler(EXECUTION_PLAN이 명시한 대로) — Server Action이 아니라 REST 스타일을 유지해 `app/api/profile/route.ts`와 일관된 컨벤션을 지킨다.
- **입력(요청 바디)**: `{ numbers: number[] }`만 받는다. **`user_id`/`generation_method`를 클라이언트가 지정하게 하지 않는다** — `generation_method`는 이번 Phase에서 서버가 항상 `'auto'`로 고정(향후 Phase7이 `dream`/`fortune` 값을 쓸 때 이 지점을 확장).
- **왜 `numbers`는 클라이언트가 보내야 하는가**: `generateNumbers()`가 클라이언트(또는 렌더링 시점)에서 이미 실행되어 화면에 표시된 상태이므로, 저장 API가 서버에서 다시 생성하면 **"화면에 보인 번호"와 "저장된 번호"가 달라지는 버그**가 생긴다. 클라이언트가 "방금 보여준 그 번호"를 그대로 보내고, 서버는 그 값의 **유효성만** 검증한다(생성 방식을 신뢰하는 것이 아니라 결과값의 도메인 규칙 준수만 검증 — 로또 번호 제안 기능에는 "사용자가 원하는 숫자를 대신 골랐는지"를 막아야 할 보안적 이유가 없다, §6).
- **인증**: `getCurrentUser()` 없으면 `401`.
- **응답**: `{ data: UserNumberEntry }` 성공 시, `{ error: { code, message } }` 실패 시.
- **service_role**: 사용하지 않음.

### 클라이언트 측 흐름 요약

```
Client Component(NumberGenerator) → generateNumbers()(순수 함수, 즉시 실행, DB 호출 없음)
  → 화면에 결과 표시(애니메이션)
  → 로그인 상태면: 그 numbers를 그대로 POST /api/numbers
  → 비로그인 상태면: 아무것도 전송하지 않고 "로그인하면 기록돼요" 배너만 표시
```

---

## 9. UX 요구사항 (SITEMAP/INFORMATION_ARCHITECTURE/DESIGN_SYSTEM 기준)

- **페이지 목적**: [[INFORMATION_ARCHITECTURE]] §2.1/§2.2 홈 화면의 "빠른 실행 카드" 중 하나로 이미 진입점이 마련되어 있다(Phase3에서 이미 연결 완료, 재수정 불필요).
- **핵심 CTA**: "번호 생성하기"(이미 홈 Hero 버튼 문구로 확정, `app/page.tsx` 재확인) — Phase5는 `/generate` 페이지 안에서도 동일 라벨을 재사용하는 것을 권장.
- **결과 표시 애니메이션**: [[DESIGN_SYSTEM]] §6 "볼이 하나씩 굴러나오는 순차 애니메이션, 총 소요 0.8~1.2초", 트랜지션 200~300ms ease-out, `prefers-reduced-motion` 시 장식 애니메이션 비활성화 — 명확히 문서화되어 있다.
- **다시 생성**: EXECUTION_PLAN에 명시적 문구는 없지만 "결과 노출" 이후 사용자가 새 번호를 다시 뽑는 것은 이 기능의 통상적 사용 패턴이다 — `generateNumbers()`가 순수 함수라 버튼 클릭마다 재호출하면 된다(구현 세부사항, Decision 불필요).
- **로그인 필요 여부**: **비로그인도 생성 가능** — "비로그인: 결과만 표시(저장 없음)"이 EXECUTION_PLAN 완료 기준에 명시되어 있다. **"번호 생성 자체"와 "번호 저장"은 명확히 분리된 정책**이며, 저장 시점에만 로그인이 필요하다. 비로그인 사용자에게 로그인을 강제로 유도(리다이렉트)하지 않고 "로그인하면 다이어리에 기록돼요" 배너로 안내하는 것이 문서상 의도다(추측 아님, EXECUTION_PLAN 원문).
- **빈 상태**: 해당 없음(페이지 진입 시 이미 결과가 있거나 "생성하기" 버튼이 있는 초기 상태 — Phase4류 "데이터 없음" EmptyState 개념과는 다른 성격).
- **오류 상태**: 저장 실패(로그인 상태에서 `POST /api/numbers` 실패) 시 — Phase4가 이미 확립한 "일시적으로 연결이 어려워요" 톤의 에러 문구 패턴을 그대로 재사용 권장. 단, 저장이 실패해도 **화면에 표시된 번호 자체는 사라지지 않아야 한다**(생성 결과와 저장 결과는 독립적인 상태로 관리).
- **로딩 상태**: 저장 요청 중(`POST /api/numbers` 응답 대기) `Spinner`(기존 컴포넌트) 재사용 권장. 번호 "생성" 자체는 DB 호출이 없어 로딩 상태가 필요 없다(즉시 계산).
- **모바일/접근성**: [[UI_UX_GUIDELINE]] 기존 원칙(터치 타겟 44px 이상, 핵심 CTA 56px 이상, `prefers-reduced-motion`)을 그대로 따르면 된다 — Phase5 전용 신규 요구사항 없음.

---

## 10. 저장 정책 — 이미 확정된 정책의 재확인 (신규 Decision 아님)

이번 감사가 "A/B/C/D 중 결정"을 요구했으나, **EXECUTION_PLAN.md와 ROADMAP.md가 이미 A안(생성 즉시 자동 저장, 로그인 상태에 한함)으로 명시적으로 확정해뒀다** — ROADMAP §1 Must 표에 "번호 자동 저장 | 로그인 시 자동 저장"이라고 정확히 이 단어로 적혀 있다. 새로 결정할 사안이 아니라 **재확인**이다.

이 정책이 프로젝트 원칙에 부합하는 이유:
- **Supabase Free Tier**: 행 1개(numbers 배열 하나, 몇 개의 스칼라 컬럼) INSERT는 비용상 무의미한 수준 — 500MB DB 한도 기준으로 수만~수십만 건 단위까지 문제없다.
- **유지보수 비용**: "저장" 버튼을 별도로 만들면 그 버튼의 상태 관리(저장됨/저장 안 됨/저장 중)가 추가로 필요해진다 — 자동 저장은 그 복잡도 자체를 없앤다(1인 개발 원칙과 직결).
- **UX**: "다이어리가 핵심"이라는 이 프로젝트의 정체성(ROADMAP §0)과 맞다 — 사용자가 별도 행동을 하지 않아도 기록이 쌓이는 것이 "행운 다이어리"의 핵심 가치 제안이다.
- **로그인 전환**: 비로그인 시 "저장 안 됨"을 보여주는 것 자체가 로그인 유도 장치로 이미 설계되어 있다(배너).
- **향후 확장성**: `generation_method`/`related_dream_id`/`related_fortune_id` 등 이미 만들어둔 컬럼들이 "생성 즉시 저장"을 전제로 설계되어 있다(생성 시점의 맥락을 스냅샷으로 남기는 구조) — 사용자가 나중에 "저장" 버튼을 누르는 방식이었다면 이 컬럼들의 값을 그 사이에 어떻게 유지할지 별도 상태 관리가 필요해진다.

**C안(로컬 상태만, 저장 없음)과 B안(수동 저장)은 기각** — 문서가 이미 A안으로 확정했고, 기각할 만한 반대 근거도 없다.

---

## 11. 로또 도메인 규칙

| 규칙 | 상태 |
|---|---|
| 1~45 범위 | DB CHECK로 강제(실측 확인, §5) |
| 정확히 6개 | DB CHECK로 강제(실측 확인) |
| 중복 없음 | DB CHECK로 강제(실측 확인) |
| 오름차순 정렬 | 문서에 명시 없음 — **강제 규칙 아님**, `generateNumbers()` 구현 시 정렬해서 반환하는 것을 권장(일반적인 로또 UI 관례, Decision 불필요) |
| 동일 번호 조합 중복 허용 여부 | UNIQUE 제약 없음(재확인) — **이미 허용되는 상태이며 이것이 올바르다**(진짜 무작위라면 같은 조합이 두 번 나올 수 있어야 함, 막을 이유 없음) — Decision 불필요 |
| bonus number 필요 여부 | `user_numbers`에는 `bonus_number` 컬럼 자체가 없다(`draws`에만 있음) — Phase5 생성 결과에는 **애초에 해당 사항 없음** |
| 당첨 번호/사용자 번호 데이터 구조 분리 | 이미 `draws`(공식 결과)와 `user_numbers`(사용자 기록)로 분리되어 있음(기존 스키마) |
| **한 번에 여러 게임 생성 가능 여부** | **문서에 없음 → Decision 필요** |
| **최대 생성 게임 수 / 저장 개수 제한** | **문서에 없음 → Decision 필요** |
| **생성 횟수 제한(rate limit)** | **문서에 없음 → Decision 필요**(단, §13에서 MVP 비필수로 판단) |

---

## 12. 성능/비용 분석

| 질문 | 판단 |
|---|---|
| 번호 생성 자체가 DB 호출 없이 가능한가 | **가능** — 순수 함수, 외부 의존성 없음 |
| 저장이 DB 1회 호출로 가능한가 | **가능** — 단일 INSERT 1건 |
| 여러 게임 생성 시 N+1 발생 가능성 | **여러 게임을 지원하기로 결정하면 발생 가능** — 게임 수만큼 INSERT를 반복하면 N+1이 된다. 다만 Supabase(PostgREST)는 배열 형태의 다중 INSERT(bulk insert, 요청 1회에 행 여러 개)를 지원하므로, 여러 게임을 지원하기로 결정하더라도 N+1 없이 구현 가능하다 — **이번 Decision(§11의 "여러 게임")에 따라 구현 방식이 갈릴 뿐, 기술적으로 막히는 지점은 아니다** |
| Diary 조회와 충돌 가능성 | 없음 — `getRecentUserNumbers()`는 읽기 전용 SELECT, `POST /api/numbers`는 INSERT만 수행. 서로 다른 요청/트랜잭션이라 충돌 없음 |
| 불필요한 API Route 필요 여부 | `app/api/numbers/route.ts` 하나로 충분(EXECUTION_PLAN이 이미 이렇게 설계) |
| Edge Function 필요 여부 | **불필요** — `docs/IMPLEMENTATION_PLAN.md`/`ROADMAP.md`의 기존 원칙("Edge Function/Cron은 Phase5 이후 실제 트래픽 필요 시 도입")과 별개로, 번호 생성은 동기 처리로 충분히 가벼운 작업이라 애초에 배치/비동기 처리 대상이 아니다 |
| Server Action 필요 여부 | **불필요** — Route Handler로 EXECUTION_PLAN이 이미 결정해뒀고, 기존 프로젝트의 유일한 쓰기 API(`app/api/profile/route.ts`)도 Route Handler 컨벤션이라 일관성 있음 |
| 클라이언트에서 생성해도 되는가 | **가능하고 권장됨** — §6/§9 참조, 애니메이션 표시를 위해서도 Client Component 실행이 자연스럽다 |

**가장 단순한 구조**: `generateNumbers()`(순수 함수, 클라이언트 실행) → 로그인 시 `POST /api/numbers`(단일 INSERT) → Phase4의 기존 조회 함수가 자동으로 반영. 새로운 인프라(Edge Function, 별도 캐시, Server Action)가 전혀 필요 없다.

---

## 13. 악용 가능성 / 보안 방어 분류

| 위협 | MVP에서 필요한 방어 | 나중에 추가 가능 |
|---|---|---|
| `user_id` 위조 | **이미 방어됨** — RLS가 INSERT 시 `auth.uid() = user_id`를 강제(실측 확인, §5). 서버 코드도 `getCurrentUser()`로만 `user_id`를 결정해야 하며 클라이언트 입력을 신뢰하지 않는다(설계 원칙, §8) | — |
| 비정상 payload(범위 밖 숫자, 7개 이상 등) | **이미 방어됨** — DB CHECK(실측) + 애플리케이션 레벨 이중 검증(§8 설계) | — |
| 다른 사용자의 번호를 대신 저장 | **이미 방어됨** — RLS(§5) | — |
| API 직접 호출(프론트엔드 우회) | `getCurrentUser()` 기반 인증이 API 레벨에서 이미 강제됨(기존 `app/api/profile/route.ts`와 동일 패턴 적용 예정) | — |
| 무제한 DB INSERT(같은 사용자가 자기 계정에 대량 생성) | **MVP에서는 방어하지 않아도 된다** — 타인에게 피해가 가지 않고(RLS로 본인 데이터만 영향), 손해는 본인 Supabase 사용량뿐이다. 실제로 이런 유인이 있는 사용자도 드물다 | 저장 개수 상한(§11 Decision)이나 시간당 생성 횟수 제한은 실사용 데이터를 보고 필요성이 확인되면 그때 추가 |
| 악의적인 대량 요청(스크립트로 반복 호출) | **MVP에서는 방어하지 않아도 된다** — 위와 동일 이유, 게다가 Supabase 자체에도 프로젝트 레벨 요청 제한이 있다 | 명시적 rate limit(예: IP/사용자당 분당 N회)은 실제 남용 사례가 관측되면 추가 |
| 저장 개수 폭증으로 인한 DB 용량 문제 | **MVP에서는 낮은 우선순위** — 500MB Free Tier 한도 대비 `user_numbers` 1행 크기가 매우 작다(int[6] 등) | 사용자당 저장 상한은 실사용 지표(평균 생성 횟수)를 본 뒤 결정 |

**결론**: RLS와 DB CHECK가 이미 제공하는 방어만으로 MVP 단계의 실질적 위험은 전부 차단된다. Rate limit 등 추가 방어는 지금 만들지 않는 것이 "1인 개발/과설계 지양" 원칙에 맞다.

---

## 14. Design System / UI 컴포넌트 재사용 가능성

| 컴포넌트 | 재사용 가능 여부 |
|---|---|
| `Button`(`buttonClassName`) | **재사용 가능** — "번호 생성하기"/"다시 생성" CTA에 그대로 사용 |
| `Card` | **재사용 가능** — 결과 표시 영역의 컨테이너로 사용 가능 |
| `EmptyState` | **부분적으로만 관련** — Phase5에는 "데이터 없음" 개념이 없어 그대로 쓰일 곳은 적지만, 저장 실패 시 안내 문구 표시에 `components/journal/JournalLoadError`류 패턴(같은 문구 스타일)을 참고할 수 있다 |
| `Spinner` | **재사용 가능** — 저장 요청 중 로딩 표시 |
| `Input`/`Label` | 관련 없음(Phase5는 입력 폼이 없다 — 완전자동만) |
| `Badge` | **재사용 가능(선택)** — "당첨 확률 보장 없음" 안내를 배지가 아니라 본문 텍스트로 넣는 것을 권장(Badge는 danger 색상 유혹이 있는 자리라 Phase3/4가 이미 피해온 함정을 반복하지 않기 위함, §15) |
| `Container`/`PageShell`/`Main` | **재사용 필수(변경 금지)** — 다른 모든 페이지와 동일하게 감싸는 구조 |

**새로 만들어야 하는 것(지금 생성하지 않고 후보만 제안)**:
- **`components/lotto/NumberGenerator.tsx`**(Client Component, EXECUTION_PLAN 계획대로) — 상태(현재 결과, 로딩, 에러)를 갖는 유일한 컴포넌트가 되어야 한다.
- **`components/lotto/NumberResultDisplay.tsx`** — EXECUTION_PLAN은 "LottoBall 재사용"을 전제하지만, **`LottoBall`은 실제로 존재하지 않는다**(전체 코드베이스 grep 확인, [[DESIGN_SYSTEM]] §4.2가 "시그니처 컴포넌트"로 지정했으나 Phase3의 어느 보고서에도 만들어진 적이 없음, `docs/PHASE4_PRE_IMPLEMENTATION_AUDIT.md` §9에서 이미 같은 공백을 지적함). **Phase5가 이 컴포넌트를 신규로 만들어야 한다** — "재사용"이 아니라 "신규 생성 후 향후 재사용 가능하게" 만드는 작업이다.

과도한 추상화 우려는 없다 — 위 2개는 EXECUTION_PLAN이 이미 계획한 최소 구성이고, 기존 컴포넌트로 대체 가능한 부분(버튼/카드/스피너)은 전부 재사용하기로 확인했다.

---

## 15. Phase3/4 잔여 이슈가 Phase5에 미치는 영향

| 이슈 | 분류 | 근거 |
|---|---|---|
| `color-danger`/`color-success` WCAG 미달 | **Phase5와 무관** | Phase5 UI(번호 생성 결과)는 성공/실패 이분법 상태를 표시할 필요가 없다(생성은 항상 "성공"이고, 저장 실패는 중립적 안내 문구로 충분) — danger/success 색상을 쓸 필요 자체가 없다 |
| `destructive` variant hover 미정의 | **Phase5와 무관** | 삭제 등 destructive 액션이 Phase5 범위에 없다 |
| GNB/BottomNavigation 메뉴 구성 차이 | **Phase5와 무관** | `/generate`는 GNB·BottomNavigation 양쪽에 이미 동일하게 연결되어 있어(재확인) 이 차이(꿈해몽 유무)와 무관 |
| Fortune Phase 미배정 | **Phase5와 무관** | `generation_method`의 `'fortune'` 값은 Phase5가 쓰지 않는다(`'auto'`만 사용) |
| "더보기" 메뉴 미구현 | **Phase5와 무관** | `/generate`는 이미 주요 내비게이션에 노출되어 있어 "더보기"와 무관 |
| Header 세션 조회로 인한 정적 페이지 동적화 | **Phase5와 무관** | `/generate`는 로그인 여부에 따라 배너/저장 동작이 달라져야 하는 페이지라 애초에 정적(SSG) 대상이 아니다 — 이 이슈가 새로운 제약을 추가하지 않는다 |
| `proxy.ts` vs Architecture Decision 문서 불일치 | **Phase5와 무관** | `/generate`는 `proxy.ts`의 `PROTECTED_PATHS`에 전혀 포함되지 않는 완전 공개 경로다(재확인) — 이 불일치는 `/my/*`에만 해당 |

**Phase5 착수 전 해결이 필요한 기존 이슈는 없다.**

---

## 16. Decision 필요 사항 (추측하지 않고 전부 명시)

1. **`/generate` vs `/generate/auto`**: SITEMAP §1의 트리 구조를 정정할지, 아니면 실제 구현(현재 전체 코드베이스가 이미 `/generate`로 통일)을 그대로 확정하고 SITEMAP을 그에 맞게 갱신할지. (권장: 후자 — 이미 여러 Phase에 걸쳐 `/generate`로 굳어져 있고 되돌릴 이유가 없음)
2. **한 번에 여러 게임 생성 가능 여부**: 1세트(6개)만 지원할지, 5게임처럼 여러 세트를 한 번에 생성할지. EXECUTION_PLAN 문구("1~45 무작위 6개")는 단수형이라 1세트를 시사하지만 명시적 결정은 없다.
3. **저장 개수/생성 횟수 제한**: 사용자당 저장 가능한 `user_numbers` 행 수 상한, 또는 시간당 생성 횟수 제한을 둘지. §13 분석 결과 MVP에서는 불필요하다고 판단했으나, 이 판단 자체가 사용자 승인 대상이다.
4. **공유(카카오 공유) 기능의 Phase 배정**: `share_cards` 테이블(0009)은 이미 있지만 실제 공유 버튼 UI를 만드는 Phase가 어느 문서에도 없다(Fortune과 동일 유형의 공백, §3). Phase5에 포함시킬지, 별도 Phase로 분리할지.
5. **`session_id`(비회원 추적) 컬럼 사용 여부**: 스키마에 이미 있지만 Phase5가 비로그인 생성 결과를 이 컬럼으로 추적할지, 아니면 사용하지 않고 그냥 NULL로 둘지 — EXECUTION_PLAN은 "비로그인은 저장하지 않는다"고만 하고 이 컬럼의 용도를 언급하지 않는다.

---

## 17. Phase5 Ready 판정

### **CONDITIONAL PASS**

기술적 결함이나 Critical/High 문제는 발견되지 않았다. DB/RLS는 이미 Phase5가 필요로 하는 모든 것을 실측으로 검증된 상태로 갖추고 있고, Phase4 코드와의 연동도 수정 없이 가능함을 확인했다. `CONDITIONAL PASS`로 판정하는 이유는 §16의 5가지 결정 사항이 남아있기 때문이다 — 그중 1번(`/generate` 경로)은 구현 방향에 직접 영향을 주므로 착수 전 확인을 권장하고, 나머지는 구현 중간에 확인해도 무방하다.

1. **Phase5 구현 범위**: `/generate` 페이지, `generateNumbers()` 순수 함수, `POST /api/numbers`, `lib/api/numbers.ts`, `components/lotto/NumberGenerator.tsx`+`NumberResultDisplay.tsx`(신규, LottoBall 포함) — §3 표 그대로.
2. **DB 변경 필요 여부**: **불필요.** 기존 `user_numbers` 스키마가 완전히 충분함(§4).
3. **RLS 변경 필요 여부**: **불필요.** 기존 정책이 모든 시나리오를 이미 만족함(§5 실측).
4. **API/Service 추가 필요 여부**: **필요.** `app/api/numbers/route.ts`, `lib/api/numbers.ts`, `lib/logic/generateNumbers.ts` 신규 생성(§8) — 전부 신규 추가이지 기존 파일 수정이 아니다.
5. **`/generate` 로그인 요구 여부**: **생성은 불필요, 저장만 필요.** 비로그인도 생성 가능(결과만 표시), 저장은 로그인 시에만(§9).
6. **번호 생성 알고리즘 구현 위치**: `lib/logic/generateNumbers.ts`(순수 함수), 실행은 클라이언트(Client Component) 권장(§6, §9).
7. **번호 저장 시점**: 생성 즉시 자동 저장(로그인 상태에 한함) — 이미 확정된 정책의 재확인(§10).
8. **반드시 사용자 결정이 필요한 사항**: §16의 5가지.
9. **Phase5-1에서 가장 먼저 해야 할 작업**: §18.

---

## 18. Phase5-1 추천 작업

**Phase5-1 — `generateNumbers()` 순수 함수 + 단위 테스트**를 가장 먼저 하는 것을 추천한다.

근거: EXECUTION_PLAN 자신의 구현 순서 1번이 이것이고, DB/API/UI 전부가 이 함수의 출력 형태(정확히 6개, 1~45, 중복없음, 정렬 여부)에 의존한다 — Phase4가 "API 계약을 먼저 확정한다"는 원칙으로 재작업을 피했던 것과 동일한 이유로, 여기서도 순수 함수의 계약(입출력 타입)을 가장 먼저 고정해야 이후 컴포넌트·API 작업이 흔들리지 않는다. 착수 전 §16-2(여러 게임 생성 여부)만 먼저 확인되면 이 함수의 반환 타입(`number[]` vs `number[][]`)이 처음부터 올바르게 설계된다.
