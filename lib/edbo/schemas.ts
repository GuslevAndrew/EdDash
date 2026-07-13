import { z } from "zod";

export const importEducatorsOptionsSchema = z.object({
  dt: z.string().regex(/^\d{2}\.\d{2}\.\d{4}$/, "Дата має бути у форматі DD.MM.YYYY"),
  qf: z.string().min(1).optional(),
  eb: z.string().min(1).optional(),
  sp: z.string().min(1).optional(),
  rg: z.string().min(1).optional(),
  id: z.string().min(1).optional()
});

export const dashboardFiltersSchema = z.object({
  datasetType: z.enum(["entrants", "graduates", "students"]).default("students"),
  snapshotDate: z.string().optional(),
  snapshotDates: z
    .preprocess((value) => (Array.isArray(value) ? value : value ? [value] : undefined), z.array(z.string().trim().min(1)).optional()),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  years: z
    .preprocess((value) => (Array.isArray(value) ? value : value ? [value] : undefined), z.array(z.coerce.number().int().min(1900).max(2100)).optional()),
  regionId: z.coerce.number().int().positive().optional(),
  regionIds: z
    .preprocess((value) => (Array.isArray(value) ? value : value ? [value] : undefined), z.array(z.coerce.number().int().positive()).optional()),
  institutionTypeCode: z.string().min(1).optional(),
  institutionTypeCodes: z
    .preprocess((value) => (Array.isArray(value) ? value : value ? [value] : undefined), z.array(z.string().trim().min(1)).optional()),
  institutionId: z.coerce.number().int().positive().optional(),
  institutionIds: z
    .preprocess((value) => (Array.isArray(value) ? value : value ? [value] : undefined), z.array(z.coerce.number().int().positive()).optional()),
  fieldCode: z.string().trim().min(1).optional(),
  fieldCodes: z
    .preprocess((value) => (Array.isArray(value) ? value : value ? [value] : undefined), z.array(z.string().trim().min(1)).optional()),
  specialityId: z.coerce.number().int().positive().optional(),
  specialityCode: z.string().trim().min(1).optional(),
  specialityCodes: z
    .preprocess((value) => (Array.isArray(value) ? value : value ? [value] : undefined), z.array(z.string().trim().min(1)).optional()),
  educationLevelId: z.coerce.number().int().positive().optional(),
  educationLevelName: z.string().trim().min(1).optional(),
  educationLevelNames: z
    .preprocess((value) => (Array.isArray(value) ? value : value ? [value] : undefined), z.array(z.string().trim().min(1)).optional()),
  entryBaseId: z.coerce.number().int().positive().optional(),
  entryBaseIds: z
    .preprocess((value) => (Array.isArray(value) ? value : value ? [value] : undefined), z.array(z.coerce.number().int().positive()).optional()),
  studyFormId: z.coerce.number().int().positive().optional(),
  studyFormIds: z
    .preprocess((value) => (Array.isArray(value) ? value : value ? [value] : undefined), z.array(z.coerce.number().int().positive()).optional()),
  includeBlockedInstitutions: z
    .preprocess((value) => value === true || value === "true" || value === "1", z.boolean())
    .default(false),
  sortBy: z
    .enum([
      "institution",
      "institutionType",
      "region",
      "field",
      "speciality",
      "educationLevel",
      "entryBase",
      "studyForm",
      "snapshotDate",
      "studentsCount"
    ])
    .default("studentsCount"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20)
});

export type DashboardFiltersInput = z.infer<typeof dashboardFiltersSchema>;
