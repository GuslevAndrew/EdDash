import { NextRequest, NextResponse } from "next/server";
import { parseDashboardSearchParams } from "@/lib/dashboard/params";
import { getTableData } from "@/lib/dashboard/queries";
import { getCanonicalEducationLevelName } from "@/lib/education-levels/canonical";
import { formatCanonicalField, formatCanonicalSpeciality } from "@/lib/specialities/canonical";

export async function GET(request: NextRequest) {
  try {
    const filters = parseDashboardSearchParams(request.nextUrl.searchParams);
    const data = await getTableData(filters);

    return NextResponse.json({
      total: data.total,
      rows: data.rows.map((row) => {
        const yearlyRow = "year" in row;
        return {
          id: row.id,
          institution: row.institution.name,
          institutionType: row.institution.institutionTypeName,
          region: row.region.name,
          field: formatCanonicalField(row.speciality),
          speciality: formatCanonicalSpeciality(row.speciality),
          educationLevel: getCanonicalEducationLevelName(row.educationLevel.name),
          entryBase: row.entryBase.name,
          studyForm: yearlyRow ? "" : row.studyForm?.name ?? "Усі форми навчання",
          snapshotDate: yearlyRow ? String(row.year) : row.snapshotDate.toISOString(),
          studentsCount: yearlyRow ? row.personsCount : row.studentsCount
        };
      })
    });
  } catch (error) {
    console.error("table api error", error);
    return NextResponse.json({ message: "Не вдалося отримати таблицю даних." }, { status: 400 });
  }
}
