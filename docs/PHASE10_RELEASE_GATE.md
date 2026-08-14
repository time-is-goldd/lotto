# Phase10-0 — Release / Public Content Gate

> GATE ONLY. Production 코드/DB/Migration/RLS/UI/env/Vercel 설정을 전혀 수정하지 않았다(읽기·분석만 수행, 변경 파일은 본 문서 1개뿐). Phase0~9는 재감사하지 않고 기존 감사 보고서(Phase8 Final Audit, Phase9 Final Audit, Phase9-6 FAQ/Guide Implementation Report)를 인용만 했다. 목적은 Phase10의 실제 범위와 구현 순서를 확정하는 것이다.

---

## 1. EXECUTION_PLAN Phase10 실제 범위

`docs/EXECUTION_PLAN.md` Phase10 원문을 그대로 추출한다.

**생성할 파일(§3)**: `app/terms/page.tsx`, `app/privacy/page.tsx`, `app/about/page.tsx`, `app/faq/page.tsx`, `app/guide/[topic]/page.tsx`

**구현순서(§5)**:
1. 이용약관/개인정보처리방침/서비스소개 작성(법적 최소 요건, ROADMAP MVP **Must**)
2. seed 데이터를 실제 최근 회차 데이터로 교체
3. 프로덕션 환경변수 최종 점검(카카오 Redirect URI를 프로덕션 도메인으로)
4. 성능 점검(Core Web Vitals)
5. 핵심 루프(생성→로그인→다이어리→당첨확인) 수동 E2E 테스트
6. 프로덕션 배포 및 도메인 연결

**완료 기준(§6)**:
- 실제 도메인에서 핵심 루프 오류 없이 동작
- 이용약관/개인정보처리방침 게시
- Core Web Vitals 목표치 충족(또는 개선계획 문서화)
- 실제 회차 데이터로 당첨확인 정상 동작

**중요 발견 — §3(생성할 파일)과 §5/§6(구현순서/완료 기준) 사이의 범위 불일치**: §3은 5개 파일을 "생성할 파일"로 명시하지만, §5의 6단계 구현순서는 `app/faq/page.tsx`/`app/guide/[topic]/page.tsx`를 만드는 단계를 전혀 언급하지 않는다(1번 "이용약관/개인정보처리방침/서비스소개"는 terms/privacy/about 3개만 가리킨다). §6 완료 기준 4개도 FAQ/Guide 공개 페이지를 요구하지 않는다. 즉 **EXECUTION_PLAN 문서 자체가 FAQ/Guide 공개 페이지를 "만들 파일 목록"에는 넣었지만 "완료를 판정하는 기준"에서는 뺐다** — Phase9-0/Phase9-5가 이미 "관리자 CRUD는 Phase9, 공개 페이지는 Phase10 소관"이라고 확정한 근거가 바로 이 §3이므로, 이번 결정에서 이 불일치를 임의로 지우지 않고 아래와 같이 해소한다: **§3(파일 목록)을 실제 산출물 범위로 채택**하고, §6(완료 기준)이 그 파일들을 빠뜨린 것을 문서의 누락으로 취급한다 — Phase9-6 보고서(§18)가 이미 "Phase10 착수 가능 여부: YES, Phase10에서 구현해야 할 공개 FAQ/Guide"라고 다음 작업으로 못박아 뒀고, Phase9 Final Audit(§23)도 동일한 결론을 내렸다. 이 프로젝트가 지금까지 반복해 온 "문서 간 충돌은 더 구체적인 산출물 목록을 우선한다" 원칙(`PHASE9_FAQ_GUIDE_DECISION.md` §2와 동일한 해소 방식)과 일치한다.

**ROADMAP.md MoSCoW 상 위치**: 법적 페이지(terms/privacy/about)는 **Must**("이용약관/개인정보처리방침/19세 미만 이용제한 고지 | 법적 최소 요건"). FAQ/가이드는 **Could**("가이드/FAQ | 초기엔 최소 페이지 3~5개로 축소 가능"). 등급 차이가 크다 — 실제 launch 절대 요건은 법적 페이지 쪽이지 FAQ/Guide가 아니다.

**사용자 지시문 §1 체크리스트 대조**:

