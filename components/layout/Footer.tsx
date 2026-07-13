import Image from "next/image";

function MailIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16v12H4z" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="mt-12 border-t border-line bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <Image
          src="/brand/eddash-logo.png"
          alt="EdDash"
          width={132}
          height={38}
          unoptimized
          className="h-8 w-auto object-contain"
        />

        <div className="flex flex-wrap items-center gap-2">
          <a
            className="inline-flex items-center gap-2 rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100"
            href="mailto:contact@eddash.info"
          >
            <MailIcon />
            contact@eddash.info
          </a>
        </div>
      </div>
    </footer>
  );
}
