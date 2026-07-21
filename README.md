# AMERTA Smart Quality Gate

Progressive Web App untuk **gerbang mutu bahan baku herbal** — inspeksi awal
kematangan kulit manggis berbasis AI yang berjalan **langsung di perangkat**, sebagai
penyaring cerdas sebelum uji laboratorium (NIR/HPLC).

> Demo teknis untuk pitch ICC. Teknologi = gerbang pendukung; produk & nano tetap bintang utama.

## Fitur

- 🧠 **Inferensi on-device** — MobileNetV3-Large (akurasi test 96%) via ONNX Runtime Web
  (WebAssembly). Gambar tidak pernah keluar dari perangkat.
- 🔥 **Peta aktivasi** — overlay dari feature-map konvolusi terakhir → menunjukkan area
  yang dilihat model (explainable AI).
- 🚦 **Gerbang mutu bertingkat** — cascade CV → NIR: Accept · Route→NIR · Reject.
  Kimia (NIR) selalu jadi penentu akhir; AI hanya router, bukan hakim.
- 📷 **Inspeksi → Batch → Dashboard** — hasil inspeksi tercatat jadi batch; KPI & SPC
  control chart ikut bergerak.
- 📲 **PWA** — installable, halaman inspeksi jalan **offline** (model & runtime di-cache).
- 🔒 **Auth** — sesi cookie HTTP-only (PBKDF2 + HMAC, WebCrypto), middleware proteksi rute.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Prisma · PostgreSQL ·
ONNX Runtime Web · Recharts · Framer Motion.

## Jalankan lokal

```bash
npm install
npx prisma db push      # sinkron skema ke DATABASE_URL
npm run seed            # 10 pemasok + 38 batch + 2 user
npm run dev             # http://localhost:3000
```

Login demo: `qc@amerta.id` / `amerta2026`. Butuh `.env` (lihat `.env.example`):
`DATABASE_URL` + `AUTH_SECRET`.

## Deploy

Lihat [DEPLOY.md](DEPLOY.md) — Vercel + Postgres (Neon/Supabase).

## Peta file

| Path | Isi |
|---|---|
| `lib/inference-onnx.ts` | inferensi on-device + peta aktivasi |
| `lib/gate.ts` | cascade keputusan mutu |
| `lib/auth.ts` · `middleware.ts` | autentikasi + proteksi rute |
| `app/(app)/inspection` | HERO: foto → gerbang mutu → catat batch |
| `app/(app)/dashboard` | KPI + SPC control chart |
| `public/sw.js` | service worker (offline/PWA) |

Detail teknis & catatan pemeliharaan: [HANDOFF.md](HANDOFF.md).
