import { createHash } from "node:crypto";
import { INSTITUTION_TYPES } from "./constants";
import type {
  NormalizedEducatorRow,
  NormalizedInstitution,
  NormalizedRegion,
  NormalizedSpeciality,
  NormalizedYearlyOutcomeRow,
  YearlyOutcomeType
} from "./types";

type LooseRecord = Record<string, unknown>;

const ENTRY_BASE_NAMES: Record<string, string> = {
  "650": "Без зазначеної основи вступу"
};

function asRecord(value: unknown): LooseRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as LooseRecord) : null;
}

export function extractRows(payload: unknown): LooseRecord[] {
  if (Array.isArray(payload)) return payload.filter(Boolean).map((item) => asRecord(item)).filter(Boolean) as LooseRecord[];
  const record = asRecord(payload);
  if (!record) return [];
  const candidates = ["data", "items", "results", "rows", "educators", "universities"];
  for (const key of candidates) {
    const value = record[key];
    if (Array.isArray(value)) return value.filter(Boolean).map((item) => asRecord(item)).filter(Boolean) as LooseRecord[];
  }
  return [record];
}

function pickString(row: LooseRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function normalizeShortName(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized || normalized === "." || normalized === "-") return undefined;
  return normalized;
}

function pickNumber(row: LooseRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
    if (typeof value === "string") {
      const parsed = Number(value.replace(/\s+/g, "").replace(",", "."));
      if (Number.isFinite(parsed)) return Math.round(parsed);
    }
  }
  return undefined;
}

export function normalizeRegionName(value: string | undefined): string {
  const name = value?.trim();
  if (!name) return "Без регіону";
  if (name === "Київ" || name === "м.Київ" || name === "місто Київ") return "м. Київ";
  if (name === "Невідомий регіон") return "Без регіону";
  if (name === "Автономна Республіка Крим" || name === "АР Крим") return "Автономна Республіка Крим";

  const oblastNames = new Map([
    ["Вінницька", "Вінницька область"],
    ["Волинська", "Волинська область"],
    ["Дніпропетровська", "Дніпропетровська область"],
    ["Донецька", "Донецька область"],
    ["Житомирська", "Житомирська область"],
    ["Закарпатська", "Закарпатська область"],
    ["Запорізька", "Запорізька область"],
    ["Івано-Франківська", "Івано-Франківська область"],
    ["Київська", "Київська область"],
    ["Кіровоградська", "Кіровоградська область"],
    ["Луганська", "Луганська область"],
    ["Львівська", "Львівська область"],
    ["Миколаївська", "Миколаївська область"],
    ["Одеська", "Одеська область"],
    ["Полтавська", "Полтавська область"],
    ["Рівненська", "Рівненська область"],
    ["Сумська", "Сумська область"],
    ["Тернопільська", "Тернопільська область"],
    ["Харківська", "Харківська область"],
    ["Херсонська", "Херсонська область"],
    ["Хмельницька", "Хмельницька область"],
    ["Черкаська", "Черкаська область"],
    ["Чернівецька", "Чернівецька область"],
    ["Чернігівська", "Чернігівська область"]
  ]);

  if (oblastNames.has(name)) return oblastNames.get(name) ?? name;
  return name;
}

function normalizeFoundationYear(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = value.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  return match?.[1] ?? value;
}

function normalizeEducationLevelName(value: string | undefined, code: string | undefined): string {
  const name = value?.trim();
  const normalizedName = name?.toLocaleLowerCase("uk-UA");
  if (normalizedName?.includes("молодший бакалавр") || normalizedName?.includes("молодший спеціаліст")) {
    return "Фаховий молодший бакалавр";
  }
  if (normalizedName?.includes("магістр") || normalizedName?.includes("спеціаліст")) return "Магістр";
  if (name === "Доктор філософії" || code === "7") return "Доктор філософії (PhD)";
  return name ?? `Освітній рівень ${code ?? "невідомий"}`;
}

function sumNumbers(row: LooseRecord, keys: readonly string[]): number | undefined {
  let total = 0;
  let found = false;
  for (const key of keys) {
    const value = pickNumber(row, [key]);
    if (value !== undefined) {
      total += value;
      found = true;
    }
  }
  return found ? total : undefined;
}

