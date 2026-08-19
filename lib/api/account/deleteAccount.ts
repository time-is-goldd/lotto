import { createClient as createServiceClient } from "@/lib/supabase/service";

// Phase10-8 계약(docs/ACCOUNT_WITHDRAWAL_REPORT.md). 회원탈퇴의 유일한 실행 지점이다 —
// API Route(app/api/account/route.ts)는 세션에서 얻은 userId를 그대로 넘기기만 하고,
// 실제 admin 보호/데이터 정리/auth 삭제는 전부 이 파일이 담당한다("책임을 UI/API에
// 흩뿌리지 않는다", 지시문 §21).
//
// service_role을 쓴다: profiles/fortune_results/user_period_stats/notifications는
// client 대상 DELETE RLS 정책이 아예 없고(정책 없음=기본 차단, 0008/0017), auth.users
// 삭제(admin.deleteUser)는애초에 service_role(Admin API) 없이는 불가능하다.
//
// FK 조사 결과(supabase/migrations 0001~0019 전수 확인, 보고서 §2 참조): profiles.id →
// auth.users(id)와 user_numbers/dream_journal_entries/fortune_results/user_period_stats/
// share_cards.user_id → profiles(id)는 전부 ON DELETE 미지정(Postgres 기본값 NO ACTION)이다
// — CASCADE로 자동 정리되는 관계가 하나도 없다(notification_deliveries.notification_id →
// notifications(id)만 유일하게 ON DELETE CASCADE). 그래서 이 함수가 자식 테이블부터 명시적
// 순서로 직접 삭제한 뒤에야 profiles/auth.users를 지울 수 있다 — 순서를 지키지 않으면
// FK violation으로 실패한다.
//
// 각 DELETE는 .eq(컬럼, userId) 조건 하나로 완결되는 단일 문장이라 그 자체로 원자적이고,
// 동일 인자로 재호출해도 이미 지워진 행은 0건 매칭이라 안전하다(idempotent) — 여러 테이블에
// 걸친 클라이언트 레벨 트랜잭션을 새로 만들지 않는다(지시문 §9 "가장 안전한 순서 + 재시도
// 가능한 idempotent 구조" 요구를 이 성질로 충족한다).

export class AdminAccountProtectedError extends Error {
  constructor() {
    super("관리자 계정은 일반 회원탈퇴로 삭제할 수 없습니다.");
    this.name = "AdminAccountProtectedError";
  }
}

async function assertNotAdmin(userId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("admins")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data !== null) {
    throw new AdminAccountProtectedError();
  }
}

// 테이블마다 "어떤 컬럼이 사용자를 가리키는지"가 다르다(profiles는 id 자신, 나머지는
// user_id) — 그 차이만 표로 남기고 반복되는 delete 호출 코드를 하나로 합쳤다.
const USER_OWNED_TABLES: { table: "notifications" | "user_numbers" | "dream_journal_entries" | "fortune_results" | "user_period_stats" | "share_cards"; column: "user_id" }[] = [
  // notification_deliveries는 notifications 삭제 시 ON DELETE CASCADE로 함께 정리된다
  // (0006_notifications.sql) — 별도 삭제 호출이 필요 없다.
  { table: "notifications", column: "user_id" },
  { table: "user_numbers", column: "user_id" },
  { table: "dream_journal_entries", column: "user_id" },
  { table: "fortune_results", column: "user_id" },
  { table: "user_period_stats", column: "user_id" },
  // share_cards는 실제 애플리케이션 코드 어디에서도 쓰이지 않는 테이블이다(0017_fortune_results_
  // privacy.sql 조사 근거) — 실사용 중인 row가 없을 가능성이 높지만, user_id 컬럼이 있는 이상
  // 방어적으로 함께 정리한다(존재하지 않는 행을 지우는 것은 no-op이라 안전하다).
  { table: "share_cards", column: "user_id" },
];

async function deleteUserOwnedData(userId: string): Promise<void> {
  const supabase = createServiceClient();

  for (const { table, column } of USER_OWNED_TABLES) {
    const { error } = await supabase.from(table).delete().eq(column, userId);
    if (error) {
      throw error;
    }
  }
}

async function deleteProfile(userId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("profiles").delete().eq("id", userId);
  if (error) {
    throw error;
  }
}

async function deleteAuthUser(userId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    throw error;
  }
}

// 이 함수는 호출자가 이미 "본인 세션"임을 확인했다는 전제로 userId를 그대로 받는다
// (app/api/account/route.ts가 getCurrentUser()로 얻은 세션 본인 id만 넘긴다 — client
// body/query의 어떤 값도 여기 도달하지 않는다, 지시문 §8/§29 "client-provided user_id
// 금지"). 실행 순서: admin 보호 → 자식 테이블 → profiles → auth.users. 중간에 실패하면
// 그 지점에서 예외를 던지고 멈춘다(부분 실패 상태를 감추지 않는다) — 이미 지워진 테이블은
// 다시 이 함수를 호출해도 재삭제 시도가 no-op이므로 재시도가 안전하다.
export async function deleteAccount(userId: string): Promise<void> {
  await assertNotAdmin(userId);
  await deleteUserOwnedData(userId);
  await deleteProfile(userId);
  await deleteAuthUser(userId);
}
