import { PrismaClient } from "@prisma/client";
import { generateSuppliers, generateBatches } from "../lib/seed-data";
import { hashPassword } from "../lib/auth";

const prisma = new PrismaClient();

async function main() {
  await prisma.batch.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();

  const suppliers = generateSuppliers();
  const batches = generateBatches(suppliers, 38);

  await prisma.supplier.createMany({
    data: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      ingredient: s.ingredient,
      region: s.region,
      specCompliance: s.specCompliance,
      rating: s.rating,
      status: s.status,
    })),
  });

  await prisma.batch.createMany({
    data: batches.map((b) => ({
      id: b.id,
      ingredient: b.ingredient,
      supplierId: b.supplierId,
      region: b.region,
      receivedAt: new Date(b.receivedAt),
      quantityKg: b.quantityKg,
      cvGrade: b.cvGrade,
      cvConfidence: b.cvConfidence,
      nirMarkerPct: b.nirMarkerPct,
      markerSpecMin: b.markerSpecMin,
      gateDecision: b.gateDecision,
    })),
  });

  // Kata sandi demo yang sama untuk semua akun (tercantum di halaman login).
  const passwordHash = await hashPassword("amerta2026");
  await prisma.user.createMany({
    data: [
      { email: "qc@amerta.id", name: "Sari", role: "qc", passwordHash },
      { email: "qa@amerta.id", name: "Bima", role: "qa", passwordHash },
    ],
  });

  console.log(`Seeded ${suppliers.length} suppliers, ${batches.length} batches, 2 users.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