| 항목 | Phase10 포함 여부 | 근거 |
|---|---|---|
| 공개 `/faq` | **포함**(§3 파일 목록, 완료 기준 아님) | 위 설명 |
| 공개 `/guide/[topic]` | **포함**(§3 파일 목록, 완료 기준 아님) | 위 설명 |
| FAQ/가이드 SEO | 포함(§3이 페이지를 요구하는 이상 최소 metadata는 당연히 따라옴, Phase8이 세운 패턴 재사용) | §7 |
| FAQ/가이드 sitemap 반영 | 포함(공개 페이지가 생기면 정합성상 필요, `SITEMAP.md` §4가 `/guide/*`·`/faq/*`를 P2로 이미 분류) | §8 |
| 실제 draws seed → 실제 회차 데이터 교체 | **포함**, §5 순서 2번 + §6 완료 기준에 명시 | §9 |
| Production 배포 | **포함**, §5 순서 6번 | §14 |
| Vercel/Supabase production 설정 | **포함**(EXECUTION_PLAN Phase0에서 이미 Vercel 연결됐고, Phase10 §5 순서 3번이 "프로덕션 환경변수 최종 점검") | §11 |
| Search Console 등록 | Phase10 §5/§6에 문자 그대로는 없음. 단 Phase8 Final Audit(§20)이 "배포 후 필수, Phase10 배포 단계 이후가 자연스러운 시점"이라고 이미 이월해 둠 | §12 |
| 네이버 서치어드바이저 등록 | 상동 | §12 |
| Rich Results Test | 상동 | §12 |
| 환경변수 검증 | **포함**, §5 순서 3번 | §11 |
| 관리자 운영 계정 등록 | Phase10 §3/§5/§6 어디에도 문자 그대로 없음. 그러나 관리자 계정 0건 상태로는 배포 후 회차 입력·콘텐츠 관리가 불가능해 실질적으로 launch 전 필요(§10) | §10 |
| launch 전 smoke test | **포함**, §5 순서 5번("핵심 루프 수동 E2E 테스트") | §14 |

---

## 2. Code 작업 vs 운영 작업

### A. 코드 구현 작업 (레포에 커밋되는 산출물)

| 작업 | 파일 | 의존성 |
|---|---|---|
| `content_entries` 공개 읽기 RLS + 인덱스 | 신규 migration 1개(§5) | 없음 |
| 공개 조회 서비스 | `lib/api/content.ts`(신규) | 위 RLS |
| FAQ 공개 페이지 | `app/faq/page.tsx` | `lib/api/content.ts` |
| Guide 공개 페이지 | `app/guide/[topic]/page.tsx` | `lib/api/content.ts`, §6 title 중복 방지 |
| FAQ/Guide SEO metadata + JSON-LD | 위 두 페이지 내부 | Phase8이 만든 `lib/seo/*` 패턴 재사용 |
| Sitemap 확장 | `app/sitemap.ts`(수정) | 공개 읽기 서비스 |
| 법적 페이지 | `app/terms/page.tsx`, `app/privacy/page.tsx`, `app/about/page.tsx` | 없음(정적 텍스트, DB 무관) |

### B. Release / 운영 작업 (레포 산출물이 아니거나, 실제 인프라/데이터를 다루는 1회성 행위)

| 작업 | 성격 | 의존성 |
|---|---|---|
| 실제 회차 데이터 준비/입력 | 데이터(운영자가 공식 회차 결과를 조사해 입력) | 없음(코드와 독립) |
| FAQ 5문항/가이드 3편 실제 콘텐츠 작성 | 콘텐츠(운영자가 Phase9-6 관리자 화면으로 직접 작성) | Code 작업의 admin CRUD는 이미 완료(Phase9-6) — 이 자체는 즉시 시작 가능, 공개 페이지 코드 완성과 병행 가능 |
| 운영 관리자 계정 등록 | 1회성 DB 작업(service_role) | 실제 로그인 계정 존재 |
| Production 환경변수 최종 점검 | Vercel 설정 | 없음 |
| 카카오 앱 "개발"→"운영" 전환 + Redirect URI 변경 | 카카오 개발자 콘솔 설정 | Production 도메인 확정 |
| 프로덕션 배포 | Vercel 배포 | 위 코드 작업 전부 완료 |
| 카카오 로그인 실제 브라우저 E2E | 사람이 직접 1회 수행 | 배포(또는 로컬)된 URL |
| Google Search Console / 네이버 서치어드바이저 / Rich Results Test | 외부 서비스 등록·제출 | 배포된 공개 도메인 |

**선후관계 요약**: Code 작업(RLS→서비스→FAQ/Guide UI→SEO/sitemap)과 법적 페이지는 서로 독립적으로 병행 가능하다. 운영 작업 중 "실제 회차 데이터"·"콘텐츠 작성"·"관리자 등록"·"환경변수 점검"도 Code 작업과 병행 가능하다(전부 배포를 전제하지 않음). 유일한 하드 의존은 **배포 이후에만 가능한 3가지**(카카오 실제 E2E, Search Console류 등록, Rich Results Test) — 이것만 반드시 배포 뒤로 순서가 고정된다.

---

## 3. FAQ 공개 페이지 설계

- URL: `/faq` 단일 목록 페이지. `SITEMAP.md` §1 "`/guide, /faq` 가이드/FAQ(기존과 동일)"와 `PHASE9_FAQ_GUIDE_DECISION.md` §11("FAQ는 단일 페이지가 이 프로젝트의 실제 계획")이 이미 이렇게 확정해 뒀다 — 재검토하지 않는다.
- 필요 데이터: `content_entries`에서 `type='faq'`인 행의 `title`/`body`/`display_order`만 사용. 상세 라우트(`/faq/[id]` 등)는 만들지 않는다.
- 정렬: `display_order` 오름차순 → `id` 오름차순 2차 정렬(Phase9-6 관리자 목록과 동일한 정렬 계약을 그대로 공개 페이지에 재사용).

