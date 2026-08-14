# Phase9 Final Audit — 관리자

> AUDIT ONLY. 코드/DB/Migration/RLS/UI를 전혀 수정하지 않았다(전수 확인: 이번 Task로 변경된 파일은 본 보고서 1개뿐). Phase9-0~9-4가 이미 결정·검증한 사항은 재조사하지 않고 실제 코드/실제 HTTP 응답/실제 Supabase로 재검증만 했다. 감사 도중 실제 데이터 무결성 문제 1건을 발견해 즉시 원상복구했다(§7).

---

## 1. 감사 범위

Phase9-0(사전 감사) ~ Phase9-4(대시보드) 전체 + Phase6/7/8과의 회귀. `npx supabase migration list`로 local/remote 동기화 확인, 실제 dev/production build 결과, 실제 Supabase 프로젝트에 테스트 계정 2~3개로 관리자 인증·회차등록·꿈해몽 CRUD·대시보드 KPI를 처음부터 끝까지 재현했다.

---

## 2. Phase9 완료 기준

`docs/EXECUTION_PLAN.md` Phase9 원문(Phase9-0이 이미 확정, 재조사 아님 — 재인용)의 완료 기준 3개:

| 완료 기준 | 상태 |
|---|---|
| 관리자 계정만 `/admin/*` 접근 가능(일반 회원 차단 확인) | **충족**(§3) |
| 회차 입력→배치 실행이 관리자 화면만으로 완결(SQL Editor 불필요) | **충족**(§4) |
| 꿈해몽/FAQ/가이드 CRUD 정상 동작 | **부분 충족** — 꿈해몽 CRUD는 완전히 동작(§5), **FAQ/가이드는 Phase9-0이 착수 전에 이미 BLOCKER로 분류한 대로 여전히 미구현**(§18) |

ROADMAP.md에는 "Phase 9"라는 macro-phase 번호 자체가 없어(Phase8-0/8-5가 이미 확인) 번호 충돌은 없다. `ADMIN_REQUIREMENTS.md`가 서술하는 더 넓은 범위(회원관리/신고/커뮤니티/쇼핑몰/당첨사례/로또명당/감사로그)는 EXECUTION_PLAN Phase9의 실제 완료 기준에 없어 이번 감사 대상이 아니다(Phase9-0이 이미 확정).

---

## 3. Phase9-1 관리자 인증 결과

실제 코드 재확인: `app/admin/layout.tsx`/`lib/auth/isAdmin.ts`/`admins` 테이블/`admin_role` enum/RLS/`proxy.ts`의 `/api/admin` 보호 — 전부 Phase6-4/Phase9-1이 만든 것 그대로, 무수정.

실제 HTTP 검증(production build):

| 테스트 | 결과 |
|---|---|
| Test A: 비로그인 `/admin` | `307` → `/login?next=%2Fadmin` |
| Test B: 일반 사용자 `/admin` | `404`, **관리자 대시보드 텍스트/숫자 응답에 전혀 포함되지 않음**(§8에서 상세) |
| Test C: 관리자 `/admin` | `200`, 대시보드 정상 렌더링 |
| `POST /api/admin/draws` | 비로그인 `401` → 일반 사용자 `403` → 관리자는 인증 통과 후 `400`(입력 검증 단계 진입) |

---

## 4. Phase9-2 회차 관리 결과

`lib/api/admin/draws.ts`/`app/api/admin/draws/route.ts`/`components/admin/DrawRegistrationForm.tsx` 무수정 확인.

실제 Supabase에서 회차 99201(당첨번호 `[8,9,10,11,12,13]`, 보너스 20)을 등록해 재검증:

- `draws` INSERT 정상.
- 사전에 저장해 둔 User A의 동일 번호 `user_numbers` 행이 `target_round: 99201, match_count: 6, win_rank: 1, checked_at: <시각>`으로 정확히 UPDATE됨을 service_role 재조회로 확인.
- `notifications`에 `type: "win_result", title: "99201회차 1등 당첨을 축하합니다!"` 생성 확인.
- 동일 회차(99201)를 다른 번호/금액으로 재등록 시도 → `409 DUPLICATE_ROUND`, 기존 `draws` 행이 **전혀 변경되지 않음**을 재조회로 확인.

