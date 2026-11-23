import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { qrSvg } from "@/core/qr";
import { Topbar } from "@/components/topbar";
import { PrintButton } from "@/components/print-button";
import { withUser } from "@/server/auth";
import { publicBaseUrl } from "@/server/public-url";
import { getStudio } from "@/server/studios";

export const metadata: Metadata = { title: "QR del mostrador" };

export default async function QrPage() {
  const studio = await withUser((scope) => getStudio(scope));
  const base = await publicBaseUrl();
  const formUrl = `${base.url}/s/${studio.slug}`;
  const svg = await qrSvg(formUrl, { size: 260 });
  const t = await getTranslations("qr");
  return (
    <>
      <Topbar title={t("title")} sub={t("sub")} />
      <div className="cols">
        <div className="qr-poster" id="poster">
          <div className="top">
            {studio.logo && <img src={`/s/${studio.slug}/logo`} alt="" />}
            <div className="t">{studio.name}</div>
          </div>
          <div className="body">
            {/* SVG generado en el servidor por la librería qrcode a partir de nuestra propia URL */}
            <div dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="big">{t("scan")}</div>
            <p className="muted">{t("scanHint")}</p>
          </div>
        </div>
        <div className="card no-print">
          <h2>{t("how")}</h2>
          <ol className="steps-list"><li>{t("step1")}</li><li>{t("step2")}</li><li>{t("step3")}</li></ol>
          <p className="label">{t("address")}</p>
          <div className="hash" data-testid="form-url">{formUrl}</div>
          {base.lan && <div className="notice warn" style={{ marginTop: 12, fontSize: ".85rem" }}>{t("lanNote")}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <PrintButton label={t("print")} />
            <a className="btn ghost" href={formUrl} target="_blank" rel="noopener">{t("test")}</a>
          </div>
        </div>
      </div>
    </>
  );
}
