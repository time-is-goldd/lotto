# Phase9-2 관리자 회차 입력 화면 구현 보고서

> Phase6에서 이미 구현·실측 검증된 회차 등록/당첨 대조 시스템(`lib/api/admin/draws.ts`, `app/api/admin/draws/route.ts`, `lib/logic/matchNumbers.ts`)을 재구현하지 않고, 관리자 UI에 그대로 연결했다. 판정/저장/알림 로직은 단 한 줄도 새로 만들지 않았다.

---

## 1. 생성/수정 파일

**신규**:
- `app/admin/draws/page.tsx` — 회차 입력 페이지(Server Component)
- `components/admin/DrawRegistrationForm.tsx` — 폼(Client Component)
- `components/admin/drawFormValidation.ts` — 순수 검증 함수(UX용 클라이언트 검증)
- `components/admin/drawFormValidation.test.ts` — 위 순수 함수 유닛테스트
- 본 보고서

**수정**: `app/admin/page.tsx` — "회차 관리" 카드만 `/admin/draws`로 연결(나머지 3개 카드는 여전히 라우트가 없어 `href` 없이 텍스트로만 유지).

**미변경**: `lib/api/admin/draws.ts`, `app/api/admin/draws/route.ts`, `lib/logic/matchNumbers.ts`, `lib/types/winning.ts`, `lib/auth/isAdmin.ts`, `app/admin/layout.tsx`, `proxy.ts` — 전부 무수정 재사용(`git status`로 확인). Migration/RLS 신규 없음.

검증 중 임시로 사용하고 전부 삭제한 것(흔적 없음): `app/api/jtest/route.ts`(세션 발급/admin 승격/DB 확인/정리용 임시 라우트, Phase2 이래 반복 사용해 온 방식), Supabase 테스트 계정 2개, `admins`/`user_numbers`/`notifications` 테스트 행, 테스트 회차(`round` 99001/99002/99003).

---

## 2. 기존 Phase6 코드 재사용 내역

| 로직 | 재사용 방식 |
|---|---|
| 당첨번호/보너스번호 검증(6개/1~45/중복없음/보너스-본번호 중복금지) | 서버: `lib/api/admin/draws.ts`가 이미 `assertValidNumberSet`/`assertValidBonusNumber`(`lib/logic/matchNumbers.ts`) 호출(무수정). 클라이언트: `components/admin/drawFormValidation.ts`가 **같은 두 함수를 그대로 import**해 재사용 — 규칙을 한 번 더 작성하지 않았다 |
| 등수 판정(`win_rank`)/일치 개수(`match_count`) | `matchNumbers()`(무수정), 관리자 UI는 이 값을 전혀 계산하지 않는다 |
| 회차 저장 + `target_round` 연결 + 배치 대조 + 알림 생성 | `registerDrawAndMatchUserNumbers()`(무수정), `POST /api/admin/draws`가 그대로 호출 |
| 중복 회차 처리(`409`) | `draws.round UNIQUE` + `DuplicateRoundError`(무수정) |
| 관리자 인증 | `isAdmin()`(무수정) + `app/admin/layout.tsx`(Phase9-1, 무수정) |

**서버 로직은 단 한 줄도 새로 만들지 않았다.** 이번 Task가 실제로 새로 작성한 코드는 (1) 폼 UI, (2) 클라이언트 UX 검증(서버와 동일한 규칙을 재사용하되 별도 파일), (3) API 응답을 화면에 표시하는 로직뿐이다.

---

## 3. `/admin/draws` UX

- **입력 필드**: 회차(1개) + 당첨번호 6개(개별 input, `fieldset`+`legend`로 그룹화) + 보너스 번호(1개) + 1등 당첨금(1개) + 1등 당첨자 수(1개) — 지시문이 요구한 5개 항목과 정확히 일치, 그 외 필드 없음.
- **접근성**: 모든 input이 `Input` 컴포넌트(기존, `components/ui/Input.tsx`)로 `label`+`id`가 자동 연결됨. 오류는 `role="alert"` 문단으로 표시(색상만으로 전달하지 않음). 버튼은 `disabled`/`aria-busy`(기존 `Button` 컴포넌트가 이미 처리)로 상태가 명확하다. `h1` 정확히 1개("회차 관리"). 실측으로 6개 번호 input을 포함한 모든 필드에 `<label for="...">`가 정확히 연결됨을 확인(§6).
- **클라이언트 검증**: §2의 재사용 함수가 던지는 `WinningValidationError`의 메시지를 그대로 표시 — 서버가 최종적으로 검증하는 것과 동일한 문구를 미리 보여준다. **클라이언트 검증은 UX 편의일 뿐이며, 최종 검증은 여전히 `POST /api/admin/draws`(무수정)에서 수행된다.**
- **디자인**: 새 색상 토큰/새 컴포넌트 없음 — `Input`/`Button`/`Card`(Phase9-1이 이미 쓴 것과 동일한 기존 컴포넌트)만 재사용.

