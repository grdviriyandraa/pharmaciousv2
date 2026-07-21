# AMERTA Smart Quality Gate — Handoff

Live-clickable pitch demo for ICC. Next.js fullstack (App Router) + Prisma + SQLite.
The point: show the pharmacy jury that the CV → NIR gate is a *real, running* thing,
not a slide. Tech stays a **supporting gate** — nano + produk tetap bintang utama.

## Jalanin lokal (atau di Claude Code)

```bash
npm install
npx prisma generate      # butuh akses ke binaries.prisma.sh
npx prisma db push       # bikin dev.db (SQLite)
npm run seed             # isi 10 pemasok + 38 batch (deterministik)
npm run dev              # http://localhost:3000  → /login → demo lgsg masuk
```

Login: **auth aktif** (session cookie HTTP-only + middleware). Akun demo (di-seed):
`qc@amerta.id` / `amerta2026` (Sari, QC) dan `qa@amerta.id` / `amerta2026` (Bima, QA).
Butuh `AUTH_SECRET` di `.env` (sudah ada; kalau deploy, set ulang yang baru).
Implementasi: `lib/auth.ts` (PBKDF2 + HMAC via WebCrypto, tanpa dependensi),
`middleware.ts` (proteksi rute + redirect), `app/api/auth/*`.

## Yang SUDAH diuji di sini

- **Logika gerbang** (`lib/gate.ts`) — cascade lengkap diuji via tsx: kimia (NIR) selalu
  override CV; mangosteen >95% auto-accept, 80–95% route, <80% route(lab), Un_Ripe reject;
  kelor & pegagan lewat NIR (gak ada gerbang visual). ✅
- **Seed** (`lib/seed-data.ts`) — distribusi ~82/11/8 (accept/route/reject), semua rata-rata
  penanda di atas spec. Deterministik (PRNG seed tetap) biar demo stabil. ✅
- **SPC** (`lib/analytics.ts`) — mean/UCL/LCL ±3σ. Detail bagus buat cerita: LCL manggis
  (1.57) di bawah garis spec (1.8) → "terkendali ≠ memenuhi spec". ✅
- **Type-check** `tsc --noEmit` bersih. ✅

## Yang BELUM bisa diuji di sandbox ini (bukan bug — kejaring network)

- `prisma generate` / `db push` / `seed` → butuh `binaries.prisma.sh` (diblok di sandbox).
- `next build` / `dev` → `next/font` ambil font dari `fonts.googleapis.com` (diblok).
- Di mesin kamu / Claude Code dua-duanya jalan normal. Belum sempat render visual, jadi
  tolong cek tampilan pas pertama `npm run dev`.

## Nyolokin model asli (Tahap 2) — SUDAH DI-WIRE, tinggal taruh file

> Koreksi dari rencana awal: model di notebook ternyata **PyTorch** (MobileNetV3-Large),
> bukan Keras — jadi jalur TFJS/`.h5` tidak berlaku. Jalur yang dipakai: **ONNX Runtime Web**
> (on-device, di browser). Wiring lengkap sudah ada di `lib/inference-onnx.ts`.

Langkah satu-satunya yang tersisa (di Colab):

1. Re-run notebook `Mangosteen_QualityGate_CV_final.ipynb` sampai sel
   `=== 14. Export model ===` → menghasilkan `/content/mangosteen_grader.onnx`.
2. Download file itu, taruh di **`public/model/mangosteen_grader.onnx`**.
3. Selesai. Tanpa ubah kode: halaman inspeksi otomatis pindah dari mock ke model asli
   (badge di panel hasil berubah "mock demo" → "MobileNetV3 · on-device").

Detail teknis (sudah diimplementasi, tercatat di sini biar tidak hilang):
- Preprocess di `lib/inference-onnx.ts` meniru training persis (sel 6 notebook):
  resize squash 224×224, /255, normalisasi ImageNet. Kelas: `["Ripe","Un_Ripe"]`
  (urutan alfabetis ImageFolder).
- Runtime wasm ORT di-copy ke `public/ort/` oleh `scripts/copy-ort-wasm.mjs`
  (jalan otomatis via `postinstall`) — self-hosted supaya bisa di-cache offline.
