import type { Metadata } from "next";
import { isProjectPaused } from "@/lib/project-status";
import { PausedPage } from "@/components/home/PausedPage";

const pausedMetadata: Metadata = {
  title: { absolute: "EdDash — на паузі" },
  description: "EdDash тимчасово на паузі. Збережені дані чекають на наше повернення.",
  alternates: { canonical: "/" }
};

export async function generateMetadata(): Promise<Metadata> {
  if (isProjectPaused) return pausedMetadata;
  return (await import("@/components/home/ActiveHomePage")).metadata;
}

export default async function HomePage() {
  if (isProjectPaused) return <PausedPage />;
  const { default: ActiveHomePage } = await import("@/components/home/ActiveHomePage");
  return <ActiveHomePage />;
}
