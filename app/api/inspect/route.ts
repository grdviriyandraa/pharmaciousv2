import { NextResponse } from "next/server";
import { analyzeMangosteen } from "@/lib/inference";
import { decideGate } from "@/lib/gate";

// Runs the (mock) CV inference and returns grade + confidence + gate decision.
// When the real TFJS model is wired it runs client-side; this route stays as the
// server fallback / audit endpoint. No image is persisted (privacy-safe demo).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.imageDataUrl) {
    return NextResponse.json({ error: "imageDataUrl wajib diisi" }, { status: 400 });
  }
  const result = await analyzeMangosteen(body.imageDataUrl);
  const gate = decideGate({
    ingredient: "mangosteen",
    cvGrade: result.grade,
    cvConfidence: result.confidence,
    nirMarker: null,
  });
  return NextResponse.json({ ...result, gate });
}