---

## 4. Guide 공개 페이지 설계

- URL: `/guide/[topic]`. `title`을 `encodeURIComponent`로 URL 세그먼트에 직접 사용(별도 `slug` 컬럼 없음) — `dreams.keyword`가 이미 확립한 패턴(`app/dream/[keyword]/page.tsx`)을 그대로 재사용한다. `PHASE9_FAQ_GUIDE_DECISION.md` §8-A가 이미 이 방향을 확정했다.
- 조회: `getGuideByTopic(topic)` → `content_entries`에서 `type='guide' AND title = decodeURIComponent(topic)` 단건 조회.
- title 변경 시 이전 URL은 `404`, 새 URL은 `200` — `dreams.keyword` 수정 시 이미 동일하게 동작함을 Phase9 Final Audit(§5)이 실측 확인한 것과 완전히 같은 특성이다. 새로운 문제가 아니라 기존에 이미 받아들인 트레이드오프를 그대로 물려받는다.

---

## 5. content_entries 공개 읽기 전략

지시문 §3의 3개 후보를 비교한다.

| 기준 | A. anon/authenticated SELECT RLS 추가 | B. Route/service가 service_role로 읽기 | C. 다른 패턴 |
|---|---|---|---|
| 보안 | RLS는 SELECT만 허용, INSERT/UPDATE/DELETE는 그대로 service_role 전용 유지 — 쓰기 경로에 영향 없음 | service_role 키의 사용 범위가 "관리자 전용 쓰기"에서 "일반 공개 읽기"까지 넓어짐 — 노출 표면 확대 | 이 프로젝트에 A/B 외 제3의 안전한 공개 읽기 패턴은 없음(전수 확인) |
| SEO/SSG/ISR | `app/sitemap.ts`/`lib/api/dreams.ts`가 이미 쓰는 "anon client + `revalidate`" 패턴을 그대로 재사용 가능 | 페이지 렌더 경로에 `service_role` 의존이 생겨, 실수로 클라이언트에 노출되는 회귀 위험이 구조적으로 상존 | — |
| 유지보수 | migration 1개 추가만 하면 끝, 새 코드 경로 없음 | 관리자 서비스(`lib/api/admin/content.ts`)와 별개로 "공개용 service_role 서비스"까지 관리 지점이 늘어남 | — |
| 1인 개발 단순성 | 기존에 이미 검증된 패턴 그대로 복붙 | 새로운 관리 부담 | — |
| public 콘텐츠라는 데이터 성격 | FAQ/가이드는 태생적으로 "전체 공개" 콘텐츠 — RLS로 그 사실을 DB 레벨에서 명시하는 것이 데이터 성격과 정확히 일치 | 데이터 성격상 굳이 서버에서만 읽어야 할 이유가 없음(비공개 데이터가 아님) | — |
| 기존 dreams 공개 RLS 패턴과의 정합성 | `dreams_select_public`과 완전히 동일한 패턴(`to anon, authenticated using (true)`) | 새로운 예외 패턴 | — |

**권고안: A(anon/authenticated SELECT RLS 추가)**. `content_entries_select_public` 정책(`to anon, authenticated using (true)`)을 신규 migration으로 추가하고, `lib/api/content.ts`는 `lib/api/dreams.ts`와 동일하게 anon 클라이언트(`lib/supabase/server.ts` 또는 `sitemap.ts`처럼 cookies 없는 별도 anon 클라이언트)로 조회한다. **이번 Task에서는 migration을 만들지 않는다** — Phase10-1에서 실제로 생성한다.

---

## 6. Guide URL / title 중복 위험

**실제 구조적 위험을 확인했다.** 현재 `content_entries`에는 `title`에 대한 UNIQUE 제약이 전혀 없다(migration 원문 재확인, `0014_content_entries.sql`). `type='guide'`인 행 중 `title`이 같은 두 행이 생기면:

- `getGuideByTopic()`이 `.eq("type","guide").eq("title", topic).single()`로 조회할 경우 PostgREST가 "2행 이상"을 에러로 반환한다(`single()`은 정확히 1행만 허용).
- `.maybeSingle()`을 써도 2행 이상이면 동일하게 에러다.
- 즉 중복 title이 생기는 순간 **해당 topic의 `/guide/[topic]` 조회 자체가 깨진다** — 404가 아니라 500에 가까운 실패.

현재 `content_entries` 실데이터는 0건(Phase9-6 검증 데이터 전량 삭제 확인, 본 Task에서 재확인)이라 지금 당장 깨진 URL은 없지만, 관리자가 가이드를 작성하면서 실수로 같은 제목을 두 번 입력하면 즉시 재현되는 문제다. Phase9-6 관리자 서비스(`lib/api/admin/content.ts`)의 입력 검증에도 title 중복 차단 로직이 없다(전수 확인).

