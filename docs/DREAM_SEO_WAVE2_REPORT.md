# Dream SEO Expansion Wave 2 + Content Depth Audit — 완료 보고서

Phase10-9B. Phase10-9(Wave1, `docs/DREAM_SEO_EXPANSION_REPORT.md`)가 만든 25→45개 Parent /
101→287개 Situation 기반 위에서, (1) 남겨둔 P3 후보 25개를 재평가하고, (2) 기존 287개
Situation의 콘텐츠 깊이를 실측 감사하고, (3) 검색 의도 격차가 있는 기존 Parent에 상황을
보강하고, (4) 신규 Parent를 additive로 확장한 결과를 기록한다. 이번 Wave 종료 후에는
페이지 수를 더 늘리는 작업을 중단하고 실제 검색엔진 색인/노출 데이터를 기다리는 단계로
넘어간다(최종 성공 조건).

## 1. 요약

| 항목 | Before | After | 증감 |
|---|---|---|---|
| Parent (dreams) | 45 | 61 | +16 |
| Situation (dream_situations) | 287 | 396 | +109 |
| Category | 8 | 9 (신규: 공포) | +1 |
| Sitemap URL 총합 | 348 | 474 | +126 |

verdict: **PASS**

## 2. Phase10-9 P3 후보 25개 재평가

Wave1이 미룬 25개 후보를 ADD/MERGE/DEFER/REJECT 4갈래로 재판정했다. 재판정은 각 키워드가
(a) 기존 Parent와 검색 의도가 겹치지 않는 독립 소재인지, (b) 이미 다른 Parent의 Situation
하나로 자연스럽게 흡수되는 세부 상황인지, (c) 문화적 해몽 근거가 아직 약하거나 이름
충돌 위험이 있는지를 기준으로 판단했다.

### ADD — 신규 Parent 16개
곰꿈, 코끼리꿈, 나비꿈, 여우꿈, 벌꿈, 손꿈, 출산하는 꿈, 좀비꿈, 유명인이 나오는 꿈,
친구가 나오는 꿈, 부모님이 나오는 꿈, 지갑꿈, 반지꿈, 기차꿈, 배꿈, 지진이 나는 꿈.

### MERGE — 기존 Parent의 신규 Situation으로 흡수 3개
- **금꿈** → `돈을 줍는 꿈`의 신규 Situation `금을-줍는-꿈`으로 흡수(금이라는 소재 자체가
  "무언가를 줍는다"는 상황의 하위 변주이지 독립된 검색 의도가 아니라고 판단).
- **강물꿈** → `물에 빠지는 꿈`의 신규 Situation `강물에-빠지는-꿈`으로 흡수(장소 변형이지
  꿈 해석의 구조 자체가 다르지 않음).
- **폭풍이 치는 꿈** → `번개 치는 꿈`의 신규 Situation `폭풍이-몰아치는-꿈`으로 흡수(번개·
  천둥·폭풍이 기상학적으로도 해몽 전통에서도 같은 계열의 자연현상 꿈으로 묶여 다뤄짐).

### DEFER — 보류 4개
- **늑대꿈**: 여우꿈(교활함/기민함)과 상징 영역이 크게 겹쳐, 두 Parent를 동시에 만들면
  근거가 약한 상태에서 근접 중복 콘텐츠가 될 위험이 큼. 여우꿈 실적을 지켜본 뒤 재검토.
- **발꿈**: "신체" 카테고리 신체 부위 꿈 중 문화적 해몽 근거(전통 자료·검색 수요)가 가장
  약한 축에 속함. 손꿈(이번 Wave ADD)의 실적을 먼저 확인.
- **눈(신체)꿈**: 기존 "눈 오는 꿈"(날씨) Parent와 이름이 "눈꿈"으로 겹칠 위험이 커서
  URL/제목 충돌 소지가 있음 — 명명 규칙을 먼저 정리한 뒤 추가하는 것이 안전.
- **회사에서 일하는 꿈**: "상황" 카테고리 소재로는 범위가 넓고 모호해 근거 있는 하위
  Situation(승진/야근/퇴사 등)을 갈라내기 전에는 Parent 단위로 만들기 이르다고 판단.

