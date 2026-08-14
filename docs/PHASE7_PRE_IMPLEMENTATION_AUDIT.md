# Phase7-0 Pre-Implementation Audit — 꿈해몽

> 이 감사는 코드/Migration/RLS/UI를 수정하지 않는다. Phase3~6에서 이미 결정·검증된 사항(관리자 인증, RLS 컨벤션, 색상 토큰 이슈 등)은 재조사하지 않고 인용했고, 실제 코드/DB와 문서가 충돌하는 지점만 실측했다.

---

## 1. Phase7 정의

### 문서 간 충돌 발견

`EXECUTION_PLAN.md`(§ Phase 7 — 꿈해몽)와 `ROADMAP.md`(§2 Phase별 로드맵 — Phase 7 멤버십)가 "Phase 7"에 서로 다른 기능을 배정하고 있다:

- `EXECUTION_PLAN.md`: Phase 7 = 꿈해몽(열람/추천번호/개인 기록).
- `ROADMAP.md`: Phase 7 = 멤버십(구독) — 그런데 `ROADMAP.md`의 Phase 1은 "MVP" 전체(카카오 로그인부터 당첨확인까지, 즉 `EXECUTION_PLAN.md`의 Phase1~6 전부)를 가리킨다. 두 문서는 **같은 단어 "Phase"를 서로 다른 단위(거시적 사업 단계 vs 세부 기술 구현 단계)로 쓰고 있어 실제로는 번호 체계 자체가 다르다** — 진짜 의미의 상충이 아니라 표기 혼동이다.

### 우선순위 판단

1. **어떤 문서를 우선했는가**: `EXECUTION_PLAN.md`.
2. **왜**: (a) 이번 세션 전체(Phase1~6)가 시종일관 `EXECUTION_PLAN.md`의 세분화된 Phase 번호를 기준으로 진행돼 왔다(Task 지시문 자체가 "Phase6-4-2", "Phase7-0"처럼 `EXECUTION_PLAN.md` 번호를 그대로 사용). (b) **실제 코드가 이미 이 해석을 전제로 작성돼 있다** — `app/my/journal/dreams/page.tsx`의 주석이 "꿈 기록 작성은 Phase7 범위(이번 Task는 조회 전용)"이라고 명시하고, `app/page.tsx`의 `FEATURES` 배열도 "꿈해몽" 카드를 이미 `/dream`으로 연결해뒀다. 지시문의 "실제 코드 우선" 원칙에 따라 이 이상 논쟁할 필요가 없다.
3. **결론: Phase7 = 꿈해몽(열람, 꿈별 추천번호, 개인 꿈 기록)**. `ROADMAP.md`의 "Phase 7 멤버십"은 별도 번호 체계의 표기이며 실제 구현 순서와 무관하다 — 문서를 수정하지 않고 이 사실만 기록한다(Known Issue, §8).

---

## 2. 현재 구현 상태

