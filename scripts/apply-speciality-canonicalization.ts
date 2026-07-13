import { prisma } from "@/lib/db";
import { getCanonicalSpeciality } from "@/lib/specialities/canonical";

async function main() {
  const specialities = await prisma.speciality.findMany({
    select: { id: true, code: true, name: true }
  });

  const stats = new Map<string, number>();

  for (const speciality of specialities) {
    const canonical = getCanonicalSpeciality({ code: speciality.code, name: speciality.name });
    stats.set(canonical.source, (stats.get(canonical.source) ?? 0) + 1);

    await prisma.speciality.update({
      where: { id: speciality.id },
      data: {
        canonicalCode: canonical.source === "unmapped" ? null : canonical.code,
        canonicalName: canonical.source === "unmapped" ? null : canonical.name,
        canonicalFieldCode: canonical.source === "unmapped" ? null : canonical.fieldCode,
        canonicalFieldName: canonical.source === "unmapped" ? null : canonical.fieldName,
        canonicalSource: canonical.source
      }
    });
  }

  const mapped = specialities.length - (stats.get("unmapped") ?? 0);
  console.log(`Опрацьовано спеціальностей: ${specialities.length}`);
  console.log(`Уніфіковано: ${mapped}`);
  console.log(`Без відповідності: ${stats.get("unmapped") ?? 0}`);
  for (const [source, count] of [...stats.entries()].sort((first, second) => first[0].localeCompare(second[0]))) {
    console.log(`${source}: ${count}`);
  }
}

main()
  .catch((error) => {
    console.error("Не вдалося уніфікувати спеціальності:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