### REJECT — 제외 2개
- **오리꿈**: 다른 동물 소재 대비 전통 해몽 문헌·검색 수요 근거가 뚜렷하지 않아 근거 없는
  콘텐츠를 양산하지 않기 위해 제외.
- **교통사고 꿈**: 이미 기존 `자동차꿈` Parent 안에 사실상 동일한 검색 의도를 다루는
  Situation이 존재해(사고/충돌 관련), 별도 Parent를 만들면 근접 중복이 됨.

## 3. 기존 287개 Situation 깊이 감사 (Depth Audit)

`scratchpad/depth_audit.mjs`로 실제 DB의 287개 Situation 전량과 45개 Parent 전량을
직접 조회해 실측했다.

- body(interpretation) 길이: **min 185자 / median 357자 / max 476자**
- 150자 미만 "thin" 후보: **0건**
- key_meaning 누락/과짧음: **0건**
- 고정 보일러플레이트 문구 반복: **0건**
- key_meaning 중복: **0건**

287개 Situation은 이미 Wave1에서 충분한 길이·구조로 작성되어 있어, 억지로 100개를
수정하는 작업은 하지 않았다(지시문 명시 원칙 그대로 따름) — 개별 Situation 본문은
이번 Wave에서 **전혀 수정하지 않았다**.

## 4. Flagship Parent Hub 재작성 (9개)

Situation 개수는 많은데(7~12개) 부모 Parent의 `interpretation`이 여전히 1문단·40~90자
수준으로 남아 있던 초기(Wave0) Flagship 9개를 찾아 hub 구조를 재작성했다.

| Parent | Situation 수 | Before 길이 | After 구조 |
|---|---|---|---|
| 돼지꿈 | 12 | 88자, 단일 문단 | "## " 3섹션 |
| 뱀꿈 | 12 | 77자, 단일 문단 | "## " 3섹션 |
| 개꿈 | 9 | 71자, 단일 문단 | "## " 3섹션 |
| 똥꿈 | 9 | 78자, 단일 문단 | "## " 3섹션 |
| 이빨 빠지는 꿈 | 9 | 76자, 단일 문단 | "## " 3섹션 |
| 용꿈 | 8 | 76자, 단일 문단 | "## " 3섹션 |
| 호랑이꿈 | 7 | 67자, 단일 문단 | "## " 3섹션 |
| 임신하는 꿈 | 7 | 59자, 단일 문단 | "## " 3섹션 |
| 죽은 사람이 나오는 꿈 | 7 | 58자, 단일 문단 | "## " 3섹션 |

재작성은 `dreams.interpretation` 컬럼만 `UPDATE`하며, 해당 9개 Parent의 Situation
행은 전혀 건드리지 않는다. `## ` 마크다운은 Wave1이 이미 만든
`components/dream/DreamHubContent.tsx`가 그대로 파싱하므로 컴포넌트 코드 변경이
필요 없었다.

## 5. 기존 Parent 검색 의도 확장 (Section B, 13개 Parent + 28개 신규 Situation)

번개 치는 꿈(+3, P3-merge 1건 포함), 로또 당첨되는 꿈(+3), 돈을 줍는 꿈(+2, P3-merge
1건 포함), 물에 빠지는 꿈(+2, P3-merge 1건 포함), 시험 보는 꿈(+2), 결혼식 꿈(+2),
도둑에게 쫓기는 꿈(+2), 하늘을 나는 꿈(+2), 조상이 나타나는 꿈(+2), 산에 오르는 꿈(+2),
바다를 보는 꿈(+2), 까치꿈(+2), 거북이꿈(+2) = 총 28개.

## 6. 신규 Parent 16개 + Situation 81개 (Section C)

카테고리 분포: 동물(곰/코끼리/나비/여우/벌, 25개 Situation), 신체(손/출산, 10개),
공포(좀비 — **신규 카테고리**, 6개), 인물(유명인/친구/부모님, 15개), 사물(지갑/반지,
10개), 교통(기차/배, 10개), 자연(지진, 5개). "공포" 카테고리는 `dreams.category`가
자유 텍스트 컬럼이고 `lib/api/dreams.ts`의 `getDreamCategories()`가 DB 값을 그대로
집계하는 구조라 코드 변경 없이 자동으로 노출된다(§9 참조).