| 항목 | 상태 |
|---|---|
| `dreams`/`dream_number_mappings` 테이블·RLS | **완성**(Phase1, `0003_dreams.sql`+`0008`) |
| `dreams` 시드 콘텐츠 20~30건 | **완성** — 실제 DB에서 25건 확인(읽기 전용 조회, 카테고리: 동물10/신체3/인물2/상황3/자연4/행동1/사물2) |
| `dream_number_mappings` 시드 | **완성** — 25건(꿈 1건당 추천번호 1세트) |
| `dream_journal_entries` 테이블·RLS(본인 CRUD 전부) | **완성**(Phase1, `0004_dream_journal_entries.sql`+`0008`) |
| 개인 꿈 기록 **조회** (`getRecentDreamJournalEntries()`, `app/my/journal/dreams/page.tsx`) | **완성**(Phase4) — `EXECUTION_PLAN.md`가 Phase7의 "수정할 파일"로 지정한 이 페이지의 "실데이터 연결"은 이미 Phase4에서 앞당겨 끝났다(§8 Known Issue) |
| 개인 꿈 기록 **작성**(`DreamJournalForm`) | **미구현** — `app/my/journal/dreams/page.tsx`에 "작성 기능 준비 중" Badge로 명시적으로 표시돼 있음 |
| `/dream`, `/dream/[keyword]`, `/dream/[keyword]/numbers`, `/dream/category/[category]` | **미구현**(전수 Glob 확인, 파일 없음) |
| `components/dream/*`(`DreamContent`, `DreamNumberSuggestion`) | **미구현** |
| `lib/api/dreams.ts` | **미구현** |
| `app/generate/page.tsx`의 `source=dream` 쿼리파라미터 처리 | **미구현**(현재 코드 직접 확인 — `generateNumbers()`만 호출, 쿼리파라미터 처리 없음) |
| GNB(`GlobalNav.tsx`) "꿈해몽" 메뉴, 홈(`app/page.tsx`) "꿈해몽" 카드 | **이미 존재, `/dream`을 가리킴(현재 404)** — 신규 네비게이션 추가 불필요, Phase7이 대상 페이지만 만들면 그대로 연결됨 |
| `content/dreams-seed/*.md` | **없음, 그리고 필요 없음** — 실제 콘텐츠는 이미 `0010_seed_data.sql`로 DB에 직접 들어가 있다. `EXECUTION_PLAN.md`가 예정한 "마크다운 원고→시드" 워크플로는 실제로 쓰인 적이 없다(§9 Decision) |

**재사용 가능한 기존 기능**: `lib/logic/matchNumbers.ts`가 export하는 `assertValidNumberSet`(6개/1~45/중복없음 검증) — `dream_number_mappings.numbers`도 동일 규칙이라 새 검증을 만들 필요가 없다(다만 이 컬럼은 DB CHECK로 이미 강제되고 있어 애플리케이션 레벨에서 재검증할 필요 자체가 있는지도 §7에서 확인). `lib/api/journal.ts`의 `resolveLimit`/`resolveOffset`/pagination 패턴, `EmptyState`/`JournalLoadError`/`Card`/`Badge` 등 기존 UI 컴포넌트, `getCurrentUser()`+`getProfile()` 순차 인증 확인 패턴(`app/generate/page.tsx`가 이미 쓰는 그대로).