const STUDY_FORM_COLUMNS = [
  {
    code: "day_budget",
    name: "Денна (бюджет)",
    keys: ["Денна (бюджет)", "Р”РµРЅРЅР° (Р±СЋРґР¶РµС‚)"]
  },
  {
    code: "day_contract",
    name: "Денна (контракт)",
    keys: ["Денна (контракт)", "Р”РµРЅРЅР° (РєРѕРЅС‚СЂР°РєС‚)"]
  },
  {
    code: "part_time_budget",
    name: "Заочна (бюджет)",
    keys: ["Заочна (бюджет)", "Р—Р°РѕС‡РЅР° (Р±СЋРґР¶РµС‚)"]
  },
  {
    code: "part_time_contract",
    name: "Заочна (контракт)",
    keys: ["Заочна (контракт)", "Р—Р°РѕС‡РЅР° (РєРѕРЅС‚СЂР°РєС‚)"]
  },
  {
    code: "evening_budget",
    name: "Вечірня (бюджет)",
    keys: ["Вечірня (бюджет)", "Р’РµС‡С–СЂРЅСЏ (Р±СЋРґР¶РµС‚)"]
  },
  {
    code: "evening_contract",
    name: "Вечірня (контракт)",
    keys: ["Вечірня (контракт)", "Р’РµС‡С–СЂРЅСЏ (РєРѕРЅС‚СЂР°РєС‚)"]
  }
] as const;

