export type EdboPayload = unknown;

export type ApiProbeResult = {
  url: string;
  status: number | null;
  ok: boolean;
  contentType: string | null;
  durationMs: number;
  kind: "json" | "html" | "text" | "binary" | "error";
  body: unknown;
  rawText: string;
  errorMessage?: string;
};

export type NormalizedRegion = {
  externalId?: string;
  code?: string;
  name: string;
};

export type NormalizedSpeciality = {
  externalId?: string;
  code?: string;
  name: string;
  fieldCode?: string;
  fieldName?: string;
};

export type NormalizedInstitution = {
  externalId?: string;
  parentExternalId?: string;
  name: string;
  shortName?: string;
  institutionTypeCode: string;
  institutionTypeName: string;
  regionName: string;
  regionCode?: string;
  foundationYear?: string;
  ownership?: string;
  settlement?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  blockedAt?: string;
  governingBody?: string;
};

export type NormalizedEducatorRow = {
  snapshotDate: Date;
  institutionExternalId?: string;
  institutionName: string;
  institutionShortName?: string;
  regionExternalId?: string;
  regionCode?: string;
  regionName: string;
  specialityExternalId?: string;
  specialityCode?: string;
  specialityName: string;
  fieldCode?: string;
  fieldName?: string;
  educationLevelCode: string;
  educationLevelName: string;
  entryBaseCode: string;
  entryBaseName: string;
  studyFormCode?: string;
  studyFormName?: string;
  studentsCount: number;
  sourceHash: string;
};

export type YearlyOutcomeType = "entrants" | "graduates";

export type NormalizedYearlyOutcomeRow = {
  type: YearlyOutcomeType;
  year: number;
  institutionExternalId?: string;
  institutionName: string;
  institutionShortName?: string;
  regionExternalId?: string;
  regionCode?: string;
  regionName: string;
  specialityExternalId?: string;
  specialityCode?: string;
  specialityName: string;
  fieldCode?: string;
  fieldName?: string;
  educationLevelCode: string;
  educationLevelName: string;
  entryBaseCode: string;
  entryBaseName: string;
  studyFormCode?: string;
  studyFormName?: string;
  personsCount: number;
  sourceHash: string;
};
