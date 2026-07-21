import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#FAFAF6",
        surface: "#FFFFFF",
        ink: "#14261C",
        muted: "#5B6B62",
        hairline: "#E7E5DE",
        brand: { DEFAULT: "#0F766E", ink: "#0B5C55", tint: "#E6F1EF" }, // system / emerald
        gold: { DEFAULT: "#B45309", tint: "#FBF1E4" }, // marker highlight
        // ingredient identities
        manggis: "#6D28D9",
        kelor: "#4D7C0F",
        pegagan: "#0E7490",
        // gate verdicts
        accept: "#059669",
        route: "#D97706",
        reject: "#E11D48",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: { xl: "0.9rem", "2xl": "1.25rem" },
      boxShadow: {
        card: "0 1px 2px rgba(20,38,28,0.04), 0 8px 24px -12px rgba(20,38,28,0.12)",
        lift: "0 2px 4px rgba(20,38,28,0.05), 0 16px 40px -16px rgba(20,38,28,0.22)",
      },
    },
  },
  plugins: [],
};
export default config;
