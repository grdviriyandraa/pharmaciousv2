import type { InferenceResult } from "./types";
import { decideGate, recommendationFor } from "./gate";

// ─────────────────────────────────────────────────────────────────────────────
// INFERENCE — single swap point for the whole app.
//
// RIGHT NOW: a deterministic *mock* so the demo clicks end-to-end without a model.
// It derives a stable pseudo-result from the image bytes, so the same photo always
// gives the same grade (feels real in a live demo).
//
// TO WIRE THE REAL MODEL (round 2, once Rard exports MobileNetV3 → TFJS):
//   1. `npm i @tensorflow/tfjs`
//   2. Put the converted model at /public/model/model.json (+ *.bin shards).
//   3. Replace the body of `analyzeMangosteen` with:
//        const model = await tf.loadLayersModel('/model/model.json')
//        const t = tf.browser.fromPixels(imgEl).resizeBilinear([224,224])
//                   .toFloat().div(255).expandDims(0)
//        const probs = (model.predict(t) as tf.Tensor).dataSync()
//        → grade + confidence from probs; Grad-CAM via tf.grad on last conv layer.
//   The rest of the app (gate cascade, DB, UI) stays untouched.
// ─────────────────────────────────────────────────────────────────────────────

const CLASSES = ["Ripe", "Un_Ripe"] as const;

/** Cheap stable hash of a data URL so the mock is deterministic per image. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += Math.max(1, Math.floor(s.length / 512))) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296; // 0..1
}

export async function analyzeMangosteen(imageDataUrl: string): Promise<InferenceResult> {
  // simulate model latency for the demo
  await new Promise((r) => setTimeout(r, 900));

  const r = hashString(imageDataUrl);
  const ripe = r > 0.25; // most demo images read as ripe
  const grade = ripe ? CLASSES[0] : CLASSES[1];
  const confidence = Number((0.78 + r * 0.21).toFixed(3)); // 0.78–0.99

  const { decision } = decideGate({
    ingredient: "mangosteen",
    cvGrade: grade,
    cvConfidence: confidence,
    nirMarker: null,
  });

  return {
    grade,
    confidence,
    heatmapDataUrl: null, // real Grad-CAM arrives with the real model
    recommendation: recommendationFor(decision),
  };
}
