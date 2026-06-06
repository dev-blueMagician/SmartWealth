/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#FAFBFC",
          panel: "#FFFFFF",
          subtle: "#F1F5F9",
          muted: "#F8FAFC",
        },
        border: {
          DEFAULT: "#E5E9F0",
          subtle: "#EEF2F7",
        },
        accent: {
          DEFAULT: "#2563EB",
          hover: "#1D4ED8",
          soft: "#EFF6FF",
        },
        ok: "#059669",
        warn: "#D97706",
        danger: "#DC2626",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      maxWidth: {
        content: "840px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.05)",
        cardHover: "0 4px 14px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.05)",
      },
    },
  },
  plugins: [],
};
