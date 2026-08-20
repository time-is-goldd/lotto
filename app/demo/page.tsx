import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export const metadata: Metadata = { title: "공개 데모" };

interface DemoLink {
  href: string;
  label: string;
  reviewNote: string;
}

const DEMO_SECTIONS: Array<{ title: string; description: string; links: DemoLink[] }> = [
  {
    title: "오늘의 행운 (/fortune)",
    description: "로그인 회원이 보는 화면 — 버튼을 눌러야 결과가 보이는 흐름을 확인하세요.",
    links: [
      { href: "/demo/fortune?state=ready", label: "보기 전", reviewNote: "결과가 즉시 보이지 않는지" },
      { href: "/demo/fortune?state=revealing", label: "공개 중", reviewNote: "로딩 문구가 과장되지 않았는지" },
      { href: "/demo/fortune?state=result", label: "결과", reviewNote: "카드 레이아웃과 정보량" },
      {
        href: "/demo/fortune?state=repeat",
        label: "같은 날 재확인",
        reviewNote: "다시 계산한 것처럼 보이지 않는지",
      },
    ],
  },
  {
    title: "행운 다이어리 (/my/journal)",
    description: "번호·꿈·운세 기록을 모아 보는 화면입니다.",
    links: [
      { href: "/demo/journal?state=empty", label: "빈 기록", reviewNote: "빈 상태 안내 문구" },
      {
        href: "/demo/journal?state=populated",
        label: "기록 있음",
        reviewNote: "번호/꿈/운세 3개 섹션 레이아웃",
      },
    ],
  },
  {
    title: "당첨확인 (/my/journal/results)",
    description: "저장한 번호와 회차 결과를 비교하는 화면입니다.",
    links: [
      { href: "/demo/results?state=waiting", label: "추첨 전 대기", reviewNote: "대기 상태 문구" },
      { href: "/demo/results?state=no-match", label: "일치 없음", reviewNote: "낙첨 문구 톤" },
      {
        href: "/demo/results?state=partial-match",
        label: "일부 숫자 일치",
        reviewNote: "일치 번호 강조, 데이터 출처·기준 시각 표시",
      },
    ],
  },
];

// claude-code-luck-platform-daily-fortune-number-demo-prompt.md §17/§21: 카카오 로그인을
// 우회하거나 실제 계정을 공유하지 않고, 외부 리뷰어가 인증 이후 화면을 안전하게 검토할 수
// 있게 하는 것이 이 라우트의 유일한 목적이다. 여기서부터 각 상태로 바로 이동할 수 있는
// 링크만 제공한다 — 별도 상태 관리 없이 서버 렌더링 페이지 + 쿼리 파라미터만으로 충분하다.
export default function DemoIndexPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-h1 font-bold text-text-primary">공개 데모</h1>
        <p className="mt-2 text-body text-text-secondary">
          로그인 이후 화면을 실제 계정 없이 검토용 예시 데이터로 확인할 수 있는 페이지입니다.
          아래 링크는 전부 합성(synthetic) 데이터만 사용하며, 실제 Supabase 데이터에 접근하거나
          저장·삭제 같은 동작을 수행하지 않습니다.
        </p>
      </div>

      {DEMO_SECTIONS.map((section) => (
        <Card key={section.title}>
          <CardHeader>{section.title}</CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-body text-text-secondary">{section.description}</p>
            <ul className="flex flex-col gap-2">
              {section.links.map((link) => (
                <li key={link.href} className="flex flex-wrap items-baseline gap-2">
                  <Link href={link.href} className="text-primary underline">
                    {link.label}
                  </Link>
                  <span className="text-caption text-text-secondary">— 확인 포인트: {link.reviewNote}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
