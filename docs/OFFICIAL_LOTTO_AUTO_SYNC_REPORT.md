# Phase10-6 — Official Lotto Draw Auto Sync 구현 보고서

## 1. 조사한 동행복권 공식 데이터 구조

`dhlottery.co.kr`의 두 경로를 실제 HTTP 요청으로 직접 조사했다(추측 없음): `common.do?method=getLottoNumber&drwNo={round}`(과거부터 알려진 JSON 엔드포인트)와 `gameResult.do?method=byWin`(공개 결과 HTML 페이지), 모바일 버전(`m.dhlottery.co.kr`)까지 포함해 전부 확인했다.

## 2. Public API 존재 여부

**확인되지 않음(NO)**. 동행복권이 공식적으로 문서화·공지한 Open API는 홈페이지 어디에도 없었다(전수 검색). `common.do`는 오랫동안 그 사이트 자신의 결과 페이지가 내부적으로 쓰는 것으로 알려진 JSON 엔드포인트이지만 공식 API로 발표된 적은 없다.

**더 중요한 발견**: 이 검증 환경(클라우드/데이터센터 IP)에서 `common.do`/`gameResult.do` 두 경로 모두 실제로 `/errorPage`로 리다이렉트됐고, 그 페이지에 다음 문구가 명시돼 있었다(직접 확인, 105KB 페이지 원문 중 관련 부분만 추출):

> "서비스 접속이 차단 되었습니다. 현재 접속하신 아이피에서는 접속이 불가능합니다." (WELLCONN Corp. TRACER 봇 차단 솔루션)

`robots.txt`는 이 경로들을 막지 않는다(`Disallow: /resources/`, `/winImages/`만 명시) — 즉 **정책 위반이 아니라 순수 기술적(IP 기반) 차단**이다. 프록시/IP 스푸핑/세션 위조/CAPTCHA 우회는 전혀 시도하지 않았다(지시문 §3 금지 사항을 그대로 지켰다).

## 3. 선택한 source 방식

Priority 2(공식 웹페이지가 내부적으로 쓰는 구조화된 JSON endpoint)를 채택했다 — `common.do?method=getLottoNumber&drwNo={round}`. 이유: 동행복권 자신의 도메인에서 응답하는 구조화 데이터이고(제3자 API 아님), robots.txt가 명시적으로 막지 않으며, 매주 1회 최소 호출 빈도로도 충분하다.

## 4. source URL 형태

`https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo={round}`

## 5. HTML/JSON 여부

JSON(성공 시). 단, **이번 세션에서는 실제 JSON 응답을 단 한 번도 받지 못했다** — 요청할 때마다 차단 페이지(HTML, `text/html`)가 돌아왔다. 파서는 오랫동안 알려진 필드 구조(`returnValue`/`drwNo`/`drwNoDate`/`drwtNo1~6`/`bnusNo`/`firstWinamnt`/`firstPrzwnerCo`)를 기준으로 작성했지만, **이 구조가 현재도 정확한지는 이 세션에서 검증하지 못했다** — `lib/lotto/sources/dhlottery.ts` 파일 상단 주석에 이 사실을 정직하게 기록해뒀다.

## 6. 안정성 판단

**불안정(현재 접근 불가)**. IP 기반 차단으로 이 환경에서는 요청 자체가 항상 실패한다. Vercel 프로덕션의 실제 실행 IP에서도 같은 차단이 적용될지는 배포 후에만 확인 가능하다 — 이번 Task에서는 확정할 수 없었다.

## 7. Source adapter

`lib/lotto/sources/dhlottery.ts` — `fetchOfficialDraw(round)`(네트워크 fetch, 8초 타임아웃)와 `parseOfficialDrawResponse(raw, expectedRound)`(순수 파싱 함수, 네트워크 없이 단위 테스트 가능하도록 분리)로 나눴다. 반환 타입 `OfficialLottoDraw`는 `{ round, drawDate, numbers, bonusNumber, firstPrizeAmount, firstPrizeCount }`.

## 8. Parsing

모든 필드가 정확한 타입/값이어야 통과한다 — 하나라도 없거나 타입이 다르면 즉시 `OfficialLottoSourceError`. `returnValue: "fail"`(아직 미발표)은 별도 타입 `OfficialLottoRoundNotFoundError`로 구분해, 정상적인 "아직 없음"과 진짜 이상 상황을 구분한다.

## 9. Validation

