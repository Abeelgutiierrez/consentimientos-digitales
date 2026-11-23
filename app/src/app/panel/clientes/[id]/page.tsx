import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ageOn, daysToBirthday, fmtDate, fmtDateTime, fmtLongDate } from "@/core/dates";
import { MailStatus } from "@/components/mail-status";
import { BirthdayBadge, ConsentRows } from "@/components/panel-bits";
import { listEmails } from "@/server/email";
import { simulateBirthdayAction } from "../../cumpleanos/actions";
import { Topbar } from "@/components/topbar";
import { withUser } from "@/server/auth";
import { clientDetail } from "@/server/panel";
import { NotFoundError } from "@/server/tenant";

export const metadata: Metadata = { title: "Cliente" };

export default async function ClientPage({ params, searchParams }: PageProps<"/panel/clientes/[id]">) {
  const { id } = await params;
  let data;
  try {
    data = await withUser(async (scope, user) => ({ ...(await clientDetail(scope, id)), mails: await listEmails(scope, id), isOwner: user.role === "owner" }));
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const { client: c, dni, consents, mails, isOwner } = data;
  const t = await getTranslations("client");
  const tb = await getTranslations("birthdays");
  const te = await getTranslations("emails");
  const sp = await searchParams;
  const days = daysToBirthday(c.birthDate);
  return (
    <>
      <Topbar title={`${c.firstName} ${c.lastName}`} sub={t("services", { n: consents.length })} />
      <div className="cols">
        <div>
          <div className="card"><h2>{t("consents")}</h2><ConsentRows items={consents} showClient={false} /></div>
          <div className="card"><h2>{te("clientMails")}</h2>
            {mails.length ? (
              <table className="list"><tbody>
                {mails.map((m) => (
                  <tr key={m.id} className="link">
                    <td><Link href={`/panel/correos/${m.id}`}><b>{m.subject}</b></Link><br /><small className="muted">{fmtDateTime(m.createdAt)} · {m.code}</small></td>
                    <td style={{ textAlign: "right" }}><MailStatus status={m.status} /></td>
                  </tr>
                ))}
              </tbody></table>
            ) : <div className="empty">{te("noMails")}</div>}
          </div>
        </div>
        <div>
          <div className="card">
            <h2>{t("card")}</h2>
            <dl className="kv">
              <dt>{t("document")}</dt><dd>{dni}</dd>
              <dt>{t("birth")}</dt><dd>{fmtDate(c.birthDate)} ({t("age", { age: ageOn(c.birthDate) ?? 0 })})</dd>
              <dt>{t("phone")}</dt><dd>{c.phone}</dd>
              <dt>{t("email")}</dt><dd>{c.email || "—"}</dd>
              <dt>{t("since")}</dt><dd>{fmtDate(c.createdAt)}</dd>
              <dt>{t("promos")}</dt>
              <dd>{c.marketing ? <><span className="badge ok">{t("accepts")}</span> <small className="muted">{t("since2", { date: fmtDate(c.marketingAt) })}</small></> : <span className="badge">{t("noAccepts")}</span>}</dd>
            </dl>
          </div>
          <div className="card">
            <h2>{tb("title")} <BirthdayBadge days={days} /></h2>
            <p className="muted" style={{ fontSize: ".9rem" }}>{fmtLongDate(c.birthDate).replace(/ de \d{4}$/, "")}. {c.marketing ? tb("willReceive") : tb("wontReceive")}</p>
            {(sp.error === "noMarketing" || sp.error === "noEmail") && <div className="notice bad" role="alert">{tb(`errors.${sp.error}`)}</div>}
            {isOwner && <form action={simulateBirthdayAction.bind(null, c.id, "cliente")}><button className="btn block">{tb("simulateNow")}</button></form>}
          </div>
        </div>
      </div>
    </>
  );
}
