# PHASE1 RLS PREPARATION AUDIT — `0008_rls_policies.sql` 착수 전 검토 기록

> 이 문서는 **분석 전용 문서**다. SQL/migration/코드를 만들지 않으며, [[DATABASE_SCHEMA]]·[[EXECUTION_PLAN]]·[[IMPLEMENTATION_PLAN]]·[[AI_ENGINEERING_CONSTITUTION]]도 변경하지 않는다. `0001`~`0007`, `0013`은 Schema Freeze 대상으로 그대로 유지된다.
>
> 목적: `0008_rls_policies.sql` 작성 직전, `0001`~`0007`에서 누적된 미해결 사항 중 RLS 설계에 실제로 영향을 주는 항목만 분리하고, [[DATABASE_SCHEMA]] §6이 이미 확정한 정책 방향을 테이블별로 재확인해 "설계 승인용" 자료로 남긴다. 이 문서의 권고안은 **승인 전까지는 확정이 아니다** — 사용자 승인 후 `0008` 구현 Task에서 실제 SQL로 옮긴다.

---

## Task 1. RLS 대상 전체 테이블 목록 (13개)

[[DATABASE_SCHEMA]] §6 "Phase 1 대상 테이블" 표를 테이블 단위로 풀어서 정리한다. §6은 `dreams`/`dream_number_mappings`를 한 행으로, `winning_cases`/`stores`/`store_win_records`를 한 행으로 묶어서 표기하지만, 세 테이블 모두 정책이 동일하므로 아래에서는 개별 테이블로 분리해 표기한다.

| 테이블 | SELECT | INSERT | UPDATE | DELETE | 비고 (§6 원문) |
|---|---|---|---|---|---|
| `profiles` | 본인만(`auth.uid()=id`) | 본인만(가입 트리거) | 본인만 | **불허** | 탈퇴는 UPDATE로 익명화(§7 A안). `public_profiles` 뷰 Phase1 미생성 |
| `draws` | 전체 공개 | service_role 전용 | service_role 전용 | 불허 | 관리자 정책 공통 원칙 적용 |
| `user_numbers` | 본인만 | 본인만(`auth.uid()=user_id`) | 본인만(memo/purchase_amount 등) | **본인만** | 사용자가 잘못 생성한 기록 삭제 허용 |
| `dreams` | 전체 공개 | service_role 전용 | service_role 전용 | 불허 | 관리자 정책 공통 원칙 적용 |
| `dream_number_mappings` | 전체 공개 | service_role 전용 | service_role 전용 | 불허 | 상동 |
| `dream_journal_entries` | 본인만 | 본인만 | 본인만 | **본인만** | 완전 비공개 개인 기록, 자유 삭제 허용 |
| `fortune_results` | 본인 또는 `share_id` 익명 조회 | 본인 또는 서버 | 서버만 | 불허 | **Task 2-A에서 별도 검토** |
| `user_period_stats` | 본인만 | service_role 전용(배치) | service_role 전용(배치) | 불허 | `(user_id, period_type, period_key)` UNIQUE |
| `notifications` | 본인만 | service_role 전용 | 본인만(`is_read`만) | 불허 | 열 단위 제한 필요 |
| `notification_deliveries` | 본인 소유 알림에 한함(서버 경유 권장) | service_role 전용 | service_role 전용 | 불허 | **Task 2-B에서 별도 검토** |
| `winning_cases` | 전체 공개 | service_role 전용 | service_role 전용 | 불허 | **Task 2-C에서 별도 확인** |
| `stores` | 전체 공개 | service_role 전용 | service_role 전용 | 불허 | 상동 |
| `store_win_records` | 전체 공개 | service_role 전용 | service_role 전용 | 불허 | 상동 |

