"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, ScanEye, FlaskConical, ArrowRight, RefreshCw, KeyRound } from "lucide-react";
import { Button, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("qc@amerta.id");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Gagal masuk. Coba lagi.");
        setLoading(false);
        return;
      }
      // hormati ?next= dari middleware (tanpa useSearchParams agar halaman tetap statis)
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next && next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch {
      setError("Tidak bisa terhubung ke server. Periksa koneksi Anda.");
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* left — form */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto w-full max-w-sm"
        >
          <div className="mb-8 flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white">
              <ShieldCheck size={20} />
            </div>
            <div className="leading-tight">
              <div className="font-display text-base font-semibold">AMERTA</div>
              <div className="eyebrow">Smart Quality Gate</div>
            </div>
          </div>

          <h1 className="font-display text-3xl font-semibold leading-tight">
            Gerbang mutu bahan baku, <span className="text-brand">sebelum ekstraksi.</span>
          </h1>
          <p className="mt-3 text-sm text-muted">
            Inspeksi awal kulit manggis berbasis AI — cepat, konsisten, terdokumentasi. Bukan
            pengganti lab, tapi penyaring cerdas sebelum NIR/HPLC.
          </p>

          <form className="mt-8 space-y-3" onSubmit={submit}>
            <div>
              <label htmlFor="email" className="eyebrow mb-1.5 block">
                Email
              </label>
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="eyebrow mb-1.5 block">
                Kata sandi
              </label>
              <Input
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <p role="alert" className="rounded-lg border border-reject/25 bg-reject/5 px-3 py-2 text-xs text-reject">
                {error}
              </p>
            )}
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? <RefreshCw size={16} className="animate-spin" /> : null}
              {loading ? "Memeriksa…" : "Masuk"} {!loading && <ArrowRight size={16} />}
            </Button>
            <div className="flex items-center justify-center gap-1.5 pt-1 text-xs text-muted">
              <KeyRound size={12} />
              Akun demo: <span className="font-mono">qc@amerta.id</span> ·{" "}
              <span className="font-mono">amerta2026</span>
            </div>
          </form>
        </motion.div>
      </div>

      {/* right — gate motif */}
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <div className="absolute inset-0 hairline-grid opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-ink/40 via-transparent to-manggis/20" />
        <div className="relative flex h-full flex-col justify-center px-14 text-white">
          <span className="eyebrow text-white/60">Alur gerbang bertingkat</span>
          <div className="mt-6 space-y-3">
            {[
              { icon: ScanEye, t: "Gerbang visual (CV)", d: "MobileNetV3 + Grad-CAM menilai kematangan manggis", c: "bg-manggis" },
              { icon: FlaskConical, t: "Konfirmasi NIR", d: "Kadar α-mangostin diprediksi non-destruktif", c: "bg-gold" },
              { icon: ShieldCheck, t: "Keputusan mutu", d: "Accept · Route → NIR · Reject, terekam per batch", c: "bg-accept" },
            ].map((s, i) => (
              <motion.div
                key={s.t}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.15, duration: 0.5 }}
                className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
              >
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${s.c} text-white`}>
                  <s.icon size={18} />
                </div>
                <div>
                  <div className="font-display text-sm font-semibold">{s.t}</div>
                  <div className="text-xs text-white/60">{s.d}</div>
                </div>
              </motion.div>
            ))}
          </div>
          <p className="readout mt-10 text-xs text-white/40">
            Konsistensi mutu adalah persoalan data — sebelum jadi persoalan kimia.
          </p>
        </div>
      </div>
    </div>
  );
}
