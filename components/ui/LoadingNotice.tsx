"use client";

export function LoadingNotice({ text = "Оновлюю дані, зачекайте декілька секунд..." }: { text?: string }) {
  return (
    <div className="rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-800 shadow-sm">
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
  );
}