DB INSERT 전 다음을 전부 강제한다: round가 요청한 값과 일치, 당첨번호 정확히 6개·1~45·중복 없음, 보너스 번호가 당첨번호와 중복 불가(전부 `lib/logic/matchNumbers.ts`의 기존 `assertValidNumberSet`/`assertValidBonusNumber` 재사용 — 새 판정 로직 없음), 1등 당첨금/당첨자 수가 0 이상의 정수, 추첨일이 `YYYY-MM-DD` 형식이면서 로또 1회차(2002-12-07) 이후이고 **토요일**이어야 함(지시문 §6 "Lotto 일정과 모순되는 비정상 데이터도 거부").

## 10. Fail-closed

실제로 이 세션에서 여러 번 검증됐다 — 단위 테스트(네트워크 오류/타임아웃/404/500/빈 응답/malformed JSON/차단 페이지 HTML fixture)뿐 아니라, **실제 프로덕션 환경에서 CRON_SECRET로 인증된 실제 cron 엔드포인트 호출**과 **실제 운영자가 관리자 화면에서 직접 누른 "지금 동기화" 버튼** 둘 다 실제 차단된 dhlottery.co.kr을 상대로 정확히 fail-closed로 종료됐고, 그 전후로 `draws` 테이블이 10건(1227~1236)에서 단 1행도 변하지 않았음을 직접 재확인했다.

## 11. Latest round detection

DB `draws.round`의 MAX값을 조회해 `latest+1`부터 시도한다. `CURRENT_ROUND` 같은 하드코딩은 전혀 없다.

## 12. Missing round recovery

`latest+1, latest+2, ...` 순서로 최대 `MAX_BACKFILL_ROUNDS = 10`회까지 시도한다. 중간에 공식 source 실패/파싱 이상이 발생하면 그 즉시 중단하고 더 진행하지 않는다(지시문 §36).

## 13. Existing draw conflict

같은 round가 이미 DB에 있는데 값이 다르면(`DRAW_CONFLICT`) 절대 덮어쓰지 않고 즉시 중단, `conflictRound`를 응답에 담아 운영자가 확인할 수 있게 한다. 단위 테스트로 검증했다(TOCTOU 경쟁 상황을 재현하는 mock으로).

## 14. Phase6 integration

`lib/api/admin/draws.ts`의 `registerDrawAndMatchUserNumbers()`(Phase6-3)를 그대로 재사용했다 — 유일한 변경은 기존 시그니처에 **선택적** 두 번째 인자 `options?: { source?: string }`를 추가한 것뿐이다. 넘기지 않으면 기존 동작(관리자 수동 등록, DB 기본값 `'manual'`)과 100% 동일하다 — 기존 호출부(`app/api/admin/draws/route.ts`)와 기존 테스트는 한 줄도 바꾸지 않았다. `draws.source` 컬럼은 `0002_draws_user_numbers.sql`에 **이미 존재**했다(원래 주석이 "Phase8 자동수집 도입 시 그 경로에서 다른 값을 명시한다"고 예정해둔 그대로) — 새 컬럼도 새 migration도 필요 없었다.

## 15. Matching

새 matching 파이프라인을 전혀 만들지 않았다 — `registerDrawAndMatchUserNumbers()` 내부의 기존 대조 루프(`user_numbers` 중 미확인 건을 `matchNumbers()`로 판정)를 그대로 상속한다.

## 16. Notifications

역시 기존 `createWinNotification()` 호출 경로를 그대로 상속한다 — 자동 동기화가 새로 만든 알림 로직은 없다.

## 17. Idempotency

같은 round를 2번 동기화해도(이미 동일 값으로 DB에 존재) 재등록/재알림이 발생하지 않는다 — 단위 테스트로 검증했고, 동시 실행 경쟁(다른 프로세스가 먼저 등록) 상황도 `DuplicateRoundError`를 idempotent skip으로 처리해 안전하다.

## 18. Cron

