import type { Prisma } from "@prisma/client";
import type { DashboardFiltersInput } from "@/lib/edbo/schemas";
import { getEducationLevelNameVariants } from "@/lib/education-levels/canonical";
import { addSnapshotActiveInstitutionFilter, addYearlyActiveInstitutionFilter } from "@/lib/institutions/blocked";

export function buildSnapshotWhere(filters: Partial<DashboardFiltersInput>): Prisma.StudentSnapshotWhereInput {
  const regionIds = filters.regionIds?.length ? filters.regionIds : filters.regionId ? [filters.regionId] : [];
  const institutionIds = filters.institutionIds?.length ? filters.institutionIds : filters.institutionId ? [filters.institutionId] : [];
  const institutionTypeCodes = filters.institutionTypeCodes?.length
    ? filters.institutionTypeCodes
    : filters.institutionTypeCode
      ? [filters.institutionTypeCode]
      : [];
  const studyFormIds = filters.studyFormIds?.length ? filters.studyFormIds : filters.studyFormId ? [filters.studyFormId] : [];
  const entryBaseIds = filters.entryBaseIds?.length ? filters.entryBaseIds : filters.entryBaseId ? [filters.entryBaseId] : [];
  const educationLevelNames = filters.educationLevelNames?.length
    ? filters.educationLevelNames
    : filters.educationLevelName
      ? [filters.educationLevelName]
      : [];
  const educationLevelNameVariants = [...new Set(educationLevelNames.flatMap((name) => getEducationLevelNameVariants(name)))];
  const fieldCodes = filters.fieldCodes?.length ? filters.fieldCodes : filters.fieldCode ? [filters.fieldCode] : [];
  const specialityCodes = filters.specialityCodes?.length
    ? filters.specialityCodes
    : filters.specialityCode
      ? [filters.specialityCode]
      : [];
  const specialityWhere: Prisma.SpecialityWhereInput | undefined =
    fieldCodes.length || specialityCodes.length
      ? {
          canonicalFieldCode: fieldCodes.length ? { in: fieldCodes } : undefined,
          canonicalCode: specialityCodes.length ? { in: specialityCodes } : undefined
        }
      : undefined;

  const snapshotDate = filters.snapshotDate ? new Date(filters.snapshotDate) : undefined;
  const institutionWhere = institutionTypeCodes.length ? { institutionTypeCode: { in: institutionTypeCodes } } : undefined;

  const snapshotDates = (filters.snapshotDates?.length ? filters.snapshotDates : filters.snapshotDate ? [filters.snapshotDate] : [])
    .map((date) => new Date(date))
    .filter((date) => !Number.isNaN(date.getTime()));
  const where: Prisma.StudentSnapshotWhereInput = {
    snapshotDate,
    regionId: regionIds.length ? { in: regionIds } : undefined,
    institution: institutionWhere,
    institutionId: institutionIds.length ? { in: institutionIds } : undefined,
    speciality: specialityWhere,
    specialityId: filters.specialityId,
    educationLevel: educationLevelNameVariants.length ? { name: { in: educationLevelNameVariants } } : undefined,
    educationLevelId: educationLevelNameVariants.length ? undefined : filters.educationLevelId,
    entryBaseId: entryBaseIds.length ? { in: entryBaseIds } : undefined,
    studyFormId: studyFormIds.length ? { in: studyFormIds } : undefined,
    studyForm: studyFormIds.length ? undefined : { code: { not: "total" } }
  };

  return addSnapshotActiveInstitutionFilter(where, Boolean(filters.includeBlockedInstitutions), snapshotDates);
}

export function buildYearlyOutcomeWhere(filters: Partial<DashboardFiltersInput>): Prisma.YearlyOutcomeWhereInput {
  const years = filters.years?.length ? filters.years : filters.year ? [filters.year] : [];
  const regionIds = filters.regionIds?.length ? filters.regionIds : filters.regionId ? [filters.regionId] : [];
  const institutionIds = filters.institutionIds?.length ? filters.institutionIds : filters.institutionId ? [filters.institutionId] : [];
  const institutionTypeCodes = filters.institutionTypeCodes?.length
    ? filters.institutionTypeCodes
    : filters.institutionTypeCode
      ? [filters.institutionTypeCode]
      : [];
  const entryBaseIds = filters.entryBaseIds?.length ? filters.entryBaseIds : filters.entryBaseId ? [filters.entryBaseId] : [];
  const educationLevelNames = filters.educationLevelNames?.length
    ? filters.educationLevelNames
    : filters.educationLevelName
      ? [filters.educationLevelName]
      : [];
  const educationLevelNameVariants = [...new Set(educationLevelNames.flatMap((name) => getEducationLevelNameVariants(name)))];
  const fieldCodes = filters.fieldCodes?.length ? filters.fieldCodes : filters.fieldCode ? [filters.fieldCode] : [];
  const specialityCodes = filters.specialityCodes?.length
    ? filters.specialityCodes
    : filters.specialityCode
      ? [filters.specialityCode]
      : [];
  const specialityWhere: Prisma.SpecialityWhereInput | undefined =
    fieldCodes.length || specialityCodes.length
      ? {
          canonicalFieldCode: fieldCodes.length ? { in: fieldCodes } : undefined,
          canonicalCode: specialityCodes.length ? { in: specialityCodes } : undefined
        }
      : undefined;

  const institutionWhere = institutionTypeCodes.length ? { institutionTypeCode: { in: institutionTypeCodes } } : undefined;

  const where: Prisma.YearlyOutcomeWhereInput = {
    type: filters.datasetType === "graduates" ? "graduates" : "entrants",
    year: years.length ? { in: years } : undefined,
    regionId: regionIds.length ? { in: regionIds } : undefined,
    institution: institutionWhere,
    institutionId: institutionIds.length ? { in: institutionIds } : undefined,
    speciality: specialityWhere,
    specialityId: filters.specialityId,
    educationLevel: educationLevelNameVariants.length ? { name: { in: educationLevelNameVariants } } : undefined,
    educationLevelId: educationLevelNameVariants.length ? undefined : filters.educationLevelId,
    entryBaseId: entryBaseIds.length ? { in: entryBaseIds } : undefined
  };

  return addYearlyActiveInstitutionFilter(where, Boolean(filters.includeBlockedInstitutions), years);
}
