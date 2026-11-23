"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { InkRow } from "@/db/schema";

interface Props {
  action: (form: FormData) => Promise<void>;
  inks: InkRow[];
  applicator: string;
  needles: string;
  notes: string;
  lastUpdate: string | null;
}

const EMPTY: InkRow = { brand: "", color: "", lot: "", expiry: "", aemps: "" };

export function AnnexForm({ action, inks, applicator, needles, notes, lastUpdate }: Props) {
  const t = useTranslations("detail");
  const [rows, setRows] = useState<InkRow[]>(inks.length ? inks : [EMPTY]);
  const cols = [["brand", t("brand")], ["color", t("color")], ["lot", t("lot")], ["expiry", t("expiry")], ["aemps", t("aemps")]] as const;
  return (
    <form className="card" action={action}>
      <h2>{t("annexTitle")} <span className="muted" style={{ fontSize: ".8rem", fontWeight: 500 }}>{t("annexHint")}</span></h2>
      <div style={{ overflowX: "auto" }}>
        <table className="list ink-table">
          <thead><tr>{cols.map(([k, label]) => <th key={k}>{label}</th>)}</tr></thead>
          <tbody>
            {rows.map((ink, i) => (
              <tr key={i}>
                {cols.map(([k, label]) => (
                  <td key={k}>
                    <input type={k === "expiry" ? "date" : "text"} name={k} defaultValue={ink[k]} placeholder={k === "expiry" ? undefined : label} aria-label={`${label} ${i + 1}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn ghost small" style={{ margin: "8px 0 14px" }} onClick={() => setRows((r) => [...r, EMPTY])}>{t("addInk")}</button>
      <div className="row">
        <label className="field"><span>{t("applicator")}</span><input type="text" name="applicator" defaultValue={applicator} /></label>
        <label className="field"><span>{t("needles")}</span><input type="text" name="needles" defaultValue={needles} placeholder={t("needlesPh")} /></label>
      </div>
      <label className="field"><span>{t("annexNotes")}</span><textarea name="notes" defaultValue={notes} /></label>
      <button className="btn">{t("saveAnnex")}</button>
      {lastUpdate && <small className="muted" style={{ marginLeft: 10 }}>{t("lastUpdate", { date: lastUpdate })}</small>}
    </form>
  );
}
