# Phase10-4D — Dream Situation Expansion MVP 구현 보고서

## §1. 기존 Dream 구조

`dreams`(0003_dreams.sql) — 부모 꿈 25건, 컬럼: `id, keyword, category, interpretation, image_url, created_at, updated_at`. `dream_number_mappings` — 부모 꿈 1건당 추천 번호 1세트(정확히 6개, `is_valid_lotto_numbers()`로 강제). 공개 페이지: `/dream`(허브), `/dream/[keyword]`(상세), `/dream/category/[category]`(카테고리 목록). `lib/api/dreams.ts`가 공개 anon 조회 전담.

## §2. 기존 문제

`/dream/[keyword]` 하나가 부모 꿈 전체를 대표하는 짧은 해몽 문구 + 번호 6개로 끝나, 사용자가 실제로 꾼 구체적 상황("돼지를 잡는 꿈" 등)을 반영하지 못했다. 콘텐츠 깊이도 얕고, 번호는 항상 6개로 고정돼 있어 "확정된 번호 세트"처럼 보였다.

## §3. 최종 dream_situations 스키마

```sql
create table public.dream_situations (
  id bigint generated always as identity primary key,
  dream_id bigint not null references public.dreams (id) on delete cascade,
  keyword varchar(50) not null,
  title varchar(100) not null,
  body text not null,
  key_meaning varchar(200),
  numbers int[] check (public.is_valid_partial_lotto_numbers(numbers)),
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dream_id, keyword)
);
```

`PRODUCT_EXPANSION_PLAN.md` 권고안 대비 두 필드를 추가했다: `keyword`(URL 전용 안정적 슬러그 — title 편집이 URL을 깨뜨리지 않게 분리, §8/§23/§24가 전용 URL을 요구해 권고안의 "1단계는 URL 없음"보다 최신·구체적인 지시를 따랐다)와 `key_meaning`(상세 페이지의 "핵심 해석" 한 줄, §10 요구). 자세한 이유는 migration 0018 헤더 주석에 기록.

## §4. Situation number 구조

`is_valid_partial_lotto_numbers(numbers int[])` — 항상 정확히 6개를 요구하는 기존 `is_valid_lotto_numbers()`(draws/user_numbers/dream_number_mappings/fortune_results가 의존)와 완전히 분리된 새 함수. `NULL`(0개) 또는 1~6개의 1~45 범위·중복 없는 정수 배열만 허용한다. 빈 배열(`array[]`) 대신 `NULL`을 "0개"로 쓴 이유는 "값 없음"을 스키마 레벨에서 더 명확히 드러내기 위함.

## §5. Migration

- `supabase/migrations/0018_dream_situations.sql` — 테이블 생성 + `is_valid_partial_lotto_numbers()` + RLS(0009 이후 확립된 관례대로 같은 파일에서 함께 적용).
- `supabase/migrations/0019_dream_situations_seed.sql` — 25개 부모 꿈 전부에 걸쳐 101건 시드. `on conflict (dream_id, keyword) do nothing`으로 반복 실행 안전(0010의 `draws` 시드와 동일 패턴). `dream_id`는 하드코딩 정수가 아니라 `(select id from public.dreams where keyword = '...')` 서브쿼리로 조회(0010과 동일한 이유 — 실제 부여된 id 값에 의존하지 않음).

0001~0017은 전혀 수정하지 않았다(Schema Freeze 원칙 유지).

## §6. RLS

`dreams_select_public`/`dream_number_mappings_select_public`(0008)과 완전히 동일한 패턴: `dream_situations_select_public`이 `anon, authenticated`에게 `using (true)`로 SELECT만 허용. INSERT/UPDATE/DELETE 정책은 만들지 않아 암묵적으로 `service_role` 전용이다.

## §7. URL 구조

`/dream/[keyword]/[situation]` — 상황별 전용 URL. `dream_situations.keyword`는 `dream_id` 범위로만 UNIQUE라(전역 아님) URL 고유성은 부모 keyword + 상황 keyword 조합이 함께 보장한다. 권고안의 "1단계는 URL 없음"과 다른 방향으로, 이번 지시문 §8/§23/§24가 명시적으로 요구해 채택했다(§3 참조).

## §8. Parent UX

`app/dream/[keyword]/page.tsx`의 기존 설명/추천 번호/CTA는 한 글자도 바꾸지 않았다. 그 아래에 "이 꿈에는 이런 상황도 있어요" 섹션을 추가해, `getDreamSituations(dream.id)`로 조회한 상황들을 `display_order` 순으로 컴팩트 카드(`DreamSituationCard`)로 렌더링한다. 상황이 0건이면 섹션 자체를 렌더링하지 않는다.

## §9. Situation UX

