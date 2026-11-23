"use client";
import { useState } from "react";

const PALETTE = ["#111111", "#7a1f2b", "#b4532a", "#1f4d3a", "#1e3a5f", "#5b3f8c", "#c2185b", "#d4a373"];

interface Props {
  color: string;
  logoUrl: string | null;
  labels: { color: string; logo: string; noLogo: string; remove: string };
}

// Color con paleta rápida y logo con vista previa (como la demo). El logo se valida en el servidor.
export function BrandFields({ color, logoUrl, labels }: Props) {
  const [value, setValue] = useState(color);
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [remove, setRemove] = useState(false);
  const apply = (c: string) => {
    setValue(c);
    document.documentElement.style.setProperty("--accent", c);
  };
  return (
    <>
      <div className="field">
        <span className="label">{labels.color}</span>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="color" name="color" value={value} onChange={(e) => apply(e.target.value)} aria-label={labels.color}
            style={{ width: 54, height: 40, padding: 2, border: "1px solid var(--line)", borderRadius: 8 }} />
          <code>{value}</code>
        </div>
        <div className="swatches">
          {PALETTE.map((c) => <button key={c} type="button" style={{ background: c }} onClick={() => apply(c)} aria-label={`Color ${c}`} />)}
        </div>
      </div>
      <div className="field">
        <span className="label">{labels.logo}</span>
        <div style={{ background: "var(--soft)", border: "1px solid var(--line)", borderRadius: 12, padding: 14, textAlign: "center", minHeight: 80, marginBottom: 8 }}>
          {preview && !remove ? <img src={preview} alt="" style={{ maxHeight: 70, maxWidth: "100%" }} /> : <span className="muted">{labels.noLogo}</span>}
        </div>
        <input type="file" name="logo" accept="image/png,image/jpeg" aria-label={labels.logo}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { setRemove(false); setPreview(URL.createObjectURL(f)); } }} />
        <input type="hidden" name="removeLogo" value={remove ? "1" : "0"} />
        {(preview && !remove) && <button type="button" className="btn ghost small" style={{ marginTop: 8 }} onClick={() => setRemove(true)}>{labels.remove}</button>}
      </div>
    </>
  );
}
