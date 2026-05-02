import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Courier New"', "monospace"],
        serif: ['"Noto Serif KR"', "Georgia", "serif"],
        sans: ['"Pretendard"', '"Noto Sans KR"', "system-ui", "sans-serif"],
      },
      colors: {
        ink: { 950: "#050505", 900: "#0a0a0a", 800: "#111111", 700: "#1a1a1a", 600: "#222222", 500: "#2a2a2a" },
        blood: { 950: "#1a0000", 900: "#3d0000", 700: "#7a0000", 500: "#b80000", 300: "#ff2424", 200: "#ff6b6b" },
        bone: { 50: "#fafaf5", 100: "#f5f1e8", 200: "#d6d0c0", 300: "#9c958a", 500: "#5a544a" },
      },
    },
  },
  plugins: [],
} satisfies Config;