지시문이 제시한 4개 후보 비교:

| 후보 | 평가 |
|---|---|
| title 전체 UNIQUE | FAQ 행까지 영향받음 — FAQ는 같은 질문이 두 번 있어도 URL 충돌이 없으므로 과한 제약. 채택 안 함 |
| slug 추가 | Phase9-5 Decision(§8-A)이 명시적으로 기각한 방향을 뒤집는 것 — "실제 구현에 문제가 없으면 뒤집지 않는다"는 지시문 원칙에 위배. 채택 안 함 |
| 현재 구조 유지 + 애플리케이션 레벨 검증만 | DB 제약이 없으므로 코드 경로를 우회한 삽입(예: 향후 다른 관리자 기능, 수동 SQL)에는 무력 — 근본 차단이 아님 |
| id 기반 URL(`/guide/[id]`) | EXECUTION_PLAN이 이미 라우트명을 `/guide/[topic]`으로 명시했고 `dreams` 관례(자연어 slug)와도 어긋남 — 채택 안 함 |

**권고안(최소 변경)**: **partial UNIQUE 인덱스** — `create unique index content_entries_guide_title_idx on public.content_entries (title) where type = 'guide';`. `type='guide'`인 행에만 적용되므로 FAQ에는 영향이 없고, 기존 컬럼/Decision을 하나도 바꾸지 않는 순수 추가다. **동시에** `lib/api/admin/content.ts`의 `createContentEntry`/`updateContentEntry`에 "같은 `type='guide'`로 동일 `title`이 이미 있으면 `AdminContentValidationError`" 애플리케이션 레벨 검증을 추가해, DB 제약 위반(500 에러)이 아니라 관리자 화면에서 즉시 400으로 친절하게 막는 것을 권장한다(DB 제약은 최후 방어선, 애플리케이션 검증은 UX). 이 변경은 **이번 Task에서 만들지 않는다** — Phase10-1 migration에 §5의 RLS 정책과 함께 포함하는 것을 권장한다(같은 목적의 같은 파일 변경 단위로 묶는 것이 효율적).

---

## 7. SEO / JSON-LD 전략 (Phase10 세부 Task에 배치, 이번 Task에서 구현하지 않음)

- **FAQ**: `title`/`description`/`canonical`은 Phase8이 이미 확립한 `lib/seo/metadata.ts` 헬퍼 패턴을 그대로 재사용. **FAQPage JSON-LD는 화면에 실제로 보이는 질문/답변과 완전히 동일한 내용일 때만 추가한다** — `/faq` 페이지가 정확히 그 조건(목록 자체가 질문/답변)을 만족하므로 추가 후보이지만, 실제 구현 여부와 정확한 스키마 필드는 Phase10 세부 Task에서 결정한다.
- **Guide**: 페이지별 `title`/`description`/`canonical` — `/dream/[keyword]/page.tsx`의 `generateMetadata()` 패턴을 그대로 재사용 가능(동일하게 "제목을 URL 세그먼트로 쓰는 단건 콘텐츠 페이지" 구조). `BreadcrumbList` JSON-LD도 `/dream/[keyword]`가 이미 쓰는 것과 동일한 구조(홈→가이드→현재 topic)로 재사용 가능.
- 과장되거나 실제 화면과 다른 구조화 데이터는 만들지 않는다(지시문 원칙 그대로 유지).

---

## 8. Sitemap 영향

현재 `/sitemap.xml`은 정적(`○`, `revalidate=3600`) 35개 URL(정적 3 + 카테고리 7 + 꿈 25, Phase9 Final Audit §12 기준 baseline). FAQ/Guide 공개 페이지가 생기면:

- `/faq` URL 1개 추가(단일 목록 페이지이므로 1개뿐).
- `/guide/[topic]` — `content_entries`에서 `type='guide'`인 행 수만큼 추가(현재 0건, 운영자가 콘텐츠를 채우는 만큼 늘어남).

`app/sitemap.ts`가 이미 쓰는 "cookies 없는 별도 anon 클라이언트 + `revalidate=3600`" 패턴(§5 권고안 A와 정합 — 공개 SELECT RLS가 있어야 이 패턴이 성립한다)을 그대로 확장하면 된다. **현재 sitemap 구현을 재설계하지 않는다** — `content_entries` 조회를 `dreams`/`category` 조회와 나란히 추가하는 최소 수정으로 충분하다.

---

## 9. Synthetic draws 처리 전략

읽기 전용으로 재확인한 현재 상태(원격 Supabase, service_role SELECT):

```
draws count: 15
sources: ['manual']
rounds: 1150~1164 (연속 정수)
```

`docs/BACKLOG.md` 항목 B가 이미 "CHECK 제약을 통과하는 합성(synthetic) placeholder이며 실제 공식 당첨 결과가 아니다"로 확정해 둔 것과 정확히 일치한다(재조사 아님, 존재 재확인만).

