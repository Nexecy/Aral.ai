import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    "bg-sticker-sky",
    "bg-sticker-purple",
    "bg-sticker-pink",
    "bg-sticker-orange",
    "bg-sticker-teal",
    "bg-sticker-green",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["CleanParens", "var(--font-hanken)", "system-ui", "sans-serif"],
        hanken: ["CleanParens", "var(--font-hanken)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
        "label-caps": ["var(--font-jetbrains)", "var(--font-hanken)", "monospace"],
        "display-lg": ["var(--font-hanken)", "sans-serif"],
        "headline-md": ["var(--font-hanken)", "sans-serif"],
        "headline-sm": ["var(--font-hanken)", "sans-serif"],
        "body-lg": ["var(--font-hanken)", "sans-serif"],
        "body-sm": ["var(--font-hanken)", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          container: "hsl(var(--primary-container))",
          light: "#eef2ff",
          fixed: "#818cf8",
          active: "#3730a3",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Physical Notebook & Emerald Studio Tokens
        charcoal: {
          DEFAULT: "#1e293b",
          dark: "#0f172a",
          light: "#334155",
        },
        // Theme-aware elevation ramp (see globals.css for the light/dark values).
        "surface-container-lowest": "hsl(var(--surface-container-lowest))",
        "surface-container-low": "hsl(var(--surface-container-low))",
        "surface-container": "hsl(var(--surface-container))",
        "surface-container-high": "hsl(var(--surface-container-high))",
        "surface-container-highest": "hsl(var(--surface-container-highest))",
        outline: "hsl(var(--outline))",
        "outline-variant": "hsl(var(--outline-variant))",
        "on-surface": "hsl(var(--on-surface))",
        "on-surface-variant": "hsl(var(--on-surface-variant))",
        "on-primary": "hsl(var(--on-primary))",
        "focus-gold": "#f59e0b",
        "accent-mint": "#d1fae5",
        // Notion / Physical Paper Specific Tokens
        notion: {
          canvas: "var(--notion-canvas)",
          "canvas-soft": "var(--notion-canvas-soft)",
          surface: "var(--notion-surface)",
          hairline: "var(--notion-hairline)",
          ink: "var(--notion-ink)",
          "ink-secondary": "var(--notion-ink-secondary)",
          "ink-muted": "var(--notion-ink-muted)",
          "ink-faint": "var(--notion-ink-faint)",
          blue: "#4f46e5",
          "blue-active": "#4338ca",
          indigo: "#4f46e5",
        },
        // Accent palette, theme-aware so it stays legible in dark mode.
        sticker: {
          sky: "hsl(var(--sticker-sky))",
          purple: "hsl(var(--sticker-purple))",
          pink: "hsl(var(--sticker-pink))",
          orange: "hsl(var(--sticker-orange))",
          teal: "hsl(var(--sticker-teal))",
          green: "hsl(var(--sticker-green))",
        },
      },
      borderRadius: {
        xs: "4px",
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
        "3xl": "24px",
        full: "9999px",
      },
      boxShadow: {
        "notebook-subtle": "0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 3px 1px rgba(0, 0, 0, 0.02)",
        "notebook-card": "0 2px 6px -1px rgba(0, 0, 0, 0.04), 0 1px 4px -1px rgba(0, 0, 0, 0.02)",
        "notion-soft": "0 0.175px 1.04px rgba(0,0,0,0.01), 0 0.8px 2.92px rgba(0,0,0,0.02), 0 2.02px 7.85px rgba(0,0,0,0.027), 0 4px 18px rgba(0,0,0,0.04)",
        "notion-elevated": "0 2px 4px rgba(0,0,0,0.02), 0 6px 14px rgba(0,0,0,0.04), 0 14px 28px rgba(0,0,0,0.05), 0 23px 52px rgba(0,0,0,0.05)",
      },
      letterSpacing: {
        "tightest": "-0.035em",
        "tighter": "-0.025em",
        "tight": "-0.015em",
        "wide": "0.025em",
        "wider": "0.05em",
        "widest": "0.1em",
        "notion-display": "-0.025em",
        "notion-heading": "-0.015em",
      },
      keyframes: {
        appear: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "appear-zoom": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        appear: "appear 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "appear-zoom": "appear-zoom 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
    },
  },
  plugins: [],
};

export default config;