---

## 4. API 연결

`POST /api/admin/draws`(무수정)만 호출한다. 요청 payload:

```json
{ "round": number, "winningNumbers": number[6], "bonusNumber": number, "firstPrizeAmount": number, "firstPrizeCount": number }
```

기존 `AdminDrawInput` 계약과 정확히 일치 — 새 필드를 추가하지 않았다. 응답 상태별 처리:

| 상태 | UI 처리 |
|---|---|
| `201` | 성공 카드로 전환(§6), 서버 응답(`data`)과 클라이언트가 방금 제출한 값(`winningNumbers`/`bonusNumber`)을 합쳐 표시 — **새 조회 API 없음** |
| `400`/`401`/`403`/`409`/`500` | 전부 `body.error.message`를 그대로 표시 — 서버가 이미 사용자가 이해할 수 있는 한국어 메시지를 주므로 상태 코드별 문구를 새로 만들지 않았다(`409`는 이미 "회차 N는 이미 등록되어 있습니다."로 충분히 명확해 별도 처리 불필요, §7 실측) |

새 Route Handler/새 service 함수를 만들지 않았다.

---

## 5. 인증/보안 검증

- `app/admin/layout.tsx`(Phase9-1, 무수정)가 `/admin/draws`에도 그대로 적용되어 페이지 레벨 1차 보호를 제공한다. 이 페이지 자신은 실제 데이터를 조회하지 않아(등록된 회차 목록 등을 보여주지 않음) Phase9-1 §7-1이 지적한 "페이지가 민감한 데이터를 직접 조회하면 layout 게이트만으로 불충분" 위험이 이번 페이지에는 해당하지 않는다 — 실제 쓰기(회차 등록)는 여전히 `POST /api/admin/draws`가 `isAdmin()`으로 독립적으로 재검증한다(2계층 원칙 유지, §6 실측으로 재확인).
- 클라이언트 코드(`DrawRegistrationForm.tsx`, `drawFormValidation.ts`) 어디에도 `service_role`/`lib/supabase/service.ts` import가 없다 — `npm run build` 결과 생성된 `.next/static/chunks/`를 `grep -rl "SUPABASE_SERVICE_ROLE_KEY\|service_role"`로 전수 검사해 **0건**을 확인했다(코드 리뷰가 아니라 실제 번들 산출물 기준 검증).
- 클라이언트는 `user_id`를 전혀 전송하지 않는다(payload에 필드 자체가 없음). `match_count`/`win_rank`/`checked_at`/`target_round`도 폼이 다루지 않는다 — 실측으로 이 필드들을 body에 강제로 끼워 넣어도(§6 위조 시도) `draws` 테이블에 애초에 그런 컬럼이 없어 저장에 영향이 없고, 실제 판정 결과는 여전히 `registerDrawAndMatchUserNumbers()`가 서버에서 계산함을 확인했다.

---

## 6. 실제 HTTP 검증 결과 (실제 Supabase, production build 기준)

`npm run build && npm run start`로 실제 배포에 가까운 상태에서 테스트 계정 2개(User A=일반, User B=관리자 승격)로 검증했다.

