# Phase10-6B — Lotto Multi-Source Fallback + Source Health Verification 보고서

## 1. Phase10-6 conditional 원인

이 검증 환경(클라우드/데이터센터 IP)에서 동행복권(dhlottery.co.kr)의 `common.do`/`gameResult.do`가 TRACER(WELLCONN Corp.) 봇 차단 솔루션에 의해 IP 기반으로 차단되어, 실제 공식 데이터를 단 한 번도 받아오지 못했다 — 그래서 Phase10-6은 파이프라인은 완성했지만 "실제 Production 자동화 가능 여부"를 확정하지 못해 CONDITIONAL로 남았다.

## 2. Official source 현 상태

이번 Task에서도 동일하게 재확인했다 — `common.do?method=getLottoNumber&drwNo=1237`에 실제 요청을 보내면 `Content-Type: text/html`의 차단 페이지가 돌아온다. 우회(프록시/IP 스푸핑/세션 위조)는 시도하지 않았다. 기존 official adapter(`lib/lotto/sources/dhlottery.ts`)는 **삭제·변경 없이 그대로 Primary로 유지**했다 — 이번 Task는 여기에 새 `OfficialLottoParseFailureError` 서브타입만 **추가**했다(아래 §18 참조, 기존 검증 로직은 한 글자도 바꾸지 않았다).

## 3. Official access failure type

Content-Type이 `application/json`이 아닌 응답(차단/점검 페이지) → 네트워크/접근-class 실패로 분류된다. 이 분류는 기존 `OfficialLottoSourceError`(base) 그대로다 — secondary fallback을 고려할 근거가 되는 유일한 실패 종류다(§18의 정책과 직결).

## 4. 공공데이터포털 조사

`data.go.kr`을 실제로 검색했다 — 발견된 로또 관련 데이터셋은 전부 "1등 당첨 판매점 현황", "판매점 주소", "복권 발행 및 판매 현황", "복권 상품별 수익 구조"뿐이었다. **실제 당첨번호(회차별 6개 번호+보너스) 데이터셋은 존재하지 않는다** — `No suitable weekly winning-number dataset found`. 짐작이 아니라 포털 검색 결과를 직접 확인한 결론이다.

## 5. MBC 조사

MBC 공식 로또 프로그램 페이지(`program.imbc.com/lotto`)를 확인했다 — 방송 소개, VOD, 출연진 정보만 있고 당첨번호를 machine-readable(JSON/XML/API)로 제공하는 기능은 없다. 지시문 §33 정책대로 억지로 자동 source 후보로 쓰지 않았다.

## 6. Secondary 후보 목록

실제 웹 검색 + 실제 HTTP 요청으로 조사했다. 로또리(lottori.co.kr)·로티스(lottis.kr)·데이터로또(datalotto.kr)·redinfo.co.kr 등 여러 후보가 있었으나, 이 환경에서 실제 접근 가능하고(200 OK) 구조화된 데이터를 안정적으로 제공하는 두 곳(lottis.kr, datalotto.kr)만 최종 채택했다.

## 7. 선택된 Source A

**로티스(lottis.kr)**. `/lotto/{round}` 회차별 페이지에 schema.org "Dataset" JSON-LD가 임베드돼 있다 — `variableMeasured` 배열에 당첨번호/보너스번호/1등 당첨금/1등 당첨자 수가 구조화된 값으로 들어있다(취약한 CSS selector가 아니라 semantic 구조화 데이터, 지시문 §24 원칙 충족).

## 8. 선택된 Source B

**데이터로또(datalotto.kr)**. `/results` 페이지 하나에 1회차부터 최신 회차까지 전체 데이터가 Next.js RSC 하이드레이션 페이로드 안에 `{"round":N,"date":"...","numbers":[...],"bonus":N}` 형태로 임베드돼 있다. 1등 당첨금/당첨자 수는 이 페이지에 없다(확인됨) — 그래서 상금 정보는 로티스 쪽에서만 보강한다(§14).

## 9. 각 source 공식/비공식 여부

**둘 다 비공식(secondary corroborating source)**. 특히 로티스는 JSON-LD 안에 `"creator":{"name":"동행복권"}`, `"license":"https://www.dhlottery.co.kr/common.do?method=main"`를 **스스로 명시**해, 원본 출처가 동행복권임을 밝히고 있다 — 지시문 §5의 "동행복권을 원 데이터로 쓰면 독립 Primary Source라고 주장하지 않는다"는 원칙 그대로, 이 두 곳을 "secondary corroborating sources"로만 표현한다. 새로운 진실 공급원이 아니라 "동행복권 데이터가 맞는지 다른 경로로 재확인하는 수단"이다.

