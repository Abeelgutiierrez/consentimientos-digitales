import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { daysToBirthday, fmtDate } from "@/core/dates";
import { BirthdayBadge } from "@/components/panel-bits";
import { Topbar } from "@/components/topbar";
import { withUser } from "@/server/auth";
import { listClients } from "@/server/clients";
import { consentCountsByClient } from "@/server/panel";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage({ searchParams }: PageProps<"/panel/clientes">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const { list, counts } = await withUser(async (scope) => ({ list: await listClients(scope, q), counts: await consentCountsByClient(scope) }));
  const t = await getTranslations("clients");
  const tc = await getTranslations("common");
  return (
    <>
      <Topbar title={t("title")} sub={t("count", { n: list.length })} />
      <div className="card">
        <form className="search" method="get" action="/panel/clientes" role="search">
          <input type="search" name="q" defaultValue={q} placeholder={t("searchPh")} aria-label={t("searchPh")} />
          <button className="btn ghost">{tc("search")}</button>
          {q && <Link className="btn ghost" href="/panel/clientes">{tc("clear")}</Link>}
        </form>
        {list.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="list">
              <thead><tr><th>{t("client")}</th><th>{t("contact")}</th><th>{t("birthday")}</th><th>{t("promos")}</th><th>{t("services")}</th></tr></thead>
              <tbody>
                {list.map((c) => {
                  const days = daysToBirthday(c.birthDate);
                  return (
                    <tr key={c.id} className="link">
                      <td><Link href={`/panel/clientes/${c.id}`}><b>{c.firstName} {c.lastName}</b></Link></td>
                      <td>{c.phone}<br /><small className="muted">{c.email || t("noEmail")}</small></td>
                      <td>{fmtDate(c.birthDate).slice(0, 5)} {days !== null && days <= 30 && <BirthdayBadge days={days} />}</td>
                      <td>{c.marketing ? <span className="badge ok">{t("accepts")}</span> : <span className="badge">{t("noAccepts")}</span>}</td>
                      <td>{counts.get(c.id) ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">{t("empty")}</div>}
      </div>
    </>
  );
}