**Phase7 범위 밖으로 확인된 것**: 커뮤니티 "꿈해몽나눔" 카테고리(Phase4 커뮤니티 자체가 Won't/후속), Phase8의 "AI 초안 생성" 콘텐츠 파이프라인, 당첨 결과 UI(Phase6 Known Issue, §6/§8에서 별도 확인).

---

## 3. DB/Schema 감사

**Migration 불필요.** 근거:

- `dreams`(키워드/카테고리/해몽본문/이미지) — Phase7이 필요로 하는 컬럼이 전부 이미 존재.
- `dream_number_mappings`(꿈별 추천번호, `dreams.id` FK CASCADE) — 그대로 사용 가능.
- `dream_journal_entries`(개인 꿈 기록, `user_id`/`entry_date`/`dream_text`/`linked_dream_id`) — 열람은 물론 **작성에 필요한 컬럼까지 이미 전부 존재**. `linked_dream_id`(사전 키워드 매칭 연결)까지 이미 있어 "내부링크(연관 꿈 키워드)"(`EXECUTION_PLAN.md` 구현순서 5) 기능도 새 컬럼 없이 구현 가능.
- `user_numbers.related_dream_id`(FK 없는 애플리케이션 레벨 참조, `0002_draws_user_numbers.sql`) — "꿈 연동 생성" 기록을 저장할 자리가 Phase1부터 이미 마련돼 있다. `generation_method` enum에도 `'dream'` 값이 이미 정의돼 있다(`user_numbers_generation_method`). 새 컬럼/enum 값 추가가 전혀 필요 없다.

인덱스: `dreams_keyword_trgm_idx`/`dreams_interpretation_trgm_idx`(검색용 GIN), `dream_number_mappings_dream_id_idx`, `dream_journal_entries_user_id_idx`/`linked_dream_id_idx` — 전부 이미 존재. UNIQUE/CHECK: `is_valid_lotto_numbers()` 재사용 확인(중복 함수 없음).

**결론: Phase7은 DB 레벨에서 100% 준비된 상태에서 시작한다.**

---

## 4. RLS/보안 감사

| 테이블 | 필요한 접근 패턴(Phase7 목표 기준) | 현재 RLS | 충분한가 |
|---|---|---|---|
| `dreams`/`dream_number_mappings` | 비로그인 포함 전체 열람(콘텐츠 페이지, SEO) | 전체 공개 SELECT, 쓰기는 service_role 전용(`0008`) | **충분, 변경 불필요** |
| `dream_journal_entries` | 본인만 작성/조회/수정/삭제(완전 비공개) | 본인만 SELECT/INSERT/UPDATE/DELETE(`0008`, Phase1부터 이미 4개 정책 전부 존재) | **충분, 변경 불필요** — 작성 기능(§2 미구현 항목)을 만들 때 RLS 정책을 단 하나도 추가할 필요가 없다 |
| `user_numbers` | 꿈 연동 생성 시 `related_dream_id`/`recommendation_reason` 값을 채워 저장 | 본인만 INSERT(`0008`, Phase5부터 사용 중, 변경 없음) | **충분** — 어떤 값을 채우든 RLS는 행 소유권만 검사하므로 컬럼 추가 없이 그대로 동작 |

관리자 권한(`admins`/`isAdmin()`)이 필요한 지점은 없다 — 콘텐츠는 이미 시드 완료 상태이고, 콘텐츠 CRUD 화면은 `ADMIN_REQUIREMENTS.md §2.1`에 따라 Phase9 몫이다. Phase6에서 구축한 관리자 인증 구조를 Phase7이 재사용하거나 재발명할 필요가 없다.

**RLS 변경 필요 없음.**

---

## 5. API/Service 설계

기존 패턴 대조 결과:

- **`lib/api/dreams.ts`(신규)**: `dreams`/`dream_number_mappings` 조회 전용. 공개 데이터이므로 `lib/supabase/server.ts`(anon 클라이언트)만으로 충분하고 `getCurrentUser()`/`service_role` 둘 다 불필요 — `lib/api/journal.ts`의 `getRecentFortuneResults()`(공개 조회, 소유자 필터만 다름)와 유사한 성격이지 인증 서비스가 아니다.
- **개인 꿈 기록 작성**: `getCurrentUser()` 필요(본인 식별), `service_role` 불필요(RLS로 충분 — Phase5 `saveUserNumbers()`와 동일 패턴). Route Handler 필요 여부는 프로젝트 컨벤션 문제로 §9 Decision D3에서 다룬다.
- **`app/generate/page.tsx`의 `source=dream` 처리**: 서버 컴포넌트에서 쿼리파라미터로 `dream_number_mappings`를 조회해 `generateNumbers()` 대신 그 번호를 초기값으로 내려주는 구조가 기존 패턴(서버에서 1회 계산 후 prop 전달, hydration mismatch 방지)과 일치한다. 저장 시 `related_dream_id`/`recommendation_reason`을 채우려면 `lib/api/numbers.ts`의 `saveUserNumbers()` 확장이 필요하다 — §9 Decision D2.

**결론: Phase6이 만든 관리자 인증/배치 구조와 겹치는 부분이 전혀 없다.** Phase7은 "공개 콘텐츠 조회 서비스"+"본인 데이터 작성 서비스" 조합으로, 기존에 이미 확립된 두 가지 패턴(공개 서비스=`journal.ts`의 공개 조회 함수들, 본인 쓰기=`numbers.ts`)을 그대로 재사용하면 된다.

---

## 6. Phase6 연계성

Phase6이 만든 `target_round`/`match_count`/`win_rank`/`checked_at`/`draws`/`notifications`를 Phase7이 **전혀 사용하지 않는다** — 꿈해몽은 당첨 확인과 독립적인 기능이다. `EXECUTION_PLAN.md` Phase7의 목표/파일 목록 어디에도 이 데이터에 대한 참조가 없다.

**"당첨 결과 UI 미표시"(Phase6 Final Audit Known Issue)가 Phase7 범위에 포함되는가?** — **포함되지 않는다.** `EXECUTION_PLAN.md` Phase7의 완료 기준 4개(시드 콘텐츠 렌더링/추천번호 연동/개인 꿈 기록/SSG·ISR) 어디에도 당첨 결과 표시가 없다. **Deferred 상태를 그대로 유지한다.**

참고로 기록만 해둔다(Phase7 작업 대상 아님): `app/page.tsx`의 `FEATURES` 배열이 이미 "당첨확인" 카드를 `/my/journal/results`로 연결해뒀다(현재 404) — 이 경로가 Phase6 결과 UI의 이미 확정된 목적지라는 것을 이번 조사로 재확인했다. `lib/api/notifications.ts`(Phase6-3)의 `link_url`이 임시로 `/my/journal/history`를 가리키고 있는데, 이 페이지(`/my/journal/results`)가 나중에 만들어지면 그 상수만 바꾸면 된다는 기존 계획과 일치한다.

`lib/api/journal.ts`를 Phase7이 확장해야 하는가? — **확장 불필요.** `getRecentDreamJournalEntries()`가 이미 완전히 동작하며, Phase7이 새로 필요로 하는 것(공개 콘텐츠 조회, 개인 기록 작성)은 이 파일의 책임(Phase4 Architecture Decision §9: "조회 전용") 밖이라 별도 파일이 맞다(§9 Decision D3).

---

## 7. UI/UX 범위 감사

| 항목 | 확인 결과 |
|---|---|
| 신규 route | `/dream`, `/dream/[keyword]`, `/dream/[keyword]/numbers`, `/dream/category/[category]` — `SITEMAP.md`/`EXECUTION_PLAN.md` 일치, 신규 4개 |
| 기존 route 수정 | `/generate`(쿼리파라미터 처리 추가), `/my/journal/dreams`(작성 폼 추가) |
| GNB/BottomNavigation 변경 | **불필요** — `GlobalNav.tsx`에 "꿈해몽→/dream" 이미 존재(직접 확인). `BottomNavigation.tsx`도 Phase3에서 이미 구성됐다고 Phase5 감사가 확인한 바 있음(재확인 불필요) |
| 로그인/비로그인 | `/dream/*` 전체는 비로그인도 열람 가능해야 한다(RLS가 이미 공개 SELECT를 허용하므로 구조적으로 지원됨). 꿈별 추천번호→`/generate` 연동도 비로그인 이용 가능(Phase5 원칙과 동일 — 저장만 로그인 필요). 개인 꿈 기록 작성은 로그인 필수(RLS가 이미 이렇게 강제) |
| Empty/Loading/Error State | 기존 `EmptyState`/`JournalLoadError`/`Spinner` 재사용 가능, 신규 컴포넌트 불필요 |
| 접근성 | Phase4가 확립한 "페이지당 `<h1>` 정확히 1개" 패턴 재사용 권장(Phase6 감사가 이미 검증한 패턴) |
| 색상 토큰(`color-danger`/`color-success`, 번호 구간별 5색) | **Phase7과 무관.** 꿈해몽 콘텐츠 열람·추천번호 표시는 당첨/미당첨 이분법이나 "일치 번호 강조"가 필요한 화면이 아니다 — 이 두 이슈는 Phase7에서 전�까 재현되지 않는다(Phase5가 동일한 논리로 무관 판정한 것과 같은 이유) |
| 카테고리 taxonomy | **불일치 발견(Decision Required, §9 D1)** — `INFORMATION_ARCHITECTURE.md §3.1`은 "동물/자연/사람/사물·금전/행동·상황" 5개를 정의하지만, 실제 시드 데이터(`dreams.category`)는 "동물/신체/인물/상황/자연/행동/사물" 7개 값을 쓰고 있다(읽기 전용 조회로 직접 확인). `/dream/category/[category]` 라우팅이 어떤 슬러그 집합을 쓸지 결정하지 않으면 재작업 위험이 있다 |

---

## 8. Known Issues 영향도 (Phase7 관점 재분류만, 신규 이슈 아님)

| 이슈 | Phase7 관점 분류 |
|---|---|
| `/generate` vs `/generate/auto` | **Phase7과 무관** — Phase5-0에서 이미 실제 코드 기준 `/generate`로 확정됨, Phase7도 그대로 `/generate` 사용(쿼리파라미터만 추가) |
| `proxy.ts` vs Architecture Decision 문서 불일치 | **Phase7과 무관** — `/dream/*`은 애초에 `proxy.ts`의 `PROTECTED_PATHS` 대상이 아닌 공개 경로다. `/my/journal/dreams`는 기존 `PUBLIC_EXCEPTIONS`(`/my/journal`) 처리 대상에 이미 포함돼 있어 새로운 불일치가 생기지 않는다 |
| `color-danger`/`color-success` WCAG | **Phase7과 무관**(§7) |
| 번호 구간별 5색 미구현 | **Phase7과 무관**(§7) — 꿈별 추천번호는 "당첨 대조"가 아니라 단순 추천이라 강조색이 필요한 화면이 아니다 |
| Fortune Phase 미배정 | **Phase7과 무관** — 별도 기능(운세), Phase7의 어떤 파일도 참조하지 않음 |
| 카카오 공유 Phase 미배정 | **Phase7과 무관** — `EXECUTION_PLAN.md` Phase7 파일 목록에 공유 기능이 없다. "꿈→번호→사례→생성 연계 UX"는 `FEATURE_SPEC.md §2.3`이 Could 등급으로 별도 후속 Phase에 배정해뒀다 |
| `user_numbers` 결과 필드(자기 행) 위조 가능성 | **Phase7과 무관** — 이 문제는 `checked_at`/`win_rank`/`match_count`/`target_round`에 관한 것이고, Phase7은 이 컬럼들을 전혀 참조/수정하지 않는다(꿈 연동 생성이 건드리는 컬럼은 `related_dream_id`/`recommendation_reason`/`generation_method`뿐) |
| `admin_audit_logs` 미구현 | **Phase7과 무관** — Phase6-4-1에서 이미 Phase9로 이월 확정, Phase7은 관리자 기능을 전혀 다루지 않음 |
| Case C 원자성(RPC 필요 여부) | **Phase7과 무관** — Phase6 관리자 배치 로직 얘기, Phase7과 접점 없음 |

**Phase7이 새로 만든 이슈는 카테고리 taxonomy 불일치 1건뿐이며(§7/§9 D1), 이는 "재확인"이 아니라 이번 감사에서 처음 발견한 사실이다.**

---

## 9. Decision Required 목록

구현을 실제로 막거나 재작업을 유발할 수 있는 것만 선별했다(4건).

### D1. 꿈 카테고리 taxonomy 불일치 [우선순위: 높음]
- **문제**: `INFORMATION_ARCHITECTURE.md`가 정의한 5개 카테고리와 실제 시드 데이터의 7개 카테고리 값이 다르다.
- **선택지**: (a) 실제 시드 데이터(7개)를 정식 taxonomy로 확정하고 문서를 갱신, (b) 시드 데이터를 5개 카테고리로 재분류(원고 수정 필요), (c) `/dream/category/[category]`를 아예 만들지 않고 이번 Phase에서 제외.
- **추천안**: (a).
- **추천 이유**: 실제 코드/데이터 우선 원칙과 일치하고, 25건의 콘텐츠를 재분류(원고를 다시 검토해 카테고리를 바꾸는 작업)하는 것보다 문서 갱신이 훨씬 저비용이다. (c)는 `EXECUTION_PLAN.md`가 명시한 완료 기준을 축소하는 것이라 별도 승인 없이는 채택하지 않는 것이 맞다.
- **구현 영향**: 결정하지 않고 착수하면 카테고리 페이지의 라우팅 슬러그를 두 번 만들게 될 위험이 있다.

### D2. `lib/api/numbers.ts` 확장 방식 [우선순위: 높음]
- **문제**: `saveUserNumbers(userId, numbers)`가 `generation_method: "auto"`를 하드코딩한다(Phase5). 꿈 연동 생성은 `generation_method: "dream"` + `related_dream_id`/`recommendation_reason`을 저장해야 하는데, `EXECUTION_PLAN.md`의 Phase7 "수정할 파일" 목록에 이 파일이 빠져 있다(문서 누락, 실제로는 반드시 건드려야 함).
- **선택지**: (a) `saveUserNumbers()`에 선택적 파라미터를 추가해 하위 호환 유지, (b) 꿈 전용 별도 저장 함수를 새로 만들어 `insert` 로직을 중복 작성.
- **추천안**: (a).
- **추천 이유**: (b)는 동일한 INSERT 로직을 두 곳에 복제하게 되어 이 프로젝트가 반복적으로 강조해 온 "판정/검증 로직 복제 금지" 원칙과 같은 정신을 위반한다. 기존 호출부(`app/api/numbers/route.ts`)는 새 파라미터를 안 넘기면 그대로 `auto`로 동작해 회귀 위험이 없다.
- **구현 영향**: 결정 없이 진행하면 Phase7 도중 Phase5 파일을 다시 설계해야 하는 재작업이 발생한다.

### D3. 개인 꿈 기록 작성 경로 구조 [우선순위: 중간]
- **문제**: `DreamJournalForm` 제출을 어떤 계층에서 처리할지(API Route vs 다른 방식) 미정. `lib/api/journal.ts`는 Phase4 Architecture Decision §9가 "조회 전용"으로 명시적으로 선언한 파일이라 그대로 확장하면 그 원칙을 깨게 된다.
- **선택지**: (a) 새 파일(예: `lib/api/dreamJournal.ts`)에 쓰기 로직 분리 + 신규 API Route, (b) `journal.ts`에 예외적으로 쓰기 함수 추가.
- **추천안**: (a).
- **추천 이유**: 기존 문서화된 원칙(조회/쓰기 분리)을 유지하는 것이 일관성 있고, `lib/api/numbers.ts`(Phase5)도 이미 "저장 전용" 파일로 분리돼 있어 같은 패턴이다.
- **구현 영향**: 결정 없이 진행하면 나중에 "왜 journal.ts만 쓰기를 겸하는가"라는 문서-코드 불일치가 새로 생긴다.

### D4. `content/dreams-seed/*.md` 워크플로 폐기 [우선순위: 낮음]
- **문제**: `EXECUTION_PLAN.md`가 예정한 마크다운 기반 콘텐츠 원고 관리 워크플로가 실제로는 전혀 쓰이지 않았다(콘텐츠가 이미 SQL로 직접 시드됨).
- **선택지**: (a) 이 워크플로를 만들지 않는다, (b) 그대로 만든다(기존 DB 콘텐츠를 다시 마크다운으로 내보내는 작업 필요).
- **추천안**: (a).
- **추천 이유**: 이미 다른 방식(SQL 시드)으로 콘텐츠 관리가 굳어져 있고, 향후 콘텐츠 추가도 `ADMIN_REQUIREMENTS.md §2.1`이 Phase9 Admin CRUD로 계획해뒀다 — 지금 별도 파일 기반 워크플로를 새로 만드는 것은 이중 관리 체계를 만드는 것이라 불필요하다.
- **구현 영향**: 낮음 — 이 파일들을 만들지 않아도 Phase7의 다른 어떤 작업도 막히지 않는다.

---

## 10. Phase7 구현 순서 제안

Audit 결과(DB/RLS 100% 준비, 콘텐츠 이미 존재, 신규 코드는 조회 서비스→열람 UI→연동→작성 순으로 의존성이 자연스럽게 쌓임)를 바탕으로 제안한다.

1. **Phase7-1: 꿈해몽 조회 서비스** — `lib/api/dreams.ts`(순수 조회, 인증/service_role 불필요) 구현. 착수 직전 D1(카테고리 taxonomy) 확정 필요.
2. **Phase7-2: 꿈해몽 열람 UI** — `/dream`, `/dream/[keyword]`, `/dream/category/[category]`(SSG/ISR). Phase7-1에만 의존.
3. **Phase7-3: 번호 생성 연동** — `/dream/[keyword]/numbers`, `app/generate/page.tsx`의 `source=dream` 처리, `lib/api/numbers.ts` 확장(D2 확정 필요).
4. **Phase7-4: 개인 꿈 기록 작성** — `DreamJournalForm`, 쓰기 API(D3 확정 필요). `/my/journal/dreams`의 기존 조회 UI에 얹는 작업이라 다른 신규 페이지보다 독립적 — Phase7-2/7-3과 병행 가능.
5. **Phase7-5: Final Audit** — 완료 기준 4개(시드 렌더링/추천번호 연동/개인 기록/SSG·ISR) 재확인, Phase4/5/6 회귀 확인.

가장 먼저 할 일이 "조회 서비스"인 이유: DB/RLS가 이미 완비돼 있고 인증이 필요 없는 가장 단순한 계층이라 재작업 위험이 없으며, 이후 모든 UI(Phase7-2/7-3)가 이 서비스에 의존하므로 먼저 확정해야 나머지 작업의 인터페이스가 안정된다.

---

## 11. Validation 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 통과 — 11 test files, 119 tests(Phase6-5 종료 시점과 동일, 이번 Task는 코드를 수정하지 않음) |
| `npm run build` | 통과, 라우트 목록 변화 없음 |
| 실제 DB 조회(읽기 전용) | `dreams` 25행, `dream_number_mappings` 25행, 카테고리 분포 확인(§7) — 신규 데이터 생성/삭제 없음 |

---

## 12. Phase7 Ready 판정

### CONDITIONAL READY

DB/RLS/콘텐츠/네비게이션이 전부 준비된 상태라 인프라 부재로 인한 BLOCKED 사유는 없다. 다만 §9의 D1(카테고리 taxonomy)과 D2(`saveUserNumbers()` 확장 방식)는 구현 도중 자연스럽게 정해도 되는 사소한 사항이 아니라 **라우팅 구조와 기존 Phase5 파일의 인터페이스를 결정**하는 사항이라, 착수 전 확정하지 않으면 Phase7-1/7-3에서 재작업이 발생할 가능성이 높다.

---

## 13. Phase7-1에서 바로 실행할 다음 작업

**`lib/api/dreams.ts`(꿈해몽 조회 전용 서비스) 구현.**

이유: DB/RLS가 이미 100% 준비돼 있고(§3/§4), 인증·service_role이 전혀 필요 없는 가장 단순한 계층이며, Phase7의 나머지 모든 UI 작업(열람 페이지·카테고리 페이지·번호 연동)이 이 서비스 하나에 의존한다. 착수 직전에 D1(카테고리 slug를 실제 시드 데이터 7종 기준으로 확정)만 먼저 결정하면 재작업 위험 없이 바로 시작할 수 있다.
