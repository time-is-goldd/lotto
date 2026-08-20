import { randomBytes } from "crypto";

import { generateDailyFortune, type FortuneGender } from "@/lib/logic/dailyFortune";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service";
import type { Tables } from "@/lib/types/database";
import { getKstDateString } from "@/lib/utils/kstDate";

export type FortuneResultEntry = Tables<"fortune_results">;

export interface DailyFortuneResult {
  entry: FortuneResultEntry;
  // 오늘 처음 생성된 결과인지(true) 이미 있던 결과를 그대로 불러온 것인지(false).
  // app/fortune 페이지가 이 값으로 "첫 확인 reveal 애니메이션"을 보여줄지 판단한다(§20) —
  // 같은 날 재방문(isNew=false)에는 애니메이션 없이 즉시 결과를 보여준다.
  isNew: boolean;
}

const UNIQUE_VIOLATION_CODE = "23505";
const SHARE_ID_BYTES = 12; // base64url 인코딩 시 16자 — share_id(varchar(20)) 여유 있게

// 공유 기능(§23)은 이번 MVP에서 새 public 상세 Route/API를 만들지 않으므로 이 share_id가
// 실제로 조회 가능한 링크로 이어지지는 않는다. 그래도 share_id는 not null unique 컬럼이라
// INSERT 시 항상 채워야 한다 — 추측 불가능한 무작위 값을 넣는다. Phase10-4B: 이 share_id를
// 실제로 조회하는 라우트/API가 코드 어디에도 없음을 확인했고, fortune_results의 공개 SELECT
// 정책 자체를 0017 마이그레이션으로 제거했다(docs/DAILY_FORTUNE_PRIVACY_FIX_REPORT.md) — 이
// 컬럼은 여전히 NOT NULL UNIQUE 제약을 만족시키기 위해서만 채운다.
function generateShareId(): string {
  return randomBytes(SHARE_ID_BYTES).toString("base64url");
}

// fortune_results의 SELECT RLS는 Phase10-4B(0017_fortune_results_privacy.sql)부터
// auth.uid() = user_id로 좁혀져 있어 RLS 자체가 이미 소유자만 걸러준다. 그래도
// lib/api/journal.ts의 getRecentFortuneResults()와 동일하게 .eq("user_id", userId)를
// 명시한다 — RLS와 애플리케이션 필터가 이중으로 같은 조건을 강제하는 방어적 패턴이며,
// 이 필터만으로도(RLS가 어떤 이유로든 실패하더라도) 다른 사용자 결과가 새지 않는다.
async function getTodayFortuneResult(
  userId: string,
  resultDate: string
): Promise<FortuneResultEntry | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fortune_results")
    .select("*")
    .eq("user_id", userId)
    .eq("result_date", resultDate)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

// service_role을 쓴다 — lib/api/numbers.ts(saveUserNumbers)와 달리 이 테이블은 client
// INSERT RLS 정책이 아예 없다(0008_rls_policies.sql "Decision 1": 비회원 운세 생성도
// 지원해야 해서 auth.uid()=user_id 방식의 client INSERT 정책 자체를 두지 않고, 운세 생성은
// 서버 API Route가 service_role로만 처리하도록 이미 설계돼 있다). 이 함수가 그 기존 결정을
// 그대로 따르는 것이지, 이 Task에서 새로 내린 보안 완화 결정이 아니다.
// created:false는 이 호출이 실제로 INSERT하지 않고 동시성 충돌 이후 기존 행을 재조회만 했음을
// 뜻한다 — getOrCreateTodayFortune()이 이 값을 그대로 isNew로 내려보내 "이 요청이 방금 새로
// 만들었는지"를 정확히 반영한다(§20의 첫 확인 reveal 애니메이션은 실제로 새로 생성된 경우에만
// 의미가 있다).
async function createTodayFortuneResult(
  userId: string,
  birthDate: string,
  resultDate: string,
  gender: FortuneGender | null,
  birthTime: string | null
): Promise<{ entry: FortuneResultEntry; created: boolean }> {
  const fortune = generateDailyFortune({ birthDate, targetDate: resultDate, gender, birthTime });
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("fortune_results")
    .insert({
      user_id: userId,
      input_birth_date: birthDate,
      result_date: resultDate,
      zodiac_sign: fortune.zodiacSign,
      overall_fortune: fortune.overallFortune,
      luck_score: fortune.luckScore,
      recommended_numbers: fortune.recommendedNumbers,
      money_luck: fortune.moneyLuck,
      action_guide: fortune.actionGuide,
      things_to_avoid: fortune.thingsToAvoid,
      lucky_color: fortune.luckyColor,
      lucky_time: fortune.luckyTime,
      share_id: generateShareId(),
    })
    .select()
    .single();

  if (error) {
    // 동시에 두 요청이 같은 (user_id, result_date)로 INSERT를 시도하면(§14 "동시 요청") 하나만
    // 성공하고 나머지는 UNIQUE(user_id, result_date) 위반(23505)으로 실패한다 — 이 경우 새로
    // 생성하는 대신 방금 다른 요청이 만든 행을 다시 조회해서 반환한다.
    if (error.code === UNIQUE_VIOLATION_CODE) {
      const existing = await getTodayFortuneResult(userId, resultDate);
      if (existing) {
        return { entry: existing, created: false };
      }
    }
    throw error;
  }

  return { entry: data, created: true };
}

