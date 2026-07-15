import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export const metadata: Metadata = {
  title: "Дашборд",
  description:
    "Аналітичний дашборд EdDash для перегляду контингенту, зарахованих і випускників за регіонами, закладами, галузями та спеціальностями.",
  alternates: {
    canonical: "/dashboard"
  }
};

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardClient />
    </AppShell>
  );
}
