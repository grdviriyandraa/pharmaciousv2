import * as React from "react";
import { cn } from "@/lib/utils";
import type { GateDecision, Ingredient } from "@/lib/types";
import { INGREDIENT_META } from "@/lib/types";

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card p-5", className)} {...p} />;
}

export function Button({
  className,
  variant = "primary",
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "outline" }) {
  const styles = {
    primary: "bg-brand text-white hover:bg-brand-ink",
    outline: "border border-hairline bg-surface hover:bg-bg",
    ghost: "hover:bg-bg",
  }[variant];
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50",
        styles,
        className
      )}
      {...p}
    />
  );
}

export function Input({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-hairline bg-surface px-3.5 py-2.5 text-sm outline-none placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/15",
        className
      )}
      {...p}
    />
  );
}

const GATE_STYLE: Record<GateDecision, { label: string; cls: string; dot: string }> = {
  accept: { label: "Accept", cls: "bg-accept/10 text-accept border-accept/25", dot: "bg-accept" },
  route_nir: { label: "Route → NIR", cls: "bg-route/10 text-route border-route/25", dot: "bg-route" },
  reject: { label: "Reject", cls: "bg-reject/10 text-reject border-reject/25", dot: "bg-reject" },
};

export function GateBadge({ decision, className }: { decision: GateDecision; className?: string }) {
  const s = GATE_STYLE[decision];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        s.cls,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

const ING_COLOR: Record<Ingredient, string> = {
  mangosteen: "text-manggis bg-manggis/10 border-manggis/20",
  kelor: "text-kelor bg-kelor/10 border-kelor/20",
  pegagan: "text-pegagan bg-pegagan/10 border-pegagan/20",
};

export function IngredientBadge({ ingredient }: { ingredient: Ingredient }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        ING_COLOR[ingredient]
      )}
    >
      {INGREDIENT_META[ingredient].name}
    </span>
  );
}

export const INGREDIENT_DOT: Record<Ingredient, string> = {
  mangosteen: "bg-manggis",
  kelor: "bg-kelor",
  pegagan: "bg-pegagan",
};
