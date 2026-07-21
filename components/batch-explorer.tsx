"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search } from "lucide-react";
import { Card, GateBadge, IngredientBadge } from "@/components/ui";
import { Input } from "@/components/ui";
import { ConfidenceGauge } from "@/components/confidence-gauge";
import type { Batch, GateDecision, Ingredient } from "@/lib/types";
import { INGREDIENT_META, MARKER } from "@/lib/types";
import { fmtDate, cn } from "@/lib/utils";

const INGREDIENTS: (Ingredient | "all")[] = ["all", "mangosteen", "kelor", "pegagan"];
const DECISIONS: (GateDecision | "all")[] = ["all", "accept", "route_nir", "reject"];

export function BatchExplorer({ batches }: { batches: Batch[] }) {
  const [ing, setIng] = useState<Ingredient | "all">("all");
  const [dec, setDec] = useState<GateDecision | "all">("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Batch | null>(null);

  const filtered = useMemo(
    () =>
      batches.filter(
        (b) =>
          (ing === "all" || b.ingredient === ing) &&
          (dec === "all" || b.gateDecision === dec) &&
          (q === "" || b.id.toLowerCase().includes(q.toLowerCase()) || b.supplierName.toLowerCase().includes(q.toLowerCase()))
      ),
    [batches, ing, dec, q]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari batch / pemasok" className="w-56 pl-9" />
        </div>
        <Segmented value={ing} options={INGREDIENTS} onChange={setIng} labels={(v) => (v === "all" ? "Semua bahan" : INGREDIENT_META[v as Ingredient].name)} />
        <Segmented value={dec} options={DECISIONS} onChange={setDec} labels={(v) => (v === "all" ? "Semua status" : v === "route_nir" ? "Route" : v[0].toUpperCase() + v.slice(1))} />
        <span className="readout ml-auto text-xs text-muted">{filtered.length} batch</span>
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs text-muted">
                <th className="px-5 py-3 font-medium">Batch</th>
                <th className="px-3 py-3 font-medium">Bahan</th>
                <th className="px-3 py-3 font-medium">Pemasok</th>
                <th className="px-3 py-3 font-medium">Region</th>
                <th className="px-3 py-3 font-medium">Penanda</th>
                <th className="px-3 py-3 font-medium">Diterima</th>
                <th className="px-5 py-3 font-medium">Gerbang</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => setSelected(b)}
                  className="cursor-pointer border-b border-hairline/60 last:border-0 hover:bg-bg/60"
                >
                  <td className="readout px-5 py-3 text-xs">{b.id}</td>
                  <td className="px-3 py-3"><IngredientBadge ingredient={b.ingredient} /></td>
                  <td className="px-3 py-3 text-muted">{b.supplierName}</td>
                  <td className="px-3 py-3 text-muted">{b.region}</td>
                  <td className="readout px-3 py-3">{b.nirMarkerPct ?? <span className="text-muted">CV only</span>}</td>
                  <td className="px-3 py-3 text-muted">{fmtDate(b.receivedAt)}</td>
                  <td className="px-5 py-3"><GateBadge decision={b.gateDecision} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* detail drawer */}
      <AnimatePresence>
        {selected && <Drawer batch={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  labels,
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
  labels: (v: T) => string;
}) {
  return (
    <div className="flex rounded-xl border border-hairline bg-surface p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={cn(
            "rounded-lg px-2.5 py-1.5 font-medium transition-colors",
            value === o ? "bg-brand text-white" : "text-muted hover:text-ink"
          )}
        >
          {labels(o)}
        </button>
      ))}
    </div>
  );
}

function Drawer({ batch, onClose }: { batch: Batch; onClose: () => void }) {
  const spec = MARKER[batch.ingredient];
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm"
      />
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-hairline bg-surface p-6 shadow-lift"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="readout text-xs text-muted">{batch.id}</div>
            <div className="mt-1 flex items-center gap-2">
              <IngredientBadge ingredient={batch.ingredient} />
              <GateBadge decision={batch.gateDecision} />
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-bg" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <Field label="Pemasok" value={batch.supplierName} />
          <Field label="Region" value={batch.region} />
          <Field label="Diterima" value={fmtDate(batch.receivedAt)} />
          <Field label="Kuantitas" value={`${batch.quantityKg} kg`} />
        </dl>

        {/* CV gate */}
        {batch.cvGrade ? (
          <div className="mt-6">
            <div className="eyebrow mb-2">Gerbang visual (CV)</div>
            <div className="mb-3 grid aspect-video place-items-center rounded-xl border border-hairline bg-ink/[0.03] text-xs text-muted">
              <span className="font-mono">Grad-CAM heatmap · terpasang saat model asli aktif</span>
            </div>
            <div className="mb-1 text-sm">
              Grade: <span className="font-medium">{batch.cvGrade}</span>
            </div>
            {batch.cvConfidence != null && <ConfidenceGauge value={batch.cvConfidence} />}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-hairline bg-bg/60 p-4 text-sm text-muted">
            {INGREDIENT_META[batch.ingredient].name} tidak melewati gerbang visual — langsung ke jalur NIR.
          </div>
        )}

        {/* NIR */}
        <div className="mt-6">
          <div className="eyebrow mb-2">Konfirmasi NIR</div>
          {batch.nirMarkerPct != null ? (
            <div className="flex items-baseline gap-2">
              <span className="readout text-3xl font-semibold">{batch.nirMarkerPct}</span>
              <span className="text-sm text-muted">
                {spec.unit} · spec ≥ {spec.specMin} ·{" "}
                <span className={batch.nirMarkerPct >= spec.specMin ? "text-accept" : "text-reject"}>
                  {batch.nirMarkerPct >= spec.specMin ? "lolos" : "di bawah spec"}
                </span>
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted">Belum diukur — menunggu jalur NIR.</p>
          )}
        </div>
      </motion.aside>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
