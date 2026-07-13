import { prisma } from "@/lib/db";

const statements = [
  `CREATE TABLE IF NOT EXISTS "Region" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "externalId" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Region_externalId_key" ON "Region"("externalId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Region_code_key" ON "Region"("code")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Region_name_key" ON "Region"("name")`,
  `CREATE TABLE IF NOT EXISTS "Speciality" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "externalId" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "fieldCode" TEXT,
    "fieldName" TEXT,
    "canonicalCode" TEXT,
    "canonicalName" TEXT,
    "canonicalFieldCode" TEXT,
    "canonicalFieldName" TEXT,
    "canonicalSource" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Speciality_externalId_key" ON "Speciality"("externalId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Speciality_code_key" ON "Speciality"("code")`,
  `CREATE INDEX IF NOT EXISTS "Speciality_canonicalCode_idx" ON "Speciality"("canonicalCode")`,
  `CREATE INDEX IF NOT EXISTS "Speciality_canonicalFieldCode_idx" ON "Speciality"("canonicalFieldCode")`,
  `CREATE TABLE IF NOT EXISTS "Institution" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "externalId" TEXT,
    "parentExternalId" TEXT,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "institutionTypeCode" TEXT NOT NULL DEFAULT '1',
    "institutionTypeName" TEXT NOT NULL DEFAULT 'Вища освіта',
    "foundationYear" TEXT,
    "ownership" TEXT,
    "settlement" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "blockedAt" TEXT,
    "regionId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Institution_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Institution_externalId_key" ON "Institution"("externalId")`,
  `CREATE INDEX IF NOT EXISTS "Institution_regionId_idx" ON "Institution"("regionId")`,
  `CREATE INDEX IF NOT EXISTS "Institution_institutionTypeCode_idx" ON "Institution"("institutionTypeCode")`,
  `CREATE INDEX IF NOT EXISTS "Institution_parentExternalId_idx" ON "Institution"("parentExternalId")`,
  `CREATE TABLE IF NOT EXISTS "EducationLevel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "EducationLevel_code_key" ON "EducationLevel"("code")`,
  `CREATE TABLE IF NOT EXISTS "EntryBase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "EntryBase_code_key" ON "EntryBase"("code")`,
  `CREATE TABLE IF NOT EXISTS "StudyForm" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "StudyForm_code_key" ON "StudyForm"("code")`,
  `CREATE TABLE IF NOT EXISTS "StudentSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "snapshotDate" DATETIME NOT NULL,
    "institutionId" INTEGER NOT NULL,
    "regionId" INTEGER NOT NULL,
    "specialityId" INTEGER NOT NULL,
    "educationLevelId" INTEGER NOT NULL,
    "entryBaseId" INTEGER NOT NULL,
    "studyFormId" INTEGER,
    "studentsCount" INTEGER NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentSnapshot_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentSnapshot_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentSnapshot_specialityId_fkey" FOREIGN KEY ("specialityId") REFERENCES "Speciality" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentSnapshot_educationLevelId_fkey" FOREIGN KEY ("educationLevelId") REFERENCES "EducationLevel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentSnapshot_entryBaseId_fkey" FOREIGN KEY ("entryBaseId") REFERENCES "EntryBase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentSnapshot_studyFormId_fkey" FOREIGN KEY ("studyFormId") REFERENCES "StudyForm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `DROP INDEX IF EXISTS "StudentSnapshot_snapshotDate_institutionId_specialityId_educationLevelId_entryBaseId_key"`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "StudentSnapshot_snapshotDate_institutionId_specialityId_educationLevelId_entryBaseId_studyFormId_key" ON "StudentSnapshot"("snapshotDate", "institutionId", "specialityId", "educationLevelId", "entryBaseId", "studyFormId")`,
  `CREATE INDEX IF NOT EXISTS "StudentSnapshot_snapshotDate_idx" ON "StudentSnapshot"("snapshotDate")`,
  `CREATE INDEX IF NOT EXISTS "StudentSnapshot_institutionId_idx" ON "StudentSnapshot"("institutionId")`,
  `CREATE INDEX IF NOT EXISTS "StudentSnapshot_regionId_idx" ON "StudentSnapshot"("regionId")`,
  `CREATE INDEX IF NOT EXISTS "StudentSnapshot_specialityId_idx" ON "StudentSnapshot"("specialityId")`,
  `CREATE INDEX IF NOT EXISTS "StudentSnapshot_educationLevelId_idx" ON "StudentSnapshot"("educationLevelId")`,
  `CREATE INDEX IF NOT EXISTS "StudentSnapshot_entryBaseId_idx" ON "StudentSnapshot"("entryBaseId")`,
  `CREATE INDEX IF NOT EXISTS "StudentSnapshot_studyFormId_idx" ON "StudentSnapshot"("studyFormId")`,
  `CREATE TABLE IF NOT EXISTS "YearlyOutcome" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "institutionId" INTEGER NOT NULL,
    "regionId" INTEGER NOT NULL,
    "specialityId" INTEGER NOT NULL,
    "educationLevelId" INTEGER NOT NULL,
    "entryBaseId" INTEGER NOT NULL,
    "studyFormId" INTEGER,
    "personsCount" INTEGER NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YearlyOutcome_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "YearlyOutcome_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "YearlyOutcome_specialityId_fkey" FOREIGN KEY ("specialityId") REFERENCES "Speciality" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "YearlyOutcome_educationLevelId_fkey" FOREIGN KEY ("educationLevelId") REFERENCES "EducationLevel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "YearlyOutcome_entryBaseId_fkey" FOREIGN KEY ("entryBaseId") REFERENCES "EntryBase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "YearlyOutcome_studyFormId_fkey" FOREIGN KEY ("studyFormId") REFERENCES "StudyForm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `DROP INDEX IF EXISTS "YearlyOutcome_type_year_institutionId_specialityId_educationLevelId_entryBaseId_key"`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "YearlyOutcome_type_year_institutionId_specialityId_educationLevelId_entryBaseId_studyFormId_key" ON "YearlyOutcome"("type", "year", "institutionId", "specialityId", "educationLevelId", "entryBaseId", "studyFormId")`,
  `CREATE INDEX IF NOT EXISTS "YearlyOutcome_type_idx" ON "YearlyOutcome"("type")`,
  `CREATE INDEX IF NOT EXISTS "YearlyOutcome_year_idx" ON "YearlyOutcome"("year")`,
  `CREATE INDEX IF NOT EXISTS "YearlyOutcome_institutionId_idx" ON "YearlyOutcome"("institutionId")`,
  `CREATE INDEX IF NOT EXISTS "YearlyOutcome_regionId_idx" ON "YearlyOutcome"("regionId")`,
  `CREATE INDEX IF NOT EXISTS "YearlyOutcome_specialityId_idx" ON "YearlyOutcome"("specialityId")`,
  `CREATE INDEX IF NOT EXISTS "YearlyOutcome_educationLevelId_idx" ON "YearlyOutcome"("educationLevelId")`,
  `CREATE INDEX IF NOT EXISTS "YearlyOutcome_entryBaseId_idx" ON "YearlyOutcome"("entryBaseId")`,
  `CREATE INDEX IF NOT EXISTS "YearlyOutcome_studyFormId_idx" ON "YearlyOutcome"("studyFormId")`,
  `CREATE TABLE IF NOT EXISTS "ImportRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME,
    "recordsReceived" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "errorsCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "parametersJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "ImportRun_startedAt_idx" ON "ImportRun"("startedAt")`,
  `CREATE INDEX IF NOT EXISTS "ImportRun_status_idx" ON "ImportRun"("status")`,
  `CREATE INDEX IF NOT EXISTS "ImportRun_type_idx" ON "ImportRun"("type")`
];

