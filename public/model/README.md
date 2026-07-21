# Taruh model di sini

File yang ditunggu: **`mangosteen_grader.onnx`**

Cara mendapatkannya: re-run `Mangosteen_QualityGate_CV_final.ipynb` di Colab sampai sel
`=== 14. Export model ===`, download `/content/mangosteen_grader.onnx`, taruh di folder ini.

Tanpa file ini aplikasi tetap jalan (fallback mock, ditandai jujur di UI).
Begitu file ada → refresh halaman → badge berubah ke "MobileNetV3 · on-device".
