"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, ScanEye, Boxes, Truck, ShieldCheck, LogOut, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { InstallPrompt } from "@/components/install-prompt";

const NAV = [
  { href: "/dashboard", label: "Overview", short: "Overview", icon: LayoutDashboard },
  { href: "/inspection", label: "Inspeksi AI", short: "Inspeksi", icon: ScanEye },
  { href: "/batches", label: "Batch Intake", short: "Batch", icon: Boxes },
  { href: "/suppliers", label: "Rantai Pasok", short: "Pasok", icon: Truck },
];

const ROLE_LABEL: Record<string, string> = {
  qc: "QC Officer",
  qa: "QA",
  production_manager: "Production Manager",
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function Shell({
  user,
  children,
}: {
  user: { name: string; role: string };
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const current = NAV.find((n) => path.startsWith(n.href))?.label ?? "Overview";
  const roleLabel = ROLE_LABEL[user.role] ?? user.role;

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-hairline bg-surface md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white">
            <ShieldCheck size={18} />
          </div>
          <div className="leading-tight">
            <div className="font-display text-sm font-semibold">AMERTA</div>
            <div className="eyebrow">Quality Gate</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-2">
          {NAV.map((n) => {
            const active = path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active ? "bg-brand-tint font-medium text-brand-ink" : "text-muted hover:bg-bg hover:text-ink"
                )}
              >
                <n.icon size={17} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-hairline p-3">
          <div className="flex items-center gap-3 rounded-xl px-3 py-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gold-tint text-xs font-semibold text-gold">
              {initialsOf(user.name)}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="eyebrow">{roleLabel}</div>
            </div>
            <button
              onClick={logout}
              disabled={loggingOut}
              className="text-muted transition-colors hover:text-ink disabled:opacity-50"
              aria-label="Keluar"
            >
              {loggingOut ? <RefreshCw size={16} className="animate-spin" /> : <LogOut size={16} />}
            </button>
          </div>
        </div>
      </aside>

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-hairline bg-bg/80 px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* logo kecil khusus mobile (sidebar tersembunyi) */}
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-white md:hidden">
              <ShieldCheck size={16} />
            </div>
            <h1 className="truncate font-display text-lg font-semibold">{current}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <InstallPrompt />
            <div className="readout hidden text-xs text-muted sm:block">AMERTA · MVP 1.0 · data mock</div>
            <button
              onClick={logout}
              disabled={loggingOut}
              className="text-muted transition-colors hover:text-ink disabled:opacity-50 md:hidden"
              aria-label="Keluar"
            >
              {loggingOut ? <RefreshCw size={17} className="animate-spin" /> : <LogOut size={17} />}
            </button>
          </div>
        </header>
        {/* pb ekstra di mobile agar konten tidak tertutup bottom nav */}
        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 md:pb-6">{children}</main>
      </div>

      {/* bottom nav (mobile) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-hairline bg-surface/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-4">
          {NAV.map((n) => {
            const active = path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors",
                  active ? "font-medium text-brand-ink" : "text-muted hover:text-ink"
                )}
              >
                <n.icon size={19} className={active ? "text-brand" : undefined} />
                {n.short}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
