import { prisma } from "@/lib/db";

const correctionType = "student-snapshots-deduplicate-2016-2021";
const correctionDateType = `${correctionType}-date`;
const correctionChunkType = `${correctionType}-chunk`;
const dateFrom = new Date("2016-01-01T00:00:00.000Z");
const dateTo = new Date("2022-01-01T00:00:00.000Z");
const defaultChunkSize = 1000;

type YearSummary = {
  year: number;
  rows: number;
  students_before: bigint;
  students_after: bigint;
  odd_rows: number;
};

type DateSummary = {
  snapshotDate: Date;
  rows: number;
  students_before: bigint;
  students_after: bigint;
  odd_rows: number;
};

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseNumberArg(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? Number(process.argv[index + 1]) : Number.NaN;
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function toJson<T>(value: T): string {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === "bigint" ? item.toString() : item),
    2
  );
}

async function getSummary(): Promise<YearSummary[]> {
  return prisma.$queryRaw<YearSummary[]>`
    SELECT
      EXTRACT(YEAR FROM "snapshotDate")::int AS year,
      COUNT(*)::int AS rows,
      SUM("studentsCount")::bigint AS students_before,
      SUM(("studentsCount" / 2))::bigint AS students_after,
      SUM(CASE WHEN MOD("studentsCount", 2) <> 0 THEN 1 ELSE 0 END)::int AS odd_rows
    FROM "StudentSnapshot"
    WHERE "snapshotDate" >= ${dateFrom}
      AND "snapshotDate" < ${dateTo}
    GROUP BY 1
    ORDER BY 1
  `;
}

async function getDateSummary(): Promise<DateSummary[]> {
  return prisma.$queryRaw<DateSummary[]>`
    SELECT
      "snapshotDate",
      COUNT(*)::int AS rows,
      SUM("studentsCount")::bigint AS students_before,
      SUM(("studentsCount" / 2))::bigint AS students_after,
      SUM(CASE WHEN MOD("studentsCount", 2) <> 0 THEN 1 ELSE 0 END)::int AS odd_rows
    FROM "StudentSnapshot"
    WHERE "snapshotDate" >= ${dateFrom}
      AND "snapshotDate" < ${dateTo}
    GROUP BY 1
    ORDER BY 1
  `;
}