**제약**: `0010_seed_data.sql`은 Schema Freeze 대상이라 파일 자체를 수정하지 않는다(`DATABASE_SCHEMA.md` §10-1). 이 프로젝트는 dev/staging/prod가 분리된 다중 Supabase 프로젝트 구조가 아니라 **Phase0에서 생성한 단일 Supabase 프로젝트를 그대로 운영 DB로 쓰는 구조**다(EXECUTION_PLAN Phase0 체크리스트에 "Supabase 프로젝트 생성"이 1회성 단일 항목으로만 존재, MASTER_PRD의 "유지보수 비용 최소화" 원칙과 정합) — 즉 지금의 15건 synthetic 데이터가 그대로 실사용자에게 노출될 실제 위험이 있다.

**결정**:
- 신규 migration은 부적절하다 — 회차 데이터는 매주 늘어나는 운영 데이터이지 1회성 스키마 변경이 아니다. migration 파일에 실제 당첨번호를 박아 넣으면 "운영 데이터를 버전관리 이력에 영구 고정"하는 안티패턴이 된다.
- **권고**: (1) 실제 공식 최근 회차 데이터(10~20건, 원 seed 의도와 동일 분량)를 운영자가 동행복권 공식 결과에서 직접 조사한다 — **이 작업은 내가 임의로 실제 당첨번호를 생성/추정해서는 안 되는 영역**이다(실존하는 공식 기록이므로 창작 불가). (2) 기존 synthetic 15건을 `DELETE`한다(스키마 변경이 아니라 데이터 삭제이므로 Schema Freeze 규칙과 무관). (3) 조사한 실제 회차를 **1회성 운영 스크립트**(service_role, 로컬에서 1회 실행 후 폐기 — Phase9-6에서 쓴 `app/api/jtest/route.ts`와 동일한 "임시 검증/운영 라우트" 관례)로 일괄 입력하거나, 건수가 적으면 **이미 완성된 관리자 화면(`/admin/draws`, Phase9-2)**으로 하나씩 입력한다 — 신규 코드가 전혀 필요 없다. (4) 배포 이후 신규 회차는 계속 `/admin/draws`로 입력한다(원래 설계된 운영 흐름 그대로).
- **production DB에 synthetic 데이터가 들어가지 않게 하는 가장 안전한 방식**: 위 (2)~(3) 순서를 배포 **직전**에 수행해, synthetic 데이터가 실사용자에게 한 번도 노출되지 않는 시점에 교체를 끝낸다.

---

## 10. 운영 관리자 등록

읽기 전용으로 재확인: `admins` 테이블 현재 **0건**(Phase9-6 검증 후 테스트 계정 전량 삭제 확인, 이번 Task에서 재확인).

**정리**: Phase10 launch 전에 실제 운영 관리자 최소 1명을 등록해야 한다 — 그렇지 않으면 배포 직후 회차 입력·FAQ/가이드 콘텐츠 작성·꿈해몽 관리 어디에도 접근할 수 없다(0건 상태로 배포하면 관리자 화면 자체가 무용지물). EXECUTION_PLAN/ROADMAP 어디에도 이 항목이 명시적으로 없지만, 이미 완성된 관리자 기능(Phase9)을 실제로 쓰려면 반드시 필요한 실질적 선행 작업이다.

**절차**: Phase6 결정(`PHASE6_ADMIN_AUTH_DECISION.md`)이 이미 확정한 절차를 그대로 사용한다 — 실제 운영자 본인이 카카오(또는 이메일)로 정식 로그인해 `auth.users` 행을 만든 뒤, 그 UID를 대상으로 **service_role 기반 1회성 `admins` INSERT**를 수행한다. UID는 코드/migration/문서 어디에도 하드코딩하지 않는다(그때그때 Supabase Auth에서 실제 값을 조회해 1회성으로만 사용).

---

## 11. Production 환경변수 체크리스트

코드에서 실제 `getEnv()`/`process.env` 사용처를 전수 검색한 결과(`.env.example` 대조, 추측 없음):

| 변수 | 사용처 | 비고 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase/client.ts`, `server.ts`, `service.ts`, `app/sitemap.ts` | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase/client.ts`, `server.ts`, `app/sitemap.ts` | |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/service.ts` | 서버 전용, `NEXT_PUBLIC_` 접두사 절대 금지 |
| `NEXT_PUBLIC_SITE_URL` | `app/robots.ts`, `app/sitemap.ts`, `lib/auth/kakao.ts`(`getKakaoRedirectUri()`) | **Production 배포 시 반드시 실제 도메인으로 교체** — 로컬값(`http://localhost:3000`)을 그대로 두면 카카오 Redirect URI/sitemap/robots가 전부 잘못된 도메인을 가리킨다 |
| `KAKAO_REST_API_KEY` | `lib/auth/kakao.ts`(authorize URL, token 교환 2곳) | |
| `KAKAO_CLIENT_SECRET` | `lib/auth/kakao.ts`(token 교환) | |
| `NEXT_PUBLIC_KAKAO_JS_KEY` | `.env.example`에 선언되어 있으나 **현재 코드 어디서도 `getEnv()`로 참조되지 않음**(전수 검색 확인) | 카카오 공유(Must, `FEATURE_SPEC.md` §9.1) 기능이 아직 구현되지 않아 소비처가 없다. 지금 값이 비어 있어도 launch 자체를 막지 않지만, `.env.example`에 문서화된 키이므로 Vercel에 등록은 해 두는 것을 권장(추후 공유 기능 구현 시 재확인 불필요) |

