"use client";

import { useMemo, useState } from "react";
import { useAutoCloseDetails } from "@/components/ui/useAutoCloseDetails";

type InstitutionOption = {
  id: number;
  name: string;
};

type InstitutionMultiSelectProps = {
  institutions: InstitutionOption[];
  selectedInstitutionIds: number[];
};

function matchesQuery(label: string, query: string): boolean {
  const normalizedLabel = label.toLocaleLowerCase("uk-UA");
  const words = query
    .toLocaleLowerCase("uk-UA")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  return words.every((word) => normalizedLabel.includes(word));
}

export function InstitutionMultiSelect({ institutions, selectedInstitutionIds }: InstitutionMultiSelectProps) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => selectedInstitutionIds.map(String));
  const detailsRef = useAutoCloseDetails();

  const selectedNames = useMemo(
    () => institutions.filter((institution) => selectedIds.includes(String(institution.id))).map((institution) => institution.name),
    [institutions, selectedIds]
  );
  const label = useMemo(() => {
    if (!selectedNames.length) return "Оберіть заклад освіти";
    if (selectedNames.length <= 2) return selectedNames.join(", ");
    return `Обрано закладів: ${selectedNames.length}`;
  }, [selectedNames]);
  const filteredInstitutions = query
    ? institutions.filter((institution) => matchesQuery(institution.name, query))
    : institutions;

  function toggleInstitution(institutionId: number, checked: boolean) {
    setSelectedIds((current) => {
      const value = String(institutionId);
      if (checked) return current.includes(value) ? current : [...current, value];
      return current.filter((item) => item !== value);
    });
  }

  function resetSelection() {
    setSelectedIds([]);
  }

  return (
    <div className="block">
      <span className="text-sm font-medium text-slate-700">Заклад освіти</span>
      <details ref={detailsRef} className="group relative mt-1">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none hover:bg-slate-50 focus:border-brand-500">
          <span className="truncate">{label}</span>
          <span className="text-xs text-muted group-open:rotate-180">▼</span>
        </summary>
        <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-md border border-line bg-white p-2 shadow-lg">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mb-2 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand-500"
            placeholder="Пошук у списку"
          />
          <button
            type="button"
            onClick={resetSelection}
            disabled={!selectedIds.length}
            className="mb-2 w-full rounded-md border border-line px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Скинути
          </button>
          {filteredInstitutions.map((institution) => (
            <label key={institution.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              <input
                type="checkbox"
                name="institution"
                value={institution.id}
                checked={selectedIds.includes(String(institution.id))}
                onChange={(event) => toggleInstitution(institution.id, event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span>{institution.name}</span>
            </label>
          ))}
          {!filteredInstitutions.length ? <p className="px-2 py-3 text-sm text-muted">Нічого не знайдено</p> : null}
        </div>
      </details>
    </div>
  );
}
