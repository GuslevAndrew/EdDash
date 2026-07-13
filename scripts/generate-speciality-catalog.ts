import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SOURCE_URL = "https://zakon.rada.gov.ua/laws/show/266-2015-%D0%BF#n11";

type CatalogRow = {
  fieldCode: string;
  fieldName: string;
  code: string;
  name: string;
  levels: {
    professionalPreHigher: boolean;
    bachelor: boolean;
    master: boolean;
    phd: boolean;
  };
  isced: Array<{
    code: string;
    name: string;
  }>;
};

function textFromHtml(html: string): string {
  return html
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCode(value: string): string {
  const map: Record<string, string> = {
    А: "A",
    В: "B",
    С: "C",
    Е: "E",
    Н: "H",
    І: "I",
    К: "K",
    М: "M",
    О: "O",
    Р: "P",
    Т: "T",
    Х: "X",
    У: "Y",
    З: "Z"
  };

  return value
    .trim()
    .split("")
    .map((char) => map[char] ?? char)
    .join("");
}

function hasLevel(value: string): boolean {
  return value.includes("+");
}

function isSpecialityCode(value: string): boolean {
  return /^[A-K]\d{1,2}$/.test(value) || /^X[XY]88/.test(value);
}

function addIsced(row: CatalogRow | undefined, code: string, name: string) {
  if (!row || !code || !name) return;
  if (!row.isced.some((item) => item.code === code && item.name === name)) {
    row.isced.push({ code, name });
  }
}

function parseCatalog(html: string): CatalogRow[] {
  const start = html.indexOf("<p class=rvps14>A</p>");
  if (start < 0) throw new Error("Не знайдено початок таблиці переліку спеціальностей.");

  const tableStart = html.lastIndexOf("<table", start);
  const tableEnd = html.indexOf("</table>", start) + "</table>".length;
  const table = html.slice(tableStart, tableEnd);
  const trMatches = [...table.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((match) => match[0]);

  const rows: CatalogRow[] = [];
  let fieldCode = "";
  let fieldName = "";

  for (const tr of trMatches.slice(2)) {
    const cells = [...tr.matchAll(/<td[\s\S]*?<\/td>/g)].map((match) => textFromHtml(match[0]));
    if (!cells.length) continue;

    let specialityCells: string[];
    if (cells.length === 10) {
      fieldCode = normalizeCode(cells[0]);
      fieldName = cells[1];
      specialityCells = cells.slice(2);
    } else if (cells.length === 8) {
      specialityCells = cells;
    } else if (cells.length === 2) {
      addIsced(rows.at(-1), cells[0], cells[1]);
      continue;
    } else {
      continue;
    }

    const code = normalizeCode(specialityCells[0]);
    const name = specialityCells[1];
    if (!fieldCode || !fieldName || !isSpecialityCode(code) || !name) {
      addIsced(rows.at(-1), specialityCells[6], specialityCells[7]);
      continue;
    }

    const row: CatalogRow = {
      fieldCode,
      fieldName,
      code,
      name,
      levels: {
        professionalPreHigher: hasLevel(specialityCells[2]),
        bachelor: hasLevel(specialityCells[3]),
        master: hasLevel(specialityCells[4]),
        phd: hasLevel(specialityCells[5])
      },
      isced: []
    };
    addIsced(row, specialityCells[6], specialityCells[7]);
    rows.push(row);
  }

  return rows;
}

async function main() {
  const response = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent": "EdDash speciality catalog generator"
    }
  });
  if (!response.ok) {
    throw new Error(`Не вдалося завантажити перелік: HTTP ${response.status}`);
  }

  const html = await response.text();
  const rows = parseCatalog(html);
  const fields = [...new Map(rows.map((row) => [row.fieldCode, row.fieldName])).entries()].map(([code, name]) => ({
    code,
    name
  }));

  const output = `export const specialityCatalogSource = ${JSON.stringify(
    {
      title: "Перелік галузей знань і спеціальностей",
      sourceUrl: SOURCE_URL,
      sourceName:
        "Постанова Кабінету Міністрів України від 29.04.2015 № 266, поточна редакція на zakon.rada.gov.ua",
      generatedAt: new Date().toISOString(),
      fields,
      specialities: rows
    },
    null,
    2
  )} as const;\n\nexport type SpecialityCatalog = typeof specialityCatalogSource;\nexport type SpecialityCatalogRow = (typeof specialityCatalogSource.specialities)[number];\n`;

  const outputDir = join(process.cwd(), "lib", "specialities");
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, "catalog.ts"), output, "utf8");
  console.log(`Згенеровано ${fields.length} галузей і ${rows.length} спеціальностей.`);
}

main().catch((error) => {
  console.error("Не вдалося згенерувати довідник спеціальностей:", error);
  process.exitCode = 1;
});