`app/dream/[keyword]/[situation]/page.tsx`: breadcrumb(홈→꿈해몽→부모 꿈→상황) → "꿈의 의미"(body, 2~4문단) → "핵심 해석"(key_meaning, nullable이라 있을 때만 렌더) → "행운 숫자"(0~6개, 실제 개수만). 하단에 기존 스타일 `/generate?dream=` CTA와 "다른 [부모꿈] 해몽 보기" 내부 링크.

## §10. 돼지꿈 Situation 목록

12건(display_order 순): 돼지를 보는 꿈 / 돼지가 집 안으로 들어오는 꿈 / 돼지를 잡는 꿈 / 돼지고기를 먹는 꿈 / 돼지를 타는 꿈 / 새끼 돼지가 나오는 꿈 / 돼지가 새끼를 낳는 꿈 / 검은 돼지 꿈 / 흰 돼지 꿈 / 많은 돼지가 나오는 꿈 / 돼지에게 쫓기는 꿈 / 돼지가 죽는 꿈. 최소 요구(10+)를 충족.

## §11. 전체 Parent 수

25건(기존 그대로, 신규 부모 꿈 추가 없음 — §18 준수).

## §12. 전체 Situation 수

101건(목표 80~120 범위, 최소 60+ 충족).

## §13. Parent별 Situation 수

| 부모 꿈 | 개수 | 부모 꿈 | 개수 |
|---|---|---|---|
| 돼지꿈 | 12 | 이빨 빠지는 꿈 | 4 |
| 뱀꿈 | 6 | 임신하는 꿈 | 4 |
| 용꿈 | 5 | 조상이 나타나는 꿈 | 3 |
| 물고기 잡는 꿈 | 4 | 죽은 사람이 나오는 꿈 | 4 |
| 호랑이꿈 | 4 | 결혼식 꿈 | 3 |
| 까치꿈 | 3 | 불이 나는 꿈 | 4 |
| 거북이꿈 | 3 | 물에 빠지는 꿈 | 3 |
| 소꿈 | 4 | 하늘을 나는 꿈 | 3 |
| 쥐꿈 | 4 | 돈을 줍는 꿈 | 4 |
| 개꿈 | 4 | 로또 당첨되는 꿈 | 3 |
| 똥꿈 | 5 | 산에 오르는 꿈 | 3 |
| | | 바다를 보는 꿈 | 3 |
| | | 도둑에게 쫓기는 꿈 | 3 |
| | | 시험 보는 꿈 | 3 |

합계 101건, 25개 부모 꿈 전부에 최소 3건 이상 분포.

## §14. 숫자 0~6개 지원

`is_valid_partial_lotto_numbers()`가 DB 레벨에서 강제. 실측으로 0/1/6개 삽입 성공, 7개·범위 밖(0, 46)·배열 내 중복은 전부 `23514` CHECK 위반으로 거부됨을 재확인(§26 참조).

## §15. 실제 숫자 count distribution

| 개수 | 건수 |
|---|---|
| 0 | 22 |
| 1 | 3 |
| 2 | 21 |
| 3 | 25 |
| 4 | 17 |
| 5 | 11 |
| 6 | 2 |

전부 6개인 경우는 2건뿐(전체 101건 중) — "전부 6개면 FAIL"(§36) 기준을 명확히 충족하는 자연스러운 분포.

## §16. 콘텐츠 작성 원칙

"반드시 ~된다/곧 ~합니다" 같은 확정적 미래 예측 표현을 전혀 쓰지 않고 "전통적으로 ~로 해석된다/~로 여겨지기도 한다"류의 완곡한 문화적·오락적 표현만 사용했다. 각 상황은 상황 묘사 + 일반적 해석 + 긍정적 해석 가능성 + (필요시) 주의점을 2~4문단에 걸쳐 자연스럽게 서술했으며, 순수 SEO 글자수 채우기를 하지 않았다.

## §17. Public service

`lib/api/dreamSituations.ts`(신규) — `getDreamSituations(dreamId)`(부모→상황 목록, display_order 정렬), `getDreamSituationByKeyword(dreamId, situationKeyword)`(상황 상세). `lib/api/dreams.ts`와 동일하게 anon/쿠키 클라이언트만 쓰고 `service_role`은 전혀 쓰지 않는다. 기존 `lib/api/dreams.ts`는 수정하지 않았다.

## §18. SEO metadata

`generateMetadata()`가 상황별로 독립적인 `title`("{상황 title} 해몽 | 의미와 행운 숫자")/`description`(key_meaning 우선, 없으면 body 앞 100자)/`canonical`/OpenGraph/Twitter를 생성한다. 부모 페이지와 문구가 겹치지 않아 키워드 스터핑이 없다.

