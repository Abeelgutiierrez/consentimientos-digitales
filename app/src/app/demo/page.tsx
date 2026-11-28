import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { qrSvg } from "@/core/qr";
import { LocaleSwitch } from "@/components/locale-switch";
import { Monograma, Producto } from "@/components/marca";
import { DEMO_OWNERS, demoEnabled, demoPanelHref } from "@/server/demo";
import { publicBaseUrl } from "@/server/public-url";
import { getStudio, studioIdBySlug } from "@/server/studios";
import { withStudio } from "@/server/tenant";

export const metadata: Metadata = { title: "Demo en directo" };

// Guion de venta en directo: el comerciante firma en su móvil (QR) y lo ve llegar al panel.
export default async function DemoPage({ searchParams }: PageProps<"/demo">) {
  if (!demoEnabled()) notFound();
  const t = await getTranslations("demo");
  const { estudio } = await searchParams;
  const slugs = Object.keys(DEMO_OWNERS);
  const chosen = typeof estudio === "string" && slugs.includes(estudio) ? estudio : slugs[0]!;

  const studios = (
    await Promise.all(
      slugs.map(async (slug) => {
        const id = await studioIdBySlug(slug);
        return id ? withStudio(id, { type: "system" }, (scope) => getStudio(scope)) : null;
      }),
    )
  ).filter((s) => s !== null);
  const studio = studios.find((s) => s.slug === chosen);
  if (!studio) notFound();

  const base = await publicBaseUrl();
  const formUrl = `${base.url}/s/${studio.slug}`;
  const svg = await qrSvg(formUrl, { size: 220 });

  return (
    <div className="home demo-page">
      <header className="home-bar">
        <Link href="/" aria-label="Inicio"><Monograma className="mono" title="ΛИΛ" /></Link>
        <nav><LocaleSwitch /></nav>
      </header>
      <main className="demo-wrap">
        <div className="demo-head">
          <Producto />
          <h1>{t("pageTitle")}</h1>
          <p className="lead">{t("pageLead")}</p>
          <div className="demo-studios" role="group" aria-label={t("chooseStudio")}>
            {studios.map((s) => (
              <Link
                key={s.slug}
                href={`/demo?estudio=${s.slug}`}
                className={`demo-studio${s.slug === studio.slug ? " on" : ""}`}
                aria-current={s.slug === studio.slug ? "true" : undefined}
                style={{ "--c": s.color } as CSSProperties}
              >
                <i aria-hidden="true" />
                {s.name}
              </Link>
            ))}
          </div>
        </div>

        <ol className="demo-steps">
          <li className="demo-step">
            <span className="demo-n">1</span>
            <div>
              <h2>{t("step1Title")}</h2>
              <p>{t("step1Text")}</p>
              <div className="demo-qr">
                {/* SVG generado en el servidor por la librería qrcode a partir de nuestra propia URL */}
                <div dangerouslySetInnerHTML={{ __html: svg }} />
                <div>
                  <div className="hash" data-testid="demo-form-url">{formUrl}</div>
                  {base.lan && <p className="muted" style={{ fontSize: ".85rem", marginTop: 8 }}>{t("lanNote")}</p>}
                  <a className="btn ghost" href={`/s/${studio.slug}`} target="_blank" rel="noopener">{t("openHere")}</a>
                </div>
              </div>
            </div>
          </li>
          <li className="demo-step">
            <span className="demo-n">2</span>
            <div>
              <h2>{t("step2Title")}</h2>
              <p>{t("step2Text")}</p>
              <a className="btn lg" href={demoPanelHref(studio.slug)} target="_blank" rel="noopener">{t("openPanel")}</a>
            </div>
          </li>
          <li className="demo-step">
            <span className="demo-n">3</span>
            <div>
              <h2>{t("step3Title")}</h2>
              <ul className="demo-list">
                <li>{t("step3a")}</li>
                <li>{t("step3b")}</li>
                <li>{t("step3c")}</li>
                <li>{t("step3d")}</li>
              </ul>
            </div>
          </li>
        </ol>
      </main>
      <footer className="home-foot"><Monograma className="sello-mono" title="ΛИΛ" /></footer>
    </div>
  );
}
