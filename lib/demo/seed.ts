import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

const regions = [
  { code: "demo-kyiv", name: "м. Київ" },
  { code: "demo-lviv", name: "Львівська область" },
  { code: "demo-kharkiv", name: "Харківська область" },
  { code: "demo-odesa", name: "Одеська область" },
  { code: "demo-dnipro", name: "Дніпропетровська область" }
];

const institutions = [
  { externalId: "demo-kpi", name: "Тестовий НТУУ КПІ імені Ігоря Сікорського", shortName: "Тестовий КПІ", region: "demo-kyiv" },
  { externalId: "demo-knu", name: "Тестовий Київський національний університет", shortName: "Тестовий КНУ", region: "demo-kyiv" },
  { externalId: "demo-lnu", name: "Тестовий Львівський національний університет", shortName: "Тестовий ЛНУ", region: "demo-lviv" },
  { externalId: "demo-khnu", name: "Тестовий Харківський національний університет", shortName: "Тестовий ХНУ", region: "demo-kharkiv" },
  { externalId: "demo-onu", name: "Тестовий Одеський національний університет", shortName: "Тестовий ОНУ", region: "demo-odesa" },
  { externalId: "demo-dnu", name: "Тестовий Дніпровський національний університет", shortName: "Тестовий ДНУ", region: "demo-dnipro" }
];

const specialities = [
  { code: "121", name: "Інженерія програмного забезпечення", fieldCode: "12", fieldName: "Інформаційні технології" },
  { code: "122", name: "Комп'ютерні науки", fieldCode: "12", fieldName: "Інформаційні технології" },
  { code: "051", name: "Економіка", fieldCode: "05", fieldName: "Соціальні та поведінкові науки" },
  { code: "081", name: "Право", fieldCode: "08", fieldName: "Право" },
  { code: "222", name: "Медицина", fieldCode: "22", fieldName: "Охорона здоров'я" }
];

const educationLevels = [
  { code: "1", name: "Бакалавр" },
  { code: "2", name: "Магістр" },
  { code: "3", name: "Доктор філософії (PhD)" }
];

const entryBases = [
  { code: "40", name: "Повна загальна середня освіта" },
  { code: "30", name: "Бакалавр" }
];

const studyForms = [{ code: "day_budget", name: "Денна (бюджет)" }];

export async function seedDemoData() {
  const run = await prisma.importRun.create({
    data: {
      type: "demo-seed",
      status: "running",
      startedAt: new Date(),
      parametersJson: JSON.stringify({ source: "demo" })
    }
  });

  try {
    const regionMap = new Map<string, number>();
    for (const region of regions) {
      const saved = await prisma.region.upsert({
        where: { code: region.code },
        update: { name: region.name, externalId: region.code },
        create: { ...region, externalId: region.code }
      });
      regionMap.set(region.code, saved.id);
    }

    const institutionMap = new Map<string, number>();
    for (const institution of institutions) {
      const saved = await prisma.institution.upsert({
        where: { externalId: institution.externalId },
        update: {
          name: institution.name,
          shortName: institution.shortName,
          regionId: regionMap.get(institution.region) ?? 1
        },
        create: {
          externalId: institution.externalId,
          name: institution.name,
          shortName: institution.shortName,
          regionId: regionMap.get(institution.region) ?? 1
        }
      });
      institutionMap.set(institution.externalId, saved.id);
    }

    const specialityMap = new Map<string, number>();
    for (const speciality of specialities) {
      const saved = await prisma.speciality.upsert({
        where: { code: speciality.code },
        update: speciality,
        create: { ...speciality, externalId: `demo-${speciality.code}` }
      });
      specialityMap.set(speciality.code, saved.id);
    }

    const levelMap = new Map<string, number>();
    for (const level of educationLevels) {
      const saved = await prisma.educationLevel.upsert({ where: { code: level.code }, update: level, create: level });
      levelMap.set(level.code, saved.id);
    }

    const entryMap = new Map<string, number>();
    for (const base of entryBases) {
      const saved = await prisma.entryBase.upsert({ where: { code: base.code }, update: base, create: base });
      entryMap.set(base.code, saved.id);
    }

    const studyFormMap = new Map<string, number>();
    for (const form of studyForms) {
      const saved = await prisma.studyForm.upsert({ where: { code: form.code }, update: form, create: form });
      studyFormMap.set(form.code, saved.id);
    }

    let created = 0;
    let updated = 0;
    const dates = [new Date(Date.UTC(2021, 9, 1)), new Date(Date.UTC(2022, 9, 1)), new Date(Date.UTC(2023, 9, 1)), new Date(Date.UTC(2024, 9, 1))];

    for (const [dateIndex, snapshotDate] of dates.entries()) {
      for (const institution of institutions) {
        for (const speciality of specialities) {
          for (const level of educationLevels) {
            const base = level.code === "1" ? entryBases[0] : entryBases[1];
            const regionId = regionMap.get(institution.region) ?? 1;
            const institutionId = institutionMap.get(institution.externalId) ?? 1;
            const specialityId = specialityMap.get(speciality.code) ?? 1;
            const educationLevelId = levelMap.get(level.code) ?? 1;
            const entryBaseId = entryMap.get(base.code) ?? 1;
            const studyFormId = studyFormMap.get("day_budget") ?? 1;
            const trend = dateIndex * (speciality.code === "121" || speciality.code === "122" ? 60 : -18);
            const baseCount = 180 + institutions.indexOf(institution) * 45 + specialities.indexOf(speciality) * 35;
            const levelFactor = level.code === "1" ? 1 : level.code === "2" ? 0.42 : 0.12;
            const studentsCount = Math.max(8, Math.round((baseCount + trend) * levelFactor));
            const sourceHash = createHash("sha256")
              .update(`${snapshotDate.toISOString()}-${institution.externalId}-${speciality.code}-${level.code}-${base.code}-${studentsCount}`)
              .digest("hex");

            const existing = await prisma.studentSnapshot.findUnique({
              where: {
                snapshotDate_institutionId_specialityId_educationLevelId_entryBaseId_studyFormId: {
                  snapshotDate,
                  institutionId,
                  specialityId,
                  educationLevelId,
                  entryBaseId,
                  studyFormId
                }
              }
            });

            if (existing) {
              await prisma.studentSnapshot.update({ where: { id: existing.id }, data: { studentsCount, sourceHash, regionId, studyFormId } });
              updated += 1;
            } else {
              await prisma.studentSnapshot.create({
                data: {
                  snapshotDate,
                  institutionId,
                  regionId,
                  specialityId,
                  educationLevelId,
                  entryBaseId,
                  studyFormId,
                  studentsCount,
                  sourceHash
                }
              });
              created += 1;
            }
          }
        }
      }
    }

    await prisma.importRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        recordsReceived: created + updated,
        recordsCreated: created,
        recordsUpdated: updated
      }
    });

    return { created, updated };
  } catch (error) {
    await prisma.importRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorsCount: 1,
        errorMessage: error instanceof Error ? error.message : "Невідома помилка"
      }
    });
    throw error;
  }
}