## §19. Breadcrumb

4단계 BreadcrumbList JSON-LD(홈→꿈해몽→부모 꿈→상황)를 부모 페이지의 `buildBreadcrumbJsonLd()`와 동일한 `<` → `<` 이스케이프로 생성. 실제 HTTP 응답에서 `홈/꿈해몽/돼지꿈/돼지를 잡는 꿈` 4단계가 정확히 나오는 것을 확인했다(§26).

## §20. Internal links

부모 페이지 → 상황 카드 링크(§8), 상황 상세 페이지 breadcrumb의 부모 링크, 그리고 하단 "다른 [부모꿈] 해몽 보기" 링크로 부모↔상황 간 내부 링크를 강화했다.

## §21. Sitemap

`app/sitemap.ts`가 기존과 동일한 패턴(자체 `createPublicClient()`, `revalidate = 3600`)으로 `dream_situations`를 조회해 URL을 추가한다. 실측: 시토맵 총 141건 중 상황 URL 정확히 101건, 중복 0건.

## §22. Mobile

`DreamSituationCard`는 얇은 테두리 한 줄짜리 컴팩트 카드(제목 + 1~2줄 요약 + 화살표)로, 부모 목록의 큰 `Card` 컴포넌트와 의도적으로 다르게 만들었다(§28).

## §23. XSS/security

새로 추가한 파일 어디에도 신규 `dangerouslySetInnerHTML` 사용이 없다(기존에 감사된 JSON-LD 용도 2곳만 재사용). 꿈/상황 본문은 순수 React 텍스트 렌더링. JSON-LD의 `<` → `<` 이스케이프 패턴을 그대로 재사용해 `</script>` 조기 종료 벡터를 차단했다.

## §24. 기존 Dream → Generate 회귀

부모 페이지의 `/generate?dream=`, `/my/journal/dreams/new?dream=` 링크와 계약을 전혀 바꾸지 않았다. 상황 상세 페이지도 같은 `/generate?dream=` 계약을 재사용하되(부모 dream.id만 전달), "이 꿈을 기억하며 번호 생성하기"라는 정직한 문구로 — 상황을 실제로 저장/전달하지 않는다는 점을 암시하지 않도록 했다(§12, 자동 채우기 기능은 이번 범위 밖으로 명시).

## §25. Admin Dream 회귀

`lib/api/admin/dreams.ts`의 `deleteAdminDream()`은 `dreams` 행을 지우기만 하고 관련 행 정리를 FK cascade에 위임하는 기존 구조 그대로다 — `dream_situations.dream_id`도 동일한 `on delete cascade`이므로 코드 변경 없이 안전하게 함께 정리된다. 실측(격리된 테스트 부모 꿈 id=29 + 상황 4건 생성 후 부모 삭제)으로 고아 상황 0건을 확인했다. 관련 기존 admin 테스트(`lib/api/admin/dreams.test.ts` 등)는 전혀 수정하지 않았고 전체 스위트 통과로 회귀 없음을 확인했다.

## §26. Tests/build

- **DB 제약 실측**(격리된 테스트 부모 꿈으로): 0/1/6개 삽입 성공(201), 7개·범위 밖(0, 46)·배열 내 중복은 전부 `23514`로 거부, 중복 `(dream_id, keyword)`는 `23505`로 거부, anon SELECT 성공(200), anon INSERT/UPDATE/DELETE 전부 거부(각각 401 또는 실질적으로 0행 처리되는 204), 부모 삭제 시 cascade로 상황 0건 남음, 테스트 데이터 전량 정리 후 실제 시드 101건 그대로 확인.
- **단위 테스트**: `lib/api/dreamSituations.test.ts` 신규 7건 추가. 전체 스위트 `402 passed`(기존 395 + 신규 7).
- **lint**: `next lint` 전체 통과.
- **type-check**: `tsc --noEmit` 통과.
- **build**: `next build` 성공, 라우트 47개(기존 46 + `/dream/[keyword]/[situation]`).
- **HTTP 실측**(dev 서버): `/dream`→200, `/dream/[돼지꿈]`→200, 상황 3건(돼지를 잡는 꿈/돼지가 집 안으로 들어오는 꿈/돼지고기를 먹는 꿈)→각 200(서로 다른 title/description/canonical/번호 개수 확인), 잘못된 상황 keyword→404. `/`, `/generate`, `/dream`, `/dream/category/동물`, `/fortune`, `/my/journal`, `/faq`, `/robots.txt`, `/sitemap.xml`→200, `/my/journal/results`·`/admin/dreams`→307(비로그인 리다이렉트, 기존과 동일한 정상 동작).

## §27. Migration sync

