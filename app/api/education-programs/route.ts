import { NextResponse } from "next/server";
import educationProgramsData from "@/data/education-programs-2025.json";
import type { EducationProgramRow, EducationProgramsDataset } from "@/lib/education-programs/types";
import { specialityCatalogSource } from "@/lib/specialities/catalog";

type Option = {
  value: string;
  label: string;
};

const dataset = educationProgramsData as EducationProgramsDataset;
const defaultLimit = 50;
const maxLimit = 250;

const institutionTypeLabels: Record<string, string> = {
  "1": "Вища освіта",
  "8": "Наукові інститути (установи)",
  "9": "Фахова передвища освіта",
  "10": "Заклади післядипломної освіти",
  unknown: "Рівень закладу не визначено"
};

function getValues(params: URLSearchParams, key: string): string[] {
  return params.getAll(key).map((value) => value.trim()).filter(Boolean);
}

function getLimit(params: URLSearchParams): number {
  const raw = Number(params.get("limit") ?? defaultLimit);
  if (!Number.isFinite(raw) || raw <= 0) return defaultLimit;
  return Math.min(Math.floor(raw), maxLimit);
}

function getSpecializationValue(row: EducationProgramRow): string {
  if (!row.specializationCode || !row.specializationName) return "";
  return `${row.specializationCode}|||${row.specializationName}`;
}

function uniqueOptions(values: string[]): Option[] {
  return [...new Set(values.filter(Boolean))]
    .sort((first, second) => first.localeCompare(second, "uk", { sensitivity: "base", numeric: true }))
    .map((value) => ({ value, label: value }));
}

function matchesFilters(
  row: EducationProgramRow,
  filters: {
    regions: string[];
    institutions: string[];
    institutionTypes: string[];
    fields: string[];
    specialities: string[];
    specializations: string[];
  }
): boolean {
  if (filters.regions.length && !filters.regions.includes(row.region)) return false;
  if (filters.institutions.length && !filters.institutions.includes(row.institutionCode)) return false;
  if (filters.institutionTypes.length && !filters.institutionTypes.includes(row.institutionTypeCode)) return false;
  if (filters.fields.length && !filters.fields.includes(row.fieldCode)) return false;
  if (filters.specialities.length && !filters.specialities.includes(row.specialityCode)) return false;
  if (filters.specializations.length && !filters.specializations.includes(getSpecializationValue(row))) return false;
  return true;
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const filters = {
    regions: getValues(url.searchParams, "region"),
    institutions: getValues(url.searchParams, "institution"),
    institutionTypes: getValues(url.searchParams, "level"),
    fields: getValues(url.searchParams, "field"),
    specialities: getValues(url.searchParams, "speciality"),
    specializations: getValues(url.searchParams, "specialization")
  };
  const limit = getLimit(url.searchParams);
  const rows = dataset.rows;
  const filteredRows = rows.filter((row) => matchesFilters(row, filters));

  const institutionRows = rows.filter((row) => {
    if (filters.regions.length && !filters.regions.includes(row.region)) return false;
    if (filters.institutionTypes.length && !filters.institutionTypes.includes(row.institutionTypeCode)) return false;
    return true;
  });
  const institutionOptions = new Map<string, string>();
  for (const row of institutionRows) institutionOptions.set(row.institutionCode, row.institutionName);

  const specialityRows = rows.filter((row) => !filters.fields.length || filters.fields.includes(row.fieldCode));
  const specialityOptions = new Map<string, string>();
  for (const row of specialityRows) specialityOptions.set(row.specialityCode, `${row.specialityCode} ${row.specialityName}`);

  const specializationRows = rows.filter((row) => {
    if (filters.fields.length && !filters.fields.includes(row.fieldCode)) return false;
    if (filters.specialities.length && !filters.specialities.includes(row.specialityCode)) return false;
    return Boolean(row.specializationCode && row.specializationName);
  });
  const specializationOptions = new Map<string, string>();
  for (const row of specializationRows) specializationOptions.set(getSpecializationValue(row), `${row.specializationCode} ${row.specializationName}`);

  const institutionTypeOptions = new Map<string, string>();
  for (const row of rows) institutionTypeOptions.set(row.institutionTypeCode, institutionTypeLabels[row.institutionTypeCode] ?? row.institutionTypeName);

  return NextResponse.json({
    year: dataset.year,
    totalRows: dataset.totalRows,
    filteredCount: filteredRows.length,
    rows: filteredRows.slice(0, limit),
    options: {
      regions: uniqueOptions(rows.map((row) => row.region)),
      institutionTypes: [...institutionTypeOptions.entries()]
        .sort((first, second) => first[1].localeCompare(second[1], "uk", { sensitivity: "base", numeric: true }))
        .map(([value, label]) => ({ value, label })),
      institutions: [...institutionOptions.entries()]
        .sort((first, second) => first[1].localeCompare(second[1], "uk", { sensitivity: "base", numeric: true }))
        .map(([value, label]) => ({ value, label })),
      fields: specialityCatalogSource.fields
        .filter((field) => rows.some((row) => row.fieldCode === field.code))
        .map((field) => ({ value: field.code, label: `${field.code} ${field.name}` })),
      specialities: [...specialityOptions.entries()]
        .sort((first, second) => first[0].localeCompare(second[0], "uk", { sensitivity: "base", numeric: true }))
        .map(([value, label]) => ({ value, label })),
      specializations: [...specializationOptions.entries()]
        .sort((first, second) => first[1].localeCompare(second[1], "uk", { sensitivity: "base", numeric: true }))
        .map(([value, label]) => ({ value, label }))
    }
  });
}
