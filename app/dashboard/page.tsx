import { AppShell } from "@/components/layout/AppShell";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getFilterOptions } from "@/lib/dashboard/queries";

export default async function DashboardPage() {
  const filterOptions = await getFilterOptions();

  return (
    <AppShell>
      <DashboardClient initialOptions={JSON.parse(JSON.stringify(filterOptions))} />
    </AppShell>
  );
}
