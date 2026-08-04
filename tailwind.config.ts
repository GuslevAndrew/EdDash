import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        muted: "#6b7280",
        line: "#cbd5e1",
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          500: "#2563eb",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#172554"
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
        soft: "0 10px 28px rgba(15, 23, 42, 0.07), 0 1px 2px rgba(15, 23, 42, 0.06)",
        dropdown: "0 18px 40px rgba(15, 23, 42, 0.16)"
      }
    }
  },
  plugins: []
};

export default config;
