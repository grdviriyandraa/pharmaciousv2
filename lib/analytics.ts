import type { Batch, GateDecision, Ingredient } from "./types";
import { MARKER } from "./types";

export interface Kpis {
  totalBatches: number;
  pctAccept: number;
  pctRouteNir: number;
  pctReject: number;
  avgMarkerByIngredient: Record<Ingredient, number | null>;
  activeSuppliers: number;
}

export function computeKpis(batches: Batch[], activeSuppliers: number): Kpis {
  const n = batches.length || 1;
  const count = (d: GateDecision) => batches.filter((b) => b.gateDecision === d).length;

  const avg = (ing: Ingredient): number | null => {
    const vals = batches
      .filter((b) => b.ingredient === ing && b.nirMarkerPct != null)
      .map((b) => b.nirMarkerPct as number);
    if (!vals.length) return null;
    return round(vals.reduce((a, b) => a + b, 0) / vals.length, 2);
  };

  return {
    totalBatches: batches.length,
    pctAccept: round((count("accept") / n) * 100, 0),
    pctRouteNir: round((count("route_nir") / n) * 100, 0),
    pctReject: round((count("reject") / n) * 100, 0),
    avgMarkerByIngredient: {
      mangosteen: avg("mangosteen"),
      kelor: avg("kelor"),
      pegagan: avg("pegagan"),
    },
    activeSuppliers,
  };
}

export interface SpcPoint {
  batchId: string;
  receivedAt: string;
  value: number;
}

export interface SpcChart {
  points: SpcPoint[];
  mean: number;
  ucl: number; // upper control limit (mean + 3σ)
  lcl: number; // lower control limit (mean - 3σ)
  specMin: number;
  label: string;
  unit: string;
}

/**
 * Build an SPC (Shewhart) control chart for one ingredient's marker over time.
 * UCL/LCL at ±3σ. Points below specMin are the ones QC actually cares about.
 */
export function buildSpcChart(batches: Batch[], ingredient: Ingredient): SpcChart {
  const rows = batches
    .filter((b) => b.ingredient === ingredient && b.nirMarkerPct != null)
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
    .map((b) => ({ batchId: b.id, receivedAt: b.receivedAt, value: b.nirMarkerPct as number }));

  const vals = rows.map((r) => r.value);
  const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const variance = vals.length
    ? vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length
    : 0;
  const sigma = Math.sqrt(variance);

  return {
    points: rows,
    mean: round(mean, 2),
    ucl: round(mean + 3 * sigma, 2),
    lcl: round(Math.max(0, mean - 3 * sigma), 2),
    specMin: MARKER[ingredient].specMin,
    label: MARKER[ingredient].label,
    unit: MARKER[ingredient].unit,
  };
}

function round(x: number, d: number): number {
  const f = 10 ** d;
  return Math.round(x * f) / f;
}
