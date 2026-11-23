import Link from "next/link";
import { sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { serviceLabel } from "@/core/content";
import { LocaleSwitch } from "@/components/locale-switch";
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
    <main className="landing">
      <section className="hero">
        <span className="badge accent">v2 · Piloto</span>
        <h1 className="mt-3">{t("title")}</h1>
        <p>{t("lead")}</p>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Link className="btn lg" href="/login">{t("panel")}</Link>
          <LocaleSwitch />
        </div>
      </section>
      {studios.length > 0 && (
        <>
          <div className="notice warn" style={{ fontSize: ".9rem" }}>{t("demoNotice")}</div>
          <div className="grid-2">
            {studios.map((s) => (
              <div key={s.id} className="card studio-card" style={{ "--c": s.color } as React.CSSProperties}>
                <span className="badge">{s.services.map((k) => serviceLabel(k)).join(" · ")}</span>
                <h2 style={{ marginTop: 10 }}>{s.name}</h2>
                <p className="muted" style={{ margin: 0 }}>{s.city}</p>
                <div className="actions">
                  <a className="btn" href={`/s/${s.slug}`} target="_blank" rel="noopener">{t("clientForm")} ↗</a>
                  <Link className="btn ghost" href="/login">{t("panel")}</Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
