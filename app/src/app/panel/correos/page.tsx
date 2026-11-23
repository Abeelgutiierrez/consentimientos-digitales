import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { fmtDateTime } from "@/core/dates";
import { MailStatus } from "@/components/mail-status";
import { Topbar } from "@/components/topbar";
import { withUser } from "@/server/auth";
import { emailMode, listEmails } from "@/server/email";

export const metadata: Metadata = { title: "Correos enviados" };

export default async function EmailsPage() {
  const mails = await withUser((scope) => listEmails(scope));
  const t = await getTranslations("emails");
  return (
    <>
      <Topbar title={t("title")} sub={t("sub")} />
      {emailMode() === "simulado" && <div className="notice">{t("simulatedNotice")}</div>}
      <div className="card">
        {mails.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="list">
              <thead><tr><th>{t("to")}</th><th>{t("subject")}</th><th>{t("code")}</th><th>{t("date")}</th><th>{t("status")}</th></tr></thead>
              <tbody>
                {mails.map((m) => (
                  <tr key={m.id} className="link">
                    <td><Link href={`/panel/correos/${m.id}`}><b>{m.toEmail}</b></Link></td>
                    <td>{m.subject}{m.manual && <> <span className="badge">{t("simulation")}</span></>}</td>
                    <td className="mono">{m.code}</td>
                    <td>{fmtDateTime(m.createdAt)}</td>
                    <td><MailStatus status={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">{t("empty")}</div>}
      </div>
    </>
  );
}
