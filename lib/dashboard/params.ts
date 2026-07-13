import { dashboardFiltersSchema } from "@/lib/edbo/schemas";

export function parseDashboardSearchParams(searchParams: URLSearchParams) {
  const raw: Record<string, string | string[]> = {};

  searchParams.forEach((value, key) => {
    const current = raw[key];
    if (current === undefined) {
      raw[key] = value;
      return;
    }
    raw[key] = Array.isArray(current) ? [...current, value] : [current, value];
  });

  if (raw.regionId && !raw.regionIds) {
    raw.regionIds = raw.regionId;
    delete raw.regionId;
  }
  if (raw.studyFormId && !raw.studyFormIds) {
    raw.studyFormIds = raw.studyFormId;
    delete raw.studyFormId;
  }
  if (raw.year && !raw.years) {
    raw.years = raw.year;
  }
  if (raw.institutionTypeCode && !raw.institutionTypeCodes) {
    raw.institutionTypeCodes = raw.institutionTypeCode;
    delete raw.institutionTypeCode;
  }
  if (raw.educationLevelName && !raw.educationLevelNames) {
    raw.educationLevelNames = raw.educationLevelName;
    delete raw.educationLevelName;
  }
  if (raw.entryBaseId && !raw.entryBaseIds) {
    raw.entryBaseIds = raw.entryBaseId;
    delete raw.entryBaseId;
  }

  return dashboardFiltersSchema.parse(raw);
}

export function parsePartialDashboardSearchParams(searchParams: URLSearchParams) {
  const raw = parseDashboardSearchParams(searchParams);
  return raw;
}
