export const EDBO_BASE_URL =
  process.env.EDBO_API_BASE_URL ?? "https://registry.edbo.gov.ua";

export const EDBO_USER_AGENT =
  process.env.EDBO_USER_AGENT ?? "EdDash MVP local analytics";

export const EDBO_ENDPOINTS = {
  regions: "/api/search/regions",
  specialities: "/api/search/specialities",
  educators: "/api/opendata/university-educators/",
  entrants: "/api/opendata/university-entrant/",
  graduates: "/api/opendata/university-graduate/",
  universities: "/api/opendata/universities/"
};

export const DEFAULT_TEST_DATES = ["01.10.2018", "01.10.2020", "01.10.2023"];
export const DEFAULT_EDUCATION_LEVELS = ["1", "2"];
export const DEFAULT_ENTRY_BASES = ["40", "30"];

export const INSTITUTION_TYPES = {
  higher: { code: "1", name: "Вища освіта" },
  scientific: { code: "8", name: "Наукові інститути (установи)" },
  professionalPreHigher: { code: "9", name: "Фахова передвища освіта" },
  postgraduate: { code: "10", name: "Заклади післядипломної освіти" }
} as const;

export const SUPPORTED_INSTITUTION_TYPE_CODES = ["1", "8", "9", "10"] as const;

export function getInstitutionTypeName(code: string): string {
  return Object.values(INSTITUTION_TYPES).find((item) => item.code === code)?.name ?? "Інший тип закладу освіти";
}
