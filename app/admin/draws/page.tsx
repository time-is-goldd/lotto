import type { Metadata } from "next";
import Link from "next/link";

import DrawRegistrationForm from "@/components/admin/DrawRegistrationForm";
import LottoSourceHealthButton from "@/components/admin/LottoSourceHealthButton";
import LottoSyncButton from "@/components/admin/LottoSyncButton";

// app/admin/layout.tsx가 이미 이 경로 전체(/admin/*)의 인증 게이트다 — getCurrentUser()/
// isAdmin()을 여기서 다시 부르지 않는다. 이 페이지 자신은 실제 데이터를 조회하지 않고
// (등록된 회차 목록 등은 이번 Task 범위 밖) 입력 폼만 렌더링하므로, Phase9-1 보고서(§7-1)가
// 지적한 "페이지가 민감한 데이터를 직접 조회하면 layout 게이트만으로 충분하지 않다"는
// 위험이 이 페이지에는 해당하지 않는다.
export const metadata: Metadata = {
  title: "회차 관리",
  robots: { index: false, follow: false },
};

// Phase10-6: Primary(매주 자동 Cron) → Fallback 1(이 페이지의 "공식 당첨번호 동기화" 버튼) →
// Fallback 2(아래 기존 수동 등록 폼, 무수정 유지)의 3단 구조를 그대로 화면 순서에 반영한다
// (지시문 §22). 기존 DrawRegistrationForm은 공식 사이트 구조 변경/장애 시 긴급 fallback으로
// 계속 남겨둔다 — 제거하지 않는다.
export default function AdminDrawsPage() {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin" className="text-body text-text-secondary hover:underline">
        ← 관리자 홈
      </Link>
      <h1 className="text-h1 font-bold text-text-primary">회차 관리</h1>
      <LottoSyncButton />
      <LottoSourceHealthButton />
      <div>
        <h2 className="text-h2 font-bold text-text-primary">수동 등록</h2>
        <p className="mt-1 text-caption text-text-secondary">
          자동 동기화를 쓸 수 없을 때만 사용하세요 — 공식 사이트에서 정확한 값을 확인 후
          입력해주세요.
        </p>
        <div className="mt-3">
          <DrawRegistrationForm />
        </div>
      </div>
    </div>
  );
}
