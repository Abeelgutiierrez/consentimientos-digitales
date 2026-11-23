import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { fmtDate } from "@/core/dates";
import { Flash } from "@/components/flash";
import { BirthdayBadge } from "@/components/panel-bits";
import { Topbar } from "@/components/topbar";
import { withUser } from "@/server/auth";
import { automaticSentThisYear } from "@/server/email";
import { upcomingBirthdays } from "@/server/panel";
import { getStudio } from "@/server/studios";
import { saveBirthdayAction, simulateBirthdayAction } from "./actions";

export const metadata: Metadata = { title: "Cumpleaños" };

export default async function BirthdaysPage({ searchParams }: PageProps<"/panel/cumpleanos">) {
  const { studio, upcoming, sent, isOwner } = await withUser(async (scope, user) => ({
    studio: await getStudio(scope), upcoming: await upcomingBirthdays(scope, 60), sent: await automaticSentThisYear(scope), isOwner: user.role === "owner",
  }));
  const t = await getTranslations("birthdays");
  const tc = await getTranslations("common");
  const sp = await searchParams;
  const b = studio.birthday;
  return (
    <>
      <Topbar title={t("title")} sub={t("sub")} />
      {(sp.error === "noMarketing" || sp.error === "noEmail") && <div className="notice bad" role="alert">{t(`errors.${sp.error}`)}</div>}
      <div className="cols">
        <form className="card" action={saveBirthdayAction}>
          <h2>{t("auto")}</h2>
          <p className="muted" style={{ fontSize: ".9rem" }}>{t("autoHint")}</p>
          {!isOwner && <div className="notice">{t("ownerOnly")}</div>}
          <fieldset disabled={!isOwner} style={{ border: 0, padding: 0, margin: 0 }}>
            <label className="check"><input type="checkbox" name="enabled" defaultChecked={b.enabled} /><div><b>{t("enabled")}</b><br /><small className="muted">{t("enabledHint")}</small></div></label>
            <div className="row">
              <label className="field"><span>{t("discount")}</span><input type="number" name="discount" min={1} max={100} defaultValue={b.discount} /></label>
              <label className="field"><span>{t("validDays")}</span><input type="number" name="validDays" min={1} max={730} defaultValue={b.validDays} /></label>
            </div>
            <label className="field"><span>{t("subject")}</span><input type="text" name="subject" defaultValue={b.subject} maxLength={150} /></label>
            <label className="field"><span>{t("body")}</span><textarea name="body" rows={7} defaultValue={b.body} maxLength={2000} /></label>
            <p className="muted" style={{ fontSize: ".8rem" }}>{t("vars")} <code>{"{nombre}"}</code> <code>{"{estudio}"}</code> <code>{"{descuento}"}</code> <code>{"{codigo}"}</code> <code>{"{caducidad}"}</code></p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {isOwner && <button className="btn">{tc("save")}</button>}
              <a className="btn ghost" href="/panel/cumpleanos/vista-previa" target="_blank" rel="noopener">{t("preview")}</a>
            </div>
          </fieldset>
        </form>
        <div className="card">
          <h2>{t("next60")}</h2>
          <p className="muted" style={{ fontSize: ".85rem" }}>{t("sentThisYear", { n: sent })}</p>
          {upcoming.length ? (
            <table className="list"><tbody>
              {upcoming.map(({ client, days }) => (
                <tr key={client.id}>
                  <td>
                    <Link href={`/panel/clientes/${client.id}`}><b>{client.firstName} {client.lastName}</b></Link><br />
                    <small className="muted">{fmtDate(client.birthDate).slice(0, 5)} · {client.marketing ? t("acceptsPromos") : <span style={{ color: "var(--bad)" }}>{t("noPromos")}</span>}</small>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <BirthdayBadge days={days} />
                    {isOwner && (
                      <form action={simulateBirthdayAction.bind(null, client.id, "cumpleanos")} style={{ marginTop: 6 }}>
                        <button className="btn ghost small" disabled={!client.marketing || !client.email}>{t("simulate")}</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody></table>
          ) : <div className="empty">{t("none")}</div>}
        </div>
      </div>
      {sp.ok === "guardado" && <Flash text={t("saved")} />}
    </>
  );
}
