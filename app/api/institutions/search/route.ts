import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const minSearchLength = 3;
const maxResults = 30;

function numberValues(values: string[]): number[] {
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") ?? "").trim();
    const levelCodes = searchParams.getAll("level").filter((value) => value === "1" || value === "9");
    const regionIds = numberValues(searchParams.getAll("region"));
    const selectedIds = numberValues(searchParams.getAll("selected"));
    const showBlocked = searchParams.get("showBlocked") === "1";

    const baseWhere: Prisma.InstitutionWhereInput = {
      institutionTypeCode: { in: levelCodes.length ? levelCodes : ["1", "9"] },
      regionId: regionIds.length ? { in: regionIds } : undefined,
      blockedAt: showBlocked ? undefined : null
    };

    const selected = selectedIds.length
      ? await prisma.institution.findMany({
          where: { id: { in: selectedIds } },
          select: { id: true, name: true },
          orderBy: { name: "asc" }
        })
      : [];

    const matches =
      query.length >= minSearchLength
        ? await prisma.institution.findMany({
            where: {
              ...baseWhere,
              name: { contains: query, mode: "insensitive" }
            },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
            take: maxResults
          })
        : [];

    const itemsById = new Map<number, { id: number; name: string }>();
    for (const item of selected) itemsById.set(item.id, item);
    for (const item of matches) itemsById.set(item.id, item);

    return NextResponse.json({
      items: [...itemsById.values()].sort((first, second) =>
        first.name.localeCompare(second.name, "uk", { sensitivity: "base" })
      ),
      minSearchLength
    });
  } catch (error) {
    console.error("institution search api error", error);
    return NextResponse.json({ error: "Не вдалося виконати пошук закладів освіти." }, { status: 500 });
  }
}
