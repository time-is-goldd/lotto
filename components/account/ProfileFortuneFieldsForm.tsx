"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/ui/Button";

interface ProfileFortuneFieldsFormProps {
  initialGender: "M" | "F" | "N" | null;
  initialBirthTime: string | null; // "HH:MM:SS" 또는 null(DB time 컬럼 그대로)
}

type SubmitState = { status: "idle" | "submitting" } | { status: "error"; message: string };

// claude-code-luck-platform-fortune-domain-followup-prompt.md §11 "내 정보 수정" 보조 행동의
// 실제 목적지. birth_date는 lib/auth/profile.ts의 parseProfileUpdateInput()가 애초에 수정
// 화이트리스트에 넣지 않은 컬럼이라(Decision 3) 여기서도 gender/birth_time만 다룬다 — 새
// 백엔드를 만들지 않고 이미 있는 PUT /api/profile을 그대로 재사용한다.
export default function ProfileFortuneFieldsForm({
  initialGender,
  initialBirthTime,
}: ProfileFortuneFieldsFormProps) {
  const router = useRouter();
  const [gender, setGender] = useState(initialGender ?? "");
  const [birthTime, setBirthTime] = useState(initialBirthTime?.slice(0, 5) ?? "");
  const [state, setState] = useState<SubmitState>({ status: "idle" });
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting" });
    setSaved(false);

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender: gender === "" ? "N" : gender,
          birth_time: birthTime === "" ? null : birthTime,
        }),
      });

      if (response.ok) {
        setState({ status: "idle" });
        setSaved(true);
        router.refresh();
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setState({
        status: "error",
        message: body?.error?.message ?? "저장 중 오류가 발생했습니다.",
      });
    } catch {
      setState({ status: "error", message: "네트워크 연결을 확인하고 다시 시도해주세요." });
    }
  }

  const isSubmitting = state.status === "submitting";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="profile-gender" className="text-body font-medium text-text-primary">
          성별 <span className="text-caption text-text-secondary">(선택)</span>
        </label>
        <select
          id="profile-gender"
          value={gender}
          onChange={(event) => setGender(event.target.value as "M" | "F" | "N" | "")}
          className="rounded-md border border-border bg-bg-base px-3 py-2 text-body text-text-primary"
        >
          <option value="">선택 안 함</option>
          <option value="M">남성</option>
          <option value="F">여성</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="profile-birth-time" className="text-body font-medium text-text-primary">
          태어난 시각 <span className="text-caption text-text-secondary">(선택)</span>
        </label>
        <input
          id="profile-birth-time"
          type="time"
          value={birthTime}
          onChange={(event) => setBirthTime(event.target.value)}
          className="rounded-md border border-border bg-bg-base px-3 py-2 text-body text-text-primary"
        />
      </div>

      {/* §14: "프로필 수정과 오늘 결과 변경의 규칙을 명확히 정한다" — 이미 오늘 결과가
          있다면 조용히 다시 만들지 않고, 이 문구로 언제부터 반영되는지 알려준다. */}
      <p className="text-caption text-text-secondary">
        변경한 정보는 내일 오늘의 행운 결과부터 반영돼요.
      </p>

      {state.status === "error" && (
        <p role="alert" className="text-body text-danger">
          {state.message}
        </p>
      )}
      {saved && !isSubmitting && (
        <p role="status" className="text-body text-text-secondary">
          저장했어요.
        </p>
      )}

      <Button type="submit" variant="primary" size="md" disabled={isSubmitting} loading={isSubmitting}>
        저장
      </Button>
    </form>
  );
}
