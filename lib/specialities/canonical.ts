import { specialityCatalogSource, type SpecialityCatalogRow } from "./catalog";

export type CanonicalSpeciality = {
  code: string;
  name: string;
  fieldCode: string;
  fieldName: string;
  source: "code-2015" | "name" | "manual-name" | "legacy-code" | "unmapped";
};

const currentCodeToCanonical: Record<string, string> = {
  "011": "A1",
  "012": "A2",
  "013": "A3",
  "014": "A4",
  "015": "A5",
  "016": "A6",
  "017": "A7",
  "021": "B1",
  "022": "B2",
  "023": "B4",
  "024": "B6",
  "025": "B5",
  "026": "B6",
  "027": "B12",
  "028": "B14",
  "029": "B13",
  "031": "B7",
  "032": "B9",
  "033": "B10",
  "034": "B12",
  "035": "B11",
  "041": "B8",
  "051": "C1",
  "052": "C2",
  "053": "C4",
  "054": "C5",
  "061": "C7",
  "071": "D1",
  "072": "D2",
  "073": "D3",
  "074": "D4",
  "075": "D5",
  "076": "D7",
  "081": "D8",
  "082": "D9",
  "091": "E1",
  "101": "E2",
  "102": "E3",
  "103": "E4",
  "104": "E5",
  "105": "E6",
  "106": "C6",
  "111": "E7",
  "112": "E8",
  "113": "F1",
  "121": "F2",
  "122": "F3",
  "123": "F7",
  "124": "F4",
  "125": "F5",
  "126": "F6",
  "131": "G9",
  "132": "G8",
  "133": "G11",
  "134": "G12",
  "135": "G11",
  "136": "G10",
  "141": "G3",
  "142": "G4",
  "143": "G11",
  "144": "G4",
  "145": "G16",
  "151": "G7",
  "152": "G6",
  "153": "G5",
  "161": "G1",
  "162": "G21",
  "163": "G22",
  "171": "G5",
  "172": "G5",
  "173": "G5",
  "181": "G13",
  "182": "G15",
  "183": "G2",
  "184": "G16",
  "185": "G16",
  "186": "G20",
  "187": "G14",
  "191": "G17",
  "192": "G19",
  "193": "G18",
  "194": "G19",
  "201": "H1",
  "202": "H2",
  "203": "H3",
  "204": "H4",
  "205": "H5",
  "206": "H3",
  "207": "H6",
  "208": "H7",
  "211": "H6",
  "212": "H6",
  "221": "I1",
  "222": "I2",
  "223": "I5",
  "224": "I6",
  "225": "I7",
  "226": "I8",
  "227": "I7",
  "228": "I3",
  "229": "I9",
  "231": "I10",
  "232": "I11",
  "241": "J2",
  "242": "J3",
  "251": "K1",
  "252": "K2",
  "253": "K3",
  "254": "K5",
  "255": "K7",
  "256": "K6",
  "261": "K8",
  "262": "K9",
  "263": "K10",
  "271": "J8",
  "272": "J6",
  "273": "J7",
  "274": "J5",
  "275": "J8",
  "281": "D4",
  "291": "C3",
  "292": "C3",
  "293": "D9"
};

const manualNameMap: Record<string, string> = {
  "освітні педагогічні науки": "A1",
  "технологічна освіта": "A4",
  "фізичне виховання": "A7",
  "спорт": "A7",
  "здоровя людини": "A7",
  "аудіовізуальне мистецтво та виробництво": "B1",
  "образотворче мистецтво декоративне мистецтво реставрація": "B4",
  "сценічне мистецтво": "B6",
  "музеєзнавство памяткознавство": "B12",
  "менеджмент соціокультурної діяльності": "B14",
  "інформаційна бібліотечна та архівна справа": "B13",
  "богословя": "B8",
  "міжнародні економічні відносини": "C1",
  "практична психологія": "C4",
  "економічна кібернетика": "C1",
  "економіка підприємства": "C1",
  "управління персоналом та економіка праці": "D3",
  "фінанси і кредит": "D2",
  "бухгалтерський облік": "D1",
  "товарознавство та комерційна діяльність": "D7",
  "правознавство": "D8",
  "біологія": "E1",
  "прикладна екологія": "E2",
  "екологія охорона навколишнього середовища та збалансоване природокористування": "E2",
  "географія": "C6",
  "компютерні науки та інформаційні технології": "F3",
  "компютерна інженерія": "F7",
  "кібербезпека": "F5",
  "інформаційні системи та технології": "F6",
  "системний аналіз": "F4",
  "металургія": "G10",
  "машинобудування": "G11",
  "суднобудування": "G11",
  "електроенергетика електротехніка та електромеханіка": "G3",
  "теплоенергетика": "G4",
  "нафтогазова інженерія та технології": "G16",
  "автоматизація та компютерно інтегровані технології": "G7",
  "мікро та наносистемна техніка": "G5",
  "електроніка": "G5",
  "телекомунікації та радіотехніка": "G5",
  "технології захисту навколишнього середовища": "G2",
  "гірництво": "G16",
  "нафтогазова справа": "G16",
  "видавництво та поліграфія": "G20",
  "деревообробні та меблеві технології": "G14",
  "архітектура та містобудування": "G17",
  "будівництво та цивільна інженерія": "G19",
  "гідротехнічне будівництво водна інженерія та водні технології": "G19",
  "землевпорядкування": "G18",
  "агрономія": "H1",
  "технологія виробництва і переробки продукції тваринництва": "H2",
  "садово паркове господарство": "H3",
  "лісове господарство": "H4",
  "водні біоресурси та аквакультура": "H5",
  "ветеринарна медицина": "H6",
  "агроінженерія": "H7",
  "лікувальна справа": "I2",
  "медицина": "I2",
  "сестринська справа": "I5",
  "медсестринство": "I5",
  "акушерська справа": "I5",
  "фармація": "I8",
  "фізична терапія ерготерапія": "I7",
  "громадське здоровя": "I9",
  "соціальна робота": "I10",
  "готельно ресторанна справа": "J2",
  "туризм": "J3",
  "туристичне обслуговування": "J3",
  "автомобільний транспорт": "J8",
  "авіаційний транспорт": "J6",
  "залізничний транспорт": "J7",
  "річковий та морський транспорт": "J5",
  "пожежна безпека": "K8",
  "правоохоронна діяльність": "K9",
  "цивільна безпека": "K10",
  "зовнішня політика": "C3",
  "якість стандартизація та сертифікація": "G6",
  "управління проектами": "D3",
  "управління навчальним закладом": "A1",
  "педагогіка вищої школи": "A1",
  "національна безпека": "K3"
};

