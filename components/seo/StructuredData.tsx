import Script from "next/script";

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "EdDash",
  url: "https://eddash.info",
  inLanguage: "uk-UA",
  description: "Аналітика освіти після школи на основі відкритих офіційних даних.",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://eddash.info/institutions?institution={search_term_string}",
    "query-input": "required name=search_term_string"
  }
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "EdDash",
  url: "https://eddash.info",
  logo: "https://eddash.info/brand/eddash-icon.png",
  email: "contact@eddash.info"
};

export function StructuredData() {
  return (
    <Script id="eddash-structured-data" type="application/ld+json" strategy="afterInteractive">
      {JSON.stringify([websiteSchema, organizationSchema])}
    </Script>
  );
}
