"use client";

export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label="Пояснення"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xs font-bold leading-none text-brand-700 shadow-sm transition hover:border-brand-400 hover:bg-brand-100 hover:text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
      >
        ?
      </button>
      <span className="pointer-events-none absolute left-1/2 top-7 z-[200] hidden w-80 max-w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 whitespace-normal rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium leading-5 text-slate-700 shadow-xl ring-1 ring-slate-900/5 group-hover:block group-focus-within:block">
        {text}
      </span>
    </span>
  );
}
