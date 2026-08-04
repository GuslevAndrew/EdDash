"use client";

export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label="Пояснення"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xs font-bold leading-none text-brand-700 transition hover:border-brand-400 hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
      >
        ?
      </button>
      <span className="pointer-events-none absolute left-1/2 top-7 z-30 hidden w-72 -translate-x-1/2 rounded-md border border-line bg-white px-3 py-2 text-left text-xs font-medium leading-5 text-slate-700 shadow-lg group-hover:block group-focus-within:block">
        {text}
      </span>
    </span>
  );
}
