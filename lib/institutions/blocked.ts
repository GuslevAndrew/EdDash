import { Prisma } from "@prisma/client";

export function parseBlockedAtDate(value: string | null | undefined): Date | null {
  const rawValue = value?.trim();
  if (!rawValue) return null;

  const match = rawValue.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function getYearEndDate(year: number): Date {
  return new Date(Date.UTC(year, 11, 31));
}

export function activeInstitutionWhere(
  includeBlockedInstitutions: boolean,
  cutoffDate?: Date | null
): Prisma.InstitutionWhereInput {
  if (includeBlockedInstitutions) return {};

  if (!cutoffDate) {
    return { blockedAtDate: null };
  }

  return {
    OR: [
      { blockedAtDate: null },
      { blockedAtDate: { gt: cutoffDate } }
    ]
  };
}

export function mergeInstitutionWhere(
  baseWhere: Prisma.InstitutionWhereInput | undefined,
  includeBlockedInstitutions: boolean,
  cutoffDate?: Date | null
): Prisma.InstitutionWhereInput | undefined {
  const activeWhere = activeInstitutionWhere(includeBlockedInstitutions, cutoffDate);
  const hasBaseWhere = Boolean(baseWhere && Object.keys(baseWhere).length);
  const hasActiveWhere = Object.keys(activeWhere).length > 0;

  if (!hasBaseWhere) return hasActiveWhere ? activeWhere : undefined;
  if (!hasActiveWhere) return baseWhere;

  return { AND: [baseWhere as Prisma.InstitutionWhereInput, activeWhere] };
}

export function activeInstitutionSql(
  alias: string,
  includeBlockedInstitutions: boolean,
  cutoffSql?: Prisma.Sql
): Prisma.Sql | null {
  if (includeBlockedInstitutions) return null;

  const blockedAtDate = Prisma.raw(`${alias}."blockedAtDate"`);
  if (!cutoffSql) return Prisma.sql`${blockedAtDate} IS NULL`;

  return Prisma.sql`(${blockedAtDate} IS NULL OR ${blockedAtDate} > ${cutoffSql})`;
}

export function addSnapshotActiveInstitutionFilter(
  where: Prisma.StudentSnapshotWhereInput,
  includeBlockedInstitutions: boolean,
  dates: Date[]
): Prisma.StudentSnapshotWhereInput {
  if (includeBlockedInstitutions) return where;

  const uniqueDates = [...new Map(dates.map((date) => [date.toISOString(), date])).values()];
  if (uniqueDates.length <= 1) {
    return {
      ...where,
      institution: mergeInstitutionWhere(where.institution as Prisma.InstitutionWhereInput | undefined, false, uniqueDates[0])
    };
  }

  return {
    ...where,
    OR: uniqueDates.map((date) => ({
      snapshotDate: date,
      institution: mergeInstitutionWhere(where.institution as Prisma.InstitutionWhereInput | undefined, false, date)
    }))
  };
}

export function addYearlyActiveInstitutionFilter(
  where: Prisma.YearlyOutcomeWhereInput,
  includeBlockedInstitutions: boolean,
  years: number[]
): Prisma.YearlyOutcomeWhereInput {
  if (includeBlockedInstitutions) return where;

  const uniqueYears = [...new Set(years)];
  if (uniqueYears.length <= 1) {
    return {
      ...where,
      institution: mergeInstitutionWhere(where.institution as Prisma.InstitutionWhereInput | undefined, false, uniqueYears[0] ? getYearEndDate(uniqueYears[0]) : undefined)
    };
  }

  return {
    ...where,
    OR: uniqueYears.map((year) => ({
      year,
      institution: mergeInstitutionWhere(where.institution as Prisma.InstitutionWhereInput | undefined, false, getYearEndDate(year))
    }))
  };
}