Vercel Cron(`vercel.json`)을 사용한다 — 별도 Edge Function/외부 Cron 서비스를 도입하지 않았다. 이 프로젝트의 이전 `docs/PHASE8_PRE_IMPLEMENTATION_AUDIT.md`가 "당시 시점"에는 Cron 자동화를 명시적으로 유보(ROADMAP Phase5 이후로)하고 "온디맨드 조회 보조"만 채택했었는데, 이번 지시문(§14)이 "현재 deployment가 Vercel이므로 공식 Vercel Cron을 우선 사용한다"고 명시적으로 최신 지시를 내려 그 유보를 대체했다 — 프로젝트가 그 사이 실제 운영자 계정/관리자 등록까지 마친 지금 시점이 그 유보의 전제(MVP 미완료)를 벗어났다고 판단했다. 같은 감사 문서가 이미 실측 확인해둔 "Hobby 플랜: cron 최대 2개, 1일 1회 빈도 제한"도 재확인했다 — 주 1회 스케줄은 이 제한 안에 안전하게 들어간다.

## 19. KST 실행시간

**매주 토요일 21:30(KST)**. 실제 로또 추첨 방송(20:35 KST 시작)과 충분한 간격(약 55분)을 둬 공식 사이트 게시 지연을 흡수한다(지시문 §40 "너무 정확히 20:35에 호출하지 않는다").

## 20. UTC Cron 표현

`30 12 * * 6` — Vercel Cron은 표준 POSIX cron 문법을 **UTC 기준**으로 해석한다(Vercel 공식 플랫폼 문서 기준, KST는 UTC+9이며 서머타임이 없어 연중 고정 오프셋). `21:30 KST = 12:30 UTC`, 요일 필드 `6`은 표준 cron 관례상 토요일이다. 이 UTC 해석 자체는 Vercel 플랫폼의 안정적인 문서화된 동작이라 dhlottery 쪽과 달리 실측 확인 없이도 신뢰할 수 있는 부분이다.

## 21. CRON_SECRET

`.env.example`에 이름만 추가했다(`CRON_SECRET=`, 값 없음, 커밋 대상). 실제 값은 로컬 `.env.local`(git-ignored)에만 임의 생성해 넣어 검증에 썼고, 이 보고서/코드/문서 어디에도 실제 값을 적지 않았다. Vercel의 공식 관례(`Authorization: Bearer <CRON_SECRET>`)를 그대로 따랐고, 시크릿이 아예 설정되지 않은 경우까지 포함해 fail-closed(401)로 처리한다 — 실제 HTTP로 시크릿 없음/틀림/올바름 3가지 전부 검증했다(§37 참조).

## 22. Admin manual sync

`/admin/draws`에 "공식 당첨번호 동기화" 버튼(`components/admin/LottoSyncButton.tsx`)을 추가했다. `POST /api/admin/draws/sync`를 호출하며, Cron(`GET /api/cron/sync-lotto`)과 **정확히 같은** `syncOfficialLottoDraws()`를 호출한다 — 서로 다른 로직이 없다. 실제 운영자가 실제 브라우저 세션으로 이 버튼을 직접 눌러 정상 동작(fail-closed 메시지 노출, DB 무변경)을 확인했다.

## 23. Manual registration fallback

기존 `DrawRegistrationForm`(관리자 수동 회차 입력)은 전혀 제거하지 않았다 — `/admin/draws` 화면에 "자동 동기화 버튼 → 수동 등록 폼" 순서로 나란히 유지된다. 공식 사이트 장애/구조 변경 시 최종 fallback으로 계속 쓸 수 있다.

## 24. Network failure

타임아웃, HTTP 4xx/5xx, 빈 응답, malformed JSON, "JSON이 아닌 응답"(차단/점검 페이지 포함) 전부 `lib/lotto/sources/dhlottery.test.ts`에서 단위 테스트로 검증했다 — 전부 DB mutation 0건으로 이어짐을 `lib/api/admin/lottoSync.test.ts`에서 함께 검증했다. 특히 "차단 페이지" 케이스는 이 세션에서 실제로 받은 것과 같은 종류의 응답(HTML, `text/html`)을 fixture로 썼다.

## 25. Official recent-round comparison

**수행하지 못함(NO)** — §2에서 설명한 IP 차단 때문에 이 세션에서는 공식 source로부터 단 하나의 실제 라운드 데이터도 받아오지 못했다. 따라서 지시문 §31이 요구한 "DB에 이미 있는 최근 공식 회차 2~3개와 비교"를 실행할 수 없었다 — 이는 이번 Task의 가장 중요한 미검증 항목이며, 최종 판정(§32)에 직접 반영했다.

## 26. Existing production data safety

작업 시작 전/도중/완료 후 세 시점 모두 실제 remote Supabase에서 `draws` 테이블을 직접 조회해 **10건, round 1227~1236**이 단 한 번도 바뀌지 않았음을 확인했다.

