import type { Metadata } from "next";
import { DM_Serif_Display, IBM_Plex_Mono } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

const display = DM_Serif_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  adjustFontFallback: true,
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "高科极客 AI 网关平台",
    template: "%s · 高科极客 AI 网关",
  },
  description: "有趣的人，在这里调用世界",
  icons: {
    icon: [{ url: "/icons/mark.png", type: "image/png" }],
    shortcut: ["/icons/mark.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="dark">
      <body
        className={`${GeistSans.variable} ${display.variable} ${mono.variable}`}
        style={{ WebkitFontSmoothing: "antialiased" }}
      >
        {children}
      </body>
    </html>
  );
}
