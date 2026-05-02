import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "기리고 — 진실 심문 프로토콜",
  description: "당신이 정말 알아야 할 진실. 전문 프로파일러의 심문이 시작됩니다.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
