import type { Metadata } from "next";
import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import "./skins.css";
import { AppFrame } from "@/components/app-frame";

// 字体本地化（latin 子集 woff2 在 src/fonts/，由 scripts/fetch-local-fonts.mjs 下载）。
// 原 next/font/google 在构建期拉 fonts.googleapis.com，国内网络常被断连导致构建失败。
const display = localFont({
  src: "../fonts/dm-serif-display-400.woff2",
  variable: "--font-display",
  weight: "400",
  display: "swap",
});

const mono = localFont({
  src: [
    { path: "../fonts/ibm-plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-mono-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-mono",
});

const inter = localFont({
  src: "../fonts/inter-100-900.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const jb = localFont({
  src: [
    { path: "../fonts/jetbrains-mono-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/jetbrains-mono-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-jb",
  display: "swap",
});

const dm = localFont({
  src: "../fonts/dm-sans-100-1000.woff2",
  variable: "--font-dm",
  weight: "100 1000",
  display: "swap",
});

const poppins = localFont({
  src: [
    { path: "../fonts/poppins-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/poppins-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/poppins-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
});

const fraunces = localFont({
  src: "../fonts/fraunces-400-700.woff2",
  variable: "--font-fraunces",
  weight: "400 700",
  display: "swap",
});

const newsreader = localFont({
  src: "../fonts/newsreader-400-600.woff2",
  variable: "--font-newsreader",
  weight: "400 600",
  display: "swap",
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
  const appearanceBoot = `(function(){try{var k2='aigw.appearance.v2';var k1='aigw.appearance.v1';var lightOnly={golden:1,google:1,doubao:1,claude:1,apple:1};var raw=localStorage.getItem(k2);var s;if(raw){s=Object.assign({skin:'minimal',theme:'dark',onboarded:false},JSON.parse(raw));}else{var legacy=localStorage.getItem(k1);if(legacy){var o=JSON.parse(legacy);s={skin:'minimal',theme:o.theme||'dark',onboarded:true};localStorage.setItem(k2,JSON.stringify(s));}else{s={skin:'minimal',theme:'dark',onboarded:false};}}var skin=s.skin||'minimal';if(lightOnly[skin]){s.theme='light';}var theme=s.theme==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):s.theme;if(lightOnly[skin]){theme='light';}var r=document.documentElement;r.dataset.skin=skin;r.dataset.theme=theme;r.classList.toggle('dark',theme==='dark');r.classList.toggle('light',theme==='light');}catch(e){}})();`;

  const fontVars = [
    GeistSans.variable,
    display.variable,
    mono.variable,
    inter.variable,
    jb.variable,
    dm.variable,
    poppins.variable,
    fraunces.variable,
    newsreader.variable,
  ].join(" ");

  return (
    <html lang="zh-CN" className="dark" data-skin="minimal" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceBoot }} />
      </head>
      <body className={fontVars} style={{ WebkitFontSmoothing: "antialiased" }}>
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
