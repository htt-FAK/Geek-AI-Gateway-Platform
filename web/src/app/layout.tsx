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
  const appearanceBoot = `(function(){try{var k='aigw.appearance.v1';var raw=localStorage.getItem(k);var s=raw?Object.assign({theme:'dark',preset:'default',font:'auto',radius:'auto',density:'default',sidebar:'embedded',layout:'default'},JSON.parse(raw)):{theme:'dark',preset:'default',font:'auto',radius:'auto',density:'default',sidebar:'embedded',layout:'default'};var theme=s.theme==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):s.theme;var r=document.documentElement;r.dataset.theme=theme;r.dataset.preset=s.preset;r.dataset.font=s.font;r.dataset.radius=s.radius;r.dataset.density=s.density;r.dataset.sidebar=s.sidebar;r.dataset.layout=s.layout;r.classList.toggle('dark',theme==='dark');r.classList.toggle('light',theme==='light');}catch(e){}})();`;

  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceBoot }} />
      </head>
      <body
        className={`${GeistSans.variable} ${display.variable} ${mono.variable}`}
        style={{ WebkitFontSmoothing: "antialiased" }}
      >
        {children}
      </body>
    </html>
  );
}