**Phase6 설계(draws→user_numbers→target_round/match_count/win_rank/checked_at→notifications)가 그대로 유지됨을 실측 재확인했다.**

---

## 5. Phase9-3 꿈해몽 CRUD 결과

`lib/api/admin/dreams.ts`/Route 2개/`DreamForm`/`DeleteDreamButton` 무수정 확인. `dream_number_mappings.dream_id`가 `ON DELETE CASCADE`(0003_dreams.sql)임을 재확인.

실제 Supabase에서 전체 CRUD 사이클 재현:

| 단계 | 결과 |
|---|---|
| CREATE(keyword="감사테스트꿈", 번호 매핑 포함) | `201`, `dreams`+`dream_number_mappings` 둘 다 저장 |
| READ(public) | `/dream/감사테스트꿈` `200`, title/description/추천번호 정상 반영 |
| UPDATE(keyword/category/interpretation/번호 전부 변경) | `200`, `updated_at` 트리거로 자동 갱신, 이전 keyword `/dream/감사테스트꿈`은 즉시 `404`, 새 keyword `/dream/감사테스트꿈-수정`은 `200`으로 정확히 반영 |
| DELETE | `204`, 이후 `dream_number_mappings` 재조회 결과 **0건**(CASCADE 정상, 고아 데이터 없음), public 페이지 `404` |

이번에는 관리자 UI가 실제로 쓰는 **숫자 ID 기반**(`DELETE /api/admin/dreams/[id]`) 삭제 경로로 정리해, Phase9-4 검증에서 겪었던 함정(§7)을 재현하지 않았다.

---

## 6. Phase9-4 대시보드 결과

`lib/api/admin/dashboard.ts` 무수정 확인. 7개 KPI 명칭·계산 조건을 코드로 재확인:

| KPI | 실제 컬럼 조건 | 명칭이 조건과 일치하는가 |
|---|---|---|
| 꿈해몽 콘텐츠 | `count(dreams)` | 일치 |
| 추천번호 매핑 | `count(dream_number_mappings)` | 일치 |
| 생성된 번호 | `count(user_numbers)` — **행(게임) 단위**, 사용자 단위 아님 | 일치("게임 수" 성격, "사용자 수"라고 부르지 않음) |
| 당첨 확인 완료 | `count(user_numbers) where checked_at is not null` | 일치("확인 건수", 사람 수 아님) |
| 당첨 건수 | `count(user_numbers) where win_rank is not null` | 일치 — Phase9-4가 이미 "당첨자 수"가 아니라 "당첨 건수"로 명명한 근거(한 사용자가 여러 번 당첨될 수 있어 행 단위 집계임을 명확히 함)를 재확인했다 |
| 꿈 기반 번호 생성 | `count(user_numbers) where generation_method = 'dream'` | 일치 |
| 작성된 꿈 기록 | `count(dream_journal_entries)` — "회원 수"로 표현하지 않음 | 일치 |

**7개 전부 "명칭이 실제 query 조건과 정확히 일치"함을 코드 재검토로 확인했다** — 새로 발견된 명칭-조건 불일치는 없다.

실제 Supabase 재검증(§7의 원상복구 이후 baseline): 25/25/0/0/0/0/0에서 시작해 회차 등록(§4)까지 반영한 뒤 정상적으로 증가함을 확인(자세한 델타는 Phase9-4 보고서에 이미 기록, 이번 감사는 baseline이 정확히 25/25/0/0/0/0/0로 돌아오는지만 재확인했다 — §7 참조).

---

## 7. 실제 Supabase 통합 검증 (그리고 감사 중 발견한 데이터 무결성 문제)

