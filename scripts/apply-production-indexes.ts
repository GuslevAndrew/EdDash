import { performance } from "node:perf_hooks";
import { prisma } from "@/lib/db";

const indexes = [
  {
    name: "StudentSnapshot_snapshotDate_regionId_idx",
    sql: `CREATE INDEX IF NOT EXISTS "StudentSnapshot_snapshotDate_regionId_idx"
      ON "StudentSnapshot" ("snapshotDate", "regionId")`
  },
  {
    name: "StudentSnapshot_snapshotDate_specialityId_idx",
    sql: `CREATE INDEX IF NOT EXISTS "StudentSnapshot_snapshotDate_specialityId_idx"
      ON "StudentSnapshot" ("snapshotDate", "specialityId")`
  },
  {
    name: "StudentSnapshot_snapshotDate_educationLevelId_idx",
    sql: `CREATE INDEX IF NOT EXISTS "StudentSnapshot_snapshotDate_educationLevelId_idx"
      ON "StudentSnapshot" ("snapshotDate", "educationLevelId")`
  },
  {
    name: "StudentSnapshot_snapshotDate_entryBaseId_idx",
    sql: `CREATE INDEX IF NOT EXISTS "StudentSnapshot_snapshotDate_entryBaseId_idx"
      ON "StudentSnapshot" ("snapshotDate", "entryBaseId")`
  },
  {
    name: "StudentSnapshot_snapshotDate_studyFormId_idx",
    sql: `CREATE INDEX IF NOT EXISTS "StudentSnapshot_snapshotDate_studyFormId_idx"
      ON "StudentSnapshot" ("snapshotDate", "studyFormId")`
  },
  {
    name: "YearlyOutcome_type_year_regionId_idx",
    sql: `CREATE INDEX IF NOT EXISTS "YearlyOutcome_type_year_regionId_idx"
      ON "YearlyOutcome" ("type", "year", "regionId")`
  },
  {
    name: "YearlyOutcome_type_year_specialityId_idx",
    sql: `CREATE INDEX IF NOT EXISTS "YearlyOutcome_type_year_specialityId_idx"
      ON "YearlyOutcome" ("type", "year", "specialityId")`
  },
  {
    name: "YearlyOutcome_type_year_educationLevelId_idx",
    sql: `CREATE INDEX IF NOT EXISTS "YearlyOutcome_type_year_educationLevelId_idx"
      ON "YearlyOutcome" ("type", "year", "educationLevelId")`
  },
  {
    name: "YearlyOutcome_type_year_entryBaseId_idx",
    sql: `CREATE INDEX IF NOT EXISTS "YearlyOutcome_type_year_entryBaseId_idx"
      ON "YearlyOutcome" ("type", "year", "entryBaseId")`
  }
];

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

async function main() {
  await prisma.$executeRawUnsafe("SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE");

  for (const index of indexes) {
    const startedAt = performance.now();
    process.stdout.write(`Applying ${index.name}... `);
    await prisma.$executeRawUnsafe(index.sql);
    console.log(formatDuration(performance.now() - startedAt));
  }

  const existing = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = ANY(${indexes.map((index) => index.name)})
    ORDER BY indexname
  `;

  console.log(JSON.stringify({
    requested: indexes.length,
    present: existing.length,
    indexes: existing.map((index) => index.indexname)
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
