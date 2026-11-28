import Link from "next/link";
import { sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { serviceLabel } from "@/core/content";
import { LocaleSwitch } from "@/components/locale-switch";
import { Monograma, Producto } from "@/components/marca";
import { getStudio } from "@/server/studios";
import { withStudio, withoutStudio } from "@/server/tenant";

// Portada. Fuera de producción muestra los estudios de demostración (como la demo de la Fase 1);
// en producción no se listan los clientes del servicio.
async function demoStudios() {
  if (process.env.NODE_ENV === "production" && process.env.E2E !== "1") return [];
  const ids = await withoutStudio(async (tx) => (await tx.execute<{ id: string }>(sql`select system_studio_ids() as id`)).map((r) => r.id));
  return Promise.all(ids.slice(0, 6).map((id) => withStudio(id, { type: "system" }, (scope) => getStudio(scope))));
}

export default async function Home() {
  const t = await getTranslations("home");
  const studios = await demoStudios();
  return (
    <div className="home">
      <header className="home-bar">
        <Monograma className="mono" title="ΛИΛ" />
        <nav>
          <LocaleSwitch />
          <Link className="btn small ghost" href="/login">{t("panel")}</Link>
        </nav>
      </header>

      <main>
        <section className="home-hero">
          <div>
            <Producto />
            <h1>{t("title")}</h1>
            <p className="lead">{t("lead")}</p>
            <div className="cta">
              <Link className="btn lg" href="/login">{t("panel")}</Link>
            </div>
          </div>
          {/* El gesto del producto: una firma que se dibuja sobre su línea. */}
          <figure className="firma-viva" aria-hidden="true">
            <div className="who"><span><b>Laia Puig Ferrer</b></span><span>Tatuaje · antebrazo</span></div>
            <svg viewBox="0 0 400 130">
              <path className="base" d="M14 112 L386 112" />
              <path className="trazo" d="M24 86 C40 30 58 104 78 60 S112 18 124 74 S150 98 166 52 C176 26 188 40 190 66 S214 96 236 58 S270 34 284 70 L372 52" />
            </svg>
            <div className="ok"><i />PDF firmado y guardado en el panel</div>
          </figure>
        </section>

        {studios.length > 0 && (
          <section className="home-demo">
            <div className="notice warn" style={{ fontSize: ".9rem" }}>{t("demoNotice")}</div>
            <div className="grid-2">
              {studios.map((s) => (
                <div key={s.id} className="card studio-card" style={{ "--c": s.color } as React.CSSProperties}>
                  <div className="who"><i aria-hidden="true" /><h2>{s.name}</h2></div>
                  <p className="muted" style={{ margin: 0 }}>{s.city} · {s.services.map((k) => serviceLabel(k)).join(", ")}</p>
                  <div className="actions">
                    <a className="btn" href={`/s/${s.slug}`} target="_blank" rel="noopener">{t("clientForm")}</a>
                    <Link className="btn ghost" href="/login">{t("panel")}</Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="home-foot"><Monograma className="sello-mono" title="ΛИΛ" /></footer>
    </div>
  );
}
