"use client";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { checkCopyAction } from "./actions";

// Comprobar una copia en PDF: la huella SHA-256 se calcula en el navegador y solo se envía
// la huella. El PDF (con datos de salud) no se sube al servidor.
export function CheckCopyForm() {
  const t = useTranslations("consents");
  const [result, setResult] = useState<null | { ok: true; consentId: string; version: number } | { ok: false; msg: string }>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = (e.currentTarget.elements.namedItem("pdf") as HTMLInputElement).files?.[0];
    if (!file) return setResult({ ok: false, msg: t("copyNone") });
    setBusy(true);
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const found = await checkCopyAction(hash);
    setResult(found ? { ok: true, ...found } : { ok: false, msg: t("copyBad") });
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="search" style={{ flexWrap: "wrap" }}>
      <input type="file" name="pdf" accept="application/pdf" aria-label={t("checkCopy")} />
      <button className="btn ghost" disabled={busy}>{t("checkCopyBtn")}</button>
      {result && (
        <div className={`notice ${result.ok ? "ok" : "bad"}`} role="status" style={{ width: "100%", marginTop: 10 }}>
          {result.ok
            ? <Link href={`/panel/consentimientos/${result.consentId}`}>{t("copyOk", { ref: result.consentId.toUpperCase(), v: result.version })}</Link>
            : result.msg}
        </div>
      )}
    </form>
  );
}