### 발견: Phase9-4 검증 세션의 테스트 데이터 잔존

감사 시작 시점에 관리자 대시보드의 "꿈해몽 콘텐츠"가 **26개**로 표시됐다(정상값 25 대비 +1). 원인을 추적한 결과, `docs/PHASE9_ADMIN_DASHBOARD_REPORT.md` 작성 시 사용한 테스트 꿈 `"대시보드테스트꿈"`(id=27)이 **실제로 삭제되지 않고 남아 있었다.**

**근본 원인**: Phase9-4의 정리(cleanup) 호출이 `curl -d '{"keywords":["대시보드테스트꿈"], ...}'` 형태로 **한글 문자열을 Git Bash 커맨드라인 인자에 직접 인라인으로 넣었다** — 이는 Phase7-4/7-5/9-3이 이미 반복적으로 발견한 것과 동일한 종류의 테스트 도구 인코딩 아티팩트다. 삭제 요청 자체가 깨진 keyword로 전달돼 실제 행을 매칭하지 못했고(0행 삭제), **잔여 개수 확인 쿼리도 같은 깨진 keyword를 재사용**해 "0건 남음"이라는 **거짓 양성(false positive)**을 보고했다 — Phase9-4 보고서의 "잔여 0건 확인"이 실제로는 검증되지 않은 상태였다.

**조치**: 이번 감사에서 즉시 원인을 특정하고, **숫자 ID 기반**(`DELETE /api/admin/dreams/27`, 실제 관리자 API 그대로 사용 — 인코딩 위험이 없는 경로)으로 안전하게 삭제했다. 삭제 후 `dream_number_mappings`도 CASCADE로 함께 제거됨을 재확인했고, 대시보드가 즉시 25/25로 돌아옴을 확인했다. `draws`(정수 round 기반 정리)는 같은 인코딩 위험이 없어 별도로 재확인한 결과 문제없이 정리돼 있었다(회차 99101 잔존 없음, §6).

**교훈**: 앞으로 테스트 정리 스크립트에서 한글 값으로 필터링할 때는 반드시 percent-encoding된 쿼리 문자열이나 숫자 ID 기반 필터를 사용해야 하며, "삭제 요청의 응답이 0건"이라는 결과만으로 정리 완료를 단정하지 않고 가능하면 독립된 조회 경로(이번처럼 실제 서비스 API)로 교차 확인해야 한다.

**이 문제는 Phase9 애플리케이션 코드의 결함이 아니다** — `dreams`/`dream_number_mappings`의 실제 CRUD·CASCADE·RLS는 전부 정확히 설계대로 동작했다(§5). 문제는 오직 검증용 임시 스크립트 자체에 있었다. 다만 그 결과로 **실제 프로덕션 유사 데이터베이스에 하루 넘게 테스트 데이터가 남아 있었다**는 사실은 심각하게 취급해 이번 감사의 핵심 발견으로 기록한다.

### 이번 감사가 새로 생성한 테스트 데이터 정리

Phase9-1~9-4 전체를 재검증하며 만든 테스트 계정 3개, `user_numbers`/`dream_journal_entries`/`notifications`/`admins`/`profiles` 행, 테스트 꿈 콘텐츠 1건(위 사고와 무관한 신규), 테스트 회차 1건(99201)을 전부 삭제하고 **잔여 0건**을 직접 재확인했다(§13 baseline 재확인 포함). 이번에는 삭제 확인에 숫자 ID/round 기반 경로를 우선 사용해 같은 함정을 피했다.

---

## 8. 관리자 보안/RSC payload 검증

Phase9-1이 발견한 특성(레이아웃이 `notFound()`를 던져도 자식 페이지의 RSC payload가 응답에 남을 수 있음)을 이번에 실제로 재검증했다.

