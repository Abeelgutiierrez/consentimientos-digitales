import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SERVICES, SERVICE_KEYS } from "@/core/content";
import { Flash } from "@/components/flash";
import { Topbar } from "@/components/topbar";
import { withUser } from "@/server/auth";
import { getStudio } from "@/server/studios";
import { saveSettingsAction } from "./actions";
import { BrandFields } from "./brand-fields";

export const metadata: Metadata = { title: "Ajustes del estudio" };

export default async function SettingsPage({ searchParams }: PageProps<"/panel/ajustes">) {
  const studio = await withUser((scope) => getStudio(scope), { ownerOnly: true });
  const t = await getTranslations("settings");
  const sp = await searchParams;
  const errorKeys = ["name", "email", "services", "logoSize", "logoType"];
  const error = typeof sp.error === "string" && errorKeys.includes(sp.error) ? sp.error : null;
  return (
    <>
      <Topbar title={t("title")} sub={t("sub")} />
      {error && <div className="notice bad" role="alert">{t(`errors.${error}` as never)}</div>}
      <form className="cols" action={saveSettingsAction}>
        <div className="card">
          <h2>{t("data")}</h2>
          <p className="muted" style={{ fontSize: ".88rem" }}>{t("dataHint")}</p>
          <label className="field"><span>{t("name")}</span><input type="text" name="name" defaultValue={studio.name} required maxLength={80} /></label>
          <div className="row">
            <label className="field"><span>{t("cif")}</span><input type="text" name="cif" defaultValue={studio.cif} maxLength={20} /></label>
            <label className="field"><span>{t("phone")}</span><input type="text" name="phone" defaultValue={studio.phone} maxLength={30} /></label>
          </div>
          <div className="row">
            <label className="field"><span>{t("address")}</span><input type="text" name="address" defaultValue={studio.address} maxLength={120} /></label>
            <label className="field"><span>{t("city")}</span><input type="text" name="city" defaultValue={studio.city} maxLength={60} /></label>
          </div>
          <label className="field"><span>{t("email")}</span><input type="email" name="email" defaultValue={studio.email} maxLength={120} /></label>
          <div className="field"><span className="label">{t("services")}</span>
            {SERVICE_KEYS.map((k) => (
              <label key={k} className="check"><input type="checkbox" name="services" value={k} defaultChecked={studio.services.includes(k)} /><div>{SERVICES[k].label.es}</div></label>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>{t("brand")}</h2>
          <BrandFields color={studio.color} logoUrl={studio.logo ? `/s/${studio.slug}/logo?v=${studio.updatedAt.getTime()}` : null}
            labels={{ color: t("color"), logo: t("logo"), noLogo: t("noLogo"), remove: t("removeLogo") }} />
          <button className="btn lg block">{t("save")}</button>
          <p className="muted" style={{ fontSize: ".82rem", marginTop: 12 }}>{t("note")}</p>
        </div>
      </form>
      {sp.ok && <Flash text={t("saved")} />}
    </>
  );
}
