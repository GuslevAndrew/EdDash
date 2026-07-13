import { seedDemoData } from "@/lib/demo/seed";
import { prisma } from "@/lib/db";

async function main() {
  console.log("Створюю демонстраційні дані EdDash...");
  const result = await seedDemoData();
  console.log(`Готово. Створено: ${result.created}, оновлено: ${result.updated}.`);
}

main()
  .catch((error) => {
    console.error("Не вдалося створити демонстраційні дані:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
