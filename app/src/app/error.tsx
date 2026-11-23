"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";

// Error inesperado: mensaje genérico (nunca detalles técnicos ni datos al usuario).
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  return (
    <main className="login">
      <div className="card">
        <h1>{t("error")}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={reset}>{t("back")}</button>
          <Link className="btn ghost" href="/">{t("goHome")}</Link>
        </div>
      </div>
    </main>
  );
}