**관측**:
- 13개 테이블 중 8개(`draws`, `dreams`, `dream_number_mappings`, `winning_cases`, `stores`, `store_win_records`, 그리고 부분적으로 `user_period_stats`/`notifications`/`notification_deliveries`의 쓰기)는 "client 쓰기 정책 없음 = service_role만" 패턴으로, RLS 정책 자체는 단순하다(정책을 안 만드는 것이 정책이다).
- "본인만" 패턴(`profiles`, `user_numbers`, `dream_journal_entries`, `user_period_stats`의 SELECT, `notifications`의 SELECT/UPDATE)은 전부 `auth.uid() = user_id`(또는 `= id`) 형태로 충분하다 — 해당 컬럼이 전부 `NOT NULL`이라 `auth.uid()`와의 비교에서 NULL 문제가 없다(`profiles.id`, `user_numbers.user_id`는 nullable이지만 `user_numbers`는 §6에서 "본인만"으로 이미 비회원 케이스를 다루지 않는 것으로 확정돼 있어 문제 없음 — 아래 참고).
- 유일하게 소유자 컬럼이 nullable이면서 "본인 또는 익명"을 모두 허용해야 하는 테이블은 `fortune_results` 하나뿐이다 → Task 2-A.
- 부모-자식 관계를 넘나드는 정책이 필요한 것은 `notification_deliveries` 하나뿐이다 → Task 2-B.

**참고 — `user_numbers.user_id`도 nullable인데 왜 edge case가 아닌가**: [[DATABASE_SCHEMA]] §3.3은 `user_numbers.user_id`를 "비회원 생성 시 NULL"로 정의하지만, §6 RLS 표는 `user_numbers`의 SELECT/INSERT/UPDATE/DELETE를 전부 "본인만"으로만 명시하고 별도의 익명 경로를 적어두지 않았다. [[EXECUTION_PLAN]] Phase5(번호생성) 구현 순서를 보면 "비로그인: 결과만 표시(저장 없음)"이라고 명시되어 있어, 비회원 번호 생성 결과는 애초에 `user_numbers`에 INSERT되지 않는다(클라이언트에만 표시). 따라서 `user_numbers`는 RLS 관점에서 실제로 NULL `user_id` 행이 클라이언트 경로로 생성되는 일이 없어 edge case가 아니다. **`fortune_results`는 다르다** — [[FEATURE_SPEC]] §3.3 "비로그인도 이용 가능"이 명시되어 있고 `share_id` 공유 링크가 비회원 결과에도 필요하므로, 비회원 결과도 실제로 저장돼야 한다.

---

## Task 2. RLS 설계 시 발견된 Edge Case

### A. `fortune_results` — 비회원 INSERT 처리 방식

**현재 상태**: `user_id uuid` nullable, FK → `profiles(id)`, `ON DELETE NO ACTION`(`0005` 적용 완료). [[FEATURE_SPEC]] §3.3에 따라 비회원도 운세를 생성할 수 있고, 그 결과가 `share_id`로 공유되려면 비회원 결과도 테이블에 저장돼야 한다(단순 클라이언트 표시로 끝나는 `user_numbers`의 비회원 경로와 다르다).

**문제**: [[DATABASE_SCHEMA]] §6은 INSERT를 "본인 또는 서버"로 규정한다. 이를 `auth.uid() = user_id` 단일 조건으로 구현하면, 비회원 요청은 `auth.uid()`도 `user_id`도 둘 다 NULL이 되어 `NULL = NULL`이 SQL에서 `UNKNOWN`(참이 아님)으로 평가되므로 RLS가 이 요청을 거부한다 — 즉 "본인" 조건만으로는 문서가 의도한 비회원 경로를 커버하지 못한다.

**검토한 3가지 방향**:

| 방향 | 설명 | 장점 | 단점 |
|---|---|---|---|
| **① 비회원 INSERT anon 허용** | RLS 정책에 `(auth.uid() = user_id) OR (auth.uid() IS NULL AND user_id IS NULL)` 형태로 NULL 케이스를 명시적으로 허용 | 클라이언트가 Supabase에 직접 INSERT — 서버 API 불필요, 구현 최소, 지연시간 최소 | RLS만으로는 스팸/남용 방지 불가(anon key로 누구나 무제한 INSERT 가능) → 별도 rate limiting 필요. 운세 계산 결과(`zodiac_sign`/`luck_score`/`recommended_numbers`)를 클라이언트가 계산해 그대로 저장한다면 결과 조작 가능성도 있음 |
| **② 비회원 INSERT는 service_role만 허용** | client 대상 INSERT 정책을 아예 만들지 않고(또는 "회원도 막고"), 모든 INSERT를 service_role 경로로만 허용 | 스팸 방지, 운세 계산 로직을 서버에서만 수행하도록 강제(결과 조작 방지), [[IMPLEMENTATION_PLAN]] §5 "관리자 전용 작업은 service_role 서버 사이드에서만" 패턴과 일관 | §6 "본인 또는 서버" 문구 중 "본인" 경로(로그인 사용자가 직접 RLS로 INSERT)를 사실상 사용하지 않게 됨 — 문서 표현과 실제 구현이 어긋나 보일 수 있음 |
| **③ 애플리케이션 서버 API Route에서만 처리(로그인/비로그인 분기)** | Next.js API Route가 요청을 받아, 로그인 사용자는 사용자 세션 컨텍스트로 INSERT(RLS가 `auth.uid()=user_id`로 통과), 비회원은 service_role로 INSERT(`user_id=NULL`) | §6 "본인 또는 서버" 문구를 그대로 구현 가능. 운세 계산이 항상 서버에서 실행되므로 조작 위험 없음. rate limiting을 API Route 레벨에서 일괄 적용 가능([[AI_ENGINEERING_CONSTITUTION]] §11 "Rate Limit" 원칙과 부합) | 셋 중 구현 복잡도가 가장 높음(로그인/비로그인 분기, 세션 forwarding 로직 필요) |

