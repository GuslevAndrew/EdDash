import { prisma } from "@/lib/db";
import { warmDashboardApiCache } from "@/lib/dashboard/cache-warmup";

function isAllMode() {
  return process.argv.includes("--all");
}

async function main() {
  const result = await warmDashboardApiCache({ all: isAllMode() });
  const cached = result.entries.filter((entry) => entry.status === "cached").length;
  const failed = result.entries.filter((entry) => entry.status === "failed").length;
  const skipped = result.entries.filter((entry) => entry.status === "skipped").length;

  console.log(`Dashboard API cache warmup finished in ${result.elapsedMs} ms.`);
  console.log(`Filter sets: ${result.filterSetsCount}. Cached: ${cached}. Failed: ${failed}. Skipped: ${skipped}.`);

  for (const entry of result.entries) {
    const suffix = entry.errorMessage ? ` (${entry.errorMessage})` : "";
    console.log(`${entry.status.toUpperCase()} ${entry.scope} ${entry.label} in ${entry.elapsedMs} ms${suffix}`);
  }
}

main()
  .catch((error) => {
    console.error("Dashboard API cache refresh failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