## 10. license/disclaimer

로티스의 `/disclaimer` 페이지를 실제로 확인했다 — "당첨번호 정보의 정확성, 완전성, 신뢰성"을 보장하지 않는다고 명시돼 있다. **이것이 정확히 왜 2-source consensus가 필요한지의 근거다** — 단일 secondary도 스스로 정확성을 보장하지 않으므로, 반드시 서로 다른 두 곳이 100% 일치할 때만 신뢰한다.

## 11. latest round

두 곳 모두 이 세션 조사 시점 기준 최신 1236회(2026-08-08)까지 보유하고 있었다 — 실제 DB의 최신 회차와 정확히 일치해 freshness가 확인됐다.

## 12. historical accuracy

DB에 이미 검증된 10개 회차(1227~1236) 전부를 실제 파서로 조회해 비교했다 — **lottis.kr 10/10 PASS, datalotto.kr 10/10 PASS**(round/numbers/bonus 전부 exact match). 상세 표는 §36 참조.

## 13. update freshness

두 곳 모두 최신 회차가 DB와 일치해 "몇 주씩 뒤처진 source"는 아니었다. 다만 **추첨 당일 정확히 몇 시에 업데이트되는지는 확인할 방법이 없어 `UNKNOWN`으로 기록한다**(지시문 §13) — 실제로 이번 Task 검증 시점(회차 발표 전)에 두 곳 다 "아직 발표 안 됨"으로 정확히 응답한 것은 확인했지만, "발표 후 몇 분 내 반영되는지"는 실측하지 못했다.

## 14. normalized adapter

`lib/lotto/sources/types.ts`의 `DrawSourceResult`(`round`/`drawDate`/`numbers`/`bonusNumber`/`source`, 지시문 §17 예시 그대로) — 1등 당첨금/당첨자 수는 여기 포함하지 않는다(당첨 판정에 쓰이지 않는 표시 전용 데이터라는 기존 `lib/types/winning.ts` 원칙과 일치, consensus 비교 대상에서 의도적으로 제외). `lib/lotto/sources/lottis.ts`/`datalotto.ts` 각각이 raw HTML → 이 정규화 타입으로 변환하고, 그 뒤 `lib/logic/matchNumbers.ts`의 기존 `assertValidNumberSet`/`assertValidBonusNumber`로 공통 검증한다(새 검증 로직 없음).

## 15. consensus algorithm

`lib/lotto/sources/index.ts`(source broker)의 `getTrustedDrawResult(round)`: round/drawDate/numbers/bonusNumber **전부 exact match**해야 consensus로 인정한다(지시문 §7). 하나라도 다르면 `source-disagreement`, 한 곳만 성공하면 `single-secondary-success`, 둘 다 실패하면 `all-sources-unavailable` — 셋 다 DB mutation 없이 종료한다.

## 16. official priority

공식 소스가 성공하면 secondary를 **아예 조회조차 하지 않는다**(지시문 §2 "Secondary source 때문에 official result를 거부하지 않는다"). 공식 소스가 "아직 미발표"(정상 상태)여도 secondary로 넘어가지 않는다 — 그건 실패가 아니기 때문이다.

## 17. fallback policy

공식 소스가 **네트워크/접근 실패**일 때만 secondary 두 곳을 병렬 조회한다. `LOTTO_SECONDARY_FALLBACK_ENABLED`가 정확히 문자열 `"true"`일 때만 실제 등록에 쓰고, 아니면(기본값) consensus가 성립해도 `fallback-disabled` 상태로 보고만 하고 DB는 건드리지 않는다(지시문 §29/§30). 실측 결과, 이 환경에서는 official이 항상 network-class로 실패하므로 이 분기가 실제로 여러 번 실행됐다(§26 참조).

## 18. official parse failure 정책