**발견된 사고와 즉시 복구(정직하게 기록)**: 실제 DB integration test 도중, 격리된 테스트 회차(round 899999)로 `registerDrawAndMatchUserNumbers()`를 직접 호출해 검증하려 했는데, 이 함수는 **테스트 사용자만이 아니라 `target_round IS NULL`인 모든 실사용자의 `user_numbers`를 일괄 대조**하도록 설계돼 있다(Phase6 원래 설계, 정상 동작) — 그 결과 실제 운영자 계정의 미확인 저장번호 21건이 순간적으로 가짜 회차(899999)와 대조되어 `match_count`/`checked_at`이 채워졌다. **발견 즉시**(응답 확인 직후) 영향받은 21개 행을 정확히 원래 상태(`target_round`/`match_count`/`win_rank`/`checked_at` 전부 `null`)로 되돌렸고, 테스트로 생성된 알림 1건·테스트 회차·테스트 계정도 전부 삭제해 사고 이전 상태로 완전히 복구했다(각 단계를 실제 쿼리로 재확인). 이후로는 프로덕션 대상 `registerDrawAndMatchUserNumbers()` 실제 호출 테스트를 중단하고, 이미 충분히 검증된 기존 Phase6 mocked 테스트(28건, 로직 무수정)로 대체했다. 이 사고를 통해 배운 것: **실제 pending user_numbers가 존재하는 프로덕션 DB를 상대로 매칭 함수를 실행하는 검증은 원천적으로 피해야 한다**(격리된 테스트 회차를 써도 매칭 대상 자체가 격리되지 않으므로).

## 27. tests/build

- 신규 단위 테스트: `lib/lotto/sources/dhlottery.test.ts`(27개, 파싱+네트워크 실패 케이스), `lib/api/admin/lottoSync.test.ts`(9개, latest 판단/idempotent/conflict/backfill/source 실패), `lib/api/admin/draws.test.ts`에 `source` 옵션 전달 테스트 2개 추가. 합계 38개.
- 전체 테스트: **501 passed**(기존 463 + 신규 38).
- `next lint`: 통과.
- `tsc --noEmit`: 통과.
- `next build`: 성공, 라우트 2개 추가(`/api/cron/sync-lotto`, `/api/admin/draws/sync`) — 총 53개(기존 51 + 2).
- **실제 HTTP 검증**: cron 엔드포인트 — 시크릿 없음(401)/틀림(401)/올바름(200, 실제 차단 소스 대상 fail-closed 확인) 전부 실측. Admin sync 엔드포인트 — 비로그인(401) 실측 + 실제 운영자 브라우저 세션으로 버튼 클릭 성공(fail-closed 메시지, DB 무변경) 실측.

## 28. Migration 여부

**0개**. `draws.source` 컬럼이 `0002_draws_user_numbers.sql`에 이미 존재해(지시문 §27이 원했던 대로) 새 컬럼/새 migration이 전혀 필요하지 않았다. `draw_sync_logs` 같은 별도 로그 테이블도 만들지 않았다(지시문 §26 "Vercel/server logs로 충분하면 migration을 추가하지 않는다") — `console.error`로 서버 로그에 실패 사유가 남는다.

## 29. Vercel 설정 필요사항

`vercel.json`(신규)에 `crons: [{ path: "/api/cron/sync-lotto", schedule: "30 12 * * 6" }]`를 추가했다. **운영자가 Vercel 프로젝트 설정(Environment Variables)에 직접 등록해야 하는 값은 `CRON_SECRET` 하나뿐**이다 — 이 세션에서 실제 값을 생성하거나 노출하지 않았다.

## 30. 운영 절차

**정상 상황**: 아무것도 하지 않아도 매주 토요일 21:30(KST)에 자동 동기화된다. **자동 실패 시**: `/admin/draws`에서 "공식 당첨번호 동기화" 버튼을 눌러 즉시 재시도하고 결과 메시지를 확인한다. **공식 source 구조가 바뀐 경우**: 동기화가 매번 실패 메시지만 반환하고 DB는 그대로 유지된다 — 기존 수동 등록 폼으로 공식 사이트에서 직접 확인한 값을 입력하면 된다(fallback 2단계 그대로 작동).

## 31. 발견된 리스크