// generate-or-get(§14): 오늘 결과가 이미 있으면 그대로 반환하고, 없을 때만 새로 만든다.
// "다시 뽑기" 기능은 없다(§22) — 이 함수를 두 번 호출해도 같은 날에는 항상 같은 entry를
// 돌려준다(이미 존재하면 재조회만 하고 재생성하지 않음).
export async function getOrCreateTodayFortune(
  userId: string,
  birthDate: string,
  gender: FortuneGender | null = null,
  birthTime: string | null = null
): Promise<DailyFortuneResult> {
  const resultDate = getKstDateString();

  const existing = await getTodayFortuneResult(userId, resultDate);
  if (existing) {
    return { entry: existing, isNew: false };
  }

  const { entry, created } = await createTodayFortuneResult(
    userId,
    birthDate,
    resultDate,
    gender,
    birthTime
  );
  return { entry, isNew: created };
}

export interface DerivedFortuneFields {
  luckyNumbers: number[];
  moneyLuckScore: number;
}

// 행운 숫자(1~3개, §11)와 금전운 지수(UX Polish Task §10~§12)는 저장 컬럼을 새로 만들지
// 않고 화면에 보여줄 때만 파생시킨다(result_date 하나만 추가한다는 Phase10-4A §5 판단을
// 지키기 위함). 시드가 DailyFortuneInput으로 완전히 결정되므로 다시 계산해도 항상 같은 값이
// 나온다 — 하나의 generateDailyFortune() 호출로 두 값을 함께 얻어 중복 계산을 피한다(호출부가
// 둘 다 필요로 하므로 각각 별도 함수로 나눠 두 번 계산하지 않는다).
// birthDate/gender/birthTime은 entry에서 다시 읽지 않고, 호출자(로그인 세션을 이미 확인하고
// getProfile()도 이미 호출한 Route/페이지)가 신뢰할 수 있는 값을 그대로 전달한다 —
// getOrCreateTodayFortune 호출 시 쓴 값과 항상 같아야 결과가 일치한다. Phase10-4B §E:
// entry.input_birth_date를 다시 읽지 않도록 바꿔, 애플리케이션 코드에서 이 컬럼을 읽는
// 유일한 지점을 제거했다(개인정보 최소 사용 — 컬럼 자체는 이번 Task에서 제거하지 않는다,
// docs/DAILY_FORTUNE_PRIVACY_FIX_REPORT.md §11 참조). userId는 더 이상 시드에 쓰이지 않아
// (§7) 파라미터에서 제거했다.
export function getDerivedFortuneFields(
  entry: Pick<FortuneResultEntry, "result_date">,
  birthDate: string,
  gender: FortuneGender | null = null,
  birthTime: string | null = null
): DerivedFortuneFields {
  const fortune = generateDailyFortune({
    birthDate,
    targetDate: entry.result_date,
    gender,
    birthTime,
  });
  return { luckyNumbers: fortune.luckyNumbers, moneyLuckScore: fortune.moneyLuckScore };
}
