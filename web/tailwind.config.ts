import type { Config } from "tailwindcss";

// CrownFi light luxury theme. Ivory/white background, gold accent, Times New Roman.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Ink (primary text) and navy for headings.
        ink: "#23252f",
        navy: { DEFAULT: "#1a1f35", 2: "#2a2f52" },
        // Gold accent. Use `gold` for fills, `gold-ink` for gold TEXT on white (contrast-safe).
        gold: { DEFAULT: "#d4af37", soft: "#e6cf8f", deep: "#b8912f", ink: "#a97f16" },
        // Warm off-white surfaces + borders + luxury neutrals.
        cream: "#faf7ef",
        ivory: "#f7f2e7",
        charcoal: "#1c1c1c",
        graphite: "#3a3f52",
        stone: "#5f6172",
        line: "#e7e2d3",
        emerald: { DEFAULT: "#10b981", ink: "#0f6e56", soft: "#e1f5ee" },
        ruby: { DEFAULT: "#e11d48", soft: "#fbe9ef" },
      },
      fontFamily: {
        // Luxury brief, upgraded: Playfair Display (fashion-editorial serif) for headlines
        // and numbers, Inter for body/UI. Loaded via next/font — the CSS variables are set
        // on <html> in layout.tsx; the trailing stacks are fallbacks while fonts stream in.
        display: ["var(--font-display)", '"Playfair Display"', "Georgia", '"Times New Roman"', "serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "-apple-system", '"Segoe UI"', "sans-serif"],
      },
      keyframes: {
        floatUp: {
          from: { opacity: "0", transform: "translate(-50%, 8px)" },
          to: { opacity: "1", transform: "translate(-50%, 0)" },
        },
        fadeSlideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
      },
      animation: {
        floatUp: "floatUp 0.28s cubic-bezier(0.16,1,0.3,1) both",
        fadeSlideUp: "fadeSlideUp 0.3s ease-out both",
        float: "float 5s ease-in-out infinite",
      },
      boxShadow: {
        glass: "0 12px 34px -20px rgba(120,100,40,0.28)",
        spot: "0 24px 60px -28px rgba(184,145,47,0.55)",
        gold: "0 10px 24px -10px rgba(184,145,47,0.55)",
      },
    },
  },
  plugins: [],
} satisfies Config;
