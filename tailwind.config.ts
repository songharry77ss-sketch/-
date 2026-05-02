import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Courier New"', "monospace"],
        serif: ['"Noto Serif KR"', '"Times New Roman"', "serif"],
        sans: ['"Pretendard"', '"Noto Sans KR"', "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          900: "#0a0a0a",
          800: "#111111",
          700: "#1a1a1a",
          600: "#222222",
          500: "#2a2a2a",
        },
        blood: {
          900: "#3d0000",
          700: "#7a0000",
          500: "#b80000",
          300: "#ff2424",
        },
        bone: {
          100: "#f5f1e8",
          200: "#d6d0c0",
          300: "#9c958a",
          500: "#5a544a",
        },
      },
      keyframes: {
        flicker: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
          "52%": { opacity: "0.4" },
          "54%": { opacity: "1" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        typing: {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "1" },
        },
        glitch: {
          "0%, 100%": { transform: "translate(0)" },
          "20%": { transform: "translate(-1px, 1px)" },
          "40%": { transform: "translate(-1px, -1px)" },
          "60%": { transform: "translate(1px, 1px)" },
          "80%": { transform: "translate(1px, -1px)" },
        },
      },
      animation: {
        flicker: "flicker 4s infinite",
        scan: "scan 8s linear infinite",
        typing: "typing 1.4s ease-in-out infinite",
        glitch: "glitch 0.3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
