import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { fmtDate } from "@/core/dates";
import { BirthdayBadge, ConsentRows } from "@/components/panel-bits";
import { Topbar } from "@/components/topbar";
import { withUser } from "@/server/auth";
import { dashboardData } from "@/server/panel";
import { getStudio } from "@/server/studios";

export default async function DashboardPage({ searchParams }: PageProps<"/panel">) {
  const { studio, data } = await withUser(async (scope) => ({ studio: await getStudio(scope), data: await dashboardData(scope) }));
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");
  const { prohibido } = await searchParams;
  const s = data.stats;
  return (
    <>
      {prohibido && <div className="notice warn" role="alert">{tc("forbidden")}</div>}
      <Topbar title={t("hello", { name: studio.name })} sub={t("sub")} />
      <div className="stats">
        <div className="stat"><div className="k">{t("today")}</div><div className="v">{s.today}</div><div className="s">{t("lastWeek", { n: s.week })}</div></div>
        <div className="stat"><div className="k">{t("month")}</div><div className="v">{s.month}</div><div className="s">{t("total", { n: s.total })}</div></div>
        <div className="stat"><div className="k">{t("clients")}</div><div className="v">{s.clients}</div><div className="s">{t("marketingPct", { n: s.marketingPct })}</div></div>
        <div className="stat"><div className="k">{t("pendingInks")}</div><div className="v">{s.pendingAnnex}</div><div className="s">{t("pendingInksSub")}</div></div>
      </div>
      <div className="cols">
        <div className="card">
          <h2>{t("recent")} <Link className="btn ghost small" href="/panel/consentimientos">{t("seeAll")}</Link></h2>
          <ConsentRows items={data.recent} />
        </div>
        <div>
          <div className="card">
            <h2>{t("birthdays")} <Link className="btn ghost small" href="/panel/cumpleanos">{t("configure")}</Link></h2>
            {data.upcoming.length ? (
              <table className="list"><tbody>
                {data.upcoming.map(({ client, days }) => (
                  <tr key={client.id} className="link">
                    <td>
                      <Link href={`/panel/clientes/${client.id}`}><b>{client.firstName} {client.lastName}</b></Link><br />
                      <small className="muted">{fmtDate(client.birthDate).slice(0, 5)} · {client.marketing ? t("willGetGift") : t("noMarketing")}</small>
                    </td>
                    <td style={{ textAlign: "right" }}><BirthdayBadge days={days} /></td>
                  </tr>
                ))}
              </tbody></table>
            ) : <div className="empty">{t("noBirthdays")}</div>}
          </div>
          <div className="card">
            <h2>{t("formCard")}</h2>
            <p className="muted" style={{ fontSize: ".9rem" }}>{t("formCardHint")}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="btn small" href="/panel/qr">{t("seeQr")}</Link>
              <a className="btn ghost small" href={`/s/${studio.slug}`} target="_blank" rel="noopener">{t("openForm")}</a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
