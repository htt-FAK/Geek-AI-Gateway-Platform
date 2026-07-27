import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base: "var(--bg-base)",
        elevated: "var(--bg-elevated)",
        surface: "var(--bg-surface)",
        hover: "var(--bg-hover)",
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        tertiary: "var(--text-tertiary)",
        accent: {
          DEFAULT: "var(--accent-primary)",
          hover: "var(--accent-primary-hover)",
          muted: "var(--accent-muted)",
        },
        danger: "var(--status-error)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Noto Sans SC", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "Noto Sans SC", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      maxWidth: {
        console: "1200px",
      },
    },
  },
  plugins: [],
} satisfies Config;