async function main() {
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
  await addColumnIfMissing("Institution", "institutionTypeCode", `TEXT NOT NULL DEFAULT '1'`);
  await addColumnIfMissing("Institution", "institutionTypeName", `TEXT NOT NULL DEFAULT 'Вища освіта'`);
  await addColumnIfMissing("Institution", "parentExternalId", `TEXT`);
  await addColumnIfMissing("Institution", "foundationYear", `TEXT`);
  await addColumnIfMissing("Institution", "ownership", `TEXT`);
  await addColumnIfMissing("Institution", "settlement", `TEXT`);
  await addColumnIfMissing("Institution", "address", `TEXT`);
  await addColumnIfMissing("Institution", "phone", `TEXT`);
  await addColumnIfMissing("Institution", "email", `TEXT`);
  await addColumnIfMissing("Institution", "website", `TEXT`);
  await addColumnIfMissing("Institution", "blockedAt", `TEXT`);
  await addColumnIfMissing("StudentSnapshot", "studyFormId", `INTEGER`);
  await addColumnIfMissing("Speciality", "canonicalCode", `TEXT`);
  await addColumnIfMissing("Speciality", "canonicalName", `TEXT`);
  await addColumnIfMissing("Speciality", "canonicalFieldCode", `TEXT`);
  await addColumnIfMissing("Speciality", "canonicalFieldName", `TEXT`);
  await addColumnIfMissing("Speciality", "canonicalSource", `TEXT`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Institution_institutionTypeCode_idx" ON "Institution"("institutionTypeCode")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Institution_parentExternalId_idx" ON "Institution"("parentExternalId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Speciality_canonicalCode_idx" ON "Speciality"("canonicalCode")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Speciality_canonicalFieldCode_idx" ON "Speciality"("canonicalFieldCode")`);
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "StudentSnapshot_snapshotDate_institutionId_specialityId_educationLevelId_entryBaseId_key"`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "StudentSnapshot_snapshotDate_institutionId_specialityId_educationLevelId_entryBaseId_studyFormId_key" ON "StudentSnapshot"("snapshotDate", "institutionId", "specialityId", "educationLevelId", "entryBaseId", "studyFormId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "StudentSnapshot_studyFormId_idx" ON "StudentSnapshot"("studyFormId")`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "YearlyOutcome" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "institutionId" INTEGER NOT NULL,
    "regionId" INTEGER NOT NULL,
    "specialityId" INTEGER NOT NULL,
    "educationLevelId" INTEGER NOT NULL,
    "entryBaseId" INTEGER NOT NULL,
    "studyFormId" INTEGER,
    "personsCount" INTEGER NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YearlyOutcome_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "YearlyOutcome_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "YearlyOutcome_specialityId_fkey" FOREIGN KEY ("specialityId") REFERENCES "Speciality" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "YearlyOutcome_educationLevelId_fkey" FOREIGN KEY ("educationLevelId") REFERENCES "EducationLevel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "YearlyOutcome_entryBaseId_fkey" FOREIGN KEY ("entryBaseId") REFERENCES "EntryBase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "YearlyOutcome_studyFormId_fkey" FOREIGN KEY ("studyFormId") REFERENCES "StudyForm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`);
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "YearlyOutcome_type_year_institutionId_specialityId_educationLevelId_entryBaseId_key"`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "YearlyOutcome_type_year_institutionId_specialityId_educationLevelId_entryBaseId_studyFormId_key" ON "YearlyOutcome"("type", "year", "institutionId", "specialityId", "educationLevelId", "entryBaseId", "studyFormId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "YearlyOutcome_type_idx" ON "YearlyOutcome"("type")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "YearlyOutcome_year_idx" ON "YearlyOutcome"("year")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "YearlyOutcome_institutionId_idx" ON "YearlyOutcome"("institutionId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "YearlyOutcome_regionId_idx" ON "YearlyOutcome"("regionId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "YearlyOutcome_specialityId_idx" ON "YearlyOutcome"("specialityId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "YearlyOutcome_educationLevelId_idx" ON "YearlyOutcome"("educationLevelId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "YearlyOutcome_entryBaseId_idx" ON "YearlyOutcome"("entryBaseId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "YearlyOutcome_studyFormId_idx" ON "YearlyOutcome"("studyFormId")`);
  await seedStudyForms();
  console.log("SQLite-схему EdDash створено або оновлено.");
}

async function addColumnIfMissing(tableName: string, columnName: string, definition: string) {
  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("${tableName}")`);
  if (!columns.some((column) => column.name === columnName)) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${definition}`);
  }
}

async function seedStudyForms() {
  const forms = [
    ["total", "Усі форми навчання"],
    ["day_budget", "Денна (бюджет)"],
    ["day_contract", "Денна (контракт)"],
    ["part_time_budget", "Заочна (бюджет)"],
    ["part_time_contract", "Заочна (контракт)"],
    ["evening_budget", "Вечірня (бюджет)"],
    ["evening_contract", "Вечірня (контракт)"]
  ];
  for (const [code, name] of forms) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "StudyForm" ("code", "name", "createdAt", "updatedAt")
       VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT("code") DO UPDATE SET "name" = excluded."name", "updatedAt" = CURRENT_TIMESTAMP`,
      code,
      name
    );
  }
}

main()
  .catch((error) => {
    console.error("Не вдалося створити SQLite-схему:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

