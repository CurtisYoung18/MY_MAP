import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MY_MAP - 智能地图助手",
    template: "%s | MY_MAP",
  },
  description: "AI 驱动的智能地图助手，支持全国路线规划和沿途 POI 推荐",
  keywords: [
    "智能地图",
    "AI地图助手",
    "路线规划",
    "POI推荐",
    "高德地图",
    "MiniMax",
  ],
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geist.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased min-h-screen flex flex-col">
        <ThemeProvider>
          <div className="flex-1">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
