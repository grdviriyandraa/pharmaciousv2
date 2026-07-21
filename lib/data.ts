import { prisma } from "./db";
import type { Batch, GateDecision, Ingredient, Supplier } from "./types";

export async function getBatches(): Promise<Batch[]> {
  const rows = await prisma.batch.findMany({
    include: { supplier: true },
    orderBy: { receivedAt: "desc" },
  });
  return rows.map((b: (typeof rows)[number]) => ({
    id: b.id,
    ingredient: b.ingredient as Ingredient,
    supplierId: b.supplierId,
    supplierName: b.supplier.name,
    region: b.region,
    receivedAt: b.receivedAt.toISOString(),
    quantityKg: b.quantityKg,
    cvGrade: b.cvGrade,
    cvConfidence: b.cvConfidence,
    nirMarkerPct: b.nirMarkerPct,
    markerSpecMin: b.markerSpecMin,
    gateDecision: b.gateDecision as GateDecision,
  }));
}

export async function getSuppliers(): Promise<Supplier[]> {
  const rows = await prisma.supplier.findMany({
    include: { _count: { select: { batches: true } } },
    orderBy: { specCompliance: "desc" },
  });
  return rows.map((s: (typeof rows)[number]) => ({
    id: s.id,
    name: s.name,
    ingredient: s.ingredient as Ingredient,
    region: s.region,
    specCompliance: s.specCompliance,
    rating: s.rating,
    status: s.status as Supplier["status"],
    batchesSupplied: s._count.batches,
  }));
}