| 테스트 | 결과 |
|---|---|
| **Test A**: 비로그인 → `/admin/draws` | `307` → `Location: /login?next=%2Fadmin`(주의: `next`가 `/admin/draws`가 아니라 `/admin`을 가리킴 — `app/admin/layout.tsx`가 모든 하위 경로에 동일한 고정값을 쓰기 때문. Phase9-1 산출물의 기존 동작이라 이번 Task에서 수정하지 않음, §11에 기록) |
| **Test B**: 일반 사용자(User A) → `/admin/draws` | `404`(Phase9-1의 기존 게이트 동작 그대로) |
| **Test C**: 관리자(User B) → `/admin/draws` | `200`, `<h1>회차 관리</h1>` + 회차/번호1~6/보너스번호/1등당첨금/1등당첨자수 **9개 label** 전부 정상 렌더링 |
| **Test D**: 정상 등록(회차 99001, `[1,2,3,4,5,6]`+보너스 7) | `201`, `{matchedCount:1, winnersCount:1, failedUpdateIds:[]}`. **service_role 직접 조회로 재확인**: `draws`에 정확히 저장, User A의 `user_numbers`가 `target_round:99001, match_count:6, win_rank:1, checked_at` 반영, `notifications`에 `type:"win_result", title:"99001회차 1등 당첨을 축하합니다!"` 생성 |
| **Test E**: 동일 회차(99001) 재등록(다른 번호/금액으로) | `409 DUPLICATE_ROUND`, "회차 99001는 이미 등록되어 있습니다." — service_role 재조회로 **기존 `draws` 행이 전혀 변경되지 않았음**(번호/당첨금 그대로) 확인 |
| **Test F**: 잘못된 입력 3종(번호 중복/보너스-본번호 중복/범위초과) | 전부 `400 VALIDATION_ERROR`, 각기 다른 명확한 메시지. service_role 재조회로 **회차 99002가 DB에 전혀 생성되지 않았음** 확인 |
| **위조 시도**(정상 payload에 `match_count`/`win_rank`/`checked_at`/`target_round`/`user_id` 추가) | `201` 성공했지만 저장된 `draws` 행에는 정상 5개 필드만 반영되고 위조 필드는 아무 영향 없음(해당 컬럼 자체가 `draws` 테이블에 없음) |
| 회귀: `POST /api/admin/draws` 비로그인/일반사용자 | `401`/`403` 그대로 유지 |
| 회귀: `/`, `/dream`, `/dream/category/동물`, `/generate`, `/login`, `/my/journal` | 전부 `200` 유지 |
| 회귀: `/robots.txt`/`/sitemap.xml` | 응답·내용 변화 없음(sitemap 35개 URL 그대로) |

검증 종료 후 테스트 계정 2개, `admins`/`user_numbers`/`notifications`/`profiles` 테스트 행, 테스트 회차 3건(99001~99003)을 전부 삭제하고 **잔여 0건**을 응답으로 직접 재확인했다. 임시 검증 라우트도 삭제 완료(`git status`로 흔적 없음).

---

## 7. 중복 회차 실측 결과

§6 Test E 참조 — `409`와 명확한 한국어 메시지("이미 등록된 회차입니다"에 해당하는 "회차 99001는 이미 등록되어 있습니다.")를 그대로 화면에 노출했고, 기존 `draws` 데이터가 덮어써지지 않음을 service_role 재조회로 실측 확인했다.

---

## 8. 잘못된 입력 실측 결과

§6 Test F 참조 — 3가지 대표 오류 케이스 전부 `400`과 함께 DB에 어떤 행도 생성되지 않았음을 확인했다.

---

## 9. notifications/user_numbers/draws 반영 결과

§6 Test D 참조 — `draws` INSERT, `user_numbers`의 `target_round`/`match_count`/`win_rank`/`checked_at` UPDATE, `notifications` INSERT까지 한 번의 등록으로 전부 정상 반영됨을 실제 값으로 확인했다(`lib/api/admin/draws.ts`의 기존 로직이 그대로 작동, 신규 코드 없음).

---

## 10. Validation 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과, 경고 0건 |
| `npm run type-check` | 통과(`.next` 캐시에 삭제된 임시 라우트 타입 참조가 남는 문제를 이번에도 겪어 `.next` 정리 후 재확인 — Phase9-1과 동일한 원인, 코드 문제 아님) |
| `npm test` | 통과 — 13 test files, **188 tests**(기존 168 + 신규 `drawFormValidation.test.ts` 20건: `isDrawFormFilled` 4건 + `validateDrawForm` 16건, 경계값/중복/범위초과/음수 전부 커버) |
| `npm run build` | 통과 — 라우트 **25개**(기존 24 + `/admin/draws` 신규), `/admin/draws`는 `ƒ`(Dynamic, 매 요청 세션 확인 필요 — 당연한 결과) |
| 실제 HTTP 검증 | §6 전체 |
| `/admin` 접근 회귀 | Test A/B/C로 재확인, Phase9-1과 동일하게 동작 |
| `/api/admin/draws` 보안 회귀 | §6에서 재확인, 영향 없음 |
| Phase4~8 주요 페이지 회귀 | §6에서 재확인, 영향 없음 |

