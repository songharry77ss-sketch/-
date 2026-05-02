import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "지리고 — 진실 분석 프로토콜",
  description: "그 사람, 정말 진실을 말하고 있을까. 표창원 프로파일러가 직접 심문합니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300;400;500;700;900&family=JetBrains+Mono:wght@300;400;500;700&family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="scanlines min-h-screen">
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
