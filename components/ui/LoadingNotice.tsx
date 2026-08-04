"use client";

export function LoadingNotice({ text = "Оновлюю дані, зачекайте декілька секунд..." }: { text?: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-brand-100 bg-white text-sm text-brand-800 shadow-soft">
      <div className="h-0.5 animate-pulse bg-gradient-to-r from-brand-600 via-emerald-500 to-brand-600" />
      <div className="px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-600" />
        </span>
        <span>{text}</span>
        <span aria-hidden="true" className="inline-flex gap-0.5">
          <span className="animate-bounce">.</span>
          <span className="animate-bounce [animation-delay:120ms]">.</span>
          <span className="animate-bounce [animation-delay:240ms]">.</span>
        </span>
      </div>
      </div>
    </div>
  );
}