추가로 코드 변경 없이 확인해야 할 것(§9 EXECUTION_PLAN이 명시): **카카오 개발자 콘솔 앱을 "개발" → "운영" 모드로 전환**, Redirect URI를 프로덕션 도메인으로 등록. 이것은 env var가 아니라 카카오 콘솔 설정이지만 누락 시 실사용자 로그인이 즉시 실패하므로 같은 체크리스트에 포함한다(EXECUTION_PLAN Phase10 §9 주의사항 원문).

---

## 12. Phase8 배포 후 작업

`docs/PHASE8_FINAL_AUDIT_REPORT.md` §17/§20이 이미 "코드 문제가 아니라 배포된 공개 URL이 있어야만 가능한 운영 행위"로 확정해 둔 항목 3개를 그대로 인용한다(재조사 아님):

1. Google Rich Results Test(`search.google.com/test/rich-results`) — 실제 프로덕션 URL 제출
2. Google Search Console 등록·소유권 확인
3. 네이버 서치어드바이저 등록·소유권 확인

**순서**(지시문 예시와 동일, 실제 요구사항과 정합 확인): 배포 → production URL 확인(정상 응답) → `/sitemap.xml`/`/robots.txt` 확인(실제 도메인 기준으로 재확인 필요, `NEXT_PUBLIC_SITE_URL` 교체 후) → Rich Results Test(JSON-LD 2종 + 추가된 FAQ/Guide 구조화 데이터가 있다면 그것도 함께) → Google Search Console 등록 → 네이버 서치어드바이저 등록. Rich Results Test를 Search Console보다 먼저 두는 이유는 색인 요청 전에 구조화 데이터 오류를 먼저 잡는 것이 순서상 자연스럽고, 두 등록 절차끼리는 서로 의존관계가 없어 순서를 바꿔도 무방하다.

---

## 13. Known Issues 중 Launch 영향 분류

`docs/BACKLOG.md` + `PHASE9_FINAL_AUDIT_REPORT.md` §17 + `PHASE8_FINAL_AUDIT_REPORT.md` §15/§16이 이미 기록한 항목만 대상으로 한다(새 감사 없음, 분류만 수행).

| 이슈 | 분류 | 근거 |
|---|---|---|
| `color-danger`/`success` WCAG | Post Launch | 접근성 개선이지 기능 결함 아님. Phase8/9 감사 모두 SEO/관리자 범위와 무관하다고 이미 기록 |
| 번호 5색 미구현 | Post Launch | 시각적 개선사항, 핵심 루프 동작에 영향 없음 |
| `/dream/*` SSG/ISR 미적용 | Before Launch Recommended | Phase10 완료 기준(§1)이 "Core Web Vitals 목표치 충족(**또는 개선계획 문서화**)"를 명시적으로 허용 — 지금 당장 고치지 않아도 개선계획 문서화로 완료 기준을 만족할 수 있어 하드 blocker는 아니지만, 실제 성능 목표 달성에는 유리하므로 권장 등급 |
| `user_numbers` 결과 컬럼 위조 가능성 | Before Launch Recommended | RLS `user_numbers_update_own`이 "본인 소유 행"까지만 보장하고 `match_count`/`win_rank` 등 특정 컬럼만 수정 불가하게 막지는 못한다(Phase6부터 반복 기록된 기존 이슈, 이번에 새로 발견한 것 아님). 개인 다이어리 데이터라 당장 공개 노출되지는 않지만 `share_cards`로 공유되면 위조된 결과가 외부에 노출될 수 있어 신뢰도와 직결 — 그러나 4개 연속 Phase 감사(6/7/8/9)가 전부 이 등급으로 이월해 왔고 이번에도 그 판단을 뒤집을 새 근거가 없어 동일하게 유지 |
| Case C 원자성(배치 부분 실패) | Post Launch | 이미 문서화된 완화책 존재(다음 회차 재시도), 발생 확률 낮음, Phase6 설계 당시 이미 수용된 트레이드오프 |
| `/login?next=`이 `/admin` 하위 경로 미반영 | Post Launch | 관리자 1인 운영 환경에서 UX 불편일 뿐, 일반 사용자 경로에는 영향 없음 |
| `robots.txt`에 `/admin` 미포함 | Before Launch Recommended | 개별 관리자 페이지는 이미 `noindex` 메타 + `notFound()` 게이트로 보호되어 기능적 결함은 아니지만, 크롤 예산 낭비를 막는 defense-in-depth로 한 줄 추가하는 비용이 매우 낮음 |
| 카카오 실제 브라우저 E2E | **Launch Blocker** | `PHASE2_KAKAO_E2E_REPORT.md` §0/§3이 명시: "카카오 서버가 우리 code를 accept하는지"는 사람이 실제 브라우저로 한 번도 확인한 적이 없는 유일한 구간이다. 카카오 로그인은 Must이자 사실상 유일한 주 로그인 수단(이메일은 폴백)이므로, 이 구간이 실패하면 신규 가입 자체가 막힌다. EXECUTION_PLAN Phase10 §5 순서 5번("핵심 루프 수동 E2E 테스트")이 정확히 이 검증을 요구하고 있어 이미 계획에 포함되어 있다 |
| 외부 lotto 자동수집 미구현 | Post Launch | ROADMAP/ADMIN_REQUIREMENTS 둘 다 Phase8(자동화 고도화) 항목으로 명시적으로 분류, MVP는 수동 입력이 원래 설계 |
| `admin_audit_logs` 부재 | Post Launch | Phase6 결정(Option A)이 이미 "필요성 재검토 지연"으로 확정 |
| synthetic `draws` 데이터 | **Launch Blocker** | §9 상세. EXECUTION_PLAN 완료 기준에 "실제 회차 데이터로 당첨확인 정상 동작"이 명시되어 있고, BACKLOG가 "허위 당첨 정보 게시와 같다"고 명시적으로 위험을 기록 |
| 운영 관리자 0건 | **Launch Blocker**(신규 확인, §10) | 코드 결함은 아니지만 배포 직후 관리자 기능이 전혀 작동하지 않는 상태가 되므로 실질적 launch 전 필수 작업 |
| canonical 4개 페이지 미적용(Phase8 CONDITIONAL) | Post Launch | Phase8 감사가 이미 "의도된 설계 선택"으로 기록, 추가해도 리스크 없는 순수 보강이라 급하지 않음 |

