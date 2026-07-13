"use client";

import { useMemo, useState } from "react";
import { useAutoCloseDetails } from "@/components/ui/useAutoCloseDetails";

export type SearchableMultiSelectOption = {
  value: string;
  label: string;
};

type SearchableMultiSelectFieldProps = {
  label: string;
  name: string;
  options: SearchableMultiSelectOption[];
  selectedValues: string[];
  placeholder: string;
  selectedLabel: string;
  disableSearch?: boolean;
  hideResetButton?: boolean;
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

export function SearchableMultiSelectField({
  label,
  name,
  options,
  selectedValues,
  placeholder,
  selectedLabel,
  disableSearch = false,
  hideResetButton = false
}: SearchableMultiSelectFieldProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => selectedValues);
  const detailsRef = useAutoCloseDetails();
  const selectedOptions = useMemo(
    () => options.filter((option) => selected.includes(option.value)),
    [options, selected]
  );
  const labelText = !selectedOptions.length
    ? placeholder
    : selectedOptions.length <= 2
      ? selectedOptions.map((option) => option.label).join(", ")
      : `${selectedLabel}: ${selectedOptions.length}`;
  const filteredOptions = query ? options.filter((option) => matchesQuery(option.label, query)) : options;

  function toggleValue(value: string, checked: boolean) {
    setSelected((current) => {
      if (checked) return current.includes(value) ? current : [...current, value];
      return current.filter((item) => item !== value);
    });
  }

  return (
    <div className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <details ref={detailsRef} className="group relative mt-1">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none hover:bg-slate-50 focus:border-brand-500">
          <span className="truncate">{labelText}</span>
          <span className="text-xs text-muted group-open:rotate-180">▼</span>
        </summary>
        <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-md border border-line bg-white p-2 shadow-lg">
          {!disableSearch ? (
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mb-2 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand-500"
              placeholder="Пошук у списку"
            />
          ) : null}
          {!hideResetButton ? (
            <button
              type="button"
              onClick={() => setSelected([])}
              disabled={!selected.length}
              className="mb-2 w-full rounded-md border border-line px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Скинути
            </button>
          ) : null}
          {filteredOptions.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              <input
                type="checkbox"
                name={name}
                value={option.value}
                checked={selected.includes(option.value)}
                onChange={(event) => toggleValue(option.value, event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span>{option.label}</span>
            </label>
          ))}
          {!filteredOptions.length ? <p className="px-2 py-3 text-sm text-muted">Нічого не знайдено</p> : null}
        </div>
      </details>
    </div>
  );
}
