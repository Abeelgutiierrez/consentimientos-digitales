import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { fmtDate, fmtDateTime } from "@/core/dates";
import { Flash } from "@/components/flash";
import { SignatureSvg } from "@/components/panel-bits";
import { Topbar } from "@/components/topbar";
import { auditFor } from "@/server/audit";
import { withUser } from "@/server/auth";
import { type IntegrityResult, getConsentDetail, verifyIntegrity } from "@/server/consents";
import { NotFoundError } from "@/server/tenant";
import { saveAnnexAction } from "../actions";
import { AnnexForm } from "./annex-form";

export const metadata: Metadata = { title: "Consentimiento" };

export default async function ConsentDetailPage({ params, searchParams }: PageProps<"/panel/consentimientos/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  let data;
  try {
    data = await withUser(async (scope, user) => {
      const detail = await getConsentDetail(scope, id);
      const verify: IntegrityResult | null = sp.verificar ? await verifyIntegrity(scope, id) : null;
      const history = user.role === "owner" ? (await auditFor(scope, "consent", id)).slice(0, 50) : null;
      return { ...detail, verify, history };
    });
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const { row, payload: p, annex, pdfs, verify, history } = data;
  const t = await getTranslations("detail");
  const ta = await getTranslations("audit.actions");
  const c = p.client;
  const yes = p.legal.healthQuestions.filter((q) => p.health.answers[q.key]);
  const latestPdf = pdfs[0];
  const yesNo = (ok: boolean, strong = true) => ok ? <span className="badge ok">Sí</span> : <span className={`badge${strong ? " bad" : ""}`}>No</span>;

  return (
    <>
      <Topbar
        title={`${p.service.label} · ${c.firstName} ${c.lastName}`}
        sub={`Ref. ${row.id.toUpperCase()} · ${fmtDateTime(row.signedAt)}`}
        actions={<>
          <a className="btn" href={`/panel/consentimientos/${row.id}/pdf`} target="_blank" rel="noopener">{t("viewPdf")}</a>
          <a className="btn ghost" href={`/panel/consentimientos/${row.id}/pdf?descargar=1`}>{t("download")}</a>
          <Link className="btn ghost" href={`/panel/consentimientos/${row.id}?verificar=1`}>{t("verify")}</Link>
        </>}
      />
      {verify && (verify.signOk && verify.pdfOk
        ? <div className="notice ok" role="status"><b>{t("verifyOk")}</b></div>
        : <div className="notice bad" role="alert">{!verify.signOk && <div><b>{t("verifyBadSign")}</b></div>}{!verify.pdfOk && <div><b>{t("verifyBadPdf")}</b></div>}</div>)}
      <div className="cols">
        <div>
          <div className="card">
            <h2>{t("person")} {p.minor && <span className="badge accent">{t("minorBadge")}</span>}</h2>
            <dl className="kv">
              <dt>{t("name")}</dt><dd><Link href={`/panel/clientes/${row.clientId}`}>{c.firstName} {c.lastName}</Link></dd>
              <dt>{t("document")}</dt><dd>{c.dni}</dd>
              <dt>{t("birth")}</dt><dd>{fmtDate(c.birthDate)} · {t("ageAtSigning", { age: p.ageAtSigning })}</dd>
              <dt>{t("contact")}</dt><dd>{c.phone}{c.email ? ` · ${c.email}` : ""}</dd>
              {p.minor && <><dt>{t("tutor")}</dt><dd>{p.minor.tutorName} ({p.minor.relation}) · {p.minor.tutorDni}{p.ageAtSigning < 16 ? ` · ${t("maturity", { v: p.minor.maturityCert ? t("provided") : t("notProvided") })}` : ""}</dd></>}
            </dl>
          </div>
          <div className="card">
            <h2>{t("service")}</h2>
            <dl className="kv">
              <dt>{t("type")}</dt><dd>{p.service.label}</dd>
              <dt>{t("zone")}</dt><dd>{p.service.zone}</dd>
              <dt>{t("artist")}</dt><dd>{p.service.artistName}</dd>
              <dt>{t("description")}</dt><dd>{p.service.description || "—"}</dd>
            </dl>
          </div>
          <div className="card">
            <h2>{t("health")} {yes.length ? <span className="badge warn">{t("healthYes", { n: yes.length })}</span> : <span className="badge ok">{t("healthOk")}</span>}</h2>
            <ul className="health">
              {p.legal.healthQuestions.map((q) => (
                <li key={q.key}><span>{q.label}</span><b style={{ color: p.health.answers[q.key] ? "#c2410c" : "var(--ok)" }}>{p.health.answers[q.key] ? "Sí" : "No"}</b></li>
              ))}
            </ul>
            {p.health.notes && <div className="notice warn" style={{ margin: "12px 0 0" }}><b>{t("notes")}:</b> {p.health.notes}</div>}
          </div>
          <AnnexForm
            action={saveAnnexAction.bind(null, row.id)}
            inks={annex?.inks ?? []}
            applicator={annex?.applicator || p.service.artistName}
            needles={annex?.needles ?? ""}
            notes={annex?.notes ?? ""}
            lastUpdate={annex ? fmtDateTime(annex.createdAt) : null}
          />
        </div>
        <div>
          <div className="card">
            <h2>{t("signature")}</h2>
            <div className="sig-view"><SignatureSvg sig={p.signature} label={t("signature")} /></div>
            {p.tutorSignature && <>
              <p className="muted" style={{ margin: "12px 0 6px", fontSize: ".85rem" }}>{t("tutorSignature")}</p>
              <div className="sig-view"><SignatureSvg sig={p.tutorSignature} label={t("tutorSignature")} /></div>
            </>}
            <p className="muted" style={{ marginTop: 10, fontSize: ".85rem" }}>{t("signedFrom", { date: fmtDateTime(row.signedAt), ip: row.ip || "—" })}</p>
          </div>
          <div className="card">
            <h2>{t("checks")}</h2>
            <ul className="health">
              <li><span>{t("read")}</span>{yesNo(p.checks.read)}</li>
              <li><span>{t("privacy")}</span>{yesNo(p.checks.privacy)}</li>
              <li><span>{t("marketing")}</span>{yesNo(p.checks.marketing, false)}</li>
              <li><span>{t("images")}</span>{yesNo(p.checks.images, false)}</li>
            </ul>
          </div>
          <div className="card">
            <h2>{t("evidence")}</h2>
            <p className="muted" style={{ fontSize: ".85rem", marginBottom: 6 }}>{t("signHash")}</p>
            <div className="hash" data-testid="sign-hash">{row.signHash}</div>
            {latestPdf && <>
              <p className="muted" style={{ fontSize: ".85rem", margin: "12px 0 6px" }}>{t("pdfHash", { v: latestPdf.version })}</p>
              <div className="hash" data-testid="pdf-hash">{latestPdf.sha256}</div>
            </>}
            <p className="muted" style={{ fontSize: ".8rem", margin: "12px 0 0" }}>{t("consentVersion", { v: row.consentVersion })}</p>
            <p className="muted" style={{ fontSize: ".8rem", margin: "4px 0 0" }}>{t("device", { ua: row.userAgent || "—" })}</p>
            <h3 style={{ marginTop: 14 }}>{t("versions")}</h3>
            <ul className="health">
              {pdfs.map((v) => (
                <li key={v.version}>
                  <span>v{v.version} · {v.reason === "firma" ? t("reasonFirma") : t("reasonAnexo")} · {fmtDateTime(v.createdAt)}</span>
                  <a href={`/panel/consentimientos/${row.id}/pdf?v=${v.version}`} target="_blank" rel="noopener">{t("open")}</a>
                </li>
              ))}
            </ul>
          </div>
          {history && (
            <div className="card">
              <h2>{t("history")}</h2>
              <p className="muted" style={{ fontSize: ".85rem" }}>{t("historyHint")}</p>
              <table className="list" data-testid="history">
                <thead><tr><th>{t("when")}</th><th>{t("who")}</th><th>{t("what")}</th></tr></thead>
                <tbody>
                  {history.map((e) => (
                    <tr key={e.id}>
                      <td><small>{fmtDateTime(e.createdAt)}</small></td>
                      <td><small>{e.actorName}{e.ip ? ` · ${e.ip}` : ""}</small></td>
                      <td><small>{ta(e.action.replace(".", "_") as never)}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {sp.ok === "anexo" && <Flash text={t("annexSaved")} />}
    </>
  );
}
