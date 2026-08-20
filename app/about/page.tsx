import type { Metadata } from "next";
import Link from "next/link";

import Container from "@/components/layout/Container";
import { SITE_NAME } from "@/lib/constants";

// docs/EXECUTION_PLAN.md Phase10 §3("생성할 파일"에 app/about/page.tsx 명시)과
// docs/SITEMAP.md §1("/about... 기존과 동일") §4(P2 등급)이 이미 확정한 route다. 법률 문서가
// 아니라 서비스 소개이므로 여기서는 실제 구현된 기능만 나열한다 — 아직 코드가 없는 기능
// (친구초대/커뮤니티/쇼핑몰 등)은 언급하지 않는다.
const TITLE = "서비스 소개";
const DESCRIPTION = `${SITE_NAME}이 제공하는 기능과 서비스 성격을 소개합니다.`;
const PATH = "/about";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PATH,
    type: "website",
    // app/faq/page.tsx(Phase10-2)와 동일한 이유로 siteName/locale을 여기서도 다시 채운다 —
    // 페이지가 자신의 openGraph를 정의하면 app/layout.tsx의 전역 값이 필드 단위로 병합되지
    // 않고 완전히 대체되기 때문이다(Phase8-2가 실측으로 발견).
    siteName: SITE_NAME,
    locale: "ko_KR",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function AboutPage() {
  return (
    <Container className="flex flex-col gap-8 py-10">
      <div>
        <h1 className="text-h1 font-bold text-text-primary">{TITLE}</h1>
        <p className="mt-2 text-body text-text-secondary">
          {SITE_NAME}은 로또 번호 생성을 시작으로, 행운과 관련된 기록을 쌓아가는 서비스입니다.
        </p>
      </div>

      <section aria-labelledby="about-features-heading" className="flex flex-col gap-4">
        <h2 id="about-features-heading" className="text-h2 font-bold text-text-primary">
          제공하는 기능
        </h2>
        <ul className="flex flex-col gap-3 text-body leading-relaxed text-text-primary">
          <li>
            <strong className="font-bold">번호 생성</strong> — 버튼을 누르면 1부터 45 사이의
            숫자 6개를 무작위로 뽑아드립니다. 로그인한 경우 생성한 번호가 자동으로 저장됩니다.
          </li>
          <li>
            <strong className="font-bold">꿈해몽</strong> — 꿈 키워드별 해몽 콘텐츠와 그에 연결된
            추천 번호를 확인할 수 있습니다.
          </li>
          <li>
            <strong className="font-bold">오늘의 행운</strong> — 나이 제한 없이 로그인 없이도
            생년월일을 직접 입력해 그날의 금전운·행동 지침·행운 요소·추천 번호를 바로 확인할
            수 있습니다. 비회원 정보와 결과는 이 브라우저에만 임시 저장됩니다. 카카오로
            로그인하면 정보를 여러 기기에 걸쳐 저장해두고 다음부터는 다시 입력하지 않아도
            돼요. 프로필(입력 정보)마다 하루 한 번만 새로 만들어지고, 같은 날에는 언제 다시
            확인해도 같은 결과가 보이며, 다음 날 새로운 결과로 바뀝니다.
          </li>
          <li>
            <strong className="font-bold">행운 다이어리</strong> — 직접 생성하거나 저장한 번호
            기록, 당첨 확인 결과, 개인적으로 남긴 꿈 기록을 한곳에서 모아볼 수 있습니다.
          </li>
          <li>
            <strong className="font-bold">당첨 확인</strong> — 관리자가 입력한 공식 회차 결과와
            저장된 번호를 자동으로 대조해 당첨 여부를 알려드립니다.
          </li>
          <li>
            <strong className="font-bold">FAQ / 가이드</strong> — 서비스 이용에 대해 자주 묻는
            질문과 이용 가이드를 제공합니다.
          </li>
        </ul>
      </section>

      <section aria-labelledby="about-philosophy-heading" className="flex flex-col gap-3">
        <h2 id="about-philosophy-heading" className="text-h2 font-bold text-text-primary">
          서비스 철학
        </h2>
        <p className="text-body leading-relaxed text-text-primary">
          {SITE_NAME}이 만드는 번호는 무작위 추첨이며, 꿈해몽과 추천 번호는 참고와 재미를 위한
          정보입니다. 당첨을 예측하거나 확률을 높여주지 않으며, 실제 복권 구매와 그 결과는
          전적으로 이용자의 판단과 공식 복권 시스템에 따릅니다. 자세한 이용 조건은{" "}
          <Link href="/terms" className="text-primary underline">
            이용약관
          </Link>
          에서 확인할 수 있습니다.
        </p>
      </section>
    </Container>
  );
}
