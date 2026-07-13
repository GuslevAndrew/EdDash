const educationLevelAliases: Record<string, string> = {
  "магістр": "Магістр",
  "спеціаліст": "Магістр",
  "фаховий молодший бакалавр": "Фаховий молодший бакалавр",
  "молодший бакалавр": "Фаховий молодший бакалавр",
  "молодший спеціаліст": "Фаховий молодший бакалавр",
  "доктор філософії": "Доктор філософії (PhD)"
};

function normalizeKey(value: string): string {
  return value
    .toLocaleLowerCase("uk-UA")
    .replace(/\(phd\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getCanonicalEducationLevelName(name: string): string {
  const key = normalizeKey(name);
  if (key.includes("фаховий молодший бакалавр") || key.includes("молодший бакалавр") || key.includes("молодший спеціаліст")) {
    return "Фаховий молодший бакалавр";
  }
  if (key.includes("магістр") || key.includes("спеціаліст")) {
    return "Магістр";
  }
  return educationLevelAliases[key] ?? name;
}

export function getEducationLevelNameVariants(canonicalName: string): string[] {
  const variants = new Set<string>([canonicalName]);
  for (const [raw, canonical] of Object.entries(educationLevelAliases)) {
    if (canonical === canonicalName) {
      variants.add(raw);
      variants.add(raw.replace(/^./, (letter) => letter.toLocaleUpperCase("uk-UA")));
    }
  }
  if (canonicalName === "Доктор філософії (PhD)") {
    variants.add("Доктор філософії");
  }
  if (canonicalName === "Магістр") {
    variants.add("Магістр");
    variants.add("Спеціаліст");
  }
  if (canonicalName === "Фаховий молодший бакалавр") {
    variants.add("Фаховий молодший бакалавр");
    variants.add("Молодший бакалавр");
    variants.add("Молодший спеціаліст");
  }
  return [...variants];
}
