/* AMERTA QG — service worker (hand-rolled, tanpa dependensi).
 *
 * Strategi:
 *  - ASET BERAT & IMMUTABLE → cache-first, disimpan saat pertama diambil:
 *      /model/*   (ONNX ~21MB — kunci fitur inspeksi offline)
 *      /ort/*     (wasm runtime ONNX)
 *      /_next/static/*, ikon, manifest
 *  - NAVIGASI HALAMAN → network-first, fallback cache (halaman /inspection yang
 *    pernah dibuka tetap bisa dibuka offline).
 *  - /api/* → TIDAK di-cache (data DB harus segar).
 *
 * Naikkan VERSION setiap kali strategi berubah → cache lama dibersihkan di activate.
 */
const VERSION = "amerta-qg-v2";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;

const PRECACHE = [
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/offline.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/model/") ||
    url.pathname.startsWith("/ort/") ||
    url.pathname.startsWith("/_next/static/") ||
    PRECACHE.includes(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // biarkan cross-origin (mis. Google Fonts) apa adanya
  if (url.pathname.startsWith("/api/")) return; // data harus segar

  // Cache-first untuk aset berat/immutable (termasuk model ONNX & wasm).
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  // Network-first untuk navigasi halaman.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req, { cacheName: PAGE_CACHE });
          if (cached) return cached;
          // halaman offline bermerek (di-precache saat install)
          const offline = await caches.match("/offline.html", { cacheName: STATIC_CACHE });
          return (
            offline ||
            new Response("<h1>Offline</h1>", {
              status: 503,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            })
          );
        })
    );
  }
});