- **일반 사용자가 `/admin`을 요청한 실제 응답 전체**(HTML+RSC payload 포함)를 `관리자 대시보드`/7개 KPI 라벨 문자열로 스캔한 결과 **0건** — Phase9-4가 `app/admin/page.tsx`에 추가한 방어(실제 통계를 조회하기 전에 `isAdmin()`을 페이지 자신도 다시 확인)가 **실제로 작동함을 실측으로 확인했다.** 이는 Phase9-1 시점(레이아웃 게이트만 있고 페이지 자체 방어가 없어 정적 placeholder 텍스트가 RSC payload에 남았던 상태)보다 명백히 개선된 결과다.
- **단순히 화면에 안 보인다는 이유로 PASS를 준 것이 아니다** — raw HTTP 응답 바이트 전체를 검사했다(브라우저가 렌더링하는 DOM만 본 것이 아님).
- 비로그인 요청도 동일하게 확인(§3 Test A, 애초에 페이지 자체에 도달하지 못하고 리다이렉트됨).
- 클라이언트 번들(`.next/static/chunks/`) 전체를 `grep -rl "SUPABASE_SERVICE_ROLE_KEY\|service_role"`로 검사해 **0건** — `service_role`은 `lib/api/admin/*.ts`(서버 전용 파일) 안에만 존재한다.

---

## 9. 데이터 무결성 검증

- `dream_number_mappings.dream_id → dreams(id) ON DELETE CASCADE`가 migration 원문과 실제 삭제 동작 둘 다에서 일치함을 재확인(§5, §7).
- `draws.round UNIQUE`가 중복 등록을 실제로 차단하고 기존 데이터를 보존함을 재확인(§4).
- `user_numbers`/`dream_journal_entries`의 RLS("본인만")가 대시보드 집계(§6)에서 `service_role`을 실제로 요구하는 유일한 지점임을 코드로 재확인 — 그 외 경로는 전체 공개 SELECT로 충분.
- §7에서 발견한 잔존 테스트 데이터를 제외하면, 이번 감사 전 기간 동안 실제 콘텐츠(25건 시드 꿈)나 실제 사용자 데이터는 전혀 건드리지 않았다.

---

## 10. Phase6 회귀 검증

§4에서 재검증한 내용과 동일 — 관리자 회차 등록→`user_numbers` 대조→알림 생성 체인이 정확히 유지됨. 비로그인 401/일반 사용자 403/관리자 정상 처리도 재확인.

---

## 11. Phase7 회귀 검증

- `/dream`, `/dream/category/동물`, `/dream/돼지꿈` 전부 `200`.
- Dream → Generate: `/generate?dream=1`에서 "꿈과 연결된 번호" 배너 + `canonical: /generate`(쿼리 무관 고정) 정상. 로그인 사용자가 `generationMethod:"dream", relatedDreamId:1`로 저장 시 `201` 정상 응답(정확한 컬럼 값 재검증은 Phase7-3/8-5가 이미 실측 완료한 메커니즘이라 이번엔 저장 성공 여부만 재확인했다 — 동일 코드가 무수정임을 git status로 이미 확인했으므로 중복 검증하지 않음).
- Dream Journal: 자유 기록 작성 정상(`201`), 작성자 본인 목록에서만 보이고 다른 사용자에게 노출되지 않음(User A 목록에 있음, User B 목록에 없음/접근 불가)을 재확인.

---

## 12. Phase8 SEO 회귀 감사

`/`, `/dream`, `/dream/category/동물`, `/dream/돼지꿈`, `/generate`, `/login`, `/my/journal`, `/admin` 전부 실제 HTTP로 재확인:

| 확인 항목 | 결과 |
|---|---|
| title/description | 전부 페이지별 정상(템플릿 적용 확인) |
| canonical | `/generate`·`/dream/돼지꿈`에 정확히 존재, 나머지는 기존 설계대로 없음(Phase8-5가 이미 CONDITIONAL로 기록한 것과 동일 상태, 재발 아님) |
| robots(메타) | `/`·`/dream`·`/generate`는 `index, follow`, `/login`·`/my/journal`·`/admin`은 `noindex, nofollow` — 전부 정확 |
| OG/Twitter | `og:site_name`/`og:locale` 포함 전부 정상(Phase8-2 소실 문제 재발 없음) |
| WebSite/BreadcrumbList JSON-LD | `/dream/돼지꿈`에서 둘 다 확인 |
| `robots.txt` | `/my/`, `/login`, `/onboarding`, `/api/`, `/ui-preview` Disallow 유지, **`/admin`은 여전히 미포함**(Phase9-3이 이미 기록한 기존 이슈, 재발견 아님) |
| `sitemap.xml` | **일시적으로 36개**(정상 35개 + §7에서 발견한 잔존 테스트 URL 1개) — `revalidate=3600` 설계대로 즉시 갱신되지 않은 것이며, §7에서 실제 DB 데이터를 정리한 뒤에도 캐시가 자연 만료(최대 1시간)될 때까지는 남아있는 것이 **설계된 동작**이다. 강제로 캐시를 무효화하는 조치는 이번 Task 범위(코드/설정 수정 금지) 밖이라 취하지 않았다 |

**SEO 회귀 없음.** sitemap의 일시적 36건은 코드 결함이 아니라 §7에서 발견한 데이터 문제의 잔향이자 문서화된 캐시 정책의 정상 결과다.

---

## 13. lint/type-check/test/build 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과, 경고 0건 |
| `npm run type-check` | 통과 |
| `npm test` | 통과 — 16 test files, **234 tests**(Phase9-4 종료 시점과 동일, 변화 없음 — 신규/삭제/변경 테스트 없음) |
| `npm run build` | 통과 — 라우트 **28개**(변화 없음), `/sitemap.xml` 정적 유지(`Revalidate: 1h`) |
| 클라이언트 번들 `service_role` 검사 | 0건 |

---

## 14. Migration/RLS 상태

`npx supabase migration list` 실행 결과 `0001`~`0013` 전부 **local/remote 완전 동기화**(drift 없음). Phase9-3/9-4 작업으로 새 migration이 생성되지 않았음을 재확인했다 — `git status`에도 `supabase/migrations/`에 신규 파일이 없다. RLS도 `0008`/`0012` 이후 변경 없음(코드 검토로 재확인). **Migration/RLS 변경 불필요 — 그대로 유지.**

---

## 15. Critical / High / Medium / Low

| 등급 | 건수 | 내용 |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 1 | EXECUTION_PLAN Phase9 완료 기준 3개 중 1개(FAQ/가이드 CRUD) 미충족 — Phase9-0이 이미 스키마 미확정 BLOCKER로 분류한 것의 재확인(§18), 새 결함 아님 |
| Low | 3 | `/login?next=`가 `/admin` 하위 경로를 반영하지 않고 고정(Phase9-2 기존 기록), `/admin/*` title template 미적용(Phase9-2 기존 기록), robots.txt에 `/admin` 미포함(Phase9-3 기존 기록) |

**§7에서 발견한 테스트 데이터 잔존 문제는 이 등급 체계에 포함하지 않았다** — 애플리케이션 코드 결함이 아니라 이전 세션의 검증 스크립트 문제였고, 이번 감사에서 발견 즉시 완전히 원상복구했다(잔여 0건 재확인).

---

## 16. 신규 이슈

이번 감사에서 **새로 발견한** 것은 §7의 테스트 데이터 잔존 1건뿐이다 — 발견 즉시 원인 규명 및 원상복구를 완료했으므로 backlog로 남길 미해결 항목이 아니다. 그 외 코드/설계상 신규 결함은 발견되지 않았다.

---

## 17. 기존 Known Issues

Phase9-0~9-4가 이미 기록한 것을 재확인만 하고 그대로 유지했다(재해결 시도 없음):

