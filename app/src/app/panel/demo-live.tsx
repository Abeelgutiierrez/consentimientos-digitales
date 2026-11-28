"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

// Modo demo: el resumen y la lista de consentimientos se actualizan solos para que,
// cuando el comerciante firma en su móvil, lo vea aparecer aquí sin recargar.
const LIVE_PATHS = new Set(["/panel", "/panel/consentimientos", "/panel/clientes"]);
const EVERY_MS = 4000;

export function DemoLive({ latest }: { latest: { id: string; name: string } | null }) {
  const t = useTranslations("demo");
  const router = useRouter();
  const path = usePathname();
  const live = LIVE_PATHS.has(path);
  const seen = useRef(latest?.id ?? null);
  const [fresh, setFresh] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, EVERY_MS);
    return () => clearInterval(timer);
  }, [live, router]);

  useEffect(() => {
    if (latest && latest.id !== seen.current) {
      seen.current = latest.id;
      setFresh(latest);
    }
  }, [latest]);

  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => setFresh(null), 15000);
    return () => clearTimeout(t);
  }, [fresh]);

  return (
    <>
      {live && (
        <span className="demo-live-pill" title={t("badge")}>
          <i aria-hidden="true" />
          {t("liveOn")}
        </span>
      )}
      {fresh && (
        <div className="demo-live-toast" role="status">
          <span>{t("liveNew", { name: fresh.name })}</span>
          <Link className="btn small" href={`/panel/consentimientos/${fresh.id}`} onClick={() => setFresh(null)}>
            {t("liveOpen")}
          </Link>
        </div>
      )}
    </>
  );
}
