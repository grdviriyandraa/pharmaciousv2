"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Camera, Sparkles, RefreshCw, FlaskConical, Cpu, Save, CheckCircle2, ArrowRight, Flame } from "lucide-react";
import { Button, Card, GateBadge } from "@/components/ui";
import { ConfidenceGauge } from "@/components/confidence-gauge";
import { analyzeOnDevice, classifyFrame, getModelStatus, type OnDeviceResult, type LiveResult } from "@/lib/inference-onnx";

type SupplierOption = { id: string; name: string };
type SavedBatch = { id: string; supplierName: string };

// Ambang di bawah ini dianggap "objek belum jelas / bukan manggis" → zona netral.
const LIVE_MIN_CONFIDENCE = 0.6;

type VerdictKey = "scan" | "aim" | "accept" | "route" | "reject";
const VERDICT_STYLE: Record<VerdictKey, { ring: string; badge: string; label: string }> = {
  scan: { ring: "ring-white/40", badge: "bg-ink/75 text-white", label: "Memindai…" },
  aim: { ring: "ring-white/50", badge: "bg-ink/75 text-white", label: "Arahkan ke buah" },
  accept: { ring: "ring-accept", badge: "bg-accept text-white", label: "TERIMA" },
  route: { ring: "ring-route", badge: "bg-route text-white", label: "CEK NIR" },
  reject: { ring: "ring-reject", badge: "bg-reject text-white", label: "TOLAK" },
};

function liveVerdict(live: LiveResult | null): { key: VerdictKey; sub: string } {
  if (!live) return { key: "scan", sub: "" };
  const pct = `${(live.confidence * 100).toFixed(0)}%`;
  if (live.confidence < LIVE_MIN_CONFIDENCE) return { key: "aim", sub: "objek belum jelas" };
  if (live.decision === "accept") return { key: "accept", sub: `Ripe · ${pct}` };
  if (live.decision === "reject") return { key: "reject", sub: `${live.grade} · ${pct}` };
  return { key: "route", sub: `keyakinan ${pct}` };
}

// Contoh siap-pakai (taruh file di public/samples/ — lihat public/samples/README.md).
// Thumbnail yang filenya belum ada otomatis disembunyikan.
const SAMPLES = [
  { src: "/samples/manggis-1.jpg", label: "Contoh 1" },
  { src: "/samples/manggis-2.jpg", label: "Contoh 2" },
  { src: "/samples/manggis-3.jpg", label: "Contoh 3" },
  { src: "/samples/manggis-4.jpg", label: "Contoh 4" },
];