## 7. 중복/품질 검증

Wave1과 동일한 방법론(exact-match Map + Jaccard 유사도 > 0.5 근접중복)에 더해, 이번
Wave 전용으로 "수정된 기존 콘텐츠(hub 재작성 9개) vs 다른 기존 Parent" 비교를 추가했다.

| 검사 | 최초 결과 | 조치 | 최종 결과 |
|---|---|---|---|
| 신규 vs 신규 exact | 0 | — | 0 |
| 신규 vs 신규 near-dup | 1건 (여우꿈/여우에게-쫓기는-꿈 ↔ 좀비꿈/좀비에게-쫓기는-꿈, sim 0.51) | 좀비꿈 쪽 본문을 좀비 특유의 이미지(무리, 막다른 골목, 도움 요청)로 재작성 | 0 |
| 신규 vs 기존 287 exact | 0 | — | 0 |
| 신규 vs 기존 287 near-dup | 1건 (여우꿈/여우가-집에-들어오는-꿈 ↔ db:238 고양이가-집으로-들어오는-꿈, sim 0.56) | 여우꿈 쪽을 "영리함/기지" 테마로 재작성해 고양이꿈의 "새 인연" 테마와 구조적으로 분리 | 0 |
| 수정된 hub(9) vs 다른 기존 Parent(36) near-dup | 0 | — | 0 |
| hub-vs-hub(9개 상호) near-dup | 0 | — | 0 |
| key_meaning exact 중복 (신규 vs 기존 287) | 0 | — | 0 |
| Parent/Situation keyword 충돌 (신규 vs 기존) | 0 | — | 0 |
| 금칙 문구("반드시", "확실히", "복권에 당첨된다", "재물이 들어온다") | 1건 (유명인이 나오는 꿈/낯선-유명인을-보는-꿈, "확실히 알지 못하는" — 부정 문맥의 오탐) | "확실히"→"뚜렷하게"로 치환 | 0 |
| 새 콘텐츠 문장 시작 10자 패턴 3회+ 반복 | 0 | — | 0 |

최종 상태: **exact duplicate 0건, near-duplicate 0건**(신규↔신규, 신규↔기존287,
수정된 hub↔기존 Parent 3방향 모두).

## 8. 마이그레이션

`supabase/migrations/0021_dream_seo_wave2.sql` — 0001~0020은 전혀 수정하지 않았다.

- Section A: 9개 `UPDATE public.dreams SET interpretation = ...` (keyword 기준, Situation 미변경)
- Section B: 13개 기존 Parent에 28개 Situation `INSERT ... ON CONFLICT (dream_id, keyword) DO NOTHING`
- Section C: 16개 신규 Parent — `WITH ... INSERT INTO dreams WHERE NOT EXISTS(...) RETURNING id` →
  `dream_number_mappings` INSERT → 81개 Situation INSERT

`npx supabase db push`로 원격 DB에 적용 완료. 적용 후 실측: `dreams` 61건,
`dream_situations` 396건, `dream_number_mappings` 61건 — 모두 예상치와 정확히 일치.

## 9. SEO 샘플 감사 (29 URL)

Flagship hub 5, 기존Parent+신규Situation 5(P3-merge 3건 포함), 신규Parent hub 5,
신규Parent+신규Situation 10, 카테고리 페이지 2(신규 "공포" 포함) = 29 URL을 로컬
프로덕션급 dev 서버에 직접 요청해 검증했다.

- 최초 실행 시 전체 situation/category 경로가 404 — 원인 조사 결과 **Turbopack dev
  서버의 stale 라우트 캐시**(장시간 세션 동안 누적된 것)였음, Wave2 코드/마이그레이션과
  무관. `.next` 삭제 후 재시작으로 즉시 해소, 코드 변경 없음.
- 재검증 결과: **29/29 통과** — 200 상태, 고유 title/description, canonical 존재,
  breadcrumb JSON-LD 존재(Parent/Situation), h1 존재, 의도치 않은 noindex 없음.

## 10. 사이트맵