---

## 14. Phase10 구현 순서

실제 의존관계(§2)와 MoSCoW 등급(§1)을 기준으로, 가장 작은 실제 구현 Task 단위로 순서화한다.

```
Phase10-1  content_entries 공개 읽기 기반
           (RLS SELECT 정책 + guide title partial UNIQUE 인덱스, migration 1개
            + lib/api/content.ts + DB 타입 재생성)
              │
              ▼
Phase10-2  FAQ + Guide 공개 UI + SEO/Sitemap 통합
           (app/faq/page.tsx, app/guide/[topic]/page.tsx,
            metadata/JSON-LD, app/sitemap.ts 확장)
              │
Phase10-3  법적 페이지 (독립, 10-1/10-2와 병행 가능)
           (app/terms, app/privacy, app/about)
              │
              ▼ (10-2, 10-3 완료 후 합류)
Phase10-4  Production 데이터/운영 준비
           (synthetic draws → 실제 회차 교체, FAQ 5문항/가이드 3편 콘텐츠 작성,
            운영 관리자 1명 등록 — 전부 코드 아닌 데이터/운영 작업)
              │
              ▼
Phase10-5  Production 배포 설정 + 배포
           (환경변수 최종 점검, 카카오 운영모드 전환+Redirect URI,
            Core Web Vitals 점검, 프로덕션 배포)
              │
              ▼
Phase10-6  배포 후 검증 + SEO 등록
           (카카오 실제 브라우저 E2E, 핵심 루프 수동 E2E,
            Rich Results Test → Search Console → 네이버 서치어드바이저)
```

Phase10-2/10-3은 서로 의존관계가 없어 병행 가능하지만 별도 Task로 묶어 관리 부담을 늘리지 않는다(지시문 "불필요하게 잘게 쪼개지 않는다" 원칙 — FAQ+Guide+SEO+sitemap을 하나로 묶은 이유는 Phase9-6이 FAQ+Guide 관리자 CRUD를 하나로 묶은 것과 동일한 논리: 같은 테이블·같은 패턴을 재사용하는 대칭 작업이라 분리 실익이 없다). Phase10-4는 코드 작업이 전혀 없는 순수 운영 준비라 Phase10-1~10-3과 병행 착수 가능하지만, "완료"는 Phase10-5 배포 직전에 맞추는 것이 안전하다(synthetic 데이터를 너무 일찍 지우면 개발 중 회귀 테스트에 쓸 draws 데이터가 없어짐).

---

## 15. Launch Blocker

기술적 코드 결함(Critical/High)은 없다(Phase8/9 감사가 이미 확인, 재확인 없음). 그러나 아래 3개는 **배포 자체를 막지는 않지만 "실사용자에게 안전하게 오픈 가능한 상태"를 막는** 실질적 blocker다(§13):

