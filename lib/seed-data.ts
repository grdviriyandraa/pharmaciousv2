import type { Batch, Ingredient, Supplier } from "./types";
import { INGREDIENT_META, MARKER } from "./types";
import { decideGate } from "./gate";

// Deterministic PRNG so the demo data is stable across reloads (good for a pitch).
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260731); // case deadline as the seed, why not

const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const gauss = (mean: number, sd: number) => {
  const u = 1 - rnd();
  const v = rnd();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const SUPPLIER_NAMES: Record<Ingredient, string[]> = {
  mangosteen: ["Tani Manggis Purwakarta", "Koperasi Buah Wonosalam", "CV Perikarp Nusantara", "Kebun Manggis Leuwiliang"],
  kelor: ["Moringa Nusa Timur", "Tani Kelor Blora", "CV Daun Hijau NTT"],
  pegagan: ["Herbal Pegagan Cianjur", "Tani Centella Sukabumi", "Kebun Simplisia Bogor"],
};

export function generateSuppliers(): Supplier[] {
  const out: Supplier[] = [];
  let i = 1;
  (Object.keys(SUPPLIER_NAMES) as Ingredient[]).forEach((ing) => {
    SUPPLIER_NAMES[ing].forEach((name) => {
      const compliance = clamp(gauss(0.86, 0.1), 0.5, 0.99);
      out.push({
        id: `SUP-${String(i).padStart(3, "0")}`,
        name,
        ingredient: ing,
        region: INGREDIENT_META[ing].region,
        specCompliance: round(compliance, 2),
        rating: clamp(Math.round(compliance * 5 + gauss(0, 0.4)), 2, 5),
        batchesSupplied: 0, // filled after batches
        status: compliance > 0.8 ? "active" : compliance > 0.65 ? "probation" : "pending",
      });
      i++;
    });
  });
  return out;
}

export function generateBatches(suppliers: Supplier[], count = 38): Batch[] {
  const out: Batch[] = [];
  const start = new Date("2026-05-01").getTime();
  const span = new Date("2026-07-31").getTime() - start;

  for (let i = 0; i < count; i++) {
    const supplier = pick(suppliers);
    const ing = supplier.ingredient;
    const specMin = MARKER[ing].specMin;
    const receivedAt = new Date(start + rnd() * span).toISOString();

    // Marker value: most batches comfortably above spec, a small tail below it.
    const markerMean = specMin * 1.35;
    const markerSd = specMin * 0.2;
    const hasNir = ing !== "mangosteen" || rnd() > 0.6; // mangosteen often stops at the CV gate
    const nir = hasNir ? round(clamp(gauss(markerMean, markerSd), specMin * 0.4, specMin * 2), 2) : null;

    // CV only for mangosteen.
    let cvGrade: string | null = null;
    let cvConf: number | null = null;
    if (INGREDIENT_META[ing].hasCV) {
      const ripe = rnd() > 0.12;
      cvGrade = ripe ? "Ripe" : "Un_Ripe";
      cvConf = round(clamp(gauss(ripe ? 0.91 : 0.85, 0.09), 0.55, 0.995), 3);
    }

    const { decision } = decideGate({
      ingredient: ing,
      cvGrade,
      cvConfidence: cvConf,
      nirMarker: nir,
    });

    out.push({
      id: `BATCH-2026-${String(140 + i).padStart(4, "0")}`,
      ingredient: ing,
      supplierId: supplier.id,
      supplierName: supplier.name,
      region: supplier.region,
      receivedAt,
      quantityKg: Math.round(clamp(gauss(120, 45), 25, 300)),
      cvGrade,
      cvConfidence: cvConf,
      nirMarkerPct: nir,
      markerSpecMin: specMin,
      gateDecision: decision,
    });
  }

  // back-fill supplier batch counts
  suppliers.forEach((s) => {
    s.batchesSupplied = out.filter((b) => b.supplierId === s.id).length;
  });

  return out.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}
function round(x: number, d: number) {
  const f = 10 ** d;
  return Math.round(x * f) / f;
}
