import type { Metadata } from "next";

import { SITE_NAME } from "@/lib/constants";

import "./globals.css";

export const metadata: Metadata = {
  title: SITE_NAME,
  description: "행운을 기록하고, 관리하고, 공유하는 플랫폼",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