**추천안(확정 아님, 승인 필요)**: **③**을 추천한다.
- 운세 계산(생년월일 → 띠 → 행운지수 → 추천번호) 자체가 이미 서버에서 실행돼야 하는 로직이므로(클라이언트가 계산 결과만 보내 저장하는 구조는 신뢰할 수 없다), 어차피 서버 API Route가 필요한 경로다. 이 경로 안에서 로그인/비로그인을 분기하는 추가 비용은 상대적으로 작다.
- [[AI_ENGINEERING_CONSTITUTION]] §11 "인증이 필요한 API는 요청마다 세션을 재확인... 서버가 최종 방어선"과 정확히 같은 패턴이며, 이미 `0006_notifications.sql` 이후 예정된 알림 발송, `Phase6` 당첨확인 배치도 동일하게 "관리자/서버 경유" 패턴을 쓰고 있어 프로젝트 전반의 일관성이 높다.
- 결과적으로 RLS 정책 자체는 **②와 동일한 모양**(client 직접 INSERT는 원칙적으로 막거나, 로그인 사용자에 한해서만 `auth.uid()=user_id` 허용)이 되지만, 그 앞단의 애플리케이션 아키텍처가 §6의 "본인 또는 서버" 의도를 실제로 살린다.
- **단, 최종 선택은 사용자 승인 필요** — ①이 "비회원 트래픽이 많고 서버 부담을 최소화해야 한다"는 판단이 있다면 더 적합할 수 있다.

---

### B. `notifications` / `notification_deliveries` — EXISTS 서브쿼리 패턴 검증

**제시된 정책안**:
```sql
exists (
  select 1 from notifications
  where notifications.id = notification_deliveries.notification_id
  and notifications.user_id = auth.uid()
)
```

**검증 결과 — 적절하다.** 이유:
1. **정합성**: 부모(`notifications`)의 소유자(`user_id`)를 기준으로 자식(`notification_deliveries`)의 접근을 판단하는 "부모 소유권 상속" 패턴은 FK로 연결된 1:N 관계에서 표준적으로 쓰이는 RLS 구현 방식이다. `notification_deliveries` 자체에는 `user_id` 컬럼이 없으므로(§3.16에 없음, 임의로 추가하지 않음) 이 방식이 사실상 유일한 구현 경로다.
2. **순환 참조 없음**: `notifications`의 RLS 정책은 `notification_deliveries`를 참조하지 않는다(단방향). Postgres가 `notification_deliveries`의 정책을 평가하며 `notifications`를 서브쿼리로 조회할 때, `notifications` 자신의 SELECT RLS(`auth.uid()=user_id`)도 함께 적용되지만 이는 같은 조건을 이중으로 확인하는 것뿐이라 결과에 영향이 없다 — 무한 재귀나 순환 참조 문제는 없다.
3. **인덱스 지원**: `notifications.id`는 PK(자동 인덱스), `notification_deliveries.notification_id`는 `0006`에서 이미 FK 인덱스(`notification_deliveries_notification_id_idx`)가 생성되어 있다 — 서브쿼리 조인 성능에 필요한 인덱스가 이미 갖춰져 있다.

