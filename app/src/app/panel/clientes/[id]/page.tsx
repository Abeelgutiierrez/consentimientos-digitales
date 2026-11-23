import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ageOn, fmtDate } from "@/core/dates";
import { ConsentRows } from "@/components/panel-bits";
import { Topbar } from "@/components/topbar";
import { withUser } from "@/server/auth";
import { clientDetail } from "@/server/panel";
import { NotFoundError } from "@/server/tenant";

export const metadata: Metadata = { title: "Cliente" };

export default async function ClientPage({ params }: PageProps<"/panel/clientes/[id]">) {
  const { id } = await params;
  let data;
  try {
    data = await withUser((scope) => clientDetail(scope, id));
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const { client: c, dni, consents } = data;
  const t = await getTranslations("client");
  return (
    <>
      <Topbar title={`${c.firstName} ${c.lastName}`} sub={t("services", { n: consents.length })} />
      <div className="cols">
        <div>
          <div className="card"><h2>{t("consents")}</h2><ConsentRows items={consents} showClient={false} /></div>
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
        </div>
      </div>
    </>
  );
}