- Mock lama di `lib/inference.ts` tetap ada sebagai fallback (dan tetap dipakai
  `/api/inspect` sebagai endpoint audit). Kalau file model belum ada, UI jujur
  menandai hasil sebagai "mock demo".
- Peta aktivasi (Grad-CAM ringan): ADA. Model meng-output `logits` + `feat`
  (feature-map konv terakhir [1,960,7,7]). `lib/inference-onnx.ts` menghitung heatmap
  (rata-rata ReLU antar kanal → colormap hangat) sebagai overlay di halaman inspeksi,
  bisa di-toggle. Ini activation map (1 forward pass), BUKAN Grad-CAM gradien — browser
  tak bisa backprop; dilabeli jujur "Peta aktivasi CV". Terverifikasi fokus ke buah
  (pusat 9.6× > latar).

Gate cascade, DB, dan UI lain **tidak berubah**.

## PWA (installable + inspeksi offline)

- `public/manifest.json` lengkap: ikon any+maskable, **shortcuts** (Inspeksi AI,
  Dashboard — muncul di long-press ikon app), kategori, lang. iOS: apple-touch-icon
  + meta `appleWebApp` di `app/layout.tsx`.
- `public/sw.js` (service worker tanpa dependensi, register via
  `components/sw-register.tsx`, **hanya aktif di production build**):
  cache-first untuk `/model/*` + `/ort/*` + `/_next/static/*`, network-first untuk
  navigasi halaman, `/api/*` tidak di-cache, fallback **`/offline.html`** bermerek
  untuk halaman yang belum pernah dibuka. Naikkan `VERSION` di sw.js tiap ubah strategi.
- Tombol **"Pasang aplikasi"** (`components/install-prompt.tsx`) muncul otomatis di
  header saat browser melempar `beforeinstallprompt` (Chromium, production).
- Mobile: sidebar diganti **bottom nav** (`components/shell.tsx`) + safe-area inset —
  layak dipakai sebagai app HP beneran.
- Scope offline yang jujur: **halaman Inspeksi** jalan offline (model on-device);
  dashboard/batches/suppliers tetap butuh server + DB. Middleware auth tidak jalan
  offline (halaman cache tetap terbuka) — by design untuk app shell PWA.
- Test PWA: `npm run build && npm run start` → login, install, lalu DevTools →
  Network → Offline → `/inspection` tetap bisa analisis.

## Kalau mau deploy (Vercel)

SQLite di Vercel serverless itu ephemeral (ke-reset tiap cold start). Pindah ke Postgres:
di `prisma/schema.prisma` ganti `provider = "postgresql"` + `DATABASE_URL` ke Neon/Supabase,
lalu `prisma migrate dev`. Gak ada perubahan kode aplikasi (Prisma yang abstraksi).

## Catatan pemeliharaan

- `next@14.2.15` ada advisory keamanan → bump ke patch 14.2.x terbaru (`npm i next@^14.2`).
- `recharts@2` deprecated tapi stabil; upgrade ke v3 opsional (ada breaking changes).
- Data mock jelas ditandai di topbar ("data mock") — jangan diklaim data riil ke juri.

## Peta file

```
lib/gate.ts          cascade keputusan (jantung logika)   ← tested
lib/analytics.ts     KPI + SPC control chart              ← tested
lib/seed-data.ts     generator pemasok+batch deterministik ← tested
lib/inference-onnx.ts inferensi on-device (ORT wasm) + fallback mock
lib/inference.ts     mock deterministik (fallback + /api/inspect)
lib/auth.ts          PBKDF2 + session HMAC (WebCrypto, Node & Edge)
lib/session.ts       getSessionUser() utk server components
middleware.ts        proteksi rute + redirect login/dashboard
app/api/auth/*       login (set cookie) & logout
lib/data.ts          akses Prisma (server components)
app/(app)/dashboard  KPI + SPC hero + batch terbaru
app/(app)/inspection HERO: upload/kamera → gerbang mutu → CATAT jadi batch
app/api/batches      GET list + POST catat batch dari inspeksi (gate re-derive server)
app/(app)/batches    tabel + filter + drawer detail
app/(app)/suppliers  lane per-bahan + grid pemasok
app/api/*            backend simpel (batches, suppliers, inspect)
```