1. **synthetic `draws` 데이터 15건** — 실제 회차로 교체 전까지 허위 당첨 정보 게시 위험.
2. **운영 관리자 0건** — 배포 직후 관리자 기능 전체가 무용지물.
3. **카카오 로그인 실제 브라우저 E2E 미검증** — 유일한 주 가입 경로가 사람에 의해 한 번도 끝까지 확인된 적 없음.

FAQ/Guide 공개 페이지 자체는 launch blocker가 아니다(§1 — EXECUTION_PLAN 완료 기준에 없고 ROADMAP상 Could).

---

## 16. Phase10-1 정확한 작업 범위

**목표**: `content_entries`를 일반 사용자가 읽을 수 있게 하는 최소 기반을 만든다. 공개 페이지 UI는 이 Task에 포함하지 않는다(Phase10-2).

**포함**:
- 신규 migration 1개: `content_entries_select_public` RLS 정책(`to anon, authenticated using (true)`) + `content_entries_guide_title_idx`(partial UNIQUE, `where type = 'guide'`) — 같은 목적(공개 읽기를 안전하게 만드는 것)의 두 변경을 한 파일로 묶는다.
- `lib/api/admin/content.ts`의 `createContentEntry`/`updateContentEntry`에 guide title 중복 애플리케이션 검증 추가(§6).
- `lib/api/content.ts`(신규): `getFaqEntries()`, `getGuideEntries()`, `getGuideByTopic(topic)` — anon 클라이언트 기반, `lib/api/dreams.ts` 패턴 재사용. 관리자 서비스(`lib/api/admin/content.ts`)의 mutation/service_role 코드는 재사용하지 않는다(책임 분리, 지시문 §6).
- `npx supabase gen types typescript --linked` 재실행 + diff 확인.
- 단위 테스트(`lib/api/content.test.ts`).

**포함하지 않음**: `app/faq/page.tsx`, `app/guide/[topic]/page.tsx`, sitemap 수정, SEO metadata — 전부 Phase10-2.

---

## 17. Phase10 Ready 여부

**READY.** Phase9는 사용자가 명시한 대로 최종 PASS 상태이고(Phase9-6 FAQ/Guide 구현 포함), Phase8은 CONDITIONAL PASS이지만 미충족 항목 2개(Rich Results Test, Search Console)가 전부 "배포 후에만 가능한 운영 행위"로 이미 Phase10 이후로 이월 확정되어 있어 Phase10 착수를 막지 않는다. Critical/High 코드 결함 없음. Phase10의 실제 범위(§1)와 구현 순서(§14)가 이번 Task로 확정되어, 다음 세션은 바로 Phase10-1 구현에 착수할 수 있다.

단, **§15의 Launch Blocker 3개는 "Phase10 착수 가능"과 별개로 "실제 프로덕션 오픈 가능" 이전에 반드시 해소되어야 한다** — 이 구분(착수 가능 vs 오픈 가능)은 Phase8/9 감사가 이미 써 온 것과 동일한 판단 틀이다.

---

## TASK REPORT — Phase10 Gate

- **Phase10 실제 범위**: 공개 FAQ/Guide 페이지(`/faq`, `/guide/[topic]`) + 법적 페이지(terms/privacy/about, Must) + 실제 회차 데이터 교체 + 프로덕션 배포/환경설정 + 배포 후 SEO 등록. EXECUTION_PLAN §3(파일 목록)과 §6(완료 기준) 사이에 FAQ/Guide 관련 범위 불일치가 있었으며, §3(더 구체적인 산출물 목록)을 기준으로 채택했다(§1).
- **Public FAQ 필요**: YES
- **Public Guide 필요**: YES
- **content_entries DB 변경 필요**: YES (공개 SELECT RLS 정책 추가 — 쓰기 스키마는 무변경)
- **RLS 변경 필요**: YES (SELECT 정책 추가만, INSERT/UPDATE/DELETE 정책은 그대로 없음=service_role 전용 유지)
- **Guide URL schema 변경 필요**: YES (컬럼 추가 아님 — `title`에 대한 partial UNIQUE 인덱스만 추가, 기존 title-as-URL 설계는 유지)
- **Synthetic draws launch blocker**: YES
- **운영 관리자 등록 필요**: YES
- **Phase8 배포 후 작업**: Rich Results Test → Google Search Console 등록 → 네이버 서치어드바이저 등록 (전부 배포 후, 프로덕션 URL 필요)
- **Launch Blocker**: (1) synthetic draws 15건 미교체 (2) 운영 관리자 0건 (3) 카카오 로그인 실제 브라우저 E2E 미검증
- **Phase10 Ready**: YES
- **Phase10-1**: `content_entries` 공개 읽기 기반 — RLS SELECT 정책 + guide title partial UNIQUE 인덱스(migration 1개) + `lib/api/content.ts`(공개 조회 서비스, service_role 미사용) + DB 타입 재생성 + 단위테스트. UI/sitemap은 포함하지 않음(Phase10-2).
- **다음 작업**: Phase10-1(`content_entries` 공개 읽기 RLS + `lib/api/content.ts` 구현) 1개.
