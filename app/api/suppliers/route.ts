import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Jangan di-prerender saat build — endpoint ini query DB, harus jalan di request time
// (kalau statis, `next build` gagal saat DATABASE_URL belum tersedia).
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.supplier.findMany({
    include: { _count: { select: { batches: true } } },
    orderBy: { specCompliance: "desc" },
  });
  const suppliers = rows.map((s: (typeof rows)[number]) => ({
    id: s.id,
    name: s.name,
    ingredient: s.ingredient,
    region: s.region,
    specCompliance: s.specCompliance,
    rating: s.rating,
    status: s.status,
    batchesSupplied: s._count.batches,
  }));
  return NextResponse.json(suppliers);
}