공식 소스가 응답은 했는데 파싱/검증에 실패하면(`OfficialLottoParseFailureError`, 이번 Task에서 `lib/lotto/sources/dhlottery.ts`에 **추가**한 서브타입) secondary로 넘어가지 않는다 — official adapter 자체가 깨졌을 가능성을 먼저 의심해야 하므로 가장 보수적으로 처리한다(지시문 §39). 기존 `parseOfficialDrawResponse()`의 검증 로직 자체는 전혀 바꾸지 않았고, 던지는 에러 타입만 `OfficialLottoParseFailureError`로 더 세분화했다 — 기존 27개 dhlottery 테스트가 전부(수정 없이) 그대로 통과함을 확인했다(서브클래스가 `instanceof` 상위 클래스 체크를 그대로 만족하므로).

## 19. source disagreement

`source-disagreement` 상태는 DB에 아무 영향을 주지 않고 종료한다. 관리자 UI(`LottoSyncButton`)는 이 경우 broker가 만든 한국어 메시지("보조 출처 간 결과가 일치하지 않습니다...")를 그대로 보여준다 — 지시문 §20의 예시 문구와 같은 취지다.

## 20. fail-closed

Fail-closed는 이번 Task에서도 실제 라이브 환경으로 재확인했다(§26) — 뿐만 아니라 **실증 검증 중 실제로 발견한 문제를 통해 fail-closed의 의미 자체를 더 정확하게 다듬었다**: 처음에는 "두 secondary가 모두 실패"와 "두 secondary가 모두 아직 미발표라고 답함"을 같은 상태로 묶었는데, 실제 운영자 브라우저 테스트에서 이게 "공식 소스가 정상"이라는 잘못된 인상을 주는 라벨로 이어지는 것을 발견해 `secondary-round-not-found`라는 별도 상태로 분리했다(§21/§26에서 상세 기록).

## 21. source health check

`lib/api/admin/lottoSourceHealth.ts`의 `checkLottoSourceHealth()` — DB에서 최신 회차만 읽고(`SELECT`, 쓰기 없음), `getTrustedDrawResult(latest+1)`을 호출해 그 결과를 그대로 반환한다. **이 파일은 `lib/api/admin/draws`(registerDrawAndMatchUserNumbers가 있는 모듈)를 아예 import하지 않는다** — 실수로 쓰기 경로가 생기는 것을 코드 구조로 원천 차단했고, 이 사실 자체를 테스트로 고정했다(정적 검증, §29).

## 22. admin UI

`/admin/draws`에 `LottoSourceHealthButton`(출처 상태 확인) 컴포넌트를 추가했다 — 복잡한 대시보드가 아니라 "회차 — 상태 라벨" + 메시지 한 줄만 보여준다(지시문 §21). **실제 운영자가 두 번 클릭해 검증했다** — 최초 버전은 "공식 소스 정상(아직 새 회차 없음)"이라는 부정확한 라벨을 보여줬는데(실제로는 공식 소스가 차단된 상태였다), 운영자의 실측 피드백으로 이 문제를 발견해 즉시 수정했고, 재클릭으로 정확한 라벨("공식 소스 접근 불가 — 보조 출처로 확인 결과 아직 새 회차 없음")을 확인받았다(§26 상세 기록).

## 23. feature flag

`LOTTO_SECONDARY_FALLBACK_ENABLED`를 `.env.example`에 이름만 추가했다(값 없음, 커밋 대상). `process.env.LOTTO_SECONDARY_FALLBACK_ENABLED === "true"`일 때만 켜지는 fail-closed 기본값이다 — 이 세션에서는 로컬 `.env.local`에도 값을 설정하지 않았다(기본값 꺼짐 상태 그대로 유지, 지시문 §29 권장사항 그대로).

## 24. production Vercel check 방법

이번 Task에서 실제 Vercel 배포는 하지 않았다(`PENDING_PRODUCTION_NETWORK_CHECK` 그대로 유지) — 대신 배포 후 운영자가 확인할 수 있는 정확한 절차를 마련했다: `/admin/draws`의 "출처 상태 확인" 버튼을 누르면 **그 요청이 실제로 실행되는 서버(로컬이면 로컬 IP, Vercel 배포 후면 Vercel의 실제 런타임 IP)** 기준으로 공식/보조 출처 접근 가능 여부를 알려준다 — "Claude 환경에서 막힘"과 "Vercel에서도 막힘"을 구분할 수 있는 도구가 이미 준비돼 있다.

## 25. matching integration

`registerDrawAndMatchUserNumbers()`(Phase6-3)는 이번 Task에서도 **로직을 전혀 수정하지 않았다** — 유일한 변경은 Phase10-6에서 이미 추가된 선택적 `options.source` 인자를 그대로 재사용해, provenance(`{mode: "official"}` → `"dhlottery.co.kr"`, `{mode: "secondary-consensus", sources}` → `"lottis.kr+datalotto.kr"`)를 `draws.source` 컬럼에 기록하는 것뿐이다. 새 matching pipeline은 만들지 않았다.

