# Deploy AMERTA QG ke Vercel (live + PWA installable)

Tujuan: URL publik HTTPS supaya juri bisa buka & **pasang PWA di HP sendiri**.
SQLite tidak bertahan di Vercel (serverless, filesystem ephemeral) → pakai **Postgres**.

Prasyarat (yang aku butuh dari kamu):
1. Akun **Vercel** (gratis) — https://vercel.com
2. **Postgres gratis** — Neon (https://neon.tech) atau Supabase — ambil **connection string**-nya
   (bentuk `postgresql://user:pass@host/db?sslmode=require`).
3. Repo di GitHub (Vercel deploy paling mulus dari GitHub). Kalau belum, aku bantu `git init` + push.

Begitu kamu kirim connection string Postgres-nya, sisa langkah di bawah aku jalankan.

---

## Langkah (dikerjakan saat connection string sudah ada)

### 1. Pindah Prisma ke Postgres
`prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"   // dari "sqlite"
  url      = env("DATABASE_URL")
}
```
Model tidak berubah — Prisma yang abstraksi. (Kode aplikasi TIDAK perlu diubah.)

### 2. Isi database
Dengan `DATABASE_URL` menunjuk ke Postgres:
```bash
npx prisma db push      # bikin skema di Postgres
npm run seed            # 10 pemasok + 38 batch + 2 user (qc@/qa@amerta.id · amerta2026)
```
Catatan: dev lokal juga bisa pakai Postgres yang sama — satu database, hilangkan sqlite.

### 3. Set Environment Variables di Vercel
Project → Settings → Environment Variables:
- `DATABASE_URL` = connection string Postgres
- `AUTH_SECRET`  = nilai acak baru
  (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

### 4. Deploy
Import repo di Vercel → framework Next.js terdeteksi otomatis. Vercel memakai script
**`vercel-build`** (`prisma generate && next build`) yang sudah disiapkan di package.json,
jadi Prisma Client selalu fresh. `postinstall` meng-copy runtime ONNX ke `public/ort/`.

### 5. Verifikasi pasca-deploy
- Buka URL → `/login` → masuk → dashboard tampil.
- Inspeksi AI → model on-device jalan (badge "MobileNetV3 · on-device").
- DevTools → Application → Manifest terpasang, SW terdaftar → bisa **Install app**.
- Buka di HP → menu browser → "Tambahkan ke Layar Utama".

---

## Yang sudah deploy-ready
- `vercel-build` (prisma generate) + `postinstall` (copy wasm ONNX).
- Auth pakai WebCrypto → kompatibel Edge runtime (middleware jalan di Vercel Edge).
- SW/PWA aktif hanya di production → di Vercel otomatis aktif (HTTPS).
- `.env.example` mendokumentasikan variabel.

## Yang perlu diperhatikan
- Aset statis besar: `public/model/*.onnx` (~17 MB) + `public/ort/*.wasm` (~13 MB) —
  disajikan lewat CDN Vercel, aman, tapi build pertama agak lebih lama.
- Kalau mau QR code untuk juri: setelah URL live keluar, aku bisa tambah halaman /qr atau
  generate PNG QR-nya.