async function main() {
  const apply = hasFlag("apply");
  const force = hasFlag("force");
  const chunkSize = parseNumberArg("chunk-size", defaultChunkSize);
  const summary = await getSummary();
  const dateSummary = await getDateSummary();
  const completedDateRuns = await prisma.importRun.findMany({
    where: { type: correctionDateType, status: "success" },
    select: { parametersJson: true }
  });
  const completedDates = new Set(
    completedDateRuns
      .map((run) => {
        try {
          const parsed = run.parametersJson ? JSON.parse(run.parametersJson) as { snapshotDate?: string } : {};
          return parsed.snapshotDate;
        } catch {
          return undefined;
        }
      })
      .filter((value): value is string => Boolean(value))
  );
  const rowsCount = summary.reduce((sum, item) => sum + item.rows, 0);
  const oddRows = summary.reduce((sum, item) => sum + item.odd_rows, 0);
  const studentsBefore = summary.reduce((sum, item) => sum + item.students_before, 0n);
  const studentsAfter = summary.reduce((sum, item) => sum + item.students_after, 0n);
  const previousSuccess = await prisma.importRun.findFirst({
    where: { type: correctionType, status: "success" },
    orderBy: { finishedAt: "desc" }
  });

  const report = {
    mode: apply ? "apply" : "dry-run",
    chunkSize,
    period: { from: dateFrom.toISOString(), toExclusive: dateTo.toISOString() },
    rowsCount,
    studentsBefore,
    studentsAfter,
    oddRows,
    previousSuccess: previousSuccess
      ? { id: previousSuccess.id, finishedAt: previousSuccess.finishedAt }
      : null,
    completedDates: [...completedDates].sort(),
    byYear: summary,
    byDate: dateSummary.map((item) => ({
      ...item,
      snapshotDate: item.snapshotDate.toISOString(),
      completed: completedDates.has(item.snapshotDate.toISOString())
    }))
  };

  console.log(toJson(report));

  if (!apply) {
    console.log("Dry-run only. Add --apply to update StudentSnapshot rows.");
    return;
  }

  if (previousSuccess && !force) {
    throw new Error(`Correction already applied in ImportRun ${previousSuccess.id}. Use --force only after manual verification.`);
  }

  if (!rowsCount) {
    throw new Error("No StudentSnapshot rows found for 2016-2021.");
  }

  const datesToApply = dateSummary.filter((item) => !completedDates.has(item.snapshotDate.toISOString()));
  await prisma.$executeRawUnsafe("SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE");
  const run = await prisma.importRun.create({
    data: {
      type: correctionType,
      status: "running",
      startedAt: new Date(),
      recordsReceived: rowsCount,
      parametersJson: JSON.stringify({
        from: dateFrom.toISOString(),
        toExclusive: dateTo.toISOString(),
        studentsBefore: studentsBefore.toString(),
        studentsAfter: studentsAfter.toString()
      })
    }
  });

  try {
    let rowsUpdated = 0;

    for (const dateItem of datesToApply) {
      const snapshotDate = dateItem.snapshotDate;
      const dateRun = await prisma.importRun.create({
        data: {
          type: correctionDateType,
          status: "running",
          startedAt: new Date(),
          recordsReceived: dateItem.rows,
          parametersJson: JSON.stringify({
            snapshotDate: snapshotDate.toISOString(),
            studentsBefore: dateItem.students_before.toString(),
            studentsAfter: dateItem.students_after.toString()
          })
        }
      });

      try {
        let dateRowsUpdated = 0;
        let lastId = 0;

        while (true) {
          const ids = await prisma.studentSnapshot.findMany({
            where: { snapshotDate, id: { gt: lastId } },
            select: { id: true },
            orderBy: { id: "asc" },
            take: chunkSize
          });
          if (!ids.length) break;

          const minId = ids[0]?.id;
          const maxId = ids[ids.length - 1]?.id;
          if (!minId || !maxId) break;
          lastId = maxId;

          const chunkAlreadyDone = await prisma.importRun.findFirst({
            where: {
              type: correctionChunkType,
              status: "success",
              parametersJson: JSON.stringify({ snapshotDate: snapshotDate.toISOString(), minId, maxId })
            },
            select: { id: true }
          });
          if (chunkAlreadyDone) continue;

          const chunkRun = await prisma.importRun.create({
            data: {
              type: correctionChunkType,
              status: "running",
              startedAt: new Date(),
              recordsReceived: ids.length,
              parametersJson: JSON.stringify({ snapshotDate: snapshotDate.toISOString(), minId, maxId })
            }
          });

          try {
            const updated = await prisma.$transaction(async (tx) => {
              await tx.$executeRawUnsafe("SET TRANSACTION READ WRITE");
              const oddRows = await tx.$queryRaw<Array<{ odd_rows: number }>>`
                SELECT COUNT(*)::int AS odd_rows
                FROM "StudentSnapshot"
                WHERE "snapshotDate" = ${snapshotDate}
                  AND "id" >= ${minId}
                  AND "id" <= ${maxId}
                  AND MOD("studentsCount", 2) <> 0
              `;
              const oddRowsCount = oddRows[0]?.odd_rows ?? 0;
              if (oddRowsCount > 0) {
                throw new Error(`Found ${oddRowsCount} odd studentsCount values in ${snapshotDate.toISOString()} ids ${minId}-${maxId}.`);
              }
              const result = await tx.$executeRaw`
                UPDATE "StudentSnapshot"
                SET
                  "studentsCount" = "studentsCount" / 2,
                  "updatedAt" = NOW()
                WHERE "snapshotDate" = ${snapshotDate}
                  AND "id" >= ${minId}
                  AND "id" <= ${maxId}
              `;
              await tx.importRun.update({
                where: { id: chunkRun.id },
                data: {
                  status: "success",
                  finishedAt: new Date(),
                  recordsUpdated: Number(result)
                }
              });
              return Number(result);
            });

            rowsUpdated += updated;
            dateRowsUpdated += updated;
            await prisma.importRun.update({
              where: { id: run.id },
              data: { recordsUpdated: rowsUpdated }
            });
          } catch (error) {
            await prisma.importRun.update({
              where: { id: chunkRun.id },
              data: {
                status: "failed",
                finishedAt: new Date(),
                errorsCount: 1,
                errorMessage: error instanceof Error ? error.message : "Unknown chunk correction error"
              }
            });
            throw error;
          }
        }

        await prisma.importRun.update({
          where: { id: dateRun.id },
          data: {
            status: "success",
            finishedAt: new Date(),
            recordsUpdated: dateRowsUpdated
          }
        });
        console.log(toJson({ date: snapshotDate.toISOString(), rowsUpdated: dateRowsUpdated }));
      } catch (error) {
        await prisma.importRun.update({
          where: { id: dateRun.id },
          data: {
            status: "failed",
            finishedAt: new Date(),
            errorsCount: 1,
            errorMessage: error instanceof Error ? error.message : "Unknown date correction error"
          }
        });
        throw error;
      }
    }

    await prisma.importRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        recordsCreated: 0,
        recordsUpdated: rowsUpdated,
        recordsSkipped: 0
      }
    });

    console.log(toJson({ applied: true, importRunId: run.id, rowsUpdated }));
  } catch (error) {
    await prisma.importRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorsCount: 1,
        errorMessage: error instanceof Error ? error.message : "Unknown correction error"
      }
    });
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
