import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { accentStyle } from "@/core/color";
import { fmtDate, fmtDateTime } from "@/core/dates";
import { Icons } from "@/components/icons";
import { publicSummary, resolvePublicLink } from "@/server/consents";
import { getStudio } from "@/server/studios";
import { withStudio } from "@/server/tenant";

export const metadata: Metadata = { title: "Consentimiento firmado", referrer: "no-referrer" };

export default async function ThanksPage({ params, searchParams }: PageProps<"/s/[slug]/gracias/[id]">) {
  const { slug, id } = await params;
  const { t: token } = await searchParams;
  const link = typeof token === "string" ? await resolvePublicLink(id, token) : null;
  if (!link || "expired" in link) notFound();
  const { studio, summary } = await withStudio(link.studioId, { type: "client" }, async (scope) => ({
    studio: await getStudio(scope),
    summary: await publicSummary(scope, id),
  }));
  if (studio.slug !== slug) notFound();
  const t = await getTranslations("thanks");
  const tf = await getTranslations("form");
  return (
    <div className="public" style={accentStyle(studio.color) as CSSProperties}>
      <div className="pub-head">
        {studio.logo && <img src={`/s/${studio.slug}/logo`} alt="" />}
        <div className="name">{studio.name}</div>
        <div className="sub">{tf("subtitle")}</div>
      </div>
      <div className="pub-wrap">
        <div className="pub-card done">
          <div className="tick"><Icons.check /></div>
          <h2>{t("title", { name: summary.firstName })}</h2>
          <p className="muted">{t("signedAt", { date: fmtDateTime(summary.signedAt) })}</p>
          <p><span className="badge">{t("ref", { ref: id.toUpperCase() })}</span></p>
          <a className="btn block lg" href={`/c/${id}/pdf?t=${encodeURIComponent(token as string)}`} target="_blank" rel="noopener">{t("download")}</a>
          <p className="muted" style={{ fontSize: ".82rem", marginTop: 10 }}>{t("linkExpires", { date: fmtDate(link.expiresAt) })}</p>
          <p style={{ marginTop: 16 }} className="muted">{t("returnDevice")}</p>
          <Link className="btn ghost block" href={`/s/${studio.slug}`}>{t("another")}</Link>
        </div>
      </div>
    </div>
  );
}
