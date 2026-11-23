import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { serviceLabel } from "@/core/content";
import { fmtDate } from "@/core/dates";
import { Flash } from "@/components/flash";
import { Topbar } from "@/components/topbar";
import { withUser } from "@/server/auth";
import { GdprError, MAX_RETENTION_YEARS, purgeCandidates, purgeConsents, setRetention } from "@/server/gdpr";
import { getStudio } from "@/server/studios";

export const metadata: Metadata = { title: "Conservación de los datos" };

async function saveRetentionAction(f: FormData) {
  "use server";
  const raw = String(f.get("years") ?? "");
  const years = raw === "" ? null : Number(raw);
  let code: string | null = null;
  try {
    await withUser((scope) => setRetention(scope, years, String(f.get("note") ?? "")), { ownerOnly: true });
  } catch (err) {
    if (err instanceof GdprError) code = err.code;
    else throw err;
  }
  redirect(code ? `/panel/ajustes/conservacion?error=${code}` : "/panel/ajustes/conservacion?ok=plazo");
}

async function purgeAction(f: FormData) {
  "use server";
  if (f.get("confirm") !== "on") redirect("/panel/ajustes/conservacion?error=confirm");
  const ids = f.getAll("ids").map(String);
  const r = await withUser((scope) => purgeConsents(scope, ids), { ownerOnly: true });
  redirect(`/panel/ajustes/conservacion?ok=purga&c=${r.consents}&k=${r.clients}`);
}

export default async function RetentionPage({ searchParams }: PageProps<"/panel/ajustes/conservacion">) {
  const { studio, due } = await withUser(async (scope) => ({ studio: await getStudio(scope), due: await purgeCandidates(scope) }), { ownerOnly: true });
  const t = await getTranslations("retention");
  const sp = await searchParams;
  const options = Array.from({ length: MAX_RETENTION_YEARS }, (_, i) => i + 1);
  return (
    <>
      <Topbar title={t("title")} sub={<Link href="/panel/ajustes">← Ajustes del estudio</Link>} />
      {(sp.error === "years" || sp.error === "confirm") && <div className="notice bad" role="alert">{t(`errors.${sp.error}`)}</div>}
      <div className="cols">
        <div className="card">
          <h2>{t("dueTitle")}</h2>
          <p className="muted" style={{ fontSize: ".88rem" }}>{t("dueHint")}</p>
          {due.length ? (
            <form action={purgeAction}>
              <table className="list">
                <thead><tr><th></th><th>{t("client")}</th><th>{t("signed")}</th><th>{t("until")}</th></tr></thead>
                <tbody>
                  {due.map((d) => (
                    <tr key={d.id}>
                      <td><input type="checkbox" name="ids" value={d.id} defaultChecked aria-label={`${d.firstName} ${d.lastName}`} /></td>
                      <td><b>{d.firstName} {d.lastName}</b><br /><small className="muted">{serviceLabel(d.service)}</small></td>
                      <td>{fmtDate(d.signedAt)}</td>
                      <td>{fmtDate(d.purgeAfter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <label className="check" style={{ marginTop: 14 }}><input type="checkbox" name="confirm" /><div>{t("confirm")}</div></label>
              <button className="btn danger">{t("purge")}</button>
            </form>
          ) : <div className="empty">{t("dueNone")}</div>}
        </div>
        <form className="card" action={saveRetentionAction}>
          <h2>{t("title")}</h2>
          <p className="muted" style={{ fontSize: ".88rem" }}>{t("hint")}</p>
          <div className="notice warn" style={{ fontSize: ".85rem" }}>{t("legalWarning")}</div>
          <label className="field"><span>{t("yearsLabel")}</span>
            <select name="years" defaultValue={studio.retentionYears ?? ""}>
              <option value="">{t("pending")}</option>
              {options.map((n) => <option key={n} value={n}>{t("years", { n })}</option>)}
            </select>
          </label>
          <label className="field"><span>{t("note")}</span><textarea name="note" defaultValue={studio.retentionNote} maxLength={500} /></label>
          <button className="btn">{t("save")}</button>
        </form>
      </div>
      {sp.ok === "plazo" && <Flash text={t("saved")} />}
      {sp.ok === "purga" && <Flash text={t("purged", { consents: Number(sp.c) || 0, clients: Number(sp.k) || 0 })} />}
    </>
  );
}
