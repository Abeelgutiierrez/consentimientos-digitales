import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { fmtDate, fmtDateTime } from "@/core/dates";
import { Flash } from "@/components/flash";
import { Topbar } from "@/components/topbar";
import { withUser } from "@/server/auth";
import { getEmail } from "@/server/email";
import { NotFoundError } from "@/server/tenant";
import { MailStatus } from "@/components/mail-status";

export const metadata: Metadata = { title: "Correo" };

export default async function EmailPage({ params, searchParams }: PageProps<"/panel/correos/[id]">) {
  const { id } = await params;
  let mail;
  try {
    mail = await withUser((scope) => getEmail(scope, id));
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const t = await getTranslations("emails");
  const tb = await getTranslations("birthdays");
  const sp = await searchParams;
  return (
    <>
      <Topbar title={t("mailTitle")} sub={fmtDateTime(mail.createdAt)} actions={<Link className="btn ghost" href="/panel/correos">{t("back")}</Link>} />
      <div className="card" style={{ marginBottom: 18 }}>
        <dl className="kv">
          <dt>{t("to")}</dt><dd>{mail.toEmail}</dd>
          <dt>{t("subject")}</dt><dd>{mail.subject}</dd>
          <dt>{t("code")}</dt><dd className="mono">{mail.code}{mail.validUntil ? ` · ${t("validUntil", { date: fmtDate(mail.validUntil) })}` : ""}</dd>
          <dt>{t("status")}</dt><dd><MailStatus status={mail.status} />{mail.error ? ` · ${mail.error}` : ""}</dd>
        </dl>
      </div>
      {/* sandbox vacío: el HTML del correo se muestra sin scripts ni acceso a la página */}
      <iframe className="mail-frame" sandbox="" srcDoc={mail.html} title={t("mailTitle")} />
      {sp.ok === "enviado" && <Flash text={tb("sent")} />}
    </>
  );
}
