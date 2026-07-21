# Retrain: tambah kelas "bukan_manggis" (gerbang penolakan)

Tujuan: model bisa bilang **"ini bukan kulit manggis"** — supaya apel/objek lain tidak
terbaca "Ripe 100%". Caranya: latih ulang jadi **3 kelas** (`Ripe`, `Un_Ripe`, `bukan_manggis`).

> Sisi aplikasi SUDAH siap (CLASSES 3 kelas + state "BUKAN MANGGIS" di kamera live &
> hasil snapshot). Begitu model 3-kelas ditaruh di `public/model/mangosteen_grader.onnx`,
> langsung aktif tanpa ubah kode.

## Yang aku butuh dari kamu: API token Kaggle
Negatif diambil OTOMATIS dari dataset publik Kaggle
**`kritikseth/fruit-and-vegetable-image-recognition`** (3.825 gambar, 36 kelas buah/sayur —
apel, mangga, jeruk, delima, dll., **tanpa manggis** → negatif yang pas). Kamu cukup punya:

1. Akun Kaggle (gratis).
2. **API token**: kaggle.com → foto profil → **Settings** → bagian **API** →
   **Create New Token** → mengunduh `kaggle.json` berisi `username` dan `key`.

---

## Sel yang dijalankan di Colab (setelah pipeline utama sampai sel 9 sudah pernah jalan)

### R1 — download negatif dari Kaggle + sebar ke kelas `bukan_manggis`
```python
# === R1. Ambil negatif dari Kaggle + sebar ke ImageFolder ===
import os, glob, random, shutil
random.seed(42)

# --- isi kredensial Kaggle (dari kaggle.json) ---
os.environ["KAGGLE_USERNAME"] = "USERNAME_KAGGLE_KAMU"
os.environ["KAGGLE_KEY"]      = "API_KEY_KAMU"
# (alternatif: simpan di Colab Secrets 🔑 lalu:
#  from google.colab import userdata
#  os.environ["KAGGLE_USERNAME"]=userdata.get("KAGGLE_USERNAME"); os.environ["KAGGLE_KEY"]=userdata.get("KAGGLE_KEY"))

!pip -q install kagglehub
import kagglehub
path = kagglehub.dataset_download("kritikseth/fruit-and-vegetable-image-recognition")

# semua gambar dataset = negatif (pastikan tak ada 'mangosteen')
neg = [f for f in glob.glob(f"{path}/**/*.*", recursive=True)
       if f.lower().endswith((".jpg", ".jpeg", ".png")) and "mangosteen" not in f.lower()]
random.shuffle(neg)
print("negatif tersedia:", len(neg))
assert len(neg) >= 200, "Dataset kosong? cek kredensial Kaggle."

# sebar ke split yang sudah ada (train + EVAL_SPLIT dari sel 6). 85% train.
n_train = int(len(neg) * 0.85)
buckets = {"train": neg[:n_train]}
if EVAL_SPLIT != "train":
    buckets[EVAL_SPLIT] = neg[n_train:]
for split, files in buckets.items():
    dst = f"{CLF_DIR}/{split}/bukan_manggis"
    os.makedirs(dst, exist_ok=True)
    for i, f in enumerate(files):
        shutil.copy(f, f"{dst}/neg_{i:05d}.jpg")
    print(f"{split}/bukan_manggis: {len(files)} gambar")

print("OK. Sekarang JALANKAN ULANG sel 6 → 7/8 → 9, lalu export (R2).")
```

> **Catatan keseimbangan:** dataset manggis besar (~50k train), negatif ~3.800. Timpang,
> tapi `class weights` di sel 8 (otomatis, ∝ 1/frekuensi) meng-upweight `bukan_manggis`
> ~5×, cukup untuk menolak objek yang jelas bukan manggis. Kalau reject kurang tajam,
> tambah dataset negatif kedua (ulangi R1 dgn slug Kaggle lain, mis. objek/tangan).

### Setelah R1: re-run sel pipeline yang sudah ada
Tidak ada perubahan kode — notebook otomatis jadi 3 kelas (ImageFolder mendeteksi folder baru,
`len(CLASSES)` jadi 3, head model & class-weights ikut menyesuaikan):
1. **Sel 6** (transforms + dataloaders) — `CLASSES` jadi `['Ripe','Un_Ripe','bukan_manggis']`.
2. **Sel 7/8** (model) — head otomatis 3 output.
3. **Sel 9** (training) — latih ulang.

### R2 — export ONNX (sama seperti versi CAM, otomatis 3 output)
```python
import torch, torch.nn as nn
class GraderCAM(nn.Module):
    def __init__(self, m):
        super().__init__()
        self.features, self.avgpool, self.classifier = m.features, m.avgpool, m.classifier
    def forward(self, x):
        f = self.features(x)                       # feat [B,960,7,7]
        logits = self.classifier(torch.flatten(self.avgpool(f), 1))  # [B,3]
        return logits, f
wrap = GraderCAM(model).eval().to(DEVICE)
torch.onnx.export(wrap, torch.randn(1,3,IMG_SIZE,IMG_SIZE,device=DEVICE),
    "/content/mangosteen_grader.onnx",
    input_names=["input"], output_names=["logits","feat"],
    dynamic_axes={"input":{0:"batch"}}, opset_version=17, dynamo=False)
from google.colab import files; files.download("/content/mangosteen_grader.onnx")
```

## Setelah download
Taruh file baru di `public/model/mangosteen_grader.onnx` (timpa yang lama). Selesai —
app langsung mendeteksi kelas ketiga: apel dll. akan tampil **"BUKAN MANGGIS"** (netral,
bukan hijau/merah), dan tidak bisa dicatat sebagai batch.

Penting: urutan kelas HARUS `['Ripe','Un_Ripe','bukan_manggis']` (alfabetis Python: huruf
besar dulu). Jangan pakai nama folder yang mengubah urutan itu, atau kabari aku untuk
menyesuaikan `CLASSES` di `lib/inference-onnx.ts`.