**성능 관련 권고(구현 시 반영 권장, 지금 결정 아님)**: Supabase RLS 성능 가이드는 `auth.uid()`를 정책 내에서 직접 호출하면 **행마다** 재평가될 수 있으므로, `(select auth.uid())` 형태로 감싸 플래너가 한 번만 평가하도록 권장한다. 이 정책과 `notifications` 자체의 "본인만" 정책 모두에 동일하게 적용하는 것이 좋다 — `0008` 구현 시 체크리스트 항목으로 남긴다(Task 4).

**§6 "서버 경유 권장" 문구와의 관계**: §6은 `notification_deliveries` SELECT를 "본인 소유 알림에 한함(**서버 경유 권장**)"이라고 적었다. "권장"이지 강제가 아니므로, EXISTS 기반 client SELECT 정책을 실제로 만들지, 아니면 client SELECT 정책 자체를 생략하고(정책 없음=기본 차단) 서버 API가 service_role로 대신 조회해 반환하는 방식으로만 노출할지는 열린 선택지다. **권고**: EXISTS 정책을 만들어 두는 쪽을 권장한다 — 서버 경유가 주 경로가 되더라도, RLS는 애플리케이션 코드의 실수와 무관하게 동작하는 DB 레벨 최종 방어선이어야 한다는 원칙([[AI_ENGINEERING_CONSTITUTION]] §11)에 더 부합한다. 이 역시 확정이 아니라 `0008` 착수 전 확인이 필요한 항목이다(Task 4에 반영).

---

### C. `winning_cases` / `stores` / `store_win_records` — 관리자 부재 시 처리 방식 확인

**검토 대상**: Phase1에서는 `admins` 테이블/관리자 플래그가 없다([[EXECUTION_PLAN]] Phase 9에야 생성). client INSERT/UPDATE/DELETE 정책을 만들지 않고 service_role만 관리하는 방식이 적절한가?

**검증 결과 — 적절하며, 이미 [[DATABASE_SCHEMA]] §6에 명문화된 방향이다(새 결정이 아니라 재확인).** §6 원문:

> "**관리자 정책에 대한 공통 원칙**: `admins` 테이블/관리자 플래그는 [[EXECUTION_PLAN]] Phase 9에야 생성된다. 따라서 Phase 1~8 동안 '관리자만' 권한은 client 대상 RLS 정책을 아예 만들지 않는 방식(정책 없음 = 기본 차단)으로 구현하고, 실제 관리자 쓰기는 서버 API route가 service_role로 수행한다."

이 원칙은 `winning_cases`/`stores`/`store_win_records`뿐 아니라 `draws`/`dreams`/`dream_number_mappings`에도 동일하게 적용되며, 세 테이블 모두 §6 표에서 이미 "service_role 전용" 쓰기로 명시돼 있다. `0008`에서는 이 6개 "전체공개 콘텐츠" 테이블 전부에 대해:
- SELECT: `TO public USING (true)`(또는 동등한 무조건 허용) 정책 1개만 생성
- INSERT/UPDATE/DELETE: **정책을 아예 만들지 않는다**(client 역할로는 RLS 활성화 후 정책 없음 = 자동 차단, service_role은 RLS를 우회하므로 별도 정책 불필요)

이 패턴은 6개 테이블에 반복되므로, `0008` 작성 시 하나의 헬퍼 서술(§6 공통 원칙 인용)로 6번 반복 적용하면 된다 — 구현은 지금 하지 않는다.

---

## Task 3. 이전 발견사항 분류 (0008 이전 결정 필요 여부)