export function parseUkrainianDate(value: string): Date {
  const [day, month, year] = value.split(".").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function normalizeRegions(payload: unknown): NormalizedRegion[] {
  return extractRows(payload)
    .map((row) => ({
      externalId: pickString(row, ["Код регіону", "id", "region_id", "KOATUU", "externalId"]),
      code: pickString(row, ["Код регіону", "code", "region_code", "KOATUU"]),
      name: normalizeRegionName(pickString(row, ["Назва регіону", "name", "region_name", "RegionName", "nameU"]))
    }))
    .filter((row) => row.name);
}

export function normalizeSpecialities(payload: unknown): NormalizedSpeciality[] {
  return extractRows(payload)
    .map((row) => ({
      externalId: pickString(row, ["Ідентифікатор спеціальності", "id", "speciality_id", "externalId"]),
      code: pickString(row, ["Код спеціальності", "code", "speciality_code", "SpecCode"]),
      name: pickString(row, ["Назва спеціальності", "name", "speciality_name", "SpecName", "nameU"]) ?? "",
      fieldCode: pickString(row, ["field_code", "FieldCode", "branch_code"]),
      fieldName: pickString(row, ["field_name", "FieldName", "branch_name"])
    }))
    .filter((row) => row.name);
}

export function normalizeInstitutions(payload: unknown, institutionTypeCode: string): NormalizedInstitution[] {
  const fallbackType =
    institutionTypeCode === INSTITUTION_TYPES.professionalPreHigher.code
      ? INSTITUTION_TYPES.professionalPreHigher
      : INSTITUTION_TYPES.higher;

  return extractRows(payload)
    .map((row) => ({
      externalId: pickString(row, ["Код", "id", "university_id", "institution_id"]),
      parentExternalId: pickString(row, ["Код головного закладу", "parent_id", "main_university_id"]),
      name: pickString(row, ["Назва закладу освіти", "name", "university_name", "institution_name"]) ?? "",
      shortName: normalizeShortName(pickString(row, ["Скорочена назва", "Коротка назва", "short_name", "university_short_name"])),
      institutionTypeCode,
      institutionTypeName: fallbackType.name,
      regionName: normalizeRegionName(pickString(row, ["Регіон (місцезнаходження)", "Регіон", "Область", "region_name", "RegionName"])),
      regionCode: pickString(row, ["Код регіону", "region_code", "KOATUU"]),
      foundationYear: normalizeFoundationYear(pickString(row, ["Рік заснування", "foundation_year", "founded_at"])),
      ownership: pickString(row, ["Форма власності", "ownership"]),
      settlement: pickString(row, ["Населений пункт (місцезнаходження)", "settlement", "city"]),
      address: pickString(row, ["Адреса (місцезнаходження)", "address"]),
      phone: pickString(row, ["Телефон / факс", "phone"]),
      email: pickString(row, ["Електронна пошта", "email"]),
      website: pickString(row, ["Веб-сайт", "website", "site"]),
      blockedAt: pickString(row, ["Дата блокування суб'єкта освітньої діяльності в ЄДЕБО", "blocked_at"]),
      governingBody: pickString(row, ["Найменування органу...", "Підпорядкування", "governing_body"])
    }))
    .filter((row) => row.name);
}

export function normalizeEducators(payload: unknown, params: { dt: string; qf?: string; eb?: string }): NormalizedEducatorRow[] {
  return extractRows(payload).flatMap((row) => {
    const snapshotDate = parseUkrainianDate(pickString(row, ["Станом на", "РЎС‚Р°РЅРѕРј РЅР°", "snapshotDate", "dt"]) ?? params.dt);
    const institutionName = pickString(row, [
      "Назва закладу освіти",
      "РќР°Р·РІР° Р·Р°РєР»Р°РґСѓ РѕСЃРІС–С‚Рё",
      "university_name",
      "universityName",
      "UniversityName",
      "institution_name",
      "education_name",
      "name"
    ]);
    const specialityName = pickString(row, [
      "Назва спеціальності",
      "РќР°Р·РІР° СЃРїРµС†С–Р°Р»СЊРЅРѕСЃС‚С–",
      "speciality_name",
      "specialityName",
      "SpecName",
      "speciality",
      "specialty_name"
    ]);
    const regionName = normalizeRegionName(pickString(row, ["Регіон", "Р РµРіС–РѕРЅ", "region_name", "regionName", "RegionName", "region"]));
    const studyFormCounts: Array<{ code: string; name: string; studentsCount: number }> = [];
    for (const form of STUDY_FORM_COLUMNS) {
      const studentsCount = pickNumber(row, [...form.keys]);
      if (studentsCount) {
        studyFormCounts.push({ code: form.code, name: form.name, studentsCount });
      }
    }
    const fallbackStudentsCount =
      pickNumber(row, [
        "students_count",
        "studentsCount",
        "cnt",
        "count",
        "Count",
        "value",
        "Кількість здобувачів",
        "РљС–Р»СЊРєС–С‚СЊ Р·РґРѕР±СѓРІР°С‡С–РІ"
      ]) ?? sumNumbers(row, STUDY_FORM_COLUMNS.flatMap((form) => [...form.keys]));
    const counts = studyFormCounts.length
      ? studyFormCounts
      : fallbackStudentsCount !== undefined
        ? [{ code: "total", name: "Усі форми навчання", studentsCount: fallbackStudentsCount }]
        : [];

    if (!institutionName || !specialityName || !counts.length) return [];

    const normalizedBase = {
      snapshotDate,
      institutionExternalId: pickString(row, ["Код", "РљРѕРґ", "university_id", "institution_id", "UniversityId", "id_university"]),
      institutionName,
      institutionShortName: normalizeShortName(pickString(row, ["Скорочена назва", "РЎРєРѕСЂРѕС‡РµРЅР° РЅР°Р·РІР°", "short_name", "university_short_name", "ShortName"])),
      regionExternalId: pickString(row, ["region_id", "RegionId"]),
      regionCode: pickString(row, ["region_code", "KOATUU"]),
      regionName,
      specialityExternalId: pickString(row, ["speciality_id", "SpecId"]),
      specialityCode: pickString(row, ["Код спеціальності", "РљРѕРґ СЃРїРµС†С–Р°Р»СЊРЅРѕСЃС‚С–", "speciality_code", "SpecCode", "sp"]),
      specialityName,
      fieldCode: pickString(row, ["field_code", "FieldCode"]),
      fieldName: pickString(row, ["field_name", "FieldName"]),
      educationLevelCode: params.qf ?? pickString(row, ["qualification_id", "qf", "education_level_code"]) ?? "unknown",
      educationLevelName: normalizeEducationLevelName(
        pickString(row, ["Освітній ступінь", "РћСЃРІС–С‚РЅС–Р№ СЃС‚СѓРїС–РЅСЊ", "qualification_name", "education_level", "EducationLevel"]),
        params.qf ?? pickString(row, ["qualification_id", "qf", "education_level_code"])
      ),
      entryBaseCode: params.eb ?? pickString(row, ["entry_base_id", "eb", "entry_base_code"]) ?? "unknown",
      entryBaseName:
        pickString(row, ["Основа вступу", "РћСЃРЅРѕРІР° РІСЃС‚СѓРїСѓ", "entry_base_name", "EntryBase"]) ??
        ENTRY_BASE_NAMES[params.eb ?? ""] ??
        `Основа вступу ${params.eb ?? "невідома"}`
    };

    return counts.map((count) => ({
      ...normalizedBase,
      studyFormCode: count.code,
      studyFormName: count.name,
      studentsCount: count.studentsCount,
      sourceHash: createHash("sha256").update(JSON.stringify({ row, studyFormCode: count.code })).digest("hex")
    }));
  });
}

export function normalizeYearlyOutcomes(
  payload: unknown,
  params: { type: YearlyOutcomeType; y: string; qf?: string; eb?: string }
): NormalizedYearlyOutcomeRow[] {
  return extractRows(payload).flatMap((row) => {
    const year =
      pickNumber(row, [
        params.type === "entrants" ? "Рік вступу" : "Рік закінчення навчання",
        "year",
        "y"
      ]) ?? Number(params.y);
    const institutionName = pickString(row, [
      "Назва закладу освіти",
      "university_name",
      "universityName",
      "UniversityName",
      "institution_name",
      "education_name",
      "name"
    ]);
    const specialityName = pickString(row, [
      "Назва спеціальності",
      "speciality_name",
      "specialityName",
      "SpecName",
      "speciality",
      "specialty_name"
    ]);
    const studyFormCounts = STUDY_FORM_COLUMNS.flatMap((form) => {
      const personsCount = sumNumbers(row, form.keys);
      return personsCount ? [{ code: form.code, name: form.name, personsCount }] : [];
    });
    const fallbackPersonsCount = sumNumbers(row, STUDY_FORM_COLUMNS.flatMap((form) => [...form.keys]));

    if (!Number.isFinite(year) || !institutionName || !specialityName || (!studyFormCounts.length && !fallbackPersonsCount)) return [];

    const educationLevelCode = params.qf ?? pickString(row, ["qualification_id", "qf", "education_level_code"]) ?? "unknown";
    const entryBaseCode = params.eb ?? pickString(row, ["entry_base_id", "eb", "entry_base_code"]) ?? "unknown";

    const base = {
      type: params.type,
      year,
      institutionExternalId: pickString(row, ["Код", "university_id", "institution_id", "UniversityId", "id_university"]),
      institutionName,
      institutionShortName: normalizeShortName(pickString(row, ["Скорочена назва", "short_name", "university_short_name", "ShortName"])),
      regionExternalId: pickString(row, ["region_id", "RegionId"]),
      regionCode: pickString(row, ["region_code", "KOATUU"]),
      regionName: normalizeRegionName(pickString(row, ["Регіон", "region_name", "regionName", "RegionName", "region"])),
      specialityExternalId: pickString(row, ["speciality_id", "SpecId"]),
      specialityCode: pickString(row, ["Код спеціальності", "speciality_code", "SpecCode", "sp"]),
      specialityName,
      fieldCode: pickString(row, ["field_code", "FieldCode"]),
      fieldName: pickString(row, ["field_name", "FieldName"]),
      educationLevelCode,
      educationLevelName: normalizeEducationLevelName(
        pickString(row, ["Освітній ступінь", "qualification_name", "education_level", "EducationLevel"]),
        educationLevelCode
      ),
      entryBaseCode,
      entryBaseName:
        pickString(row, ["Основа вступу", "entry_base_name", "EntryBase"]) ??
        ENTRY_BASE_NAMES[entryBaseCode] ??
        `Основа вступу ${entryBaseCode}`
    };

    if (studyFormCounts.length) {
      return studyFormCounts.map((form) => ({
        ...base,
        studyFormCode: form.code,
        studyFormName: form.name,
        personsCount: form.personsCount,
        sourceHash: createHash("sha256").update(JSON.stringify({ type: params.type, row, studyFormCode: form.code })).digest("hex")
      }));
    }

    return [
      {
        ...base,
        personsCount: fallbackPersonsCount ?? 0,
        sourceHash: createHash("sha256").update(JSON.stringify({ type: params.type, row })).digest("hex")
      }
    ];
  });
}
