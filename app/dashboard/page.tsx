import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getFilterOptions } from "@/lib/dashboard/queries";

export const metadata: Metadata = {
  title: "Дашборд",
  description:
    "Аналітичний дашборд EdDash для перегляду контингенту, зарахованих і випускників за регіонами, закладами, галузями та спеціальностями.",
  alternates: {
    canonical: "/dashboard"
  }
};

export default async function DashboardPage() {
  const filterOptions = await getFilterOptions();

  return (
    <AppShell>
      <DashboardClient initialOptions={JSON.parse(JSON.stringify(filterOptions))} />
    </AppShell>
  );
}
