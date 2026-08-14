import type { Metadata } from "next";

import Container from "@/components/layout/Container";
import { SITE_NAME } from "@/lib/constants";

// docs/EXECUTION_PLAN.md Phase10 §3/§5/§6(법적 최소 요건, ROADMAP MVP Must)이 확정한 route다.
// 내용은 실제 schema(supabase/migrations/*.sql)와 실제 코드(lib/auth/kakao.ts, lib/auth/profile.ts,
// lib/api/numbers.ts, lib/api/notifications.ts 등)를 근거로만 작성했다 — 코드로 확인되지 않는
// 보관기간·삭제 절차·제3자 미제공 같은 단정적 문구는 쓰지 않는다. 실제 운영자 성명/사업자
// 정보/연락처는 저장소 어디에도 존재하지 않아(전수 확인) 임의로 채우지 않았다 — 해당 항목은
// docs/PHASE10_LEGAL_PAGES_REPORT.md §14 "Before Launch Required Information"으로 별도 보고했다.
const TITLE = "개인정보처리방침";
const DESCRIPTION = `${SITE_NAME}이 처리하는 개인정보 항목과 이용 목적을 안내합니다.`;
const PATH = "/privacy";

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

export default function PrivacyPage() {
  return (
    <Container className="flex flex-col gap-8 py-10">
      <div>
        <h1 className="text-h1 font-bold text-text-primary">{TITLE}</h1>
        <p className="mt-2 text-body text-text-secondary">
          {SITE_NAME}(이하 &ldquo;서비스&rdquo;)이 처리하는 개인정보 항목과 이용 목적을
          안내합니다.
        </p>
      </div>

      <div className="flex max-w-[720px] flex-col gap-8 text-body leading-relaxed text-text-primary">
        <section aria-labelledby="privacy-items-heading" className="flex flex-col gap-2">
          <h2 id="privacy-items-heading" className="text-h2 font-bold text-text-primary">
            1. 수집하는 개인정보 항목
          </h2>
          <p>서비스는 다음 개인정보를 수집·처리합니다.</p>
          <ul className="list-disc pl-6">
            <li>
              <strong className="font-bold">카카오 로그인 시</strong> — 닉네임, 카카오 계정 고유
              식별값(카카오 기본 제공 동의항목만 사용하며, 실제 이메일·전화번호는 수집하지
              않습니다)
            </li>
            <li>
              <strong className="font-bold">회원가입(온보딩) 시 직접 입력</strong> — 닉네임,
              생년월일(필수, 만 19세 미만 이용 제한 확인 목적), 성별·태어난 시각(선택), 마케팅
              정보 수신 동의 여부, 다이어리 공개 기본값 설정
            </li>
            <li>
              <strong className="font-bold">서비스 이용 중 생성되는 정보</strong> — 생성·저장한
              번호와 생성 방식, 자진 기록한 구매 여부·구매 금액·행운 메모, 당첨 확인 결과(대조된
              회차·일치 개수·등수), 직접 작성한 꿈 기록, 서비스 내 알림 내역, 생년월일을 바탕으로
              하루 1회 생성되는 오늘의 행운 결과(금전운·행동 지침·행운 요소·추천 번호)
            </li>
          </ul>
        </section>

        <section aria-labelledby="privacy-purpose-heading" className="flex flex-col gap-2">
          <h2 id="privacy-purpose-heading" className="text-h2 font-bold text-text-primary">
            2. 개인정보 이용 목적
          </h2>
          <ul className="list-disc pl-6">
            <li>카카오 로그인을 통한 회원 식별 및 서비스 이용</li>
            <li>만 19세 미만 이용 제한 확인</li>
            <li>번호 생성 기록·당첨 확인 결과·꿈 기록 등 행운 다이어리 서비스 제공</li>
            <li>
              생년월일을 바탕으로 한 오늘의 행운(금전운·행동 지침·행운 요소·추천 번호) 생성 및
              계정 연결 저장 — 외부 AI 서비스를 이용하지 않고 서비스 내부 로직으로만 계산합니다
            </li>
            <li>당첨 결과 발생 시 서비스 내 알림 제공</li>
          </ul>
        </section>

        <section aria-labelledby="privacy-retention-heading" className="flex flex-col gap-2">
          <h2 id="privacy-retention-heading" className="text-h2 font-bold text-text-primary">
            3. 보관 및 삭제
          </h2>
          <p>
            개인정보는 서비스를 제공하는 동안 보관됩니다. 현재 서비스는 이용자가 직접 계정을
            탈퇴하거나 데이터 삭제를 요청할 수 있는 별도의 화면을 제공하지 않고 있습니다. 삭제를
            원하시는 경우 아래 &ldquo;8. 문의 방법&rdquo;을 통해 요청해주시면 확인 후 처리합니다.
          </p>
        </section>

        <section aria-labelledby="privacy-third-party-heading" className="flex flex-col gap-2">
          <h2 id="privacy-third-party-heading" className="text-h2 font-bold text-text-primary">
            4. 서비스 제공을 위해 이용하는 외부 서비스
          </h2>
          <p>서비스는 아래 외부 서비스를 통해 운영됩니다.</p>
          <ul className="list-disc pl-6">
            <li>
              <strong className="font-bold">Supabase</strong> — 회원 인증 및 데이터베이스 저장·운영
            </li>
            <li>
              <strong className="font-bold">Vercel</strong> — 웹 서비스 호스팅
            </li>
            <li>
              <strong className="font-bold">카카오(Kakao)</strong> — 로그인 인증(OAuth)
            </li>
          </ul>
          <p>
            위 서비스 외에 광고, 분석(analytics), 마케팅을 목적으로 개인정보를 제3자에게 제공하지
            않습니다.
          </p>
        </section>

        <section aria-labelledby="privacy-cookie-heading" className="flex flex-col gap-2">
          <h2 id="privacy-cookie-heading" className="text-h2 font-bold text-text-primary">
            5. 쿠키 및 로그인 세션
          </h2>
          <p>
            서비스는 로그인 상태를 유지하기 위한 인증 세션 쿠키와, 카카오 로그인 과정에서 잠시
            사용되는 보안(CSRF 방지) 쿠키를 사용합니다. 광고나 방문자 추적을 위한 쿠키, 분석
            도구는 사용하지 않습니다.
          </p>
        </section>

        <section aria-labelledby="privacy-rights-heading" className="flex flex-col gap-2">
          <h2 id="privacy-rights-heading" className="text-h2 font-bold text-text-primary">
            6. 이용자의 권리
          </h2>
          <p>
            이용자는 본인의 개인정보에 대해 열람, 정정, 삭제를 요청할 권리가 있습니다. 현재 별도
            설정 화면은 제공되지 않으며, 요청은 아래 &ldquo;8. 문의 방법&rdquo;을 통해 접수합니다.
          </p>
        </section>

        <section aria-labelledby="privacy-minor-heading" className="flex flex-col gap-2">
          <h2 id="privacy-minor-heading" className="text-h2 font-bold text-text-primary">
            7. 만 19세 미만 이용 제한
          </h2>
          <p>
            서비스는 회원가입 시 입력한 생년월일을 기준으로 만 19세 이상만 이용할 수 있도록
            제한합니다.
          </p>
        </section>

        <section aria-labelledby="privacy-contact-heading" className="flex flex-col gap-2">
          <h2 id="privacy-contact-heading" className="text-h2 font-bold text-text-primary">
            8. 문의 방법
          </h2>
          <p>
            현재 서비스는 별도의 고객센터·문의 채널을 아직 마련하지 못했습니다. 문의 채널은
            준비되는 대로 이 페이지를 통해 안내할 예정입니다.
          </p>
        </section>

        <section aria-labelledby="privacy-change-heading" className="flex flex-col gap-2">
          <h2 id="privacy-change-heading" className="text-h2 font-bold text-text-primary">
            9. 정책 변경 안내
          </h2>
          <p>
            이 개인정보처리방침은 법령이나 서비스 운영상 필요에 따라 변경될 수 있으며, 변경 시
            서비스 내 공지를 통해 안내합니다.
          </p>
        </section>
      </div>
    </Container>
  );
}