| # | 항목 | 분류 | 근거 |
|---|---|---|---|
| 1 | `fortune_results.related_dream_id` 지시문-문서 불일치 | **C** | `0005`에서 이미 [[DATABASE_SCHEMA]] 그대로(컬럼 없음) 구현 완료. 추가 조치 불필요 — 사용자가 실제로 이 컬럼을 원한다면 그것은 "미해결 사항 정리"가 아니라 새로운 스키마 변경 요청이며, 별도 Design Gate가 필요하다. RLS 설계에 영향 없음(참조할 컬럼 자체가 없음) |
| 2 | `user_period_stats.created_at` 없음 | **B** | RLS 정책(§6: 본인만 SELECT, service_role 전용 INSERT/UPDATE)은 `created_at` 유무와 무관하게 작성 가능. 필요성이 확정되면 `0008` 이후 `0011`+ `ALTER TABLE ADD COLUMN`으로 처리 |
| 3 | `notification_deliveries` created_at/updated_at 없음 | **B** | RLS 정책(Task 2-B의 EXISTS 패턴)은 시각 컬럼과 무관하게 작성 가능. `0008` 이후 별도 migration으로 처리 가능 |
| 4 | `notifications.link_url` NOT NULL | **B** | RLS 정책은 `link_url` nullable 여부와 무관. NOT NULL을 완화하려면 `ALTER COLUMN ... DROP NOT NULL` migration이 필요하나 `0008`을 막지 않음 |
| 5 | `notification_deliveries.status` 부분 인덱스 조건 미정 | **B** | 인덱스는 성능 최적화 항목으로 RLS 정책 정확성과 무관. `0008` 이후 조건이 정해지면 별도 migration으로 추가 |
| 6 | `stores.lat`/`lng` NOT NULL | **B** | RLS와 무관한 데이터 입력 워크플로 문제. 완화 필요 시 `ALTER COLUMN` migration으로 처리 |
| 7 | `store_win_records` UNIQUE(`store_id`, `round`, `prize_rank`) 부재 | **B** | RLS와 무관한 데이터 무결성 문제. 필요 시 `ALTER TABLE ADD CONSTRAINT` migration으로 처리 |
| 8 | [[EXECUTION_PLAN]] / [[ROADMAP]] MoSCoW 등급 표기 불일치 | **C** | 스키마·RLS와 무관한 순수 문서 표기 문제. 문서 수정만으로 해결 |

**결론**: 8개 항목 중 **RLS 작성을 직접 막는(A) 항목은 없다.** 전부 B(스키마 보완, `0008` 이후 별도 migration 가능) 또는 C(문서만 수정)로 분류된다. 단, Task 2에서 새로 식별된 아래 두 항목은 8개 목록에는 없지만 **A에 해당**하므로 `0008` 착수 전 결정이 필요하다:

| 신규 항목 | 분류 | 근거 |
|---|---|---|
| `fortune_results` 비회원 INSERT 정책 방향(①/②/③) | **A** | 정책 표현 자체가 결정에 따라 달라짐(단순 `auth.uid()=user_id` vs NULL 허용 조건 vs client 정책 자체를 안 만듦) — `0008` SQL을 쓰기 전에 방향을 확정해야 한다 |
| `notification_deliveries` SELECT를 client RLS로 만들지, 서버 경유만으로 대체할지 | **A** | 정책을 만들지 여부 자체가 결정 대상 — `0008`에 정책을 포함할지 말지가 갈린다 |

---

## Task 4. `0008_rls_policies.sql` 작성 전 체크리스트

### 4.1 모든 테이블 정책 방향 확정
- [ ] Task 1의 13개 테이블 × 4개 연산(SELECT/INSERT/UPDATE/DELETE) = 52개 셀 전부 방향 확정 — 이 문서 기준으로는 50개 확정, 2개(`fortune_results` INSERT, `notification_deliveries` SELECT 구현 여부) 승인 대기
- [ ] `fortune_results` 비회원 INSERT 방향(①/②/③) 사용자 확정
- [ ] `notification_deliveries` SELECT를 client 정책으로 만들지 여부 확정

### 4.2 `anon` / `authenticated` / `service_role` 역할 구분
- [ ] 공개 SELECT 테이블(`draws`, `dreams`, `dream_number_mappings`, `winning_cases`, `stores`, `store_win_records`) 정책은 `anon`과 `authenticated` 모두를 포함해야 한다 — Postgres RLS `CREATE POLICY`의 기본 대상(`TO` 절 생략 시 `public`)이 이를 만족하는지, 아니면 `TO anon, authenticated`를 명시할지 결정
- [ ] "본인만" 계열 정책(`profiles`, `user_numbers`, `dream_journal_entries`, `user_period_stats`, `notifications`)은 `TO authenticated`로 한정해 비로그인 요청이 애초에 정책 평가 대상에서 제외되도록 할지 검토(불필요한 정책 평가 오버헤드 축소)
- [ ] `service_role`은 기본적으로 RLS를 우회하므로 별도 정책이 필요 없다는 점을 팀(1인 개발자 본인) 기준으로 재확인 — 서버 코드가 `service_role` 키를 쓰는 경로와 사용자 세션(`anon`/`authenticated`) 키를 쓰는 경로가 실제 코드에서 섞이지 않는지도 `0008` 이후 Phase2~ 구현 시점에 재검증 필요

