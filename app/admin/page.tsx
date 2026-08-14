import Link from "next/link";

import Badge from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { getAdminDashboardStats } from "@/lib/api/admin/dashboard";
import { isAdmin } from "@/lib/auth/isAdmin";

// Phase9-2/9-3/9-6이 실제로 만든 화면만 href를 갖는다 — 아직 없는 라우트로 링크를 걸면
// 클릭 시 404가 되므로 href가 없는 항목은 텍스트로만 안내한다(Phase9-1/9-2/9-3과 동일 원칙).
const MANAGEMENT_LINKS = [
  { title: "회차 관리", description: "당첨번호 입력 + 자동 대조 실행", href: "/admin/draws" },
  { title: "꿈해몽 관리", description: "꿈 콘텐츠 및 추천번호 CRUD", href: "/admin/dreams" },
  { title: "FAQ 관리", description: "자주 묻는 질문 CRUD", href: "/admin/faq" },
  { title: "가이드 관리", description: "이용 가이드 CRUD", href: "/admin/guides" },
] as const;

interface StatCardProps {
  label: string;
  value: number;
  unit: string;
}

// 대시보드 안에서만 7번 반복되는 표시 단위라 components/에 새 공용 컴포넌트를 만들지 않고
// 이 파일 안에 지역 함수로 둔다(과도한 추상화 지양, 기존 Card 컴포넌트만 재사용).
function StatCard({ label, value, unit }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="text-caption font-medium text-text-secondary">{label}</CardHeader>
      <CardContent className="text-h1 font-bold text-text-primary">
        {value.toLocaleString("ko-KR")}
        <span className="ml-1 text-body font-medium text-text-secondary">{unit}</span>
      </CardContent>
    </Card>
  );
}

// Phase9-1 §7-1이 발견한 특성(app/admin/layout.tsx가 notFound()를 던져도 자식 페이지의
// RSC payload 자체는 이미 계산돼 응답에 포함될 수 있음)을 이 페이지부터 실제로 반영한다 —
// layout의 게이트만 믿지 않고 이 페이지 자신도 isAdmin()을 다시 확인한 뒤에만 실제 통계를
// 조회한다. 정상 흐름(관리자)에서는 layout이 이미 통과시킨 뒤라 이 확인이 다시 false가 될
// 일이 없지만, 이 페이지 컴포넌트 함수 자체가 (프레임워크 특성상) 비관리자 요청에서도
// 평가될 가능성에 대비해 실제 통계 조회 이전에 반드시 이 확인을 먼저 통과하게 한다.
export default async function AdminHomePage() {
  const admin = await isAdmin();
  if (!admin) {
    return null;
  }

  const stats = await getAdminDashboardStats();

  return (
    <>
      <h1 className="text-h1 font-bold text-text-primary">관리자 대시보드</h1>

      <section aria-labelledby="dashboard-stats-heading" className="mt-6">
        <h2 id="dashboard-stats-heading" className="sr-only">
          핵심 지표
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="꿈해몽 콘텐츠" value={stats.dreamCount} unit="개" />
          <StatCard label="추천번호 매핑" value={stats.dreamNumberMappingCount} unit="개" />
          <StatCard label="생성된 번호" value={stats.userNumbersCount} unit="건" />
          <StatCard label="당첨 확인 완료" value={stats.checkedUserNumbersCount} unit="건" />
          <StatCard label="당첨 건수" value={stats.winningUserNumbersCount} unit="건" />
          <StatCard label="꿈 기반 번호 생성" value={stats.dreamGeneratedNumbersCount} unit="건" />
          <StatCard label="작성된 꿈 기록" value={stats.dreamJournalEntryCount} unit="건" />
        </div>
      </section>

      <section aria-labelledby="recent-dreams-heading" className="mt-8">
        <h2 id="recent-dreams-heading" className="text-h2 font-bold text-text-primary">
          최근 등록된 꿈해몽
        </h2>
        {stats.recentDreams.length === 0 ? (
          <EmptyState
            title="등록된 꿈이 없어요"
            description="꿈해몽 관리에서 새 꿈을 추가해보세요."
          />
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {stats.recentDreams.map((dream) => (
              <li key={dream.id}>
                <Card className="flex items-center justify-between gap-3">
                  <span className="text-body text-text-primary">{dream.keyword}</span>
                  <span className="text-caption text-text-secondary">
                    {new Date(dream.createdAt).toLocaleDateString("ko-KR")}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="admin-links-heading" className="mt-8">
        <h2 id="admin-links-heading" className="text-h2 font-bold text-text-primary">
          관리 화면
        </h2>
        <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {MANAGEMENT_LINKS.map((section) => {
            const cardBody = (
              <Card className={section.href ? "h-full transition-colors hover:bg-bg-base" : undefined}>
                <CardHeader className="flex items-center justify-between gap-2">
                  {section.title}
                  {!section.href && <Badge>예정</Badge>}
                </CardHeader>
                <CardContent>{section.description}</CardContent>
              </Card>
            );

            return (
              <li key={section.title}>
                {section.href ? (
                  <Link href={section.href} className="block h-full">
                    {cardBody}
                  </Link>
                ) : (
                  cardBody
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