`git status`로 이번 Task가 실제로 변경한 파일이 §1에 나열한 것뿐임을 확인했다 — `lib/api/admin/draws.ts`/`app/api/admin/draws/route.ts`/`lib/logic/matchNumbers.ts`/`app/admin/layout.tsx`/`proxy.ts`/migration/RLS는 전부 무수정.

---

## 11. 발견된 문제

새로 발견된 Critical/High 문제는 없다.

- **(기록만, 낮은 우선순위) `/login?next=` 값이 하위 경로를 반영하지 않음**: `/admin/draws`에서 비로그인으로 접근해도 리다이렉트는 `/login?next=%2Fadmin`(항상 `/admin` 고정)이다 — `app/admin/layout.tsx`(Phase9-1 산출물)가 모든 `/admin/*` 하위 경로에 동일한 상수를 쓰기 때문이다. 로그인 후 관리자가 원래 가려던 `/admin/draws`가 아니라 `/admin` 홈으로 가게 되는 사소한 UX 손실이며, 보안 문제는 아니다(로그인 자체는 정상 동작). 이번 Task 범위(`app/admin/layout.tsx` 무수정)를 지키기 위해 고치지 않았다.
- **(기록만) `<title>` template 미적용**: `/admin/draws`의 `<title>`이 "회차 관리"로만 표시되고 다른 모든 페이지가 갖는 "| Luck Platform" 접미사가 붙지 않는다. `app/admin/layout.tsx`가 자신의 metadata에서 `title: "관리자"`(템플릿 객체가 아닌 평문 문자열)를 지정해 그 하위 트리의 title template 상속이 재설정되기 때문으로 보인다(Next.js 메타데이터 트리 병합 동작, Phase8-2가 겪은 `og:site_name` 소실과 유사한 종류의 프레임워크 특성). `/admin/*` 전체가 `noindex`라 **SEO에는 영향이 전혀 없고**, 관리자 브라우저 탭 표기에만 영향을 주는 순수 미관 문제라 이번 Task 범위(`app/admin/layout.tsx` 무수정) 밖으로 남겨둔다.
- **robots.txt에 `/admin` 미포함**: 지시문 §12에 따라 이번 Task에서 SEO 범위를 확장하지 않았다. 현재 상태를 확인만 했다 — `/admin/*`는 각 페이지의 `robots: noindex, nofollow` 메타데이터로 검색 색인은 이미 차단되지만(Phase9-1 §5, 실측 재확인), `app/robots.ts`의 `Disallow` 목록에는 아직 없다. **보안 문제가 아니다**(robots.txt는 크롤 차단일 뿐 접근 차단이 아니라는 Phase8-1의 기존 원칙과 동일) — 크롤 예산 최적화 관점의 별도 작업으로 분리해 기록만 한다.

---

## 12. Phase9-3 착수 가능 여부

**READY.** Critical/High 문제 없음. 회차 등록 화면이 Phase6 백엔드와 완전히 연결되어 실제 Supabase 환경에서 정상/중복/오류/위조 시나리오 전부 실측 검증됐고, 기존 `/admin`·`/api/admin/draws`·Phase4~8 주요 페이지에 회귀가 없다.

---

## 13. Phase9-3에서 가장 먼저 구현할 작업

**꿈해몽 CRUD 화면(`app/admin/dreams/page.tsx` + `lib/api/admin/dreams.ts` 신규 서비스).**

이유: `docs/PHASE9_PRE_IMPLEMENTATION_AUDIT.md`가 이미 확인한 대로 `dreams`/`dream_number_mappings` 테이블과 조회 서비스(`lib/api/dreams.ts`)는 Phase7에서 이미 완성돼 있어 스키마 확정을 기다릴 필요가 없다(FAQ/가이드와 달리 BLOCKER가 없음) — Phase9-2가 확립한 "관리자 폼 → 기존/신규 API Route → `service_role` 서비스 계층" 패턴을 그대로 반복 적용하면 되는 다음으로 재작업 위험이 가장 낮은 항목이다. 구현 시 Phase9-1 §7-1의 발견(레이아웃 게이트만으로는 페이지 자신의 실제 데이터 조회를 보호하지 못할 수 있음)을 반영해, 꿈 목록을 조회하는 페이지 컴포넌트에서도 `isAdmin()`을 한 번 더 확인하는 것을 권장한다 — 이번 회차 입력 화면과 달리 꿈해몽 관리 화면은 실제 콘텐츠 목록을 페이지 컴포넌트 자체에서 조회하게 되므로, 그 위험이 실질적으로 적용되는 첫 사례가 된다.
