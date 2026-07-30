import { prisma } from "@/lib/db";

type CountRow = {
  table_name: string;
  rows_count: bigint;
};

type SnapshotDateRow = {
  snapshot_date: Date;
  rows_count: number;
  students_count: bigint;
};

type YearlyRow = {
  type: string;
  year: number;
  rows_count: number;
  persons_count: bigint;
};

type DbSizeRow = {
  db_size: string;
};

type RelationSizeRow = {
  relname: string;
  total_size: string;
};

async function main() {
  const [counts, snapshotDates, yearlyRows, dbSize, relationSizes, recentFailedImports] = await Promise.all([
    prisma.$queryRaw<CountRow[]>`
      SELECT 'StudentSnapshot' AS table_name, COUNT(*)::bigint AS rows_count FROM "StudentSnapshot"
      UNION ALL SELECT 'YearlyOutcome', COUNT(*)::bigint FROM "YearlyOutcome"
      UNION ALL SELECT 'Institution', COUNT(*)::bigint FROM "Institution"
      UNION ALL SELECT 'Region', COUNT(*)::bigint FROM "Region"
      UNION ALL SELECT 'Speciality', COUNT(*)::bigint FROM "Speciality"
      ORDER BY table_name
    `,
    prisma.$queryRaw<SnapshotDateRow[]>`
      SELECT
        "snapshotDate" AS snapshot_date,
        COUNT(*)::int AS rows_count,
        SUM("studentsCount")::bigint AS students_count
      FROM "StudentSnapshot"
      GROUP BY 1
      ORDER BY 1 DESC
    `,
    prisma.$queryRaw<YearlyRow[]>`
      SELECT
        type,
        year,
        COUNT(*)::int AS rows_count,
        SUM("personsCount")::bigint AS persons_count
      FROM "YearlyOutcome"
      GROUP BY 1, 2
      ORDER BY 1, 2 DESC
    `,
    prisma.$queryRaw<DbSizeRow[]>`SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size`,
    prisma.$queryRaw<RelationSizeRow[]>`
      SELECT relname, pg_size_pretty(pg_total_relation_size(quote_ident(relname))) AS total_size
      FROM pg_stat_user_tables
      WHERE relname IN ('StudentSnapshot','YearlyOutcome','Institution','Speciality','ImportRun')
      ORDER BY pg_total_relation_size(quote_ident(relname)) DESC
    `,
    prisma.importRun.findMany({
      where: { status: "failed" },
      orderBy: { startedAt: "desc" },
      take: 10,
      select: {
        id: true,
        type: true,
        startedAt: true,
        finishedAt: true,
        recordsReceived: true,
        recordsUpdated: true,
        errorMessage: true
      }
    })
  ]);

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    dbSize: dbSize[0]?.db_size ?? null,
    tableCounts: counts.map((row) => ({
      table: row.table_name,
      rows: row.rows_count.toString()
    })),
    relationSizes,
    studentSnapshots: snapshotDates.map((row) => ({
      date: row.snapshot_date.toISOString(),
      rows: row.rows_count,
      students: row.students_count.toString()
    })),
    yearlyOutcomes: yearlyRows.map((row) => ({
      type: row.type,
      year: row.year,
      rows: row.rows_count,
      persons: row.persons_count.toString()
    })),
    recentFailedImports
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
