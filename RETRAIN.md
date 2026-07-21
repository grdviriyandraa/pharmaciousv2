# Retrain: tambah kelas "bukan_manggis" (gerbang penolakan)

Tujuan: model bisa bilang **"ini bukan kulit manggis"** — supaya apel/objek lain tidak
terbaca "Ripe 100%". Caranya: latih ulang jadi **3 kelas** (`Ripe`, `Un_Ripe`, `bukan_manggis`).

> Sisi aplikasi SUDAH siap (CLASSES 3 kelas + state "BUKAN MANGGIS" di kamera live &
> hasil snapshot). Begitu model 3-kelas ditaruh di `public/model/mangosteen_grader.onnx`,
> langsung aktif tanpa ubah kode.

## Yang aku butuh dari kamu: gambar negatif
Kumpulkan **±300–1500 gambar yang BUKAN kulit manggis** — makin beragam makin bagus:
apel, jeruk, buah bulat lain, tangan, latar meja/kertas, objek acak. (Sertakan buah lain
yang mirip supaya model belajar bedanya.) Taruh semuanya di folder Colab `/content/negatives_raw/`.

Dua cara mengisinya ada di sel **R1b** di bawah.

---

## Sel yang dijalankan di Colab (setelah pipeline utama sampai sel 9 sudah pernah jalan)

### R1 — distribusikan negatif ke ImageFolder
```python
# === R1. Tambah kelas "bukan_manggis" ke ImageFolder ===
import os, glob, random, shutil
random.seed(42)

NEG_RAW = "/content/negatives_raw"   # taruh gambar negatif di sini (lihat R1b)
os.makedirs(NEG_RAW, exist_ok=True)

exts = ("*.jpg","*.jpeg","*.png","*.bmp","*.webp","*.JPG","*.PNG")
neg = []
for e in exts:
    neg += glob.glob(f"{NEG_RAW}/**/{e}", recursive=True)
random.shuffle(neg)
assert len(neg) >= 50, f"Baru {len(neg)} gambar negatif di {NEG_RAW}. Tambah dulu (sel R1b)."

# ikut split yang sudah ada: train + EVAL_SPLIT (dari sel 6). 85% train, sisanya eval.
n_train = int(len(neg) * 0.85)
buckets = {"train": neg[:n_train]}
if EVAL_SPLIT != "train":
    buckets[EVAL_SPLIT] = neg[n_train:]

for split, files in buckets.items():
    dst = f"{CLF_DIR}/{split}/bukan_manggis"
    os.makedirs(dst, exist_ok=True)
    for i, f in enumerate(files):
        ext = os.path.splitext(f)[1].lower() or ".jpg"
        shutil.copy(f, f"{dst}/neg_{i:05d}{ext}")
    print(f"{split}/bukan_manggis: {len(files)} gambar")

print("OK. Sekarang JALANKAN ULANG sel 6 → 7/8 → 9, lalu export (R2).")
```

### R1b — cara mengisi `/content/negatives_raw/` (pilih salah satu)
```python
# --- Opsi A: upload zip berisi gambar, lalu unzip ---
# from google.colab import files; up = files.upload()  # pilih negatives.zip
# import zipfile, os
# for name in up:
#     if name.endswith(".zip"):
#         zipfile.ZipFile(name).extractall("/content/negatives_raw")
# print("unzipped")

# --- Opsi B: dataset buah publik via kagglehub (buang yang mangosteen) ---
# !pip -q install kagglehub
# import kagglehub, glob, shutil, os
# p = kagglehub.dataset_download("kritikseth/fruit-and-vegetable-image-recognition")
# src = [f for f in glob.glob(f"{p}/**/*.*", recursive=True)
#        if f.lower().endswith((".jpg",".jpeg",".png")) and "mangosteen" not in f.lower()]
# os.makedirs("/content/negatives_raw", exist_ok=True)
# for i, f in enumerate(src[:1200]): shutil.copy(f, f"/content/negatives_raw/n_{i}.jpg")
# print(len(src[:1200]), "negatif disiapkan")
```

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
