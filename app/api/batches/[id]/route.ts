import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const b = await prisma.batch.findUnique({
    where: { id: params.id },
    include: { supplier: true },
  });
  if (!b) return NextResponse.json({ error: "Batch tidak ditemukan" }, { status: 404 });
  return NextResponse.json({
    id: b.id,
    ingredient: b.ingredient,
    supplierId: b.supplierId,
    supplierName: b.supplier.name,
    region: b.region,
    receivedAt: b.receivedAt.toISOString(),
    quantityKg: b.quantityKg,
    cvGrade: b.cvGrade,
    cvConfidence: b.cvConfidence,
    nirMarkerPct: b.nirMarkerPct,
    markerSpecMin: b.markerSpecMin,
    gateDecision: b.gateDecision,
  });
}