`app/sitemap.ts`는 `dreams`/`dream_situations`/`category` 3개 테이블을 매 빌드 시
직접 조회하는 완전 동적 구조라 코드 변경이 필요 없었다. 실측: 총 474 URL(정적 8 +
카테고리 9 + Parent 61 + Situation 396, 가이드 항목 0건), **중복 URL 0건**.

## 11. Dream Search 재검증

지시문 §23의 대표 질의(돼지/뱀/돈/죽은 사람/이빨/불/쫓김) + 신규 콘텐츠 대표 질의(곰/
여우/지진)로 재검증했다. "쫓김"은 결과 0건인데, 이는 `lib/api/dreamSearch.ts`가
의도적으로 단순 `ilike` 부분일치만 쓰는 비-AI 검색이라 "쫓기는"이라는 활용형과
문자열이 다르면 매칭되지 않는 것으로, "쫓기는"으로 질의하면 8건이 정확히 매칭됨을
확인했다 — Wave1부터 알려진 설계상의 한계이지 Wave2 회귀가 아니다. 그 외 모든 질의가
관련성 있는 Parent/Situation을 반환했다. 랭킹 로직은 변경하지 않았다(AI/시맨틱 검색
도입 없음).

## 12. 내부 링크 무결성

Situation 상세 페이지의 "비슷한 꿈도 확인해보세요" 섹션은 `getDreamSituations(dream.id)`
결과에서 현재 페이지만 제외한 뒤 앞 4개를 보여주는 라이브 DB 조회 방식이라(코드 변경
없음) 구조적으로 존재하지 않는 Situation을 참조하거나 자기 자신을 링크할 수 없다.
샘플 감사 29건 모두 이 섹션이 정상 렌더링됨을 확인했다.

## 13. Admin 호환성

`app/admin/dreams/**`의 CRUD는 이번 Wave에서 코드를 전혀 수정하지 않았고, 마이그레이션도
`dreams`/`dream_situations`/`dream_number_mappings`의 기존 스키마를 그대로 쓴다(컬럼
추가/변경 없음) — 신규 Parent/Situation도 Admin 화면에서 기존과 동일하게 조회/수정
가능하다.

## 14. 검증 스위트

| 항목 | 결과 |
|---|---|
| ESLint (`--max-warnings=0`) | 0 errors, 0 warnings |
| TypeScript (`tsc --noEmit`) | 0 errors |
| Vitest | **554/554 passed**(Wave1과 동일 베이스라인, 신규 로직 파일 없어 테스트 추가 없음) |
| `npm run build` | 성공, 전 라우트 정상 생성(`/api/account`, `/my/account` 포함) |

## 15. Account Withdrawal 최소 회귀 확인 (§43)

이번 Wave는 Account Withdrawal 로직(`lib/api/account/**`, `app/api/account/**`,
`app/my/account/**`)을 전혀 건드리지 않았다. `npm run build` 결과에 두 라우트
(`/api/account`, `/my/account`)가 정상 포함되어 컴파일 레벨 회귀가 없음을 확인했다 —
전체 재테스트는 이번 Task 범위가 아니다.

## 16. 프로덕션 데이터 안전성

마이그레이션 0021은 `dreams`/`dream_situations`/`dream_number_mappings` 3개 테이블만
건드리므로, 사용자 데이터 테이블은 적용 전후 실측이 완전히 동일하다.

| 테이블 | 값 |
|---|---|
| profiles | 1 |
| admins | 1 |
| user_numbers | 21 |
| draws | 10 |
| notifications | 0 |
| fortune_results | 1 |
| dream_journal_entries | 0 |
| user_period_stats | 0 |
| share_cards | 0 |

Phase10-7/8/9 이후 계속 유지되어 온 동일한 베이스라인과 일치 — **변경 0건**.

## 17. Lotto sync / Cron / fallback flag / Kakao 인증

이번 Wave에서 관련 파일을 전혀 수정하지 않았다(git status에 해당 경로 변경 없음).

## 18. git 상태

커밋/푸시는 수행하지 않았다(§44). 변경/추가 파일:

- 수정: `app/dream/[keyword]/[situation]/page.tsx`, `app/dream/[keyword]/page.tsx`,
  `app/dream/page.tsx`(Wave1에서 이미 수정됨, 이번 Wave 추가 수정 없음),
  `app/privacy/page.tsx`, `components/auth/ProfileMenu.tsx`(모두 Phase10-8/9 잔여분)
- 신규(이번 Wave): `supabase/migrations/0021_dream_seo_wave2.sql`,
  `docs/DREAM_SEO_WAVE2_REPORT.md`
- 신규(Phase10-8/9 잔여, 이번 Wave 미변경): `app/api/account/`, `app/api/dream/`,
  `app/my/account/`, `components/account/`, `components/dream/DreamHubContent.tsx`,
  `components/dream/DreamSearchInput.tsx`, `docs/ACCOUNT_WITHDRAWAL_REPORT.md`,
  `docs/DREAM_SEO_CONTENT_MAP.md`, `docs/DREAM_SEO_EXPANSION_REPORT.md`,
  `docs/VERCEL_DEPLOYMENT_REHEARSAL_REPORT.md`, `lib/api/account/`,
  `lib/api/dreamSearch.ts`, `lib/api/dreamSearch.test.ts`,
  `supabase/migrations/0020_dream_seo_expansion.sql`

## 19. 발견했지만 이번 Wave 범위가 아닌 사항

- Turbopack dev 서버가 장시간 세션에서 새 라우트를 stale 캐시로 404 처리하는 현상을
  겪었다(§9) — 로컬 개발 환경 이슈이며 프로덕션 빌드에는 영향 없음(§14 build 성공).
  다음 로컬 개발 세션에서 유사 증상이 재현되면 `.next` 삭제 후 재시작으로 해결된다.

## 20. 다음 작업 판단

지시문의 최종 성공 조건대로, 이번 Wave 종료 시점에서 Parent 45→61 / Situation
287→396 / Category 8→9 확장과 기존 콘텐츠 깊이 감사(thin 후보 0건)를 모두 마쳤다.
추가로 페이지 수를 더 늘리는 작업은 지금 하지 않는 것이 맞다고 판단한다 — 61개
Parent·396개 Situation은 이미 상당한 폭이고, 남은 P3 4건(DEFER)도 근거 보강이
먼저 필요한 상태다.

---

## TASK REPORT — Dream SEO Wave2

- Parents Before/After/Added: 45 / 61 / +16
- Situations Before/After/Added: 287 / 396 / +109
- Existing Situations Audited: 287
- Thin Candidates: 0
- Existing Situations Improved: 0 (Situation 본문 미수정 — thin 후보 자체가 0건이라 수정 대상 없음)
- Flagship Coverage: 9개 Parent hub interpretation 재작성 완료(돼지꿈/뱀꿈/개꿈/똥꿈/이빨 빠지는 꿈/용꿈/호랑이꿈/임신하는 꿈/죽은 사람이 나오는 꿈)
- Exact Duplicates: 0
- Near Duplicates: 0 (발견 2건 모두 재작성으로 해소, §7 참조)
- Boilerplate Issues: 0
- Search Quality: PASS
- Unique Metadata: PASS (29 URL 샘플 전수 확인)
- Sitemap URLs: 474 (중복 0건)
- Broken URLs: 0
- Mobile: 이번 Wave 범위 아님(레이아웃 코드 미변경, Wave1 검증 유지)
- Admin Compatible: YES
- Migration: 0021_dream_seo_wave2.sql 적용 완료, 실측 카운트 일치
- Tests: 554/554 passed
- Build: success
- User Data Changed: NO
- verdict: PASS
- Further Blind Content Expansion Recommended: NO
- Remaining Launch Blockers: 없음(이번 Task 범위 내). Phase10-7 배포 리허설 보고서(`docs/VERCEL_DEPLOYMENT_REHEARSAL_REPORT.md`)의 기존 Public Launch Ready 판정은 이번 Task와 무관하게 별도 유지됨.
- 다음 작업: 정확히 1개. **Google Search Console / 네이버 서치어드바이저에 갱신된 sitemap.xml을 제출하고 4~6주간 색인/노출 데이터를 관찰한다 — 그 결과가 나오기 전까지는 Dream SEO 콘텐츠를 더 확장하지 않는다.**