- `/login?next=`이 `/admin` 하위 경로 대신 `/admin`으로 고정(Phase9-2)
- `/admin/*` `<title>` template 미적용(Phase9-2)
- `robots.txt`에 `/admin` 미포함(Phase9-3)
- **FAQ/가이드 schema 미확정**(Phase9-0, §18에서 상세)
- Case C 완전 원자성, `user_numbers` 컬럼 위조 가능성, `color-danger`/`success` WCAG, `/dream/*` SSG/ISR 미적용 — 전부 Phase9와 무관, 재조사하지 않음

---

## 18. FAQ/가이드의 정확한 상태

**Phase9-0이 착수 전에 이미 BLOCKER로 분류한 상태 그대로 남아있다.** `faqs`/`guides`/`notices` 테이블이 어떤 migration에도 존재하지 않고, `DATABASE_SCHEMA.md §3.22`는 컬럼 정의 없이 "v1.0과 동일"이라고만 적혀 있으며 그 "v1.0" 문서 자체가 저장소에 없다(Phase9-0이 이미 확인, 이번 감사에서 재확인만 함 — 여전히 스키마가 어디에도 정의돼 있지 않음).

**EXECUTION_PLAN의 완료 기준에 "FAQ/가이드 CRUD 정상 동작"이 명시돼 있는 것은 사실이다**(§2) — 그래서 이 항목을 Critical/High 결함으로 승격하지 않되, Medium(완료 기준 일부 미충족)으로는 명확히 반영했다(§15). **임의로 FAQ 스키마를 설계해서 구현하지 않았다** — 지시문 원칙 그대로 준수.

**다음 단계에서 결정해야 할 것**(Phase9-0이 이미 제시한 것 그대로, 재결정 아님): FAQ/가이드/공지의 최소 컬럼(제목/본문/카테고리/노출순서/공개여부 등)을 사용자가 확정해야 migration을 설계할 수 있다.

---

## 19. Phase9 최종 판정

### CONDITIONAL PASS

**근거**: Critical/High 결함이 전혀 없고, 관리자 인증·회차 등록·꿈해몽 CRUD·대시보드 4개 기능이 실제 Supabase 환경에서 전부 정상 동작함을 실측으로 확인했다(§3~§6). 다만 EXECUTION_PLAN이 명시한 완료 기준 3개 중 1개(FAQ/가이드 CRUD)가 스키마 미확정이라는, 코드 문제가 아닌 사전 조건 미비로 인해 충족되지 못한 상태다(§18). 이는 Phase8-5가 "Rich Results Test/Search Console 미수행"을 이유로 CONDITIONAL PASS를 준 것과 정확히 같은 성격(코드 결함이 아니라 이 Task 범위에서 해결 불가능한 선행 조건)이라 FAIL이 아니라 CONDITIONAL PASS로 판정한다.

**PASS가 아닌 이유**: 완료 기준 3개 중 1개가 여전히 미충족 상태로 남아있어, "완료 기준이 모두 충족"이라는 PASS 조건(지시문 §17)을 문자 그대로 만족하지 못한다.

**BLOCKED가 아닌 이유**: Critical/High가 없고, 이미 구현된 3개 기능(인증/회차/꿈해몽 CRUD/대시보드— 실질적으로 4개 중 3개+대시보드)은 전부 운영 가능한 수준으로 실측 검증됐다. FAQ/가이드 부재가 나머지 기능의 정상 운영을 막지 않는다.

---

## 20. Phase10 착수 가능 여부

**질문 1 — Phase9 기능 자체가 실제 운영 가능한 수준인가?** 예. 관리자 인증/회차 등록/꿈해몽 CRUD/대시보드 4개 전부 실제 Supabase 환경에서 정상 동작을 재확인했다.

**질문 2 — Phase10 배포 단계로 넘어가도 되는가?** **조건부.** `EXECUTION_PLAN.md` Phase10의 선행조건은 "Phase 0~9 전체 완료"라고 명시돼 있다 — 이를 문자 그대로 적용하면 Phase9의 완료 기준 1개(FAQ/가이드)가 아직 충족되지 않아 이 조건이 완전히 성립하지 않는다. 다만 FAQ/가이드는 배포 자체를 기술적으로 막는 요소가 아니다(관리자 화면이 하나 비어있을 뿐, 서비스의 다른 어떤 기능도 이를 전제하지 않는다).

