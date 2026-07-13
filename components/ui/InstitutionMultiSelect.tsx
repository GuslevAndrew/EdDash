"use client";

import { useEffect, useMemo, useState } from "react";
import { useAutoCloseDetails } from "@/components/ui/useAutoCloseDetails";

type InstitutionOption = {
  id: number;
  name: string;
};

type InstitutionMultiSelectProps = {
  institutions: InstitutionOption[];
  selectedInstitutionIds: number[];
  levelCodes?: string[];
  regionIds?: number[];
  showBlocked?: boolean;
};

type InstitutionSearchResponse = {
  items: InstitutionOption[];
  minSearchLength: number;
};

const minSearchLength = 3;

export function InstitutionMultiSelect({
  institutions,
  selectedInstitutionIds,
  levelCodes = [],
  regionIds = [],
  showBlocked = false
}: InstitutionMultiSelectProps) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => selectedInstitutionIds.map(String));
  const [options, setOptions] = useState(institutions);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const detailsRef = useAutoCloseDetails();

  const selectedNames = useMemo(
    () => options.filter((institution) => selectedIds.includes(String(institution.id))).map((institution) => institution.name),
    [options, selectedIds]
  );

  const label = useMemo(() => {
    if (!selectedNames.length) return "Оберіть заклад освіти";
    if (selectedNames.length <= 2) return selectedNames.join(", ");
    return `Обрано закладів: ${selectedNames.length}`;
  }, [selectedNames]);

  useEffect(() => {
    setOptions(institutions);
  }, [institutions]);

  useEffect(() => {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length > 0 && normalizedQuery.length < minSearchLength) {
      setError("");
      setOptions((current) => current.filter((institution) => selectedIds.includes(String(institution.id))));
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      const params = new URLSearchParams();
      if (normalizedQuery.length >= minSearchLength) params.set("q", normalizedQuery);
      for (const levelCode of levelCodes) params.append("level", levelCode);
      for (const regionId of regionIds) params.append("region", String(regionId));
      for (const selectedId of selectedIds) params.append("selected", selectedId);
      if (showBlocked) params.set("showBlocked", "1");

      setIsLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/institutions/search?${params.toString()}`, {
          signal: controller.signal
        });
        if (!response.ok) throw new Error("Search request failed");
        const data = (await response.json()) as InstitutionSearchResponse;
        setOptions(data.items);
      } catch (searchError) {
        if (searchError instanceof DOMException && searchError.name === "AbortError") return;
        setError("Не вдалося завантажити заклади освіти.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [levelCodes, query, regionIds, selectedIds, showBlocked]);

  function toggleInstitution(institutionId: number, checked: boolean) {
    setSelectedIds((current) => {
      const value = String(institutionId);
      if (checked) return current.includes(value) ? current : [...current, value];
      return current.filter((item) => item !== value);
    });
  }

  function resetSelection() {
    setSelectedIds([]);
    setQuery("");
    setOptions([]);
  }

  const trimmedQuery = query.trim();
  const shouldPromptForQuery = !trimmedQuery && !selectedIds.length;
  const shouldPromptForMoreCharacters = trimmedQuery.length > 0 && trimmedQuery.length < minSearchLength;
  const shouldShowEmptyState = trimmedQuery.length >= minSearchLength && !isLoading && !options.length;

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
            placeholder="Пошук у списку: введіть перші три літери назви закладу освіти"
          />
          <button
            type="button"
            onClick={resetSelection}
            disabled={!selectedIds.length}
            className="mb-2 w-full rounded-md border border-line px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Скинути
          </button>

          {isLoading ? <p className="px-2 py-3 text-sm text-muted">Завантажую заклади...</p> : null}
          {error ? <p className="px-2 py-3 text-sm text-rose-700">{error}</p> : null}
          {shouldPromptForQuery ? <p className="px-2 py-3 text-sm text-muted">Почніть вводити назву закладу освіти.</p> : null}
          {shouldPromptForMoreCharacters ? <p className="px-2 py-3 text-sm text-muted">Для пошуку введіть ще кілька символів.</p> : null}

          {options.map((institution) => (
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

          {shouldShowEmptyState ? <p className="px-2 py-3 text-sm text-muted">Нічого не знайдено</p> : null}
        </div>
      </details>
    </div>
  );
}