## 26. idempotency

Official로 등록된 회차를 나중에 secondary consensus로 다시 확인해도(또는 그 반대), 값이 같으면 idempotent skip, 다르면 DRAW_CONFLICT로 처리한다 — 출처 종류와 무관하게 동일한 정책이다(단위 테스트로 검증, §37).

**실제 라이브 검증(가장 중요한 실증 기록)**: 이 환경에서 진짜 dhlottery.co.kr(차단됨), lottis.kr, datalotto.kr 세 곳 모두를 상대로 실제 cron 엔드포인트(`GET /api/cron/sync-lotto`, 실제 `CRON_SECRET` 인증)를 두 번 호출했다 — 매번 공식 소스는 네트워크 차단으로 실패, 두 secondary 모두 살아있고 정상 파싱됐지만(실제 200 응답, 실제 페이지), 1237회가 아직 두 곳 어디에도 발표되지 않아 최종 상태는 `up-to-date`(DB mutation 0)로 정확히 종료됐다. 이 과정에서 secondary 두 곳의 실제 프로덕션 접근성과 파서 정확성이 이 세션에서 다시 한번 실측으로 재확인됐다.

## 27. DB safety

작업 시작 전/도중/완료 후 세 시점 모두 실제 remote Supabase에서 `draws`(10건, 1227~1236)와 실제 운영자의 `user_numbers`(21건, 전부 `target_round`/`match_count`/`win_rank`/`checked_at` null)를 직접 조회해 **완전히 동일함을 diff로 확인**했다(§49 요구사항 그대로 — 모든 필드가 byte-identical).

## 28. test contamination 방지

이번 Task에서는 Phase10-6에서 있었던 사고(테스트 회차 등록이 실제 운영자 저장번호 21건을 순간적으로 오염시켰던 사고)를 **의도적으로 반복하지 않았다** — `registerDrawAndMatchUserNumbers()`를 프로덕션 DB에 대해 단 한 번도 직접 호출하지 않았다. 대신: (1) 파서 정확성은 mock된 유닛 테스트 + 실제로 캡처한 프로덕션 fixture로, (2) 라이브 접근성은 오직 **읽기 전용**(cron 상태 확인, source-health 조회)으로만, (3) 실제 매칭 로직은 기존 Phase6 mocked 테스트(28개, 무수정)에 위임해 검증했다.

## 29. tests/build

- 신규 단위 테스트: `lib/lotto/sources/types.ts` 관련 클래스 재사용, `lottis.test.ts`(17개), `datalotto.test.ts`(9개), `index.test.ts`(11개, consensus/disagreement/fail-closed), `lottoSourceHealth.test.ts`(4개, mutation-zero 정적 검증 포함), `lottoSync.test.ts`(broker 연동으로 전면 재작성, 12개), `draws.test.ts` source 옵션 테스트 2개(Phase10-6에서 이미 추가). 합계 43개 추가.
- 전체 테스트: **543 passed**(기존 501 + 신규 42, 순증가는 위 항목 합산과 lottoSync.test.ts 순증분 기준).
- `tsc --noEmit`: 통과.
- `next lint`: 통과.
- `next build`: 성공, 라우트 1개 추가(`/api/admin/draws/source-health`) — 총 54개(기존 53 + 1).
- **실제 HTTP 검증**: cron 엔드포인트를 실제 `CRON_SECRET`으로 2회 호출(수정 전/후), 실제 운영자 브라우저 세션으로 "출처 상태 확인"·"지금 동기화" 버튼을 각각 2회 클릭해 확인.

## 30. Production에서 해야 할 설정

`.env.example`에 이미 이름이 추가된 `LOTTO_SECONDARY_FALLBACK_ENABLED`를 Vercel 프로젝트 환경변수에 등록할지는 **운영자의 선택**이다 — 등록하지 않거나 `"true"` 외의 값을 주면 fail-closed 기본값(꺼짐)이 유지된다. 새로 필요한 API 키나 유료 가입은 없다(lottis.kr/datalotto.kr 둘 다 인증 불필요, 무료).

## 31. 남은 리스크

