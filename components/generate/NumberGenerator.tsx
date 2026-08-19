"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { trackProductEvent } from "@/lib/analytics/trackProductEvent";
import { buildDreamAwareNumbers } from "@/lib/logic/dreamNumbers";
import { generateNumbers } from "@/lib/logic/generateNumbers";

import {
  buildSaveRequestPayload,
  canAutoSave,
  getRevealDelaysMs,
  getShuffleDurationMs,
  SHUFFLE_INTERVAL_MS,
  toSaveKey,
  type DreamContext,
  type GenerateAuthState,
} from "./generatorSaveLogic";

interface NumberGeneratorProps {
  authState: GenerateAuthState;
  initialNumbers: number[];
  // Phase7-3: app/dream/[keyword]/page.tsx의 CTA가 붙여주는 선택적 표시용 정보일 뿐이다.
  dreamContext?: DreamContext | null;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

// GENERATE_HOME_UX_FIX Task: 이전 두 번의 구현(단일 rAF → 이중 rAF + 전용 keyframe)이 모두
// CSS transition이 "실제로 트리거되는가"에 기대는 구조였고, 두 번 다 실제 사용자에게는
// 애니메이션이 보이지 않는다는 결과로 이어졌다. "작은 patch를 계속 쌓지 말고 간단하고
// 확실한 state machine으로 교체해도 된다"는 지시에 따라 그 구조를 완전히 버렸다 — 이제는
// 시각적 변화(셔플 tick, 번호 하나씩 공개) 하나하나가 서로 다른 시각에 실행되는 개별
// setInterval/setTimeout이 실제 React state(텍스트 내용 자체 포함)를 바꾸는 방식이다.
// 각 변화가 최소 90ms 이상 떨어진 시점에 실제로 커밋되므로, 브라우저가 두 스타일 변경을
// 한 프레임으로 합쳐버려 전환이 생략되는 문제 자체가 구조적으로 발생할 수 없다 — 화면에
// 보이는 숫자(텍스트 노드)가 매 단계 실제로 다른 값으로 바뀌기 때문에 "애니메이션이
// 있었는지" 여부가 CSS transition의 성공 여부에 의존하지 않는다.
type Stage = "idle" | "rolling" | "revealing" | "done";

// initialNumbers는 app/generate/page.tsx(Server Component)가 이미 서버에서 1회 생성해
// 내려준 값이다 — 여기서 다시 generateNumbers()를 호출해 초기값을 만들지 않는다(SSR과
// 클라이언트 하이드레이션 시점에 각각 다른 난수가 나와 hydration mismatch가 생기는 것을
// 구조적으로 방지, docs/PHASE5_GENERATE_UI_REPORT.md §3).
export default function NumberGenerator({ authState, initialNumbers, dreamContext }: NumberGeneratorProps) {
  // finalNumbers: 실제 저장/공개되는 번호. rollingNumbers: rolling 단계에서만 쓰는 decoy
  // 번호(API/DB에는 절대 전달되지 않는다). revealedCount: revealing 단계에서 몇 번째까지
  // finalNumbers를 "확정 공개"했는지(§D, §E — finalNumbers/displayNumbers 분리).
  const [finalNumbers, setFinalNumbers] = useState<number[]>(initialNumbers);
  const [rollingNumbers, setRollingNumbers] = useState<number[]>(initialNumbers);
  const [revealedCount, setRevealedCount] = useState(initialNumbers.length);
  const [rollTick, setRollTick] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  // stage 기본값 "done"(전부 공개된 상태) — 서버 렌더링과 첫 하이드레이션 렌더가 항상 동일한
  // 결과를 그리도록 한다(hydration mismatch 방지). 실제 연출은 마운트 이후에만 시작한다.
  const [stage, setStage] = useState<Stage>("done");

  const savedKeyRef = useRef<string | null>(null);
  const trackedKeyRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const reduceMotionRef = useRef(false);
  const rollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutIdsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  // 로그인 + profile 있음 상태에서만, 그리고 "이 finalNumbers 값에 대해 아직 저장을 시도한
  // 적이 없을 때만" 저장을 시도한다(중복 저장 방지). finalNumbers가 바뀌는 시점(=버튼 클릭
  // 시점, 애니메이션 이전)에 그대로 반응한다 — "언제 저장 요청을 보내는가"는 애니메이션
  // 방식이 바뀌어도 1비트도 다르지 않다(§F "기존 저장 계약 절대 유지").
  useEffect(() => {
    if (!canAutoSave(authState)) {
      return;
    }

    const key = toSaveKey(finalNumbers);
    if (savedKeyRef.current === key) {
      return;
    }
    savedKeyRef.current = key;

    const requestId = ++requestIdRef.current;
    setSaveStatus("saving");

    fetch("/api/numbers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSaveRequestPayload(finalNumbers, dreamContext)),
    })
      .then((response) => {
        if (requestIdRef.current !== requestId) {
          return;
        }
        setSaveStatus(response.ok ? "saved" : "error");
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) {
          return;
        }
        setSaveStatus("error");
      });
  }, [finalNumbers, authState, dreamContext]);

  // §20 numbers_generated — "view와 success를 혼동하지 마라"는 저장 성공(위 useEffect,
  // number_saved는 서버가 실제로 쏜다)과는 별개 이벤트라 별도 effect·별도 dedupe 키
  // (trackedKeyRef)로 분리했다. 로그인 여부와 무관하게(비회원도 번호는 만든다) 항상 기록한다.
  useEffect(() => {
    const key = toSaveKey(finalNumbers);
    if (trackedKeyRef.current === key) {
      return;
    }
    trackedKeyRef.current = key;

    trackProductEvent("numbers_generated", {
      source: dreamContext ? "dream" : "general",
      dream_number_count: dreamContext?.dreamNumbers.length ?? 0,
    });
  }, [finalNumbers, dreamContext]);

  function clearAllTimers() {
    if (rollIntervalRef.current) {
      clearInterval(rollIntervalRef.current);
      rollIntervalRef.current = null;
    }
    timeoutIdsRef.current.forEach((id) => clearTimeout(id));
    timeoutIdsRef.current = [];
  }

  // rolling(§C: decoy 숫자가 SHUFFLE_INTERVAL_MS마다 실제로 바뀜) → revealing(§D:
  // resultNumbers를 인덱스별로 서로 다른 시각에 하나씩 확정 공개) 순서로 재생한다. decoy
  // 숫자는 generateNumbers()를 그대로 재사용한다(새 난수 로직 없음, 번호 생성 알고리즘
  // 자체는 무수정). resultNumbers는 파라미터로 직접 받는다 — state를 클로저로 읽지 않아
  // stale closure 걱정 없이 항상 "지금 이 재생에서 공개해야 할 값"이 명확하다.
  function playAnimation(isFirst: boolean, resultNumbers: number[]) {
    setStage("rolling");
    setRevealedCount(0);

    rollIntervalRef.current = setInterval(() => {
      setRollingNumbers(generateNumbers());
      setRollTick((tick) => tick + 1);
    }, SHUFFLE_INTERVAL_MS);

    const rollingDoneId = setTimeout(() => {
      if (rollIntervalRef.current) {
        clearInterval(rollIntervalRef.current);
        rollIntervalRef.current = null;
      }
      setStage("revealing");

      // 6개 공을 각각 서로 다른 시각(getRevealDelaysMs — 순수 함수, 단위 테스트로 간격
      // 검증됨)에 확정한다 — 마지막 공이 확정되는 순간 stage를 done으로 되돌려 재생성
      // 버튼을 다시 활성화한다(§G).
      getRevealDelaysMs(resultNumbers.length).forEach((delay, index) => {
        const revealId = setTimeout(() => {
          setRevealedCount(index + 1);
          if (index === resultNumbers.length - 1) {
            setStage("done");
          }
        }, delay);
        timeoutIdsRef.current.push(revealId);
      });
    }, getShuffleDurationMs(isFirst));

    timeoutIdsRef.current.push(rollingDoneId);
  }

  // 마운트 시 1회: prefers-reduced-motion이면 연출을 아예 재생하지 않는다(이미 "done" 기본값
  // 그대로 유지). 아니면 첫 생성 연출을 시작한다. setState 호출을 requestAnimationFrame
  // 콜백 안에서 하는 것은 이 프로젝트 eslint 설정(react-hooks/set-state-in-effect)을 지키기
  // 위함이다(기존 관례 그대로 유지).
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotionRef.current = mediaQuery.matches;
    if (mediaQuery.matches) {
      return;
    }
    const rafId = requestAnimationFrame(() => playAnimation(true, initialNumbers));
    return () => {
      cancelAnimationFrame(rafId);
      clearAllTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 연출 재생 중에는 재생성을 막는다(§G "중복 클릭 방지") — 버튼 자체도 disabled로 막지만,
  // 이벤트 핸들러 레벨에서도 한 번 더 확인한다. generateNumbers()는 여기서 정확히 한 번만
  // 호출되고 그 결과가 finalNumbers로 저장된다 — rolling 단계의 decoy 숫자는 별도로
  // 여러 번 생성되지만 그 값들은 rollingNumbers에만 머물고 finalNumbers/API에는 절대
  // 전달되지 않는다(§E/§F).
  // claude-code-luck-platform-launch-prompt.md §12: "같은 꿈에서 매번 꿈 숫자까지 전부 바뀌지
  // 않게 하고, 무작위로 채우는 부분만 다시 생성되게 해라." dreamContext.dreamNumbers가 있으면
  // buildDreamAwareNumbers()가 그 고정 부분집합은 그대로 두고 나머지 슬롯만 새로 뽑는다 —
  // 일반 생성(dreamNumbers 없음)은 기존과 똑같이 generateNumbers()로 완전 무작위다.
  function handleRegenerate() {
    if (stage !== "done") {
      return;
    }

    const next =
      dreamContext && dreamContext.dreamNumbers.length > 0
        ? buildDreamAwareNumbers(dreamContext.dreamNumbers).numbers
        : generateNumbers();
    setFinalNumbers(next);

    if (reduceMotionRef.current) {
      setRevealedCount(next.length);
      setStage("done");
      return;
    }
    playAnimation(false, next);
  }

  const numbersToRender = stage === "rolling" ? rollingNumbers : finalNumbers;
  const isRollPulsed = rollTick % 2 === 1;
  // §12 "꿈 숫자가 하나도 없으면... 꿈과 연결된 숫자라고 표현하지 않는다" — dreamContext가
  // 있어도(=CTA로 넘어온 dream/situation 자체는 유효) 그 꿈에 저장된 숫자가 하나도 없으면
  // hasDreamNumbers는 false이고, 아래 문구/강조색을 전부 숨긴 채 완전한 일반 생성으로 보인다.
  const hasDreamNumbers = Boolean(dreamContext && dreamContext.dreamNumbers.length > 0);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* 꿈 기반 생성임을 화면에 표시한다(docs/PHASE7_DREAM_NUMBER_INTEGRATION_REPORT.md §7,
          claude-code-luck-platform-launch-prompt.md §12). 연출 단계와 무관하게 항상 보인다
          (맥락 정보라 결과 완성 여부에 좌우되지 않는다). */}
      {dreamContext && hasDreamNumbers && (
        <p className="text-body text-text-secondary">
          &ldquo;{dreamContext.keyword}&rdquo; 꿈 페이지에 연결된 재미용 숫자를 먼저 담고, 나머지는
          1~45에서 무작위로 채웠어요.
        </p>
      )}

      {/* 과장 없는 짧은 상태 문구. aria-live로 스크린리더에도 단계 전환을 알린다. min-h로
          문구가 나타났다 사라졌다 할 때 레이아웃이 흔들리지 않게 한다. */}
      <p aria-live="polite" className="min-h-[1.5em] text-body text-text-secondary">
        {stage === "rolling" && "행운 번호를 섞고 있어요"}
        {stage === "revealing" && "번호를 하나씩 확인하고 있어요"}
        {stage === "done" && "행운 번호가 완성됐어요."}
      </p>

      {/* rolling/revealing 중에는 스크린리더에 노출하지 않는다(aria-hidden) — 위 aria-live
          문구가 단계를 대신 전달한다. index를 key로 쓰는 것은 의도적이다 — 6칸 고정 위치
          그리드에서 같은 DOM 노드를 재사용해야 opacity/scale CSS 전환이 그 자리에서
          자연스럽게 이어진다(값을 key로 쓰면 매 tick/공개마다 노드가 갈아치워져 전환
          효과 자체가 사라진다). */}
      <ol
        aria-label="생성된 번호"
        aria-hidden={stage !== "done"}
        className="flex flex-wrap justify-center gap-3"
      >
        {numbersToRender.map((n, index) => {
          const isPending = stage === "revealing" && index >= revealedCount;
          const isPulsed = stage === "rolling" && isRollPulsed;
          // rolling 단계의 n은 decoy 숫자라 dreamNumbers와 우연히 겹쳐도 의미가 없다 — done일
          // 때만(실제 finalNumbers가 화면에 있을 때만) 꿈 숫자 강조색을 적용한다.
          const isDreamNumber =
            stage === "done" && hasDreamNumbers && dreamContext!.dreamNumbers.includes(n);

          return (
            <li
              key={index}
              aria-label={isDreamNumber ? `꿈 숫자 ${n}` : undefined}
              className={`flex h-12 w-12 items-center justify-center rounded-full text-button font-bold transition-all duration-200 ease-out ${
                isPending
                  ? "scale-90 border-2 border-border bg-bg-subtle text-text-secondary opacity-70"
                  : isDreamNumber
                    ? "scale-100 bg-accent-gold text-text-primary opacity-100"
                    : isPulsed
                      ? "scale-110 bg-primary text-white opacity-90"
                      : "scale-100 bg-primary text-white opacity-100"
              }`}
            >
              {isPending ? "?" : n}
            </li>
          );
        })}
      </ol>

      {/* §12 "숫자는 UI에서 라벨 또는 시각적 범례로 구분한다" — 색만으로 구분하면 색맹 사용자가
          놓칠 수 있어 텍스트 범례를 함께 둔다. done 단계 + 꿈 숫자가 실제로 있을 때만 보인다. */}
      {stage === "done" && hasDreamNumbers && (
        <p className="flex items-center gap-4 text-caption text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 w-3 rounded-full bg-accent-gold" />
            꿈 숫자
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 w-3 rounded-full bg-primary" />
            무작위 숫자
          </span>
        </p>
      )}

      {/* 지시문 §A-3(Phase5): 현재 이 화면에 실제로 존재하는 유일한 행동은 "다시
          생성하기"뿐이다 — 저장은 로그인 사용자에게 이미 자동으로 이루어지고(위 useEffect,
          버튼 없음) 공유 기능은 없다. Button 컴포넌트로 disabled 시각 상태를 그대로 얻는다. */}
      <Button
        type="button"
        variant="secondary"
        size="md"
        disabled={stage !== "done"}
        onClick={handleRegenerate}
      >
        다시 생성하기
      </Button>

      {/* 연출이 끝난 뒤(stage === "done")에만 보조 문구를 보여준다 — 번호가 하나씩 나타나는
          동안 아래 문구까지 함께 흔들리며 나타나는 산만함을 줄인다. 저장 상태(saveStatus)
          자체의 계산/요청 타이밍은 전혀 바뀌지 않았다. */}
      {stage === "done" && authState === "ready" && saveStatus !== "idle" && (
        <p role="status" className="flex items-center gap-2 text-body text-text-secondary">
          {saveStatus === "saving" && (
            <>
              <Spinner className="h-4 w-4" />
              <span>다이어리에 저장하고 있어요...</span>
            </>
          )}
          {saveStatus === "saved" && <span>다이어리에 저장했어요.</span>}
          {saveStatus === "error" && <span>저장하지 못했어요. 다시 생성하면 다시 시도해요.</span>}
        </p>
      )}

      {stage === "done" && authState === "anonymous" && (
        <p className="text-body text-text-secondary">
          <Link
            href="/login?next=%2Fgenerate&reason=save-number"
            className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            로그인
          </Link>
          하면 생성한 번호가 다이어리에 자동으로 기록돼요.
        </p>
      )}

      {stage === "done" && authState === "profile-pending" && (
        <p className="text-body text-text-secondary">
          <Link
            href="/onboarding"
            className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            온보딩을 마치면
          </Link>
          생성한 번호가 다이어리에 자동으로 기록돼요.
        </p>
      )}
    </div>
  );
}
