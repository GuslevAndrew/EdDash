"use client";

export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative isolate inline-flex align-middle">
      <button
        type="button"
        aria-label="Пояснення"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xs font-bold leading-none text-brand-700 shadow-sm transition hover:-translate-y-px hover:border-brand-400 hover:bg-brand-100 hover:text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
      >
        ?
      </button>
      <span className="pointer-events-none absolute left-1/2 top-7 z-[9999] hidden w-80 max-w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 whitespace-normal rounded-md bg-slate-950 px-3.5 py-3 text-left text-xs font-medium leading-5 text-white shadow-dropdown ring-1 ring-white/10 group-hover:block group-focus-within:block">
        <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-950" />
        <span className="relative block">{text}</span>
      </span>
    </span>
  );
}
