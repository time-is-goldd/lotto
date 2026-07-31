import { SITE_NAME } from "@/lib/constants";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      <h1 className="text-2xl font-bold text-neutral-900">{SITE_NAME}</h1>
      <p className="mt-2 text-base text-neutral-500">프로젝트 초기 세팅 단계입니다.</p>
    </main>
  );
}