**질문 3 — 배포 전에 반드시 해결해야 할 문제가 있는가?** Critical/High 관점에서는 **없다.** 다만 "Phase 0~9 전체 완료"라는 EXECUTION_PLAN의 명시적 게이트를 문자 그대로 지키려면 FAQ/가이드 스키마 결정 및 최소 구현이 필요하다 — 이는 기술적 필요가 아니라 **문서가 정한 절차상의 선행조건**이므로, 이 게이트를 그대로 지킬지 FAQ/가이드를 배포 후 backlog로 명시적으로 이월할지는 **제품 결정이 필요하다**(이번 감사가 대신 결정하지 않는다).

**질문 4 — 배포 후에 처리해야 하는 작업은 무엇인가?** §22에 정리.

**질문 5 — 현재 프로젝트의 남은 EXECUTION_PLAN Phase는 무엇인가?** Phase9(FAQ/가이드 미완, 그 외 CONDITIONAL PASS), Phase10(배포) — EXECUTION_PLAN은 Phase0~10으로 끝난다. ROADMAP의 macro-phase(회원기능강화/커뮤니티/쇼핑몰/멤버십/AI자동화 등)는 EXECUTION_PLAN Phase0~10과 별개 번호 체계이며 이번 프로젝트가 지금까지 실행해 온 체계(EXECUTION_PLAN)의 다음 단계는 **Phase10 배포**뿐이다.

---

## 21. 배포 전 필수 작업

**기술적으로는 없다** — Critical/High 결함이 없고 4개 핵심 기능이 전부 실측 검증됐다.

**제품 결정 필요 사항 1개**: FAQ/가이드를 "Phase9 완료 기준"으로 계속 유지하며 배포를 미룰지, 아니면 명시적으로 Phase10 이후(또는 별도 backlog)로 이월할지 결정이 필요하다. 이번 감사는 그 결정 자체를 내리지 않는다(지시문 원칙 그대로).

---

## 22. 배포 후 backlog

- FAQ/가이드/공지 schema 확정 및 최소 CRUD 구현(Phase9 잔여 완료 기준).
- `/login?next=`이 `/admin` 하위 경로를 반영하도록 개선(Low, Phase9-2 기존 기록).
- `/admin/*` title template 적용(Low, Phase9-2 기존 기록).
- `robots.txt`에 `/admin` 추가(Low, Phase9-3 기존 기록).
- Phase8-5가 이미 기록한 배포 후 필수 항목(Rich Results Test 실제 제출, Search Console/서치어드바이저 등록 — 실제 프로덕션 URL 필요, 배포 이후에만 가능).
- 그 외 이번 감사에서 재확인만 하고 재해결하지 않은 기존 Known Issues(Case C 원자성, `user_numbers` 컬럼 위조 가능성, WCAG, SSG/ISR).

---

## 23. 다음 작업 추천

**FAQ/가이드/공지 최소 스키마를 사용자와 함께 확정하는 것**을 다음 작업으로 권장한다. 기술적으로는 Phase10(배포) 착수를 막을 이유가 없지만, EXECUTION_PLAN이 명시한 "Phase 0~9 전체 완료" 게이트를 있는 그대로 존중하려면 이 결정이 유일하게 남은 조각이다. 이 결정이 끝나면(a) 최소 컬럼으로 migration 1건 + 조회/쓰기 서비스 + 간단한 관리자 CRUD 화면을 Phase9-3(꿈해몽 CRUD)과 동일한 패턴으로 빠르게 완성할 수 있고, (b) 만약 사용자가 FAQ/가이드를 배포 후로 이월하기로 결정하면 그 즉시 Phase10 착수로 넘어갈 수 있다 — 어느 쪽이든 다음 단계가 이 결정 하나에 달려 있다.