1. **Vercel 실제 런타임에서 공식 소스 접근 가능 여부 미확인** — Phase10-6과 동일한 미해결 항목.
2. **secondary 두 곳의 추첨 당일 업데이트 속도 UNKNOWN** — 다음 실제 토요일 추첨 후 관찰이 필요하다.
3. secondary 두 곳 모두 궁극적으로 동행복권 데이터에 의존하므로, 동행복권 자체에 심각한 오류가 있었던 극히 드문 경우 두 secondary가 "일치하는 잘못된 값"을 함께 보여줄 이론적 가능성은 배제할 수 없다(그러나 이는 secondary corroborating source 구조 자체의 근본적 한계이며, `LOTTO_SECONDARY_FALLBACK_ENABLED`가 기본적으로 꺼져 있어 지금 당장의 실제 위험은 없다).

## 32. Launch blocker 여부

**없음** — Cron이 배포돼도 fail-closed 설계 덕분에 (a) 공식 소스가 막혀 있으면 아무 일도 일어나지 않고, (b) `LOTTO_SECONDARY_FALLBACK_ENABLED`가 기본적으로 꺼져 있어 secondary consensus가 성립해도 자동 등록되지 않는다. 가장 나쁜 경우도 "자동 업데이트가 늦어짐"일 뿐 "잘못된 데이터가 등록됨"은 구조적으로 발생하지 않는다.

## 33. 다음 작업 추천

**다음 실제 로또 추첨(매주 토요일) 직후, 운영자가 "출처 상태 확인" 버튼으로 세 출처(공식+보조 2곳)가 실제로 언제 업데이트되는지 관찰**한다 — §13/§31-2에서 `UNKNOWN`으로 남긴 update freshness를 실제 데이터로 채우고, Vercel 배포가 이뤄졌다면 그 시점에 공식 소스 접근 가능 여부까지 함께 확인할 수 있는 가장 자연스러운 기회다.

---

## TASK REPORT — Lotto Multi-Source Fallback

- **Official Source Retained**: PASS(무수정 유지, Primary 그대로)
- **Official Current Environment**: 차단됨(이 세션 기준, TRACER 봇 차단)
- **Public Government API Found**: NO(data.go.kr 실제 검색 확인 — 판매점 데이터뿐)
- **MBC Structured Winning Numbers Found**: NO(VOD/방송 정보만, 실제 페이지 확인)
- **Secondary Source A**: lottis.kr(로티스)
- **Secondary Source B**: datalotto.kr(데이터로또)
- **Different Operators**: 추정됨(다른 도메인/브랜딩, 둘 다 원본은 동행복권으로 스스로 명시 — "secondary corroborating sources"로만 표현)
- **Recent 10 Rounds Source A**: 10/10 PASS(실측)
- **Recent 10 Rounds Source B**: 10/10 PASS(실측)
- **A/B Consensus**: 구현 및 실제 라이브 테스트 완료(cron 2회 실호출)
- **Single Secondary Auto-write**: 금지(코드/테스트로 강제)
- **Official Network Failure Fallback**: 허용(플래그 켜짐 시에만 실제 등록)
- **Official Parse Failure Fallback**: 금지(보수적 정책, §18/§39)
- **Source Disagreement**: DB mutation 0으로 처리(테스트 확인)
- **Dry Run**: PASS(source-health가 registerDrawAndMatchUserNumbers를 아예 import하지 않음, 정적 검증 테스트 포함)
- **Production Mutation During Test**: 없음(0건, 실제 registerDrawAndMatchUserNumbers를 프로덕션에 호출하지 않았다)
- **Operator Data Changed**: 없음(draws/user_numbers 전부 작업 전후 byte-identical, diff로 확인)
- **Feature Flag**: `LOTTO_SECONDARY_FALLBACK_ENABLED`(기본 꺼짐, `.env.example`에 이름만 추가)
- **Vercel Official Check**: PENDING_PRODUCTION_NETWORK_CHECK
- **Migration**: 0개
- **Tests**: 543 passed(기존 501 + 신규 42)
- **Build**: 성공(라우트 53 → 54)
- **Fallback Architecture**: **PASS**
- **Auto-write Safe**: YES(fail-closed 설계 + 기본 꺼짐 플래그로 구조적으로 안전 — Vercel 실제 접근성만 아직 PENDING)
- **다음 작업**: 다음 실제 토요일 추첨 후 "출처 상태 확인" 버튼으로 세 출처의 실제 업데이트 시점 관찰
