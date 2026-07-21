// ── AMERTA Smart Quality Gate — domain types ────────────────────────────────
// CV grading only applies to mangosteen (the hero ingredient). Kelor & pegagan
// skip the visual gate and go straight to the NIR lane.

export type Ingredient = "mangosteen" | "kelor" | "pegagan";

export type GateDecision = "accept" | "route_nir" | "reject";

/** The marker each ingredient is standardised against (from Solusi 1 & 2). */
export const MARKER: Record<Ingredient, { label: string; unit: string; specMin: number }> = {
  mangosteen: { label: "α-Mangostin", unit: "%", specMin: 1.8 },
  kelor: { label: "TPC (GAE)", unit: "mg/g", specMin: 45 },
  pegagan: { label: "Asiatikosida", unit: "%", specMin: 0.8 },
};

export const INGREDIENT_META: Record<
  Ingredient,
  { name: string; latin: string; role: string; hasCV: boolean; region: string }
> = {
  mangosteen: {
    name: "Kulit Manggis",
    latin: "Garcinia mangostana",
    role: "Hero · anti-acne",
    hasCV: true,
    region: "Jawa / Sumatra",
  },
  kelor: {
    name: "Daun Kelor",
    latin: "Moringa oleifera",
    role: "Antioksidan / antipolutan",
    hasCV: false,
    region: "Jawa Timur / NTT",
  },
  pegagan: {
    name: "Pegagan",
    latin: "Centella asiatica",
    role: "Rehidrasi / barrier repair",
    hasCV: false,
    region: "Jawa Barat",
  },
};

export interface Batch {
  id: string;
  ingredient: Ingredient;
  supplierId: string;
  supplierName: string;
  region: string;
  receivedAt: string; // ISO
  quantityKg: number;
  cvGrade: string | null; // "Ripe" | "Un_Ripe" — mangosteen only
  cvConfidence: number | null; // 0..1
  nirMarkerPct: number | null; // measured marker value
  markerSpecMin: number;
  gateDecision: GateDecision;
}

export interface Supplier {
  id: string;
  name: string;
  ingredient: Ingredient;
  region: string;
  specCompliance: number; // 0..1
  rating: number; // 1..5
  batchesSupplied: number;
  status: "active" | "probation" | "pending";
}

/** Output contract for ANY inference backend (ONNX on-device, or mock fallback). */
export interface InferenceResult {
  grade: string; // e.g. "Ripe" | "Un_Ripe"
  confidence: number; // 0..1
  heatmapDataUrl: string | null; // Grad-CAM overlay (null until real model wired)
  recommendation: string;
  modelSource?: "onnx" | "mock"; // which backend produced this (for honest demo labeling)
}
