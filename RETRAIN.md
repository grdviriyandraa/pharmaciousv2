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

## Sel yang dijalankan di Colab

### R1 — download negatif dari Kaggle + sebar ke kelas `bukan_manggis`
**TARUH sel ini sebagai sel BARU tepat setelah sel 5 (Crop bbox → ImageFolder), SEBELUM sel 6.**
Sel 5 membuat folder `CLF_DIR/{train,valid,test}/`; negatif harus masuk sebelum sel 6 membaca
folder & menentukan jumlah kelas.

```python
# === R1. Ambil negatif dari Kaggle + sebar ke ImageFolder ===
import kagglehub, os, glob, random, shutil
random.seed(42)

# Download latest version
path = kagglehub.dataset_download("kritikseth/fruit-and-vegetable-image-recognition")
print("Path to dataset files:", path)
# Kalau diminta login: jalankan kagglehub.login() sekali (username + key dari kaggle.json).

# semua gambar dataset ini = negatif "bukan_manggis"
neg = [f for f in glob.glob(f"{path}/**/*.*", recursive=True)
       if f.lower().endswith((".jpg", ".jpeg", ".png")) and "mangosteen" not in f.lower()]
random.shuffle(neg)
print("negatif tersedia:", len(neg))
assert len(neg) >= 200, "Dataset kosong? cek autentikasi Kaggle (kagglehub.login())."

eval_split = "test" if os.path.isdir(f"{CLF_DIR}/test") else "valid"
n_train = int(len(neg) * 0.85)
buckets = {"train": neg[:n_train], eval_split: neg[n_train:]}
for split, files in buckets.items():
    dst = f"{CLF_DIR}/{split}/bukan_manggis"
    os.makedirs(dst, exist_ok=True)
    for i, f in enumerate(files):
        shutil.copy(f, f"{dst}/neg_{i:05d}.jpg")
    print(f"{split}/bukan_manggis: {len(files)} gambar")

print("OK. Sekarang JALANKAN ULANG sel 6 → 7/8 → 9, lalu export (R2).")
```

### R1b — WAJIB: seimbangkan sampling (kalau tidak, model COLLAPSE)
> ⚠️ **Pelajaran dari percobaan pertama:** manggis ~50k vs negatif ~3.800 sangat timpang.
> `class weights` bawaan sel 8 meng-upweight `bukan_manggis` ~4–5×, dan itu membuat model
> **collapse** — SEMUA gambar (termasuk foto manggis asli) diprediksi `bukan_manggis` ~100%.
> Wajib ganti ke **WeightedRandomSampler** (seimbangkan lewat sampling, bukan bobot loss).

**Ganti baris `train_dl=...` di sel 6** dengan:
```python
import numpy as np
from torch.utils.data import WeightedRandomSampler
_targets = [y for _, y in train_ds.samples]
_cw = 1.0 / np.bincount(_targets)                     # bobot per kelas
_sw = [_cw[t] for t in _targets]                      # bobot per sampel
_sampler = WeightedRandomSampler(_sw, num_samples=len(_sw), replacement=True)
train_dl = DataLoader(train_ds, batch_size=BATCH_SIZE, sampler=_sampler, num_workers=2)
```
**Dan di sel 8**, pakai loss TANPA class weight (karena sampler sudah menyeimbangkan):
```python
criterion = nn.CrossEntropyLoss()   # bukan CrossEntropyLoss(weight=w)
```
Naikkan `EPOCHS` sedikit (mis. 15) karena 3 kelas lebih sulit.

### Setelah R1 + R1b: re-run pipeline
1. **Sel 6** (dgn WeightedRandomSampler) — `CLASSES` jadi `['Ripe','Un_Ripe','bukan_manggis']`.
2. **Sel 7/8** (model + loss polos) — head otomatis 3 output.
3. **Sel 9** (training) — latih ulang.

> **Verifikasi sebelum pakai:** setelah export, uji beberapa foto manggis ASLI. Kalau masih
> banyak yang terbaca `bukan_manggis`, kurangi negatif (cap ~2.000) atau tambah epoch.
> Kirim `.onnx`-nya ke Claude untuk dites otomatis dgn foto di `public/samples/`.

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
