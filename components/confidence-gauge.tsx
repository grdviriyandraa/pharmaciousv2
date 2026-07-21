import { cn } from "@/lib/utils";
import { CV_THRESHOLD } from "@/lib/gate";

// A segmented bar that maps confidence onto the three decision zones.
// The reader can *see* which zone a batch fell in — the router logic made visual.
export function ConfidenceGauge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const zone =
    value > CV_THRESHOLD.autoAccept ? "accept" : value >= CV_THRESHOLD.review ? "review" : "lab";
  const zoneLabel = { accept: "Auto-accept", review: "QC review", lab: "Wajib NIR" }[zone];
  const zoneColor = { accept: "text-accept", review: "text-route", lab: "text-reject" }[zone];

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="eyebrow">Keyakinan model</span>
        <span className="readout text-2xl font-semibold">{pct}%</span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-hairline">
        {/* zone backdrops: <80 | 80–95 | >95 */}
        <div className="absolute inset-y-0 left-0 w-[80%] bg-reject/15" />
        <div className="absolute inset-y-0 left-[80%] w-[15%] bg-route/20" />
        <div className="absolute inset-y-0 left-[95%] right-0 bg-accept/25" />
        {/* fill */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all",
            zone === "accept" ? "bg-accept" : zone === "review" ? "bg-route" : "bg-reject"
          )}
          style={{ width: `${pct}%` }}
        />
        {/* threshold ticks */}
        <div className="absolute inset-y-0 left-[80%] w-px bg-ink/25" />
        <div className="absolute inset-y-0 left-[95%] w-px bg-ink/25" />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] font-mono text-muted">
        <span>0</span>
        <span className="translate-x-2">80</span>
        <span className="-translate-x-4">95</span>
        <span>100</span>
      </div>
      <p className={cn("mt-2 text-sm font-medium", zoneColor)}>→ {zoneLabel}</p>
    </div>
  );
}
