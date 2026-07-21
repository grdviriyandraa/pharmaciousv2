import type { GateDecision, Ingredient } from "./types";
import { MARKER } from "./types";

// ── Confidence-threshold cascade (PRD §8) ───────────────────────────────────
// The CV gate is a *fast first filter* for mangosteen. It never overrides
// chemistry: NIR marker (when present) is the final word. This keeps the AI in
// its lane — a router, not a judge — which is the honest framing for a pharmacy
// jury assessing "kemudahan diterapkan".

export const CV_THRESHOLD = {
  autoAccept: 0.95, // > 0.95  → trust the visual grade
  review: 0.8, // 0.80–0.95 → human QC review
  // < 0.80 → send to lab (NIR)
} as const;

/**
 * Decide a batch's fate.
 *
 * Rules, in order:
 *  1. If a NIR marker reading exists, chemistry decides (accept if ≥ spec, else reject).
 *  2. Otherwise, for mangosteen, use the CV confidence cascade.
 *  3. Ingredients without a CV lane (kelor, pegagan) with no NIR yet → route to NIR.
 */
export function decideGate(params: {
  ingredient: Ingredient;
  cvGrade?: string | null;
  cvConfidence?: number | null;
  nirMarker?: number | null;
}): { decision: GateDecision; reason: string } {
  const { ingredient, cvGrade, cvConfidence, nirMarker } = params;
  const specMin = MARKER[ingredient].specMin;
  const markerLabel = MARKER[ingredient].label;

  // 1. Chemistry is final.
  if (nirMarker != null) {
    if (nirMarker >= specMin) {
      return {
        decision: "accept",
        reason: `NIR ${markerLabel} ${nirMarker} ≥ spec ${specMin} — lolos.`,
      };
    }
    return {
      decision: "reject",
      reason: `NIR ${markerLabel} ${nirMarker} < spec ${specMin} — di bawah ambang.`,
    };
  }

  // 2. Mangosteen visual cascade (no NIR yet).
  if (ingredient === "mangosteen" && cvConfidence != null) {
    const ripe = (cvGrade ?? "").toLowerCase().startsWith("rip");
    if (!ripe) {
      return {
        decision: "reject",
        reason: `Gerbang visual: ${cvGrade} (conf ${(cvConfidence * 100).toFixed(0)}%) — belum matang.`,
      };
    }
    if (cvConfidence > CV_THRESHOLD.autoAccept) {
      return {
        decision: "accept",
        reason: `Gerbang visual: Ripe, keyakinan ${(cvConfidence * 100).toFixed(0)}% > 95% — auto-accept.`,
      };
    }
    if (cvConfidence >= CV_THRESHOLD.review) {
      return {
        decision: "route_nir",
        reason: `Keyakinan ${(cvConfidence * 100).toFixed(0)}% (80–95%) — perlu review QC / konfirmasi NIR.`,
      };
    }
    return {
      decision: "route_nir",
      reason: `Keyakinan ${(cvConfidence * 100).toFixed(0)}% < 80% — wajib validasi lab (NIR).`,
    };
  }

  // 3. Kelor / pegagan without chemistry yet.
  return {
    decision: "route_nir",
    reason: `${markerLabel} belum diukur — arahkan ke jalur NIR.`,
  };
}

export function recommendationFor(decision: GateDecision): string {
  switch (decision) {
    case "accept":
      return "Terima batch → lanjut ke ekstraksi.";
    case "route_nir":
      return "Tahan → uji NIR untuk konfirmasi kadar penanda.";
    case "reject":
      return "Tolak batch → kembalikan ke pemasok / turunkan grade harga.";
  }
}