1. **가장 중요**: 이 세션에서 실제 공식 데이터를 단 한 번도 받아오지 못해, 파서의 필드 구조가 지금도 정확한지 검증되지 않았다.
2. IP 차단이 이 검증 환경에만 해당하는지, Vercel 프로덕션 실행 환경(역시 클라우드 IP)에도 적용되는지 알 수 없다.
3. §26에 기록한 실제 사고(테스트로 인한 실사용자 데이터 순간 오염) — 즉시 복구했지만, 향후 유사 검증 시 반드시 격리된 개발 DB를 쓰거나 이 함수를 프로덕션에 대해 직접 호출하지 않아야 한다는 절차적 교훈을 남긴다.

## 32. 남은 Launch Blockers

1. **공식 source 실 접근 미검증** — Vercel 배포 후 실제로 `common.do`가 응답하는지, 응답 필드 구조가 파서 가정과 일치하는지 반드시 재확인해야 한다(§25/§31-1/2).
2. 위 확인 전까지는 `vercel.json`의 cron이 배포돼도 항상 fail-closed로 아무 것도 하지 않을 뿐이므로 안전하지만, "자동 동기화가 실제로 동작한다"고 간주해서는 안 된다.

## 33. 다음 작업 추천

**Vercel 배포 후 실제 프로덕션 IP에서 `/admin/draws`의 "지금 동기화" 버튼으로 공식 데이터 접근이 실제로 되는지부터 확인**한다 — 이것이 확인돼야 §32의 유일한 launch blocker가 해소되고 자동 Cron을 신뢰할 수 있다. 만약 프로덕션에서도 차단된다면, 동행복권 측에 정식 데이터 이용 문의를 하거나 공식 공공데이터 경로를 조사하는 후속 결정이 필요하다.

---

## TASK REPORT — Official Lotto Auto Sync

- **Official Source**: 동행복권(dhlottery.co.kr) `common.do?method=getLottoNumber`
- **Official Domain**: dhlottery.co.kr
- **Official Public API Confirmed**: **NO**(공식 문서화된 API 아님, 이 세션에서는 접근 자체가 IP 차단됨)
- **Source Type**: JSON(성공 시 — 이번 세션에는 실제로 한 번도 받지 못함)
- **Third-party Primary Source**: 사용 안 함
- **Latest Round Detection**: DB MAX(round)+1부터 자동 판단(하드코딩 없음)
- **Missing Round Recovery**: 지원(최대 10회차 backfill, 중간 실패 시 즉시 중단)
- **Strict Validation**: 지원(round/6개/1~45/중복/보너스/당첨금/당첨자수/추첨일+요일 전부)
- **Fail Closed**: PASS(단위 테스트 + 실제 차단된 소스 대상 실측 2회로 확인)
- **Existing Draw Conflict**: DRAW_CONFLICT로 감지, 자동 덮어쓰기 없음(테스트 확인)
- **Automatic Overwrite**: 없음
- **Phase6 Registration Reused**: PASS(registerDrawAndMatchUserNumbers 무수정 로직 + 선택적 source 인자만 추가)
- **Matching Automatic**: PASS(기존 로직 그대로 상속)
- **Notifications Automatic**: PASS(기존 로직 그대로 상속)
- **Idempotent**: PASS(테스트 확인)
- **Cron Platform**: Vercel Cron
- **Cron Schedule KST**: 매주 토요일 21:30
- **Cron Schedule UTC**: 매주 토요일 12:30(`30 12 * * 6`)
- **CRON_SECRET**: 보호 구현 완료(401 없음/틀림/올바름 실측), 값은 미생성/미노출
- **Admin Manual Sync**: PASS(실제 운영자 클릭으로 확인)
- **Manual Entry Fallback**: 유지(무수정)
- **Current Official Data Comparison**: **수행 불가**(IP 차단으로 이 세션에서 실제 공식 데이터를 한 번도 받지 못함)
- **Existing Production Draws Preserved**: PASS(10건, 1227~1236, 작업 전후 불변 — 단, §26 기록된 사고 발생·즉시 복구 이력 있음)
- **Migration**: 0개
- **Tests**: 501 passed(기존 463 + 신규 38)
- **Build**: 성공(라우트 51 → 53)
- **Auto Sync**: **CONDITIONAL**
- **Remaining Launch Blockers**: 공식 source 실 접근이 이 세션에서 검증되지 않음 — Vercel 배포 후 재확인 필수
- **다음 작업**: Vercel 배포 후 프로덕션 IP에서 공식 데이터 접근 여부 실제 확인
