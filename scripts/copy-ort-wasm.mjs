// Copies the onnxruntime-web wasm runtime into public/ort/ so it is served
// same-origin (cacheable by the service worker → inference works offline).
// Runs automatically via `postinstall`.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, "node_modules", "onnxruntime-web", "dist");
const dest = join(root, "public", "ort");

// ort.wasm.bundle.min.mjs = ESM bundle wasm-only (di-import runtime oleh
// lib/inference-onnx.ts, sengaja TIDAK lewat webpack); pasangan simd-threaded
// adalah runtime wasm yang dimuatnya dari env.wasm.wasmPaths ("/ort/").
const FILES = [
  "ort.wasm.bundle.min.mjs",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
];

if (!existsSync(src)) {
  console.warn("[copy-ort-wasm] onnxruntime-web not installed yet — skipping.");
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
for (const f of FILES) copyFileSync(join(src, f), join(dest, f));
console.log(`[copy-ort-wasm] copied ${FILES.length} files → public/ort/`);
