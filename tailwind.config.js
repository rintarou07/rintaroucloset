/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        gemini: {
          bg: "#131314",
          elevated: "#1E1F20",
          interactive: "#282A2C",
          border: "rgba(255, 255, 255, 0.07)",
          text: "#E3E3E3",
          secondary: "#9AA0A6",
          muted: "#5F6368",
        },
        crimson: {
          core: "#D91B2E",
          glow: "#F43F5E",
          tint: "rgba(217, 27, 46, 0.15)",
          active: "#E11D48",
        },
        hextech: {
          gold: {
            antique: "#785A28",
            hover: "#C89B3C",
            bright: "#F0E6D2",
          },
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        "crimson-glow": "0 0 16px rgba(244, 63, 94, 0.45)",
        "gold-glow": "0 0 14px rgba(200, 155, 60, 0.35)",
      },
    },
  },
  plugins: [],
};
