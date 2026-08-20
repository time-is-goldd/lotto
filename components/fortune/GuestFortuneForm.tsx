"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import BirthDateSplitInput, { type BirthDateSplitInputHandle } from "@/components/fortune/BirthDateSplitInput";
import DailyFortuneCard from "@/components/fortune/DailyFortuneCard";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import { trackProductEvent } from "@/lib/analytics/trackProductEvent";
import { generateDailyFortune, type DailyFortune } from "@/lib/logic/dailyFortune";
import { validateGuestFortuneInput } from "@/lib/logic/guestFortuneValidation";
import {
  computeProfileKey,
  isUsingMemoryFallback,
  listTodayEntries,
  pruneOldEntries,
  readEntry,
  writeEntry,
  type TodayEntrySummary,
} from "@/lib/storage/guestFortuneStore";
import { getKstDateString } from "@/lib/utils/kstDate";

// claude-code-luck-platform-daily-fortune-number-demo-prompt.md §2~§5: 로그인 없이도 오늘의
// 운세를 끝까지 볼 수 있어야 하고, 같은 브라우저·같은 입력 프로필·같은 KST 날짜로 다시
// 제출하면 새로 계산하지 않고 저장된 결과를 그대로 보여준다. authState가 "profile-pending"
// 이면(로그인은 했지만 아직 프로필이 없는 회원) app/fortune/page.tsx가 이 컴포넌트를 그대로
// 재사용한다 — 아래쪽 결과 카드의 안내 문구만 로그인 유도 대신 온보딩 완료 유도로 바뀐다.
type GuestAuthState = "anonymous" | "profile-pending";

interface GuestFortuneFormProps {
  authState: GuestAuthState;
}

type FlowState = "form" | "revealing" | "result" | "error";

const NEW_REVEAL_DELAY_MS = 1500; // §12(이전 followup 프롬프트): 첫 공개 1.2~1.8초
const REPEAT_REVEAL_DELAY_MS = 800; // 재확인은 짧게 — 반복 방문을 방해하지 않는다
const REDUCED_MOTION_DELAY_MS = 50;

function formatKstTime(isoString: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(isoString));
}

