"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

// Chromium melempar `beforeinstallprompt` saat app memenuhi syarat dipasang.
// Kita tahan event-nya lalu tawarkan tombol — pola install-UX standar PWA.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!deferred) return null;

  return (
    <button
      onClick={async () => {
        await deferred.prompt();
        await deferred.userChoice; // apa pun pilihannya, tombol disembunyikan
        setDeferred(null);
      }}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-brand/25 bg-brand-tint/50 px-2.5 py-1.5 text-xs font-medium text-brand-ink transition-colors hover:bg-brand-tint ${className ?? ""}`}
    >
      <Download size={13} />
      Pasang aplikasi
    </button>
  );
}
