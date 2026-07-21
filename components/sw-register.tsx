"use client";

import { useEffect } from "react";

/**
 * Mendaftarkan service worker PWA (public/sw.js).
 * Hanya aktif di production build — saat `next dev`, cache SW justru mengganggu
 * hot-reload, jadi SW lama (kalau ada) di-unregister.
 */
export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch((e) => {
      console.warn("[pwa] service worker gagal terdaftar:", e);
    });
  }, []);
  return null;
}
