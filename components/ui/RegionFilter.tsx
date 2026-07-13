"use client";

import { useMemo, useState } from "react";
import { useAutoCloseDetails } from "@/components/ui/useAutoCloseDetails";

type RegionOption = {
  id: number;
  name: string;
};

type RegionFilterProps = {
  regions: RegionOption[];
  selectedRegionIds: number[];
};

export function RegionFilter({ regions, selectedRegionIds }: RegionFilterProps) {
  const [selectedIds, setSelectedIds] = useState(() => selectedRegionIds.map(String));
  const detailsRef = useAutoCloseDetails();

  const allSelected = regions.length > 0 && regions.every((region) => selectedIds.includes(String(region.id)));
  const label = useMemo(() => {
    if (!selectedIds.length || allSelected) return "Оберіть регіон";
    const names = regions.filter((region) => selectedIds.includes(String(region.id))).map((region) => region.name);
    if (names.length <= 2) return names.join(", ");
    return `Обрано регіонів: ${names.length}`;
  }, [allSelected, regions, selectedIds]);

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? regions.map((region) => String(region.id)) : []);
  }

  function toggleRegion(regionId: number, checked: boolean) {
    setSelectedIds((current) => {
      const value = String(regionId);
      if (checked) return current.includes(value) ? current : [...current, value];
      return current.filter((item) => item !== value);
    });
  }

  return (
    <div className="block">
      <span className="text-sm font-medium text-slate-700">Регіон</span>
      <details ref={detailsRef} className="group relative mt-1">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none hover:bg-slate-50 focus:border-brand-500">
          <span className="truncate">{label}</span>
          <span className="text-xs text-muted group-open:rotate-180">▼</span>
        </summary>
        <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-md border border-line bg-white p-2 shadow-lg">
          <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) => toggleAll(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span>Усі регіони</span>
          </label>
          <div className="my-1 border-t border-line" />
          {regions.map((region) => (
            <label key={region.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              <input
                type="checkbox"
                name="region"
                value={region.id}
                checked={selectedIds.includes(String(region.id))}
                onChange={(event) => toggleRegion(region.id, event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span>{region.name}</span>
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
