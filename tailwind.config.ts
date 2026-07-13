import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        muted: "#6b7280",
        line: "#d1d5db",
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#2563eb",
          600: "#2563eb",
          700: "#1e40af"
        },
        eddash: {
          blue: "#2563EB",
          blueDark: "#1E40AF",
          navy: "#1E3A5F",
          graphite: "#1F2937",
          text: "#111827",
          muted: "#6B7280",
          softText: "#9CA3AF",
          bg: "#F8FAFC",
          surface: "#FFFFFF",
          soft: "#F3F4F6",
          border: "#D1D5DB",
          borderSoft: "#E5E7EB",
          amber: "#F59E0B",
          green: "#16A34A",
          red: "#DC2626"
        }
      },
      borderRadius: {
        card: "14px",
        panel: "18px"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        data: ["Inter", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 1px 3px rgba(15, 23, 42, 0.08)",
        dropdown: "0 8px 24px rgba(15, 23, 42, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