const catalogByCode = new Map<string, SpecialityCatalogRow>(
  specialityCatalogSource.specialities.map((item) => [item.code, item])
);

const catalogByName = new Map<string, SpecialityCatalogRow>(
  specialityCatalogSource.specialities.map((item) => [normalizeSpecialityName(item.name), item])
);

function normalizeSpecialityName(value: string): string {
  return value
    .toLocaleLowerCase("uk-UA")
    .replace(/['’`ʼ]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[.,;:"«»]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toCanonical(item: SpecialityCatalogRow, source: CanonicalSpeciality["source"]): CanonicalSpeciality {
  return {
    code: item.code,
    name: item.name,
    fieldCode: item.fieldCode,
    fieldName: item.fieldName,
    source
  };
}

function legacyCodePrefixToCanonical(code: string): string | undefined {
  const match = code.match(/^[5678]\.(\d{2})(\d{2})?/);
  if (!match) return undefined;

  const group = match[1];
  const subGroup = `${match[1]}${match[2] ?? ""}`;
  if (subGroup === "0304") return "D8";
  if (subGroup === "0305") return "C1";
  if (subGroup === "0501") return "F3";
  if (subGroup === "0502") return "G8";
  if (subGroup === "0503") return "G16";
  if (subGroup === "0505") return "G11";
  if (subGroup === "0509") return "G5";
  if (subGroup === "0601") return "G19";
  if (subGroup === "0701") return "J8";
  if (subGroup === "0801") return "G18";
  if (subGroup === "0901") return "H1";
  if (subGroup === "1001") return "H7";
  if (subGroup === "1101") return "H6";
  if (subGroup === "1201") return "I2";
  if (subGroup === "1202") return "I8";
  if (subGroup === "1401") return "J3";
  if (subGroup === "1702") return "K8";

  const fieldFallback: Record<string, string> = {
    "01": "A1",
    "02": "B12",
    "03": "C1",
    "04": "E1",
    "05": "G11",
    "06": "G19",
    "07": "J8",
    "08": "H1",
    "09": "H1",
    "10": "H7",
    "11": "H6",
    "12": "I2",
    "14": "J3",
    "17": "K8"
  };

  return fieldFallback[group];
}

export function getCanonicalSpeciality(input: { code?: string | null; name: string }): CanonicalSpeciality {
  const code = input.code?.trim();
  const normalizedName = normalizeSpecialityName(input.name);

  if (code && catalogByCode.has(code)) {
    return toCanonical(catalogByCode.get(code)!, "name");
  }

  if (code && currentCodeToCanonical[code]) {
    const item = catalogByCode.get(currentCodeToCanonical[code]);
    if (item) return toCanonical(item, "code-2015");
  }

  const exactName = catalogByName.get(normalizedName);
  if (exactName) return toCanonical(exactName, "name");

  const manualCode = manualNameMap[normalizedName];
  if (manualCode) {
    const item = catalogByCode.get(manualCode);
    if (item) return toCanonical(item, "manual-name");
  }

  if (code) {
    const legacyCode = legacyCodePrefixToCanonical(code);
    if (legacyCode) {
      const item = catalogByCode.get(legacyCode);
      if (item) return toCanonical(item, "legacy-code");
    }
  }

  return {
    code: code ?? "unmapped",
    name: input.name,
    fieldCode: "unmapped",
    fieldName: "Без визначеної галузі",
    source: "unmapped"
  };
}

export function formatCanonicalSpeciality(input: {
  canonicalCode?: string | null;
  canonicalName?: string | null;
  code?: string | null;
  name: string;
}): string {
  if (input.canonicalCode && input.canonicalName) {
    return `${input.canonicalCode} ${input.canonicalName}`;
  }
  return input.code ? `${input.code} ${input.name}` : input.name;
}

export function formatCanonicalField(input: {
  canonicalFieldCode?: string | null;
  canonicalFieldName?: string | null;
  fieldCode?: string | null;
  fieldName?: string | null;
}): string {
  if (input.canonicalFieldCode && input.canonicalFieldName) {
    return `${input.canonicalFieldCode} ${input.canonicalFieldName}`;
  }
  if (input.fieldCode && input.fieldName) return `${input.fieldCode} ${input.fieldName}`;
  return "Без визначеної галузі";
}
