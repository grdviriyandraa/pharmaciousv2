import type { GateDecision, InferenceResult } from "./types";
import { decideGate, recommendationFor } from "./gate";
import { analyzeMangosteen as analyzeMock } from "./inference";

// ─────────────────────────────────────────────────────────────────────────────
// ON-DEVICE INFERENCE — MobileNetV3-Large via ONNX Runtime Web (wasm, browser).
//
// Model file : /public/model/mangosteen_grader.onnx  (MobileNetV3-Large, opset 17,
//              input "input" 1×3×224×224 → output "logits" [1,2] + "feat" [1,960,7,7]).
//              "feat" = peta aktivasi konv terakhir → dipakai untuk heatmap perhatian.
// Preprocess : HARUS identik dgn training (sel 6 notebook) — Resize(224,224)
//              squash, /255, Normalize ImageNet.
// Heatmap    : activation-based (rata-rata ReLU antar 960 kanal), BUKAN Grad-CAM
//              gradien (browser tak bisa backprop). Menunjukkan area fokus model.
// Fallback   : kalau file model belum ada (404) atau gagal dimuat, otomatis
//              pakai mock lama dari lib/inference.ts — demo tetap jalan, dan
//              hasil ditandai modelSource:"mock" biar jujur di UI.
//
// Browser-only: import modul ini hanya dari client component.
// ─────────────────────────────────────────────────────────────────────────────

const MODEL_URL = "/model/mangosteen_grader.onnx";
// ORT dimuat runtime dari /ort/ (di-copy oleh scripts/copy-ort-wasm.mjs), BUKAN
// di-bundle webpack — bundle ort menyeret build Node-nya dan mematahkan `next build`.
const ORT_BUNDLE_URL = "/ort/ort.wasm.bundle.min.mjs";
// Urutan kelas = ImageFolder (alfabetis Python: huruf besar dulu) di notebook.
// Model 2-kelas sekarang: ["Ripe","Un_Ripe"]. Setelah retrain + kelas reject:
// ["Ripe","Un_Ripe","bukan_manggis"] (indeks 0/1 tetap, reject = indeks 2).
// Menyertakan kelas ketiga di sini aman utk model 2-output (argmax tak pernah 2).
const CLASSES = ["Ripe", "Un_Ripe", "bukan_manggis"] as const;
const NOT_MANGOSTEEN = "bukan_manggis";
const SIZE = 224;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

export type OnDeviceResult = InferenceResult & {
  gate: { decision: GateDecision; reason: string };
  notMangosteen?: boolean; // true kalau model (3-kelas) memprediksi "bukan_manggis"
};

type OrtModule = typeof import("onnxruntime-web");
type Loaded = { ort: OrtModule; session: import("onnxruntime-web").InferenceSession };

let loadedPromise: Promise<Loaded | null> | null = null;

async function getSession(): Promise<Loaded | null> {
  if (!loadedPromise) {
    loadedPromise = (async () => {
      try {
        // webpackIgnore: biarkan browser meng-import ESM bundle ORT langsung.
        const ort = (await import(
          /* webpackIgnore: true */ ORT_BUNDLE_URL
        )) as unknown as OrtModule;
        ort.env.wasm.wasmPaths = "/ort/"; // self-hosted (lihat scripts/copy-ort-wasm.mjs)
        ort.env.wasm.numThreads = 1; // single-thread → tak butuh header COOP/COEP
        // Tanpa pre-check HEAD: GET dari create() lewat service worker, jadi saat
        // offline model tetap terlayani dari cache. Kalau file belum ada (404),
        // create() melempar → fallback mock di bawah.
        const session = await ort.InferenceSession.create(MODEL_URL, {
          executionProviders: ["wasm"],
        });
        return { ort, session };
      } catch (e) {
        console.warn("[inference] model ONNX belum tersedia / gagal dimuat — fallback ke mock:", e);
        return null;
      }
    })();
  }
  const loaded = await loadedPromise;
  // Jangan cache kegagalan: begitu file model ditaruh, percobaan berikutnya langsung pakai.
  if (!loaded) loadedPromise = null;
  return loaded;
}

/** Status backend saat ini — dipakai UI untuk badge "on-device" vs "mock". */
export async function getModelStatus(): Promise<"onnx" | "mock"> {
  return (await getSession()) ? "onnx" : "mock";
}

function softmax(logits: Float32Array): number[] {
  const max = Math.max(...logits);
  const exps = Array.from(logits, (v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

type DrawSource = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

/** Elemen gambar/video/canvas → tensor float32 NCHW [1,3,224,224], preprocessing identik training. */
function sourceToTensor(source: DrawSource, ort: OrtModule) {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d tidak tersedia");
  ctx.drawImage(source, 0, 0, SIZE, SIZE); // squash, sama seperti transforms.Resize((224,224))
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

  const chw = new Float32Array(3 * SIZE * SIZE);
  const plane = SIZE * SIZE;
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) {
      chw[c * plane + i] = (data[i * 4 + c] / 255 - MEAN[c]) / STD[c];
    }
  }
  return new ort.Tensor("float32", chw, [1, 3, SIZE, SIZE]);
}

/** dataURL → tensor (untuk analisis snapshot). */
async function preprocess(imageDataUrl: string, ort: OrtModule) {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("gambar tidak bisa dimuat"));
    el.src = imageDataUrl;
  });
  return sourceToTensor(img, ort);
}

