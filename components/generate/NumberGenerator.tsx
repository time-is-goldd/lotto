"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import Button, { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { trackProductEvent } from "@/lib/analytics/trackProductEvent";
import {
  comboOrdinalLabel,
  dailyProgressLabel,
  isDailyLimitReached,
  MAX_DAILY_GENERATIONS,
  nextGenerateCtaLabel,
} from "@/lib/logic/dailyNumberPolicy";
import { buildDreamAwareNumbers } from "@/lib/logic/dreamNumbers";
import { generateNumbers } from "@/lib/logic/generateNumbers";
import {
  appendGuestDailyCombo,
  clearGuestDailyState,
  isUsingGuestMemoryFallback,
  readGuestDailyState,
} from "@/lib/storage/guestDailyNumbersStore";
import { getKstDateString } from "@/lib/utils/kstDate";

import DailyComboRow from "./DailyComboRow";
import {
  buildDailyGeneratePayload,
  buildSaveRequestPayload,
  getRevealDelaysMs,
  getRevealDurationMs,
  toGuestDailyCombo,
  toSaveKey,
  type DailyComboView,
  type DreamContext,
  type GenerateAuthState,
} from "./generatorSaveLogic";

interface NumberGeneratorProps {
  authState: GenerateAuthState;
  // "ready"는 app/generate/page.tsx가 DB에서 오늘(KST) 조회해 내려준 실제 값이다. 비회원/
  // profile-pending은 서버가 localStorage를 볼 수 없어 항상 빈 배열이고, 실제 상태는 마운트
  // 후 클라이언트가 lib/storage/guestDailyNumbersStore.ts에서 읽어 채운다(아래 hydrated 참조).
  initialCombos: DailyComboView[];
  dreamContext?: DreamContext | null;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface GeneratingState {
  slotIndex: number;
  numbers: number[];
  dreamNumbers: number[];
  revealedCount: number;
}

function mapRowsToView(
  rows: Array<{ slot_index: number; numbers: number[]; dream_numbers: number[] | null }>
): DailyComboView[] {
  return rows
    .map((row) => ({
      slotIndex: row.slot_index,
      numbers: row.numbers,
      dreamNumbers: row.dream_numbers ?? [],
    }))
    .sort((a, b) => a.slotIndex - b.slotIndex);
}

// claude-code-luck-platform-home-brand-daily-numbers-prompt.md §9: "오늘의 세 조합" — 하루
// 최대 3개, 직접 진입은 버튼을 눌러야만 생성, 꿈 CTA만 예외적으로 자동 생성한다(§9.3).
// 이전 버전(무제한 "다시 생성하기")과 달리 이 컴포넌트는 이제 "몇 번째 조합을 만드는 중인가"를
// 추적해야 해서 finalNumbers 하나 대신 combos 배열 + generating(진행 중인 한 칸)으로
// 상태를 나눴다.
export default function NumberGenerator({
  authState,
  initialCombos,
  dreamContext,
}: NumberGeneratorProps) {
  const hasDreamSource = Boolean(dreamContext);
  const isMember = authState === "ready";

  const [combos, setCombos] = useState<DailyComboView[]>(initialCombos);
  // 회원은 서버가 이미 오늘의 진짜 상태를 내려줬으니 즉시 hydrated. 비회원/profile-pending은
  // localStorage를 읽는 effect가 끝나야 진짜 상태를 안다 — 그 전에는 "첫 조합 만들기" 같은
  // 잘못된 CTA가 잠깐 보였다 사라지는 깜빡임을 막기 위해 로딩 상태로 렌더링한다.
  const [hydrated, setHydrated] = useState(isMember);
  const [generating, setGenerating] = useState<GeneratingState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<Record<number, SaveStatus>>({});
  const [usingMemoryFallback, setUsingMemoryFallback] = useState(false);

  const autoTriggeredRef = useRef(false);
  const reduceMotionRef = useRef(false);
  const timeoutIdsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const savedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    trackProductEvent("generate_page_viewed", { source: hasDreamSource ? "dream" : "direct" });
    reduceMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach((id) => clearTimeout(id));
      timeoutIdsRef.current = [];
    };
  }, []);

  // 비회원/profile-pending: localStorage에서 오늘(KST) 상태를 읽어 hydrate한다(§9.6 "같은 날
  // 재방문하면 저장된 조합과 0~3 남은 횟수를 복원한다"). setState 호출을
  // requestAnimationFrame 콜백 안에서 하는 것은 이 프로젝트 eslint 설정
  // (react-hooks/set-state-in-effect)을 지키기 위함이다(components/generate/NumberGenerator.tsx의
  // 기존 관례 그대로 유지).
  useEffect(() => {
    if (isMember) {
      return;
    }
    const today = getKstDateString();
    const state = readGuestDailyState(today);
    const rafId = requestAnimationFrame(() => {
      setCombos(
        state.combos.map((combo, index) => ({
          slotIndex: index + 1,
          numbers: combo.numbers,
          dreamNumbers: combo.dreamNumbers,
        }))
      );
      setUsingMemoryFallback(isUsingGuestMemoryFallback());
      setHydrated(true);
    });
    return () => cancelAnimationFrame(rafId);
  }, [isMember]);

  // §9.7 비회원 → 로그인 전환 시 guest 조합을 회원 기록으로 병합한다. 실패(네트워크 오류 등)
  // 시에는 guest 상태를 지우지 않는다 — "안전하게 병합할 수 없다면 조용히 잘못 병합하지 말고
  // guest 조합을 브라우저에서 계속 보여준다"(§9.7)는 지시를 그대로 따른다.
  useEffect(() => {
    if (!isMember) {
      return;
    }
    const today = getKstDateString();
    const guestState = readGuestDailyState(today);
    if (guestState.combos.length === 0) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/numbers/daily/reconcile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ combos: guestState.combos }),
        });
        if (!response.ok || cancelled) {
          return;
        }
        const refreshed = await fetch("/api/numbers/daily");
        if (refreshed.ok && !cancelled) {
          const body = (await refreshed.json()) as {
            data: { combos: Array<{ slot_index: number; numbers: number[]; dream_numbers: number[] | null }> };
          };
          setCombos(mapRowsToView(body.data.combos));
        }
        clearGuestDailyState();
      } catch {
        // 조용히 무시 — guest 상태는 그대로 남아 다음 방문에서도 브라우저에 계속 보인다.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isMember]);

  async function persistCombo(slotIndex: number, numbers: number[], dreamNumbers: number[]) {
    setErrorMessage(null);

    if (isMember) {
      try {
        const response = await fetch("/api/numbers/daily", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildDailyGeneratePayload(numbers, dreamNumbers, dreamContext)),
        });

        if (response.status === 409) {
          // 다른 탭에서 먼저 한도를 채운 경쟁 상황 — 서버 상태로 다시 동기화한다.
          const resync = await fetch("/api/numbers/daily");
          if (resync.ok) {
            const body = (await resync.json()) as {
              data: { combos: Array<{ slot_index: number; numbers: number[]; dream_numbers: number[] | null }> };
            };
            setCombos(mapRowsToView(body.data.combos));
          }
          setGenerating(null);
          trackProductEvent("numbers_limit_reached", {
            source: dreamContext ? "dream" : "general",
            auth_state: authState,
          });
          return;
        }

        if (!response.ok) {
          setErrorMessage("번호를 만들지 못했어요. 다시 시도해주세요.");
          setGenerating(null);
          return;
        }

        const body = (await response.json()) as {
          data: { slot_index: number; numbers: number[]; dream_numbers: number[] | null };
        };
        setCombos((prev) => [
          ...prev,
          {
            slotIndex: body.data.slot_index,
            numbers: body.data.numbers,
            dreamNumbers: body.data.dream_numbers ?? [],
          },
        ]);
      } catch {
        setErrorMessage("번호를 만들지 못했어요. 다시 시도해주세요.");
        setGenerating(null);
        return;
      }
    } else {
      const today = getKstDateString();
      const combo = toGuestDailyCombo(numbers, dreamNumbers, dreamContext, new Date().toISOString());
      const nextState = appendGuestDailyCombo(today, combo);
      setUsingMemoryFallback(isUsingGuestMemoryFallback());
      setCombos(
        nextState.combos.map((c, index) => ({
          slotIndex: index + 1,
          numbers: c.numbers,
          dreamNumbers: c.dreamNumbers,
        }))
      );
    }

    setGenerating(null);
    trackProductEvent("numbers_generated", {
      source: dreamContext ? "dream" : "general",
      dream_number_count: dreamNumbers.length,
    });
    if (slotIndex >= MAX_DAILY_GENERATIONS) {
      trackProductEvent("numbers_limit_reached", {
        source: dreamContext ? "dream" : "general",
        auth_state: authState,
      });
    }
  }

  function handleGenerate() {
    if (generating || isDailyLimitReached(combos.length)) {
      return;
    }

    const slotIndex = combos.length + 1;
    const { numbers, dreamNumbers } =
      dreamContext && dreamContext.dreamNumbers.length > 0
        ? buildDreamAwareNumbers(dreamContext.dreamNumbers)
        : { numbers: generateNumbers(), dreamNumbers: [] as number[] };

    trackProductEvent("numbers_generation_started", {
      source: dreamContext ? "dream" : "general",
      auth_state: authState,
      slot_index: slotIndex,
    });

    if (reduceMotionRef.current) {
      setGenerating({ slotIndex, numbers, dreamNumbers, revealedCount: numbers.length });
      void persistCombo(slotIndex, numbers, dreamNumbers);
      return;
    }

    setGenerating({ slotIndex, numbers, dreamNumbers, revealedCount: 0 });

    getRevealDelaysMs(numbers.length).forEach((delay, index) => {
      const id = setTimeout(() => {
        setGenerating((current) =>
          current && current.slotIndex === slotIndex ? { ...current, revealedCount: index + 1 } : current
        );
      }, delay);
      timeoutIdsRef.current.push(id);
    });

    const doneId = setTimeout(() => {
      void persistCombo(slotIndex, numbers, dreamNumbers);
    }, getRevealDurationMs());
    timeoutIdsRef.current.push(doneId);
  }

  // §9.3: 꿈 상세 페이지의 명시적 CTA로 들어온 경우에만 자동 생성한다. hydrated 이전에는
  // 아직 guest의 진짜 조합 개수를 몰라 실행하지 않는다(회원은 hydrated가 처음부터 true라
  // 즉시 실행된다 — 기존 동작과 동일).
  useEffect(() => {
    if (!hydrated || autoTriggeredRef.current) {
      return;
    }
    autoTriggeredRef.current = true;
    if (hasDreamSource && combos.length < MAX_DAILY_GENERATIONS) {
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  async function handleSaveCombo(combo: DailyComboView) {
    const key = toSaveKey(combo.numbers);
    if (savedKeysRef.current.has(key)) {
      return;
    }

    trackProductEvent("save_number_clicked", {
      authenticated: true,
      source: combo.dreamNumbers.length > 0 ? "dream" : "general",
    });

    setSaveStatus((prev) => ({ ...prev, [combo.slotIndex]: "saving" }));
    try {
      const saveDreamContext =
        combo.dreamNumbers.length > 0 && dreamContext ? dreamContext : null;
      const response = await fetch("/api/numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSaveRequestPayload(combo.numbers, saveDreamContext)),
      });
      if (response.ok) {
        savedKeysRef.current.add(key);
        setSaveStatus((prev) => ({ ...prev, [combo.slotIndex]: "saved" }));
      } else {
        setSaveStatus((prev) => ({ ...prev, [combo.slotIndex]: "error" }));
      }
    } catch {
      setSaveStatus((prev) => ({ ...prev, [combo.slotIndex]: "error" }));
    }
  }

  if (!hydrated) {
    return (
      <div className="flex flex-col items-center gap-6">
        <ol aria-hidden="true" className="flex flex-wrap justify-center gap-2 md:gap-3">
          {Array.from({ length: 6 }, (_, index) => (
            <li
              key={index}
              className="h-10 w-10 rounded-full border-2 border-border bg-bg-subtle opacity-60 md:h-12 md:w-12"
            />
          ))}
        </ol>
        <p className="text-body text-text-secondary">불러오는 중…</p>
      </div>
    );
  }

  const limitReached = isDailyLimitReached(combos.length);
  const ctaLabel = nextGenerateCtaLabel(combos.length);
  const hasAnyDreamNumbers =
    combos.some((combo) => combo.dreamNumbers.length > 0) || (generating?.dreamNumbers.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-body font-medium text-text-primary">
          {dailyProgressLabel(combos.length)}
        </p>
        {!limitReached && ctaLabel && (
          <Button type="button" variant="primary" size="lg" disabled={Boolean(generating)} onClick={handleGenerate}>
            {generating ? "만드는 중…" : ctaLabel}
          </Button>
        )}
      </div>

      {hasDreamSource && dreamContext!.dreamNumbers.length > 0 && (
        <p className="text-body text-text-secondary">
          &ldquo;{dreamContext!.keyword}&rdquo; 꿈 페이지에 연결된 재미용 숫자를 먼저 담고, 나머지는
          1~45에서 무작위로 채웠어요.
        </p>
      )}

      {errorMessage && (
        <p role="alert" className="text-body text-danger">
          {errorMessage}
        </p>
      )}

      {limitReached && (
        <p role="status" className="text-body text-text-secondary">
          오늘의 세 조합을 모두 만들었어요. 내일 0시에 다시 만들 수 있어요.
        </p>
      )}

      {combos.length === 0 && !generating && (
        <ol aria-hidden="true" className="flex flex-wrap gap-2 md:gap-3">
          {Array.from({ length: 6 }, (_, index) => (
            <li
              key={index}
              className="h-10 w-10 rounded-full border-2 border-border bg-bg-subtle opacity-60 md:h-12 md:w-12"
            />
          ))}
        </ol>
      )}

      <div>
        {combos.map((combo, index) => (
          <div key={combo.slotIndex}>
            <DailyComboRow
              label={comboOrdinalLabel(combo.slotIndex)}
              numbers={combo.numbers}
              dreamNumbers={combo.dreamNumbers}
              revealedCount={combo.numbers.length}
              isFirst={index === 0}
            />
            {isMember && (
              <div className="flex items-center gap-2 pb-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saveStatus[combo.slotIndex] === "saving"}
                  onClick={() => handleSaveCombo(combo)}
                >
                  {saveStatus[combo.slotIndex] === "saved" ? "다이어리에 저장됨" : "다이어리에 저장"}
                </Button>
                {saveStatus[combo.slotIndex] === "error" && (
                  <span className="text-caption text-danger">저장하지 못했어요. 다시 시도해주세요.</span>
                )}
              </div>
            )}
          </div>
        ))}
        {generating && (
          <DailyComboRow
            label={comboOrdinalLabel(generating.slotIndex)}
            numbers={generating.numbers}
            dreamNumbers={generating.dreamNumbers}
            revealedCount={generating.revealedCount}
            isFirst={combos.length === 0}
          />
        )}
      </div>

      {hasAnyDreamNumbers && (
        <p className="flex items-center gap-4 text-caption text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 w-3 rounded-full bg-accent-gold" />
            꿈 숫자
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 w-3 rounded-full border-2 border-border bg-bg-surface" />
            일반 숫자
          </span>
        </p>
      )}

      {usingMemoryFallback && (
        <p className="text-caption text-text-secondary">
          이 브라우저에서는 오늘의 조합이 새로고침하면 사라질 수 있어요.
        </p>
      )}

      {combos.length > 0 && !generating && authState === "anonymous" && (
        <Card className="flex flex-col items-center gap-3 text-center">
          <p className="text-body font-bold text-text-primary">이 번호를 저장해둘까요?</p>
          <p className="text-body text-text-secondary">
            로그인하면 번호를 보관하고, 토요일 추첨 결과와 비교할 수 있어요.
          </p>
          <Link
            href="/login?next=%2Fgenerate&reason=save-number"
            onClick={() =>
              trackProductEvent("save_number_clicked", {
                authenticated: false,
                source: dreamContext ? "dream" : "general",
              })
            }
            className={buttonClassName("primary", "md")}
          >
            카카오로 번호 저장하기
          </Link>
        </Card>
      )}

      {combos.length > 0 && !generating && authState === "profile-pending" && (
        <Card className="flex flex-col items-center gap-3 text-center">
          <p className="text-body font-bold text-text-primary">이 번호를 저장해둘까요?</p>
          <p className="text-body text-text-secondary">
            온보딩을 마치면 번호를 보관하고, 토요일 추첨 결과와 비교할 수 있어요.
          </p>
          <Link href="/onboarding" className={buttonClassName("primary", "md")}>
            온보딩 계속하기
          </Link>
        </Card>
      )}
    </div>
  );
}
