import type { Metadata } from "next";
import {
  DM_Sans,
  DM_Serif_Display,
  Fraunces,
  IBM_Plex_Mono,
  Inter,
  JetBrains_Mono,
  Newsreader,
  Poppins,
} from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import "./skins.css";

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

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jb = JetBrains_Mono({
  variable: "--font-jb",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const dm = DM_Sans({
  variable: "--font-dm",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
        {children}
      </body>
    </html>
  );
}