export type LiveResult = {
  grade: string;
  confidence: number;
  decision: GateDecision;
  reason: string;
  notMangosteen: boolean;
};

/**
 * Klasifikasi cepat SATU frame (mode kamera real-time). Tanpa heatmap → ringan
 * untuk dijalankan berulang. Mengembalikan null kalau model asli belum terpasang
 * (mode live butuh model asli, bukan mock).
 */
export async function classifyFrame(source: DrawSource): Promise<LiveResult | null> {
  const loaded = await getSession();
  if (!loaded) return null;
  const { ort, session } = loaded;
  const input = sourceToTensor(source, ort);
  const outputs = await session.run({ [session.inputNames[0]]: input });
  const logitsName = session.outputNames.includes("logits") ? "logits" : session.outputNames[0];
  const logits = outputs[logitsName].data as Float32Array;
  const probs = softmax(logits);
  const idx = probs.indexOf(Math.max(...probs));
  const grade = CLASSES[idx] ?? `class_${idx}`;
  const confidence = Number(probs[idx].toFixed(3));
  const gate = decideGate({
    ingredient: "mangosteen",
    cvGrade: grade,
    cvConfidence: confidence,
    nirMarker: null,
  });
  return {
    grade,
    confidence,
    decision: gate.decision,
    reason: gate.reason,
    notMangosteen: grade === NOT_MANGOSTEEN,
  };
}

/**
 * Peta perhatian dari feature-map konv terakhir "feat" [1,C,H,W].
 * Per sel spasial: rata-rata aktivasi ReLU antar kanal → dinormalisasi →
 * di-upscale halus ke 224 → colormap hangat (transparan→kuning→merah) sebagai
 * overlay PNG. Ini activation map (1 forward pass), bukan Grad-CAM gradien.
 */
function buildHeatmapDataUrl(feat: Float32Array, dims: readonly number[]): string | null {
  const C = dims[1] ?? 0;
  const H = dims[2] ?? 0;
  const W = dims[3] ?? 0;
  if (!C || !H || !W) return null;
  const plane = H * W;

  const sal = new Float32Array(plane);
  let mn = Infinity;
  let mx = -Infinity;
  for (let p = 0; p < plane; p++) {
    let s = 0;
    for (let c = 0; c < C; c++) {
      const v = feat[c * plane + p];
      if (v > 0) s += v; // ReLU
    }
    const avg = s / C;
    sal[p] = avg;
    if (avg < mn) mn = avg;
    if (avg > mx) mx = avg;
  }
  const range = mx - mn || 1;

  const small = document.createElement("canvas");
  small.width = W;
  small.height = H;
  const sctx = small.getContext("2d");
  if (!sctx) return null;
  const img = sctx.createImageData(W, H);
  for (let i = 0; i < plane; i++) {
    let v = (sal[i] - mn) / range;
    v = Math.pow(v, 1.4); // pertajam ke area paling aktif
    img.data[i * 4 + 0] = 255;
    img.data[i * 4 + 1] = Math.round(210 * (1 - v));
    img.data[i * 4 + 2] = Math.round(50 * (1 - v));
    img.data[i * 4 + 3] = Math.round(200 * v);
  }
  sctx.putImageData(img, 0, 0);

  const big = document.createElement("canvas");
  big.width = SIZE;
  big.height = SIZE;
  const bctx = big.getContext("2d");
  if (!bctx) return null;
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = "high";
  bctx.drawImage(small, 0, 0, SIZE, SIZE);
  return big.toDataURL("image/png");
}

/**
 * Analisis on-device. Kontrak sama dengan /api/inspect (InferenceResult + gate),
 * jadi halaman inspeksi tinggal menukar sumbernya.
 */
export async function analyzeOnDevice(imageDataUrl: string): Promise<OnDeviceResult> {
  const loaded = await getSession();

  let grade: string;
  let confidence: number;
  let modelSource: "onnx" | "mock";
  let heatmapDataUrl: string | null = null;

  if (loaded) {
    const { ort, session } = loaded;
    const input = await preprocess(imageDataUrl, ort);
    const outputs = await session.run({ [session.inputNames[0]]: input });

    // ambil output by-name (model bisa punya 1 output logits, atau logits+feat)
    const names = session.outputNames;
    const logitsName = names.includes("logits") ? "logits" : names[0];
    const featName = names.includes("feat") ? "feat" : names.find((n) => n !== logitsName);

    const logits = outputs[logitsName].data as Float32Array;
    const probs = softmax(logits);
    const idx = probs.indexOf(Math.max(...probs));
    grade = CLASSES[idx] ?? `class_${idx}`;
    confidence = Number(probs[idx].toFixed(3));
    modelSource = "onnx";

    if (featName && outputs[featName]) {
      const t = outputs[featName];
      heatmapDataUrl = buildHeatmapDataUrl(t.data as Float32Array, t.dims);
    }
  } else {
    const mock = await analyzeMock(imageDataUrl);
    grade = mock.grade;
    confidence = mock.confidence;
    modelSource = "mock";
  }

  const gate = decideGate({
    ingredient: "mangosteen",
    cvGrade: grade,
    cvConfidence: confidence,
    nirMarker: null,
  });
  return {
    grade,
    confidence,
    heatmapDataUrl,
    recommendation: recommendationFor(gate.decision),
    modelSource,
    gate,
    notMangosteen: grade === NOT_MANGOSTEEN,
  };
}
