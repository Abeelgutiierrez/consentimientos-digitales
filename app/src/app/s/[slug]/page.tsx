import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { accentStyle } from "@/core/color";
import { type ServiceKey, checkTexts, declarations, healthQuestions, infoDocument, isServiceKey, legalLocaleFor, serviceLabel } from "@/core/content";
import { LocaleSwitch } from "@/components/locale-switch";
import { SelloCasa } from "@/components/marca";
import { isDemoStudio } from "@/server/demo";
import { getStudio, listArtists, studioIdBySlug } from "@/server/studios";
import { withStudio } from "@/server/tenant";
import { ConsentForm, type FormConfig } from "./consent-form";

export const metadata: Metadata = { title: "Consentimiento informado" };

export default async function PublicFormPage({ params }: PageProps<"/s/[slug]">) {
  const { slug } = await params;
  const studioId = await studioIdBySlug(slug);
  if (!studioId) notFound();
  const { studio, artists } = await withStudio(studioId, { type: "system" }, async (scope) => ({
    studio: await getStudio(scope),
    artists: await listArtists(scope),
  }));
  const locale = await getLocale();
  const legalLocale = legalLocaleFor(locale);
  const t = await getTranslations("form");
  const services = studio.services.filter(isServiceKey) as ServiceKey[];
  const legalInfo = { name: studio.name, cif: studio.cif, email: studio.email };

  // Solo datos públicos del estudio llegan al navegador.
  const config: FormConfig = {
    slug: studio.slug,
    services: services.map((k) => ({ key: k, label: serviceLabel(k, legalLocale) })),
    artists: artists.map((a) => ({ id: a.id, name: a.name })),
    legal: Object.fromEntries(services.map((k) => [k, { info: infoDocument(legalInfo, k, legalLocale), declarations: declarations(legalInfo, k, legalLocale) }])),
    healthQuestions: healthQuestions(legalLocale),
    checkTexts: checkTexts(legalLocale),
    legalInOtherLanguage: legalLocale !== locale,
    demo: isDemoStudio(studio.slug),
  };

  return (
    <div className="public" style={accentStyle(studio.color) as CSSProperties}>
      <div className="pub-head">
        {studio.logo && <img src={`/s/${studio.slug}/logo`} alt="" />}
        <div className="name">{studio.name}</div>
        <div className="sub">{t("subtitle")}</div>
      </div>
      <div className="pub-wrap">
        <ConsentForm config={config} />
        <div className="legal-foot">
          {studio.name}{studio.cif ? ` · ${studio.cif}` : ""} · {t("footer")}
          <div style={{ marginTop: 8 }}><LocaleSwitch /></div>
          <div style={{ marginTop: 14 }}><SelloCasa /></div>
        </div>
      </div>
    </div>
  );
}