### 4.3 INSERT/UPDATE/DELETE 정책 충돌 여부
- [ ] 같은 테이블·같은 연산에 여러 permissive 정책이 생기지 않는지 확인(Postgres는 permissive 정책을 OR로 결합하므로, 의도치 않게 접근 범위가 넓어질 수 있음) — 현재 설계는 테이블당 연산당 정책 1개 원칙이라 충돌 소지 낮음
- [ ] `notifications` UPDATE의 "본인만(`is_read`만)" 제약은 RLS의 `USING`만으로는 불가능하고 `WITH CHECK`에서 `is_read` 외 컬럼이 `OLD` 값과 동일한지 비교하는 조건이 필요함을 반영(`0005` 보고서에서 이미 언급된 사항, 재확인)

### 4.4 FK 관계와 RLS 재귀(recursive) 쿼리 문제 여부
- [ ] `notification_deliveries → notifications` EXISTS 서브쿼리: 단방향 참조, 순환 없음(Task 2-B에서 확인 완료)
- [ ] `dream_journal_entries → dreams`(`linked_dream_id`): `dream_journal_entries`의 RLS는 자신의 `user_id`만으로 판단하며 `dreams`를 참조할 필요가 없음 — 재귀 위험 없음
- [ ] `user_numbers.related_dream_id`/`related_fortune_id`: FK 제약 자체가 없으므로(§3.0 원칙 3) RLS 서브쿼리 조인 대상도 아님
- [ ] 현재 스키마 전체(`0001`~`0007`)에 순환 FK 관계가 없음을 재확인(과거 Migration 순서 검증에서 이미 확인된 사실과 일치)

### 4.5 Supabase PostgreSQL RLS 작성 시 주의사항
- [ ] **RLS 활성화 자체가 아직 안 되어 있음**: `0001`~`0007`의 모든 테이블은 `pg_class.relrowsecurity = false` 상태(각 Task Validation에서 반복 확인됨). `0008`은 `CREATE POLICY`뿐 아니라 테이블마다 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`를 반드시 포함해야 한다 — 정책만 만들고 활성화를 빠뜨리는 실수 방지
- [ ] `auth.uid()`는 `(select auth.uid())`로 감싸 per-statement 평가되도록 하는 Supabase 권장 성능 패턴 적용 여부 결정(Task 2-B에서 언급)
- [ ] `FORCE ROW LEVEL SECURITY`가 필요한 테이블이 있는지 검토(테이블 소유자 role이 앱 코드에서 직접 쿼리하는 경우가 없다면 불필요 — 현재 프로젝트는 `service_role`/`anon`/`authenticated`만 사용하므로 대부분 불필요할 것으로 예상, `0008` 구현 시 재확인)
- [ ] 각 정책에 [[DATABASE_SCHEMA]] §6의 어느 행을 근거로 하는지 SQL 주석으로 남기는 기존 관례(`0001`~`0007`의 comment 스타일)를 유지

### 4.6 Migration 순서 검증
- [ ] `0008`은 `0001`~`0007`에서 생성된 13개 테이블이 모두 존재해야 실행 가능 — 현재 `migration list` 기준 `0001`~`0007`, `0013` 전부 원격에 적용 완료(재확인 완료)
- [ ] `0008`은 새 테이블을 만들지 않는다 — `share_cards`(`0009`에서 테이블+RLS 동시 생성)를 `0008`에서 미리 참조하지 않는다
- [ ] `0008` 이후 순서(`0009` share_cards, `0010` seed)가 `0008`이 만드는 정책과 충돌하지 않는지 — `0009`는 자신의 RLS를 자체 파일에서 처리하므로 `0008`과 독립적, `0010` seed는 RLS 활성화 이후 실행되므로 seed INSERT가 `service_role`로 수행되는지 확인 필요(seed는 보통 관리자 권한으로 실행되므로 RLS를 우회할 것으로 예상 — `0010` 작성 시 재확인)

---

## 다음 단계

이 문서는 승인용 자료다. 사용자가 아래를 확정하면 `0008_rls_policies.sql` 구현 Task를 시작할 수 있다:

1. `fortune_results` 비회원 INSERT 방향(①/②/③ 중 선택, 또는 다른 방향)
2. `notification_deliveries` SELECT를 client RLS 정책으로 만들지 여부
3. (선택) Task 3의 B/C 항목 중 `0008`과 함께 처리하고 싶은 것이 있는지(기본은 전부 `0008` 이후로 분리)
