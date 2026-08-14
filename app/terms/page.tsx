import type { Metadata } from "next";
import Link from "next/link";

import Container from "@/components/layout/Container";
import { PROFILE_MIN_AGE, SITE_NAME } from "@/lib/constants";

// docs/EXECUTION_PLAN.md Phase10 §3/§5(법적 최소 요건, ROADMAP MVP Must)와
// docs/ROADMAP.md §1("이용약관/개인정보처리방침/19세 미만 이용제한 고지 | 법적 최소 요건")이
// 확정한 route다. 내용은 실제 코드에 존재하는 기능만 근거로 작성했다 — 아직 구현되지 않은
// 기능(자동 탈퇴 처리, 커뮤니티, 결제 등)은 존재하는 것처럼 서술하지 않는다
// (docs/PHASE10_LEGAL_PAGES_REPORT.md §8 근거 참조).
const TITLE = "이용약관";
const DESCRIPTION = `${SITE_NAME} 이용약관입니다. 서비스 이용 전 반드시 확인해주세요.`;
const PATH = "/terms";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PATH,
    type: "website",
    siteName: SITE_NAME,
    locale: "ko_KR",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function TermsPage() {
  return (
    <Container className="flex flex-col gap-8 py-10">
      <div>
        <h1 className="text-h1 font-bold text-text-primary">{TITLE}</h1>
        <p className="mt-2 text-body text-text-secondary">
          이 약관은 {SITE_NAME}(이하 &ldquo;서비스&rdquo;)의 이용 조건과 이용자·서비스 제공자의
          권리·의무를 정합니다.
        </p>
      </div>

      <div className="flex max-w-[720px] flex-col gap-8 text-body leading-relaxed text-text-primary">
        <section aria-labelledby="terms-purpose-heading" className="flex flex-col gap-2">
          <h2 id="terms-purpose-heading" className="text-h2 font-bold text-text-primary">
            1. 목적
          </h2>
          <p>
            이 약관은 {SITE_NAME}이 제공하는 로또 번호 생성, 꿈해몽, 행운 다이어리, 당첨 확인 등의
            서비스(이하 &ldquo;서비스&rdquo;) 이용과 관련해 서비스와 이용자 사이의 조건을 정하는
            것을 목적으로 합니다.
          </p>
        </section>

        <section aria-labelledby="terms-membership-heading" className="flex flex-col gap-2">
          <h2 id="terms-membership-heading" className="text-h2 font-bold text-text-primary">
            2. 회원가입 및 이용 자격
          </h2>
          <p>
            서비스는 카카오 계정을 통한 로그인으로 회원가입이 진행됩니다. 만 {PROFILE_MIN_AGE}세
            미만은 서비스를 이용할 수 없으며, 가입 시 입력한 생년월일을 기준으로 이용 자격을
            확인합니다.
          </p>
        </section>

        <section aria-labelledby="terms-provision-heading" className="flex flex-col gap-2">
          <h2 id="terms-provision-heading" className="text-h2 font-bold text-text-primary">
            3. 서비스의 제공 및 변경
          </h2>
          <p>
            서비스는 운영상·기술상 필요에 따라 제공하는 기능의 전부 또는 일부를 변경하거나
            중단할 수 있습니다. 서비스는 무료로 제공되며, 안정적인 운영을 위해 노력하지만
            서비스 중단이 없음을 보장하지는 않습니다.
          </p>
        </section>

        <section aria-labelledby="terms-obligations-heading" className="flex flex-col gap-2">
          <h2 id="terms-obligations-heading" className="text-h2 font-bold text-text-primary">
            4. 이용자의 의무
          </h2>
          <p>이용자는 서비스를 이용하면서 다음 행위를 해서는 안 됩니다.</p>
          <ul className="list-disc pl-6">
            <li>타인의 계정을 도용하거나 부정한 방법으로 서비스를 이용하는 행위</li>
            <li>서비스의 정상적인 운영을 방해하는 행위</li>
            <li>서비스를 통해 얻은 정보를 무단으로 복제·배포·상업적으로 이용하는 행위</li>
            <li>관련 법령 또는 공서양속에 위반되는 행위</li>
          </ul>
        </section>

        <section aria-labelledby="terms-content-heading" className="flex flex-col gap-2">
          <h2 id="terms-content-heading" className="text-h2 font-bold text-text-primary">
            5. 이용자가 남긴 기록
          </h2>
          <p>
            행운 다이어리에서 이용자가 직접 작성하는 꿈 기록, 메모 등은 본인의 개인 기록이며
            서비스 운영 목적(서비스 제공·개선) 범위 안에서만 사용됩니다. 이 기록은 본인 외에는
            공개되지 않습니다.
          </p>
        </section>

        <section aria-labelledby="terms-disclaimer-heading" className="flex flex-col gap-2">
          <h2 id="terms-disclaimer-heading" className="text-h2 font-bold text-text-primary">
            6. 번호 생성·꿈해몽·행운 다이어리 서비스의 성격
          </h2>
          <ul className="list-disc pl-6">
            <li>서비스가 생성하는 번호는 무작위(랜덤) 추출 결과이며, 로또 당첨을 보장하지 않습니다.</li>
            <li>
              꿈해몽 콘텐츠와 추천 번호, 행운 다이어리의 기록·통계는 참고와 오락을 위한 정보로,
              당첨 확률이나 결과를 예측하지 않습니다.
            </li>
            <li>
              실제 복권 구매 여부와 그 결과는 전적으로 이용자 본인의 판단과 책임이며, 공식적인
              당첨 결과는 복권 발행 기관(동행복권 등)의 발표를 기준으로 합니다.
            </li>
            <li>
              {SITE_NAME}은 복권을 판매하거나 발행하지 않으며, 공식 복권 사업자와 관계가 없습니다.
            </li>
          </ul>
        </section>

        <section aria-labelledby="terms-suspension-heading" className="flex flex-col gap-2">
          <h2 id="terms-suspension-heading" className="text-h2 font-bold text-text-primary">
            7. 서비스 중단 및 이용계약 해지
          </h2>
          <p>
            이용자는 언제든지 서비스 이용을 중단할 수 있습니다. 서비스 이용과 관련해 수집된
            개인정보의 처리 방식은{" "}
            <Link href="/privacy" className="text-primary underline">
              개인정보처리방침
            </Link>
            을 따릅니다.
          </p>
        </section>

        <section aria-labelledby="terms-liability-heading" className="flex flex-col gap-2">
          <h2 id="terms-liability-heading" className="text-h2 font-bold text-text-primary">
            8. 책임의 제한
          </h2>
          <p>
            서비스는 현재 제공되는 상태 그대로 제공되며, 서비스가 제공하는 정보(꿈해몽, 추천
            번호, 통계 등)의 완전성이나 정확성을 보장하지 않습니다. 서비스는 무료로 제공되는
            정보성 서비스이며, 이용자가 서비스를 이용하거나 서비스 정보를 참고해 내린 결정(복권
            구매 등)으로 발생한 결과에 대해 책임을 지지 않습니다.
          </p>
        </section>

        <section aria-labelledby="terms-change-heading" className="flex flex-col gap-2">
          <h2 id="terms-change-heading" className="text-h2 font-bold text-text-primary">
            9. 약관의 변경
          </h2>
          <p>
            이 약관은 서비스 운영상 필요한 경우 개정될 수 있으며, 개정된 약관은 서비스 내 공지를
            통해 안내합니다.
          </p>
        </section>
      </div>
    </Container>
  );
}