export default function GuestFortuneForm({ authState }: GuestFortuneFormProps) {
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ birthDate?: string }>({});
  const [flowState, setFlowState] = useState<FlowState>("form");
  const [result, setResult] = useState<(DailyFortune & { resultDate: string }) | null>(null);
  const [isRepeat, setIsRepeat] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [todayEntries, setTodayEntries] = useState<TodayEntrySummary[]>([]);
  const [storageNoticeVisible, setStorageNoticeVisible] = useState(false);

  const birthDateInputRef = useRef<BirthDateSplitInputHandle>(null);
  const requestIdRef = useRef(0);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // components/generate/NumberGenerator.tsx와 동일한 패턴 — ref는 React state가 아니라
  // react-hooks/set-state-in-effect 규칙 대상이 아니다.
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    trackProductEvent("fortune_form_viewed", { auth_state: authState });

    // components/generate/NumberGenerator.tsx의 마운트 effect와 동일한 이유로
    // requestAnimationFrame으로 한 박자 늦춰 호출한다 — react-hooks/set-state-in-effect가
    // effect 본문에서 곧바로 setState하는 것을 막기 때문이다(아직 페인트 전이라 실질적인
    // 지연은 없다).
    const rafId = requestAnimationFrame(() => {
      const todayKst = getKstDateString();
      pruneOldEntries(todayKst);
      setTodayEntries(listTodayEntries(todayKst));
      if (isUsingMemoryFallback()) {
        setStorageNoticeVisible(true);
      }
    });

    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    return () => {
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (flowState !== "result") {
      return;
    }
    document.getElementById("fortune-result-heading")?.focus();
  }, [flowState]);

  function revealAfterDelay(isNewGeneration: boolean, callback: () => void) {
    const delay = reducedMotionRef.current
      ? REDUCED_MOTION_DELAY_MS
      : isNewGeneration
        ? NEW_REVEAL_DELAY_MS
        : REPEAT_REVEAL_DELAY_MS;
    revealTimeoutRef.current = setTimeout(callback, delay);
  }

  // §5 두 번째 하위 요구: 입력 전에 오늘 이미 확인한 결과가 있으면 다시 계산·제출 없이
  // 곧바로 그 결과를 보여준다. profileKey는 해시값이라 어떤 생년월일이었는지 이 함수도
  // 알 수 없다 — readEntry가 그대로 돌려주는 결과만 사용한다.
  function reopenStoredEntry(profileKey: string) {
    const todayKst = getKstDateString();
    const entry = readEntry(profileKey);
    if (!entry || entry.date !== todayKst) {
      return;
    }
    setIsRepeat(true);
    setFlowState("revealing");
    trackProductEvent("fortune_result_reopened", { auth_state: authState });
    revealAfterDelay(false, () => {
      setResult({ ...entry.result, resultDate: entry.date });
      setFlowState("result");
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (flowState === "revealing") {
      return; // 중복 제출 방지
    }

    const todayKst = getKstDateString();
    const validation = validateGuestFortuneInput(
      { birthDate, gender: gender || null, birthTime: birthTime || null },
      todayKst
    );

    if (!validation.ok) {
      setFieldErrors({ birthDate: validation.errors.birthDate });
      birthDateInputRef.current?.focusFirstIncompleteOrLast();
      return;
    }

    setFieldErrors({});
    const requestId = ++requestIdRef.current;

    const profileKey = await computeProfileKey(birthDate, gender || null, birthTime || null);
    if (requestIdRef.current !== requestId) {
      return;
    }

    // §5: 같은 프로필로 같은 날 다시 제출 — 새로 계산하지 않고 저장된 결과를 그대로 쓴다.
    const existing = readEntry(profileKey);
    if (existing && existing.date === todayKst) {
      setIsRepeat(true);
      setFlowState("revealing");
      trackProductEvent("fortune_limit_hit", { auth_state: authState });
      trackProductEvent("fortune_result_reopened", { auth_state: authState });
      revealAfterDelay(false, () => {
        if (requestIdRef.current !== requestId) {
          return;
        }
        setResult({ ...existing.result, resultDate: existing.date });
        setFlowState("result");
      });
      return;
    }

    setIsRepeat(false);
    setFlowState("revealing");
    trackProductEvent("fortune_generation_started", { auth_state: authState });

    // §13: 서버를 거치지 않는다 — lib/logic/dailyFortune.ts는 secret이 필요 없는 순수 함수라
    // 브라우저에서 직접 계산한다. birthDate/gender/birthTime은 이 함수 호출 밖으로(네트워크로)
    // 전혀 나가지 않는다. 계산 자체는 실패할 일이 거의 없는 순수 함수라 catch는 방어적
    // 안전장치일 뿐이다(예: 예상 밖의 런타임 에러).
    try {
      const fortune = generateDailyFortune({
        birthDate,
        targetDate: todayKst,
        gender: (gender || null) as "M" | "F" | "N" | null,
        birthTime: birthTime || null,
      });
      const data: DailyFortune & { resultDate: string } = { ...fortune, resultDate: todayKst };

      trackProductEvent("fortune_form_submitted", {
        auth_state: authState,
        has_gender: gender !== "" && gender !== "N",
        has_birth_time: birthTime !== "",
      });

      writeEntry(profileKey, data.resultDate, data);
      setTodayEntries(listTodayEntries(data.resultDate));

      revealAfterDelay(true, () => {
        if (requestIdRef.current !== requestId) {
          return;
        }
        setResult(data);
        setFlowState("result");
        trackProductEvent("fortune_generated", { auth_state: authState });
      });
    } catch {
      if (requestIdRef.current !== requestId) {
        return;
      }
      setFlowState("error");
      setErrorMessage("오늘의 운세를 계산하지 못했어요. 다시 시도해주세요.");
    }
  }

  function handleRetry() {
    setFlowState("form");
  }

  if (flowState === "result" && result) {
    const loginNext = encodeURIComponent("/fortune");
    const loginHref =
      authState === "anonymous" ? `/login?next=${loginNext}&reason=fortune` : "/onboarding";

    return (
      <div className="flex flex-col gap-6">
        {isRepeat && (
          <p role="status" className="text-center text-caption text-text-secondary">
            오늘 이미 확인한 운세예요. 내일 새 운세를 만들 수 있어요.
          </p>
        )}
        <DailyFortuneCard
          resultDate={result.resultDate}
          zodiacSign={result.zodiacSign}
          overallFortune={result.overallFortune}
          luckScore={result.luckScore}
          moneyLuck={result.moneyLuck}
          moneyLuckScore={result.moneyLuckScore}
          actionGuide={result.actionGuide}
          thingsToAvoid={result.thingsToAvoid}
          luckyColor={result.luckyColor}
          luckyTime={result.luckyTime}
          luckyNumbers={result.luckyNumbers}
          recommendedNumbers={result.recommendedNumbers}
          isNew={false}
        />

        {/* §9(이전 followup 프롬프트): 결과를 충분히 보여준 뒤 로그인 가치를 제시한다. */}
        <Card className="flex flex-col items-center gap-3 text-center">
          <p className="text-body font-bold text-text-primary">다음부터는 입력 없이 바로 확인하세요</p>
          <p className="text-body text-text-secondary">
            {authState === "anonymous"
              ? "카카오로 로그인하면 생년월일과 선택 정보를 저장하고, 여러 기기에서도 매일 같은 기준으로 오늘의 행운을 확인할 수 있어요."
              : "온보딩을 마치면 생년월일과 선택 정보가 저장돼 매일 같은 기준으로 오늘의 행운을 확인할 수 있어요."}
          </p>
          <Link
            href={loginHref}
            onClick={() =>
              trackProductEvent("fortune_login_cta_clicked", { location: "fortune_guest_result" })
            }
            className="rounded-md bg-primary px-6 py-3 text-body font-medium text-white"
          >
            {authState === "anonymous" ? "카카오로 로그인하고 정보 저장하기" : "온보딩 계속하기"}
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h1 font-bold text-text-primary">오늘의 행운</h1>
        <p className="mt-2 text-body text-text-secondary">
          로그인 없이 생년월일을 입력하고 오늘의 맞춤 운세를 확인해보세요.
        </p>
      </div>

      {/* §5: 입력 전에 오늘 저장된 결과가 있으면 다시 입력하지 않고 바로 이어볼 수 있는
          바로가기 — 생년월일은 나열하지 않고 확인 시각만 표시한다(비식별). */}
      {todayEntries.length > 0 && flowState === "form" && (
        <Card className="flex flex-col gap-2">
          <p className="text-body font-medium text-text-primary">오늘 이미 확인한 운세가 있어요</p>
          <ul className="flex flex-col gap-2">
            {todayEntries.map((entry) => (
              <li key={entry.profileKey}>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => reopenStoredEntry(entry.profileKey)}
                >
                  {todayEntries.length === 1
                    ? "오늘 확인한 운세 다시 보기"
                    : `${formatKstTime(entry.generatedAt)}에 확인한 운세 다시 보기`}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <BirthDateSplitInput
          ref={birthDateInputRef}
          idPrefix="guest-birth-date"
          value={birthDate}
          onChange={setBirthDate}
          error={fieldErrors.birthDate}
          errorId="guest-birth-date-error"
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="guest-gender" className="text-body font-medium text-text-primary">
            성별 <span className="text-caption text-text-secondary">(선택)</span>
          </label>
          <select
            id="guest-gender"
            value={gender}
            onChange={(event) => setGender(event.target.value)}
            className="rounded-md border border-border bg-bg-base px-3 py-2 text-body text-text-primary"
          >
            <option value="">선택 안 함</option>
            <option value="M">남성</option>
            <option value="F">여성</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="guest-birth-time" className="text-body font-medium text-text-primary">
            태어난 시각{" "}
            <span className="text-caption text-text-secondary">(선택 · 몰라도 괜찮아요)</span>
          </label>
          <input
            id="guest-birth-time"
            type="time"
            value={birthTime}
            onChange={(event) => setBirthTime(event.target.value)}
            className="rounded-md border border-border bg-bg-base px-3 py-2 text-body text-text-primary"
          />
        </div>

        <Button type="submit" variant="primary" size="lg" disabled={flowState === "revealing"}>
          {flowState === "revealing" ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner className="h-4 w-4" />
              {isRepeat ? "오늘의 운세를 다시 보여드릴게요" : "오늘의 행운 카드를 준비하고 있어요"}
            </span>
          ) : (
            "오늘의 맞춤 운세 보기"
          )}
        </Button>

        <p aria-live="polite" className="sr-only">
          {flowState === "revealing" &&
            (isRepeat
              ? "오늘의 운세는 이미 정해졌어요. 같은 결과를 다시 보여드릴게요."
              : "오늘의 행운 카드를 준비하고 있어요.")}
          {flowState === "error" && errorMessage}
        </p>

        <p className="text-caption text-text-secondary">
          비회원 운세 정보와 결과는 이 브라우저에만 임시 저장되며 서버 계정에는 저장되지
          않습니다. 브라우저 데이터를 삭제하면 기록도 사라질 수 있어요.
        </p>
        {storageNoticeVisible && (
          <p role="status" className="text-caption text-text-secondary">
            이 브라우저에서는 저장소를 사용할 수 없어, 페이지를 벗어나면 오늘 결과를 다시
            확인하려면 새로 입력해야 할 수 있어요.
          </p>
        )}

        <p className="text-caption text-text-secondary">
          {authState === "anonymous" ? (
            <>
              카카오로 로그인하면 다음부터 생년월일을 다시 입력하지 않아도 돼요.{" "}
              <Link
                href={`/login?next=${encodeURIComponent("/fortune")}&reason=fortune`}
                className="underline"
              >
                로그인하고 간편하게 보기
              </Link>
            </>
          ) : (
            "온보딩을 마치면 다음부터 생년월일을 다시 입력하지 않아도 돼요."
          )}
        </p>
      </form>

      {flowState === "error" && (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-md border border-danger p-4 text-center">
          <p className="text-body text-text-primary">{errorMessage}</p>
          <Button type="button" variant="secondary" size="md" onClick={handleRetry}>
            다시 시도하기
          </Button>
        </div>
      )}
    </div>
  );
}
