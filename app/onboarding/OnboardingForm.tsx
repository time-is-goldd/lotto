"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PROFILE_NICKNAME_MAX_LENGTH } from "@/lib/constants";

interface OnboardingFormProps {
  defaultNickname: string;
}

// birth_date 형식 검증/나이 계산은 서버(app/api/profile/route.ts → lib/auth/profile.ts)가
// 전담한다 — 이 컴포넌트는 그 로직을 다시 구현하지 않고, HTML5 input 속성(required/max)으로
// "값이 비었는지"/"미래 날짜인지"만 제출 전에 걸러낸다(docs/PHASE2_ONBOARDING_REPORT.md §4).
//
// nickname은 이 Task 지시문상 "선택"이지만, profiles.nickname은 DB(0001_profiles.sql)에서
// NOT NULL이고 기존 lib/auth/profile.ts의 parseProfileCreateInput도 빈 값을 400으로 거부한다
// — 스키마/서비스는 그대로 재사용해야 하므로(Schema 변경·중복구현 금지) 여기서는 required로
// 두고 카카오 닉네임을 기본값으로 미리 채워, 사용자가 보통은 아무것도 새로 입력하지 않아도
// 되게 한다(docs/PHASE2_ONBOARDING_REPORT.md §4 "발견된 문제" 참조).
const TODAY = new Date().toISOString().slice(0, 10);

type SubmitState = { status: "idle" | "submitting" } | { status: "error"; message: string };

export default function OnboardingForm({ defaultNickname }: OnboardingFormProps) {
  const router = useRouter();
  const [nickname, setNickname] = useState(defaultNickname);
  const [birthDate, setBirthDate] = useState("");
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!birthDate) {
      setState({ status: "error", message: "생년월일을 입력해주세요." });
      return;
    }

    setState({ status: "submitting" });

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          birth_date: birthDate,
          nickname: nickname.trim(),
        }),
      });

      // 201(생성 성공) 또는 409(직전 요청이 이미 만들어둔 경우, 중복 생성 아님 —
      // docs/PHASE2_AUTH_DECISION.md Decision 1 idempotent 원칙)는 모두 성공으로 처리한다.
      if (response.ok || response.status === 409) {
        router.push("/");
        return;
      }

      if (response.status === 401) {
        setState({
          status: "error",
          message: "로그인이 만료되었습니다. 다시 로그인해주세요.",
        });
        return;
      }

      if (response.status === 400) {
        const body = await response.json().catch(() => null);
        setState({
          status: "error",
          message: body?.error?.message ?? "입력값을 다시 확인해주세요.",
        });
        return;
      }

      setState({
        status: "error",
        message: "프로필 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      });
    } catch {
      setState({
        status: "error",
        message: "네트워크 연결을 확인하고 다시 시도해주세요.",
      });
    }
  }

  const isSubmitting = state.status === "submitting";

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="birth_date" className="block text-sm font-medium text-neutral-900">
          생년월일 <span className="text-red-500">*</span>
        </label>
        <input
          id="birth_date"
          type="date"
          required
          max={TODAY}
          value={birthDate}
          onChange={(event) => setBirthDate(event.target.value)}
          disabled={isSubmitting}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-base text-neutral-900 disabled:opacity-50"
        />
      </div>

      <div>
        <label htmlFor="nickname" className="block text-sm font-medium text-neutral-900">
          닉네임
        </label>
        <input
          id="nickname"
          type="text"
          required
          maxLength={PROFILE_NICKNAME_MAX_LENGTH}
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          disabled={isSubmitting}
          placeholder="닉네임을 입력해주세요"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-base text-neutral-900 disabled:opacity-50"
        />
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-neutral-900 px-4 py-2 text-base font-medium text-white disabled:opacity-50"
      >
        {isSubmitting ? "처리 중..." : "시작하기"}
      </button>
    </form>
  );
}
