import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { fmtDateTime } from "@/core/dates";
import { serviceLabel } from "@/core/content";
import { type Signature, signaturePath, signatureViewBox } from "@/core/signature";
import type { ConsentListItem } from "@/server/consents";

// Piezas reutilizadas en varias páginas del panel.

export async function BirthdayBadge({ days }: { days: number | null }) {
  if (days === null) return null;
  const t = await getTranslations("dashboard");
  if (days === 0) return <span className="badge warn">{t("today_badge")}</span>;
  if (days === 1) return <span className="badge accent">{t("tomorrow")}</span>;
  return <span className="badge">{t("inDays", { n: days })}</span>;
}

export async function ConsentRows({ items, showClient = true }: { items: ConsentListItem[]; showClient?: boolean }) {
  const t = await getTranslations("consents");
  if (!items.length) return <div className="empty">{t("empty")}</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="list">
        <thead>
          <tr>
            {showClient && <th>{t("client")}</th>}
            <th>{t("service")}</th><th>{t("artist")}</th><th>{t("date")}</th><th>{t("traceability")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id} className="link">
              {showClient && (
                <td>
                  <Link href={`/panel/consentimientos/${c.id}`}><b>{c.clientName}</b></Link>
                  {c.isMinor && <> <span className="badge accent">{t("minor")}</span></>}
                  {c.healthYes > 0 && <> <span className="badge warn" title={t("healthTitle")}>{t("health")}</span></>}
                </td>
              )}
              <td>
                {showClient ? serviceLabel(c.service) : <Link href={`/panel/consentimientos/${c.id}`}><b>{serviceLabel(c.service)}</b></Link>}
                <br /><small className="muted">{c.zone}</small>
              </td>
              <td>{c.artistName}</td>
              <td>{fmtDateTime(c.signedAt)}</td>
              <td>{c.annexVersion > 0 ? <span className="badge ok">{t("inksDone")}</span> : <span className="badge">{t("pending")}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SignatureSvg({ sig, label }: { sig: Signature; label: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={signatureViewBox(sig)} role="img" aria-label={label}>
      <path d={signaturePath(sig)} fill="none" stroke="#1b1f3b" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