export default function InspectionPage() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OnDeviceResult | null>(null);
  const [modelStatus, setModelStatus] = useState<"onnx" | "mock" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [live, setLive] = useState<LiveResult | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [loadedSamples, setLoadedSamples] = useState<Set<string>>(new Set());
  const samples = SAMPLES.filter((s) => loadedSamples.has(s.src));

  // — pencatatan batch (loop Inspeksi → Batch → Dashboard) —
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [quantityKg, setQuantityKg] = useState("100");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedBatch | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    getModelStatus().then(setModelStatus);
    fetch("/api/suppliers")
      .then((r) => r.json())
      .then((rows: Array<{ id: string; name: string; ingredient: string }>) => {
        const mango = rows.filter((s) => s.ingredient === "mangosteen");
        setSuppliers(mango.map((s) => ({ id: s.id, name: s.name })));
        if (mango[0]) setSupplierId(mango[0].id);
      })
      .catch(() => {});
  }, []);

  // Pasang stream SETELAH <video> ter-mount (baru muncul saat camOn true).
  useEffect(() => {
    if (camOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [camOn]);

  // Loop inferensi real-time selama kamera hidup: klasifikasi frame berkala →
  // update verdict live (hijau/kuning/merah). Guard `busy` supaya tak menumpuk.
  useEffect(() => {
    if (!camOn) {
      setLive(null);
      return;
    }
    let active = true;
    let busy = false;
    const id = setInterval(async () => {
      const v = videoRef.current;
      if (busy || !v || !v.videoWidth) return;
      busy = true;
      try {
        const r = await classifyFrame(v);
        if (active) setLive(r);
      } catch {
        /* frame gagal — abaikan, coba lagi siklus berikutnya */
      } finally {
        busy = false;
      }
    }, 350);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [camOn]);

  // Matikan kamera saat komponen dilepas (jangan tinggalkan lampu kamera menyala).
  useEffect(() => () => stopStream(), []);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function resetRecord() {
    setSaved(null);
    setSaveError(null);
  }

  async function recordBatch() {
    if (!result) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          quantityKg: Number(quantityKg),
          cvGrade: result.grade,
          cvConfidence: result.confidence,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSaveError(data?.error ?? "Gagal mencatat batch.");
      } else {
        setSaved({ id: data.id, supplierName: data.supplierName });
      }
    } catch {
      setSaveError("Tidak bisa terhubung ke server.");
    } finally {
      setSaving(false);
    }
  }

  function loadSample(src: string) {
    setImage(src); // same-origin path — dipakai langsung utk <img> & preprocess
    setResult(null);
    resetRecord();
    setShowHeatmap(true);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
      setResult(null);
    };
    reader.readAsDataURL(f);
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Browser ini tidak mendukung kamera. Gunakan Unggah, atau buka lewat HTTPS.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCamOn(true); // mount <video> → effect di atas yang memasang stream
    } catch {
      alert("Tidak bisa mengakses kamera. Pastikan izin kamera diizinkan (situs harus HTTPS). Anda tetap bisa pakai Unggah.");
    }
  }

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    setImage(canvas.toDataURL("image/jpeg"));
    setResult(null);
    resetRecord();
    stopStream();
    setCamOn(false);
  }

  async function analyze() {
    if (!image) return;
    setLoading(true);
    setResult(null);
    // Inferensi jalan on-device (ONNX Runtime Web); fallback mock kalau model belum ada.
    const r = await analyzeOnDevice(image);
    setResult(r);
    setModelStatus(r.modelSource ?? null);
    resetRecord();
    setLoading(false);
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
      {/* capture panel */}
      <Card className="p-0">
        <div className="border-b border-hairline px-5 py-4">
          <h2 className="font-display text-sm font-semibold">Inspeksi kulit manggis</h2>
          <p className="mt-0.5 text-xs text-muted">
            Unggah atau ambil foto perikarp. Gerbang visual hanya untuk manggis.
          </p>
        </div>

        <div className="p-5">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-hairline bg-bg">
            {camOn ? (
              (() => {
                const v = liveVerdict(live);
                const s = VERDICT_STYLE[v.key];
                return (
                  <>
                    <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />

                    {/* grid rule-of-thirds + kotak fokus */}
                    <svg
                      className="pointer-events-none absolute inset-0 h-full w-full"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <line x1="33.33" y1="0" x2="33.33" y2="100" stroke="white" strokeOpacity="0.22" strokeWidth="0.25" />
                      <line x1="66.66" y1="0" x2="66.66" y2="100" stroke="white" strokeOpacity="0.22" strokeWidth="0.25" />
                      <line x1="0" y1="33.33" x2="100" y2="33.33" stroke="white" strokeOpacity="0.22" strokeWidth="0.25" />
                      <line x1="0" y1="66.66" x2="100" y2="66.66" stroke="white" strokeOpacity="0.22" strokeWidth="0.25" />
                      <rect x="26" y="18" width="48" height="64" fill="none" stroke="white" strokeOpacity="0.45" strokeWidth="0.5" rx="3" />
                    </svg>

                    {/* border warna verdict (lampu lalu lintas) */}
                    <div className={`pointer-events-none absolute inset-0 rounded-xl ring-4 ring-inset transition-colors ${s.ring}`} />

                    {/* badge verdict besar di atas */}
                    <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2">
                      <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 font-display text-sm font-bold shadow-lg backdrop-blur ${s.badge}`}>
                        <span className="h-2 w-2 rounded-full bg-white/90" />
                        {s.label}
                        {v.sub && <span className="font-mono text-[11px] font-medium opacity-90">· {v.sub}</span>}
                      </div>
                    </div>

                    {/* persentase live besar di kiri bawah */}
                    <div className="pointer-events-none absolute bottom-2 left-2 rounded-lg bg-ink/70 px-2.5 py-1.5 font-mono text-white backdrop-blur">
                      <span className="text-lg font-bold tabular-nums">
                        {live ? `${(live.confidence * 100).toFixed(0)}%` : "—"}
                      </span>
                      <span className="ml-1 text-[10px] opacity-70">keyakinan</span>
                    </div>

                    <span className="pointer-events-none absolute right-2 top-3 rounded-md bg-ink/70 px-2 py-1 font-mono text-[10px] text-white">
                      LIVE ● real-time
                    </span>
                  </>
                );
              })()
            ) : image ? (
              <>
                {/* image + peta aktivasi model (overlay dari feature-map konv terakhir) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="sampel" className="h-full w-full object-cover" />
                {result?.heatmapDataUrl && showHeatmap && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.heatmapDataUrl}
                      alt="peta aktivasi"
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-80"
                    />
                    <span className="absolute left-2 top-2 rounded-md bg-ink/80 px-2 py-1 text-[10px] font-mono text-white">
                      Peta aktivasi CV
                    </span>
                  </>
                )}
                {result?.heatmapDataUrl && (
                  <button
                    onClick={() => setShowHeatmap((v) => !v)}
                    className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-ink/80 px-2 py-1 text-[10px] font-medium text-white hover:bg-ink"
                  >
                    <Flame size={11} />
                    {showHeatmap ? "Sembunyikan peta" : "Tampilkan peta"}
                  </button>
                )}
              </>
            ) : (
              <div className="grid h-full place-items-center text-center text-sm text-muted">
                <div>
                  <Camera className="mx-auto mb-2 opacity-40" />
                  Belum ada gambar
                </div>
              </div>
            )}
          </div>

          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Unggah
            </Button>
            {camOn ? (
              <Button onClick={capture}>
                <Camera size={16} /> Ambil foto
              </Button>
            ) : (
              <Button variant="outline" onClick={startCamera}>
                <Camera size={16} /> Kamera
              </Button>
            )}
            <Button className="ml-auto" onClick={analyze} disabled={!image || loading}>
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading ? "Menganalisis…" : "Jalankan analisis"}
            </Button>
          </div>

          {/* preloader tersembunyi — deteksi file contoh yang benar-benar ada */}
          <div className="hidden" aria-hidden>
            {SAMPLES.map((s) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={s.src}
                src={s.src}
                alt=""
                onLoad={() => setLoadedSamples((prev) => new Set(prev).add(s.src))}
              />
            ))}
          </div>

          {/* Coba contoh — hanya muncul kalau ada file di public/samples/ */}
          {samples.length > 0 && (
            <div className="mt-4 border-t border-hairline pt-4">
              <div className="eyebrow mb-2">Coba contoh</div>
              <div className="flex flex-wrap gap-2">
                {samples.map((s) => (
                  <button
                    key={s.src}
                    onClick={() => loadSample(s.src)}
                    title={s.label}
                    className="group relative h-14 w-14 overflow-hidden rounded-lg border border-hairline transition hover:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.src}
                      alt={s.label}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* result panel */}
      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <h2 className="font-display text-sm font-semibold">Hasil gerbang mutu</h2>
          {modelStatus && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] ${
                modelStatus === "onnx"
                  ? "bg-brand-tint/60 text-brand-ink"
                  : "bg-amber-100 text-amber-800"
              }`}
              title={
                modelStatus === "onnx"
                  ? "MobileNetV3 asli berjalan di perangkat ini (ONNX Runtime Web)"
                  : "File model belum dipasang — hasil dari simulasi deterministik"
              }
            >
              <Cpu size={11} />
              {modelStatus === "onnx" ? "MobileNetV3 · on-device" : "mock demo"}
            </span>
          )}
        </div>
        <div className="p-5">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3 py-10 text-center">
                <RefreshCw className="mx-auto animate-spin text-brand" />
                <p className="text-sm text-muted">
                  {modelStatus === "onnx"
                    ? "MobileNetV3 memproses citra (on-device)…"
                    : "Simulasi (mock) memproses citra…"}
                </p>
              </motion.div>
            ) : result ? (
              <motion.div key="r" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="eyebrow">Grade kematangan</div>
                    <div className="font-display text-2xl font-semibold">{result.grade}</div>
                  </div>
                  <GateBadge decision={result.gate.decision} className="text-sm" />
                </div>

                <ConfidenceGauge value={result.confidence} />

                <div className="rounded-xl border border-hairline bg-bg/60 p-4">
                  <div className="eyebrow mb-1">Alasan</div>
                  <p className="text-sm">{result.gate.reason}</p>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-brand/20 bg-brand-tint/50 p-4">
                  <FlaskConical size={18} className="mt-0.5 shrink-0 text-brand" />
                  <div>
                    <div className="text-sm font-medium text-brand-ink">Rekomendasi</div>
                    <p className="text-sm text-ink/80">{result.recommendation}</p>
                  </div>
                </div>

                {/* Catat sebagai batch → masuk ke Batch Intake & KPI dashboard */}
                <div className="rounded-xl border border-hairline bg-surface p-4">
                  {saved ? (
                    <div className="space-y-2 text-center">
                      <CheckCircle2 className="mx-auto text-accept" size={22} />
                      <div className="text-sm font-medium">
                        Batch <span className="readout">{saved.id}</span> tercatat
                      </div>
                      <p className="text-xs text-muted">
                        Pemasok {saved.supplierName} · masuk ke Batch Intake &amp; KPI dashboard.
                      </p>
                      <div className="flex justify-center gap-3 pt-1">
                        <Link
                          href="/batches"
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                        >
                          Lihat di Batch Intake <ArrowRight size={13} />
                        </Link>
                        <button
                          onClick={resetRecord}
                          className="text-xs font-medium text-muted hover:text-ink"
                        >
                          Catat lagi
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="eyebrow mb-2">Catat sebagai batch</div>
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="min-w-[9rem] flex-1 text-xs">
                          <span className="mb-1 block text-muted">Pemasok</span>
                          <select
                            value={supplierId}
                            onChange={(e) => setSupplierId(e.target.value)}
                            className="w-full rounded-lg border border-hairline bg-bg px-2.5 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                          >
                            {suppliers.length === 0 && <option value="">— memuat —</option>}
                            {suppliers.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="w-24 text-xs">
                          <span className="mb-1 block text-muted">Jumlah (kg)</span>
                          <input
                            type="number"
                            min={1}
                            max={5000}
                            value={quantityKg}
                            onChange={(e) => setQuantityKg(e.target.value)}
                            className="w-full rounded-lg border border-hairline bg-bg px-2.5 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                          />
                        </label>
                        <Button onClick={recordBatch} disabled={saving || !supplierId}>
                          {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                          {saving ? "Menyimpan…" : "Catat batch"}
                        </Button>
                      </div>
                      {saveError && <p className="mt-2 text-xs text-reject">{saveError}</p>}
                    </>
                  )}
                </div>

                <p className="text-xs text-muted">
                  Keputusan CV adalah penyaring awal, bukan final — konfirmasi kadar α-mangostin via
                  NIR/HPLC tetap menentukan. Gambar tidak disimpan (hanya grade &amp; keyakinan
                  dicatat).
                </p>
              </motion.div>
            ) : (
              <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid place-items-center py-16 text-center text-sm text-muted">
                <div>
                  <Sparkles className="mx-auto mb-2 opacity-40" />
                  Jalankan analisis untuk melihat grade, keyakinan, dan keputusan gerbang.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </div>
  );
}
