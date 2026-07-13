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
  professionalPreHigher: { code: "9", name: "Фахова передвища освіта" }
} as const;
