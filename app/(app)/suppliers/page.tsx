import { getSuppliers } from "@/lib/data";
import { Card } from "@/components/ui";
import { INGREDIENT_META, MARKER, type Ingredient } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS = {
  active: "bg-accept/10 text-accept",
  probation: "bg-route/10 text-route",
  pending: "bg-muted/10 text-muted",
} as const;

const LANE_ACCENT: Record<Ingredient, string> = {
  mangosteen: "border-manggis/30 bg-manggis/[0.04]",
  kelor: "border-kelor/30 bg-kelor/[0.04]",
  pegagan: "border-pegagan/30 bg-pegagan/[0.04]",
};
const DOT: Record<Ingredient, string> = { mangosteen: "bg-manggis", kelor: "bg-kelor", pegagan: "bg-pegagan" };

export default async function SuppliersPage() {
  const suppliers = await getSuppliers();
  const ings: Ingredient[] = ["mangosteen", "kelor", "pegagan"];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* lanes */}
      <div className="grid gap-4 md:grid-cols-3">
        {ings.map((ing) => {
          const list = suppliers.filter((s) => s.ingredient === ing);
          const avg = list.length ? list.reduce((a, s) => a + s.specCompliance, 0) / list.length : 0;
          return (
            <div key={ing} className={cn("rounded-2xl border p-5", LANE_ACCENT[ing])}>
              <div className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", DOT[ing])} />
                <span className="font-display text-sm font-semibold">{INGREDIENT_META[ing].name}</span>
              </div>
              <div className="mt-0.5 text-xs italic text-muted">{INGREDIENT_META[ing].latin}</div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="readout text-2xl font-semibold">{list.length}</div>
                  <div className="eyebrow">pemasok</div>
                </div>
                <div className="text-right">
                  <div className="readout text-2xl font-semibold">{Math.round(avg * 100)}%</div>
                  <div className="eyebrow">rata-rata kepatuhan</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-muted">
                Penanda: {MARKER[ing].label} · {INGREDIENT_META[ing].hasCV ? "lewat gerbang CV" : "langsung NIR"}
              </div>
            </div>
          );
        })}
      </div>

      {/* supplier grid */}
      <Card className="p-0">
        <div className="border-b border-hairline px-5 py-4">
          <h2 className="font-display text-sm font-semibold">Pemasok terikat spec sheet</h2>
        </div>
        <div className="grid gap-px bg-hairline sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => (
            <div key={s.id} className="bg-surface p-4 transition-colors hover:bg-bg/60">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted">{s.region}</div>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", STATUS[s.status])}>
                  {s.status}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-gold">
                  <Star size={13} className="fill-gold" /> {s.rating}.0
                </span>
                <span className="readout text-muted">{s.batchesSupplied} batch</span>
              </div>
              <div className="mt-2">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted">Kepatuhan spec</span>
                  <span className="readout">{Math.round(s.specCompliance * 100)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-hairline">
                  <div
                    className={cn("h-full rounded-full", s.specCompliance > 0.8 ? "bg-accept" : "bg-route")}
                    style={{ width: `${s.specCompliance * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
