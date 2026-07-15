import type { Metadata } from "next";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { StructuredData } from "@/components/seo/StructuredData";
import "./globals.css";

const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL("https://eddash.info"),
  title: {
    default: "EdDash",
    template: "%s | EdDash"
  },
  description: "Пошук, перевірка та аналіз української освіти після школи на основі відкритих даних ЄДЕБО",
  applicationName: "EdDash",
  authors: [{ name: "EdDash", url: "https://eddash.info" }],
  creator: "EdDash",
  publisher: "EdDash",
  openGraph: {
    title: "EdDash",
    description: "Освіта як на дошці: аналітика освіти після школи на основі відкритих офіційних даних.",
    url: "https://eddash.info",
    siteName: "EdDash",
    locale: "uk_UA",
    type: "website",
    images: [
      {
        url: "/brand/eddash-wordmark-wide.png",
        width: 1600,
        height: 400,
        alt: "EdDash"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "EdDash",
    description: "Аналітика освіти після школи на основі відкритих офіційних даних.",
    images: ["/brand/eddash-wordmark-wide.png"]
  },
  icons: {
    icon: "/brand/eddash-icon.png",
    apple: "/brand/eddash-icon.png"
  },
  alternates: {
    canonical: "/"
  },
  ...(googleSiteVerification
    ? {
        verification: {
          google: googleSiteVerification
        }
      }
    : {})
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body>
        {children}
        <StructuredData />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
