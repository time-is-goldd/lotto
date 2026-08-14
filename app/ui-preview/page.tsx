import type { Metadata } from "next";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Label from "@/components/ui/Label";
import Spinner from "@/components/ui/Spinner";
import Textarea from "@/components/ui/Textarea";

// 개발 확인용 Showcase — 운영 기능과 연결하지 않는다(어디서도 이 경로로 링크하지 않음).
// 검색엔진 색인 대상도 아니다(docs/AI_ENGINEERING_CONSTITUTION.md §12 "개인화/관리자 페이지는
// noindex"와 동일한 취지 — 이 페이지는 내부 도구라 공개 검색 결과에 나올 이유가 없다).
export const metadata: Metadata = {
  title: "UI Preview",
  robots: { index: false, follow: false },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border pb-8">
      <h2 className="text-h2 font-bold text-text-primary">{title}</h2>
      <div className="mt-4 flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

export default function UiPreviewPage() {
  return (
    <div className="flex flex-col gap-8 py-8">
      <h1 className="text-h1 font-bold text-text-primary">UI Component Preview</h1>

      <Section title="Button — variant">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
      </Section>

      <Section title="Button — size">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </Section>

      <Section title="Button — state">
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
        <Button iconLeft={<span aria-hidden>←</span>}>아이콘 좌측</Button>
        <Button iconRight={<span aria-hidden>→</span>}>아이콘 우측</Button>
      </Section>

      <Section title="Badge">
        <Badge variant="default">Default</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="danger">Danger</Badge>
      </Section>

      <Section title="Spinner">
        <Spinner />
      </Section>

      <section className="border-b border-border pb-8">
        <h2 className="text-h2 font-bold text-text-primary">Input / Textarea / Label</h2>
        <div className="mt-4 flex max-w-sm flex-col gap-4">
          <Input id="preview-basic" label="닉네임" placeholder="닉네임을 입력해주세요" />
          <Input
            id="preview-error"
            label="생년월일"
            error="생년월일을 다시 확인해주세요, 예: 1965년 3월 5일"
          />
          <Input id="preview-disabled" label="비활성" disabled defaultValue="수정 불가" />
          <Textarea id="preview-textarea" label="꿈 기록" placeholder="오늘 꾼 꿈을 적어보세요" />
          <Label htmlFor="preview-basic-2">Label 단독 사용 예시</Label>
        </div>
      </section>

      <Section title="Card">
        <Card className="max-w-sm">
          <CardHeader>이번주 당첨 결과</CardHeader>
          <CardContent>3개 일치 — 다음 기회에 다시 도전해보세요.</CardContent>
          <CardFooter>
            <Button size="sm">자세히 보기</Button>
          </CardFooter>
        </Card>
      </Section>

      <section>
        <h2 className="text-h2 font-bold text-text-primary">EmptyState</h2>
        <div className="mt-4">
          <EmptyState
            title="아직 기록이 없어요"
            description="첫 번호를 생성하고 다이어리에 기록해보세요."
            action={<Button size="sm">번호 생성하기</Button>}
          />
        </div>
      </section>
    </div>
  );
}