`npx supabase migration list` 확인 결과 0001~0019 전부 local=remote(정상 동기화). 0018/0019는 이번 Task에서 새로 추가한 migration이며, 0001~0017은 전혀 수정하지 않았다.

## §28. 발견된 문제

시드 migration(0019) 최초 작성 시 "개꿈" 첫 번째 상황("낯선 개가 따라오는 꿈") 튜플에서 `title` 필드를 빠뜨려 `INSERT has more target columns than expressions`(SQLSTATE 42601)로 `db push`가 실패했다. Postgres 오류 메시지의 statement 번호가 실제 문제 위치와 다르게 보고돼(뒤 블록의 주석이 컨텍스트로 표시됨) 육안 검토만으로는 위치를 특정하기 어려웠다 — 괄호/대괄호 깊이를 추적해 튜플별 필드 개수를 세는 Node 스크립트를 작성해 정확한 위치(9번째 insert, 1번째 튜플)를 찾아냈다. `db push` 실패 시 전체 트랜잭션이 롤백됨을 실측으로 확인한 뒤(행 0건) 안전하게 재실행해 101건 전부 정상 커밋했다. 이 문제를 제외하면 콘텐츠 품질 검증(제목/keyword 중복, 빈 본문, 짧은 본문, 숫자 범위/개수/중복, 고아 dream_id, 인코딩 깨짐)에서 발견된 결함은 0건이다.

## §29. 후속 Admin Situation CRUD 필요 여부

**필요함(후속 과제로 권장)**. 이번 Task는 지시문 §31에 따라 의도적으로 만들지 않았고, 101건 전부 migration seed로만 존재한다 — 향후 콘텐츠 수정/추가는 코드 변경(새 migration) 없이는 불가능하다. `lib/api/admin/dreams.ts`의 기존 패턴(service_role, `assertKnownCategory`류 검증)을 그대로 확장하면 될 것으로 보인다.

## §30. 다음 작업 추천

**Admin Situation CRUD** 추가 — 현재 상황 콘텐츠는 migration seed로만 존재해 향후 수정·추가·삭제가 코드 변경 없이는 불가능하다는 점이 가장 명확한 다음 단계다. 그 외 참고용 후보(구현하지 않음, §18 준수): 25개 부모 꿈 목록에 없는 "고양이꿈" 등은 사용자 검색 빈도가 높을 수 있어 향후 신규 부모 꿈 후보로 고려해볼 만하다.

---

## TASK REPORT — Dream Situations MVP

- **Parent Dreams Preserved**: 25건 전부 유지, URL/설명/번호/CTA 무변경
- **Situation Table**: `dream_situations`(0018, FK cascade, RLS 공개 SELECT)
- **Migration**: 0018_dream_situations.sql, 0019_dream_situations_seed.sql (0001~0017 무수정)
- **Total Parent Dreams**: 25
- **Total Situations**: 101
- **Pig Dream Situations**: 12
- **Situation Number Range**: 0~6개(1~45, 중복 없음), `is_valid_partial_lotto_numbers()`로 DB 레벨 강제
- **Zero-number Situation Supported**: 예(22건이 실제 0개, NULL)
- **Six-number Forced**: 아니오(6개는 101건 중 2건뿐, 분포 0~6 전 구간에 자연스럽게 퍼짐)
- **Public Read**: anon/authenticated 전체 허용(실측 200 확인)
- **Public Mutation**: 전면 거부(anon INSERT 401, UPDATE/DELETE 실질 0행, service_role만 가능)
- **Parent URL Preserved**: `/dream/[keyword]` 완전 무변경
- **Situation URL**: `/dream/[keyword]/[situation]`(부모+상황 keyword 조합으로 전역 고유성 보장)
- **Korean Route**: 정상 동작(실측 — 인코딩된 한글 세그먼트 3종 200 확인)
- **Metadata**: 상황별 독립 title/description/canonical/OG/Twitter(키워드 스터핑 없음)
- **Breadcrumb**: 4단계(홈→꿈해몽→부모 꿈→상황) JSON-LD, XSS 이스케이프 재사용
- **Sitemap Added URLs**: +101(중복 0건, 실측 확인)
- **Dream → Generate Regression**: 없음(계약 무변경, 상황 페이지는 부모 dream.id만 재사용)
- **Admin Dream Regression**: 없음(FK cascade로 코드 변경 없이 안전, 실측 고아 0건)
- **Tests**: 402 passed(기존 395 + 신규 7)
- **Build**: 성공(라우트 47개)
- **Migration Sync**: local=remote(0001~0019 전부 일치)
- **Dream Expansion verdict**: **PASS**
- **Remaining Launch Blockers**: 없음
- **다음 작업**: Admin Situation CRUD 추가(현재 콘텐츠 수정/추가가 migration 없이는 불가능)
