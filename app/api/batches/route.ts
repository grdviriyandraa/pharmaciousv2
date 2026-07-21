import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { decideGate } from "@/lib/gate";
import { MARKER } from "@/lib/types";

export async function GET() {
  const rows = await prisma.batch.findMany({
    include: { supplier: true },
    orderBy: { receivedAt: "desc" },
  });
  const batches = rows.map((b: (typeof rows)[number]) => ({
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
  }));
  return NextResponse.json(batches);
}

// Catat hasil inspeksi CV sebagai batch baru (loop Inspeksi → Batch → Dashboard).
// Server yang menentukan region (dari pemasok), spec, dan gerbang — hasil CV dari
// klien tidak dipercaya mentah; gate di-hitung ulang di sini.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const supplierId = typeof body?.supplierId === "string" ? body.supplierId : "";
  const quantityKg = Math.round(Number(body?.quantityKg));
  const cvGrade = body?.cvGrade === "Ripe" || body?.cvGrade === "Un_Ripe" ? body.cvGrade : null;
  const cvConfidence =
    typeof body?.cvConfidence === "number" && body.cvConfidence >= 0 && body.cvConfidence <= 1
      ? body.cvConfidence
      : null;

  if (!supplierId || !cvGrade || cvConfidence == null) {
    return NextResponse.json({ error: "Data inspeksi tidak lengkap." }, { status: 400 });
  }
  if (!Number.isFinite(quantityKg) || quantityKg < 1 || quantityKg > 5000) {
    return NextResponse.json({ error: "Jumlah (kg) tidak valid." }, { status: 400 });
  }

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) return NextResponse.json({ error: "Pemasok tidak ditemukan." }, { status: 404 });
  if (supplier.ingredient !== "mangosteen") {
    return NextResponse.json(
      { error: "Gerbang visual hanya untuk pemasok manggis." },
      { status: 400 }
    );
  }

  const specMin = MARKER.mangosteen.specMin;
  const { decision } = decideGate({
    ingredient: "mangosteen",
    cvGrade,
    cvConfidence,
    nirMarker: null,
  });

  // ID berurutan melanjutkan format seed (BATCH-2026-XXXX).
  const count = await prisma.batch.count();
  const id = `BATCH-2026-${String(140 + count).padStart(4, "0")}`;

  const created = await prisma.batch.create({
    data: {
      id,
      ingredient: "mangosteen",
      supplierId: supplier.id,
      region: supplier.region,
      receivedAt: new Date(),
      quantityKg,
      cvGrade,
      cvConfidence,
      nirMarkerPct: null,
      markerSpecMin: specMin,
      gateDecision: decision,
    },
  });

  return NextResponse.json({
    id: created.id,
    supplierName: supplier.name,
    gateDecision: decision,
  });
}
