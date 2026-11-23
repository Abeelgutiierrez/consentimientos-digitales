import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations("home");
  return (
    <main className="landing">
      <section className="hero">
        <span className="badge accent">v2 · Piloto</span>
        <h1 className="mt-3">{t("title")}</h1>
        <p>{t("lead")}</p>
      </section>
    </main>
  );
}
