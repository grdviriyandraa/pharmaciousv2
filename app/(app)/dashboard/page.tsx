import Link from "next/link";
import { getBatches, getSuppliers } from "@/lib/data";
import { computeKpis, buildSpcChart } from "@/lib/analytics";
import { SpcChartView } from "@/components/spc-chart";
import { Card, GateBadge, IngredientBadge, INGREDIENT_DOT } from "@/components/ui";
import { MARKER } from "@/lib/types";
import { fmtDate, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [batches, suppliers] = await Promise.all([getBatches(), getSuppliers()]);
  const active = suppliers.filter((s) => s.status === "active").length;
  const kpis = computeKpis(batches, active);
  const spc = buildSpcChart(batches, "mangosteen");
  const recent = batches.slice(0, 7);

  const kpiCards = [
    { label: "Total batch", value: kpis.totalBatches, sub: "periode ini" },
    { label: "Accept", value: `${kpis.pctAccept}%`, sub: "lolos gerbang", tone: "text-accept" },
    { label: "Route → NIR", value: `${kpis.pctRouteNir}%`, sub: "perlu konfirmasi", tone: "text-route" },
    { label: "Reject", value: `${kpis.pctReject}%`, sub: "di bawah spec", tone: "text-reject" },
    { label: "Pemasok aktif", value: active, sub: `dari ${suppliers.length} total` },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {kpiCards.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="eyebrow">{k.label}</div>
            <div className={cn("readout mt-1 text-3xl font-semibold", k.tone)}>{k.value}</div>
            <div className="mt-0.5 text-xs text-muted">{k.sub}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* SPC hero */}
        <Card className="lg:col-span-2">
          <SpcChartView chart={spc} />
        </Card>

        {/* avg marker per ingredient */}
        <Card>
          <div className="eyebrow mb-3">Rata-rata kadar penanda</div>
          <div className="space-y-4">
            {(["mangosteen", "kelor", "pegagan"] as const).map((ing) => {
              const v = kpis.avgMarkerByIngredient[ing];
              const spec = MARKER[ing].specMin;
              const ok = v != null && v >= spec;
              return (
                <div key={ing}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", INGREDIENT_DOT[ing])} />
                      {MARKER[ing].label}
                    </span>
                    <span className="readout font-medium">
                      {v ?? "—"} <span className="text-muted">/ {spec} {MARKER[ing].unit}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-hairline">
                    <div
                      className={cn("h-full rounded-full", ok ? "bg-accept" : "bg-route")}
                      style={{ width: `${v != null ? Math.min(100, (v / (spec * 1.6)) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* recent batches */}
      <Card className="p-0">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-display text-sm font-semibold">Batch terbaru</h2>
          <Link href="/batches" className="text-xs font-medium text-brand hover:underline">
            Lihat semua →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-hairline text-left text-xs text-muted">
                <th className="px-5 py-2.5 font-medium">Batch</th>
                <th className="px-3 py-2.5 font-medium">Bahan</th>
                <th className="px-3 py-2.5 font-medium">Pemasok</th>
                <th className="px-3 py-2.5 font-medium">Penanda</th>
                <th className="px-3 py-2.5 font-medium">Diterima</th>
                <th className="px-5 py-2.5 font-medium">Gerbang</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((b) => (
                <tr key={b.id} className="border-b border-hairline/60 last:border-0 hover:bg-bg/60">
                  <td className="readout px-5 py-3 text-xs">{b.id}</td>
                  <td className="px-3 py-3"><IngredientBadge ingredient={b.ingredient} /></td>
                  <td className="px-3 py-3 text-muted">{b.supplierName}</td>
                  <td className="readout px-3 py-3">
                    {b.nirMarkerPct ?? <span className="text-muted">CV only</span>}
                  </td>
                  <td className="px-3 py-3 text-muted">{fmtDate(b.receivedAt)}</td>
                  <td className="px-5 py-3"><GateBadge decision={b.gateDecision} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
