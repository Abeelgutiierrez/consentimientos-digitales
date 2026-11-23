import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { unsubscribe } from "@/server/email";
import { requestMeta } from "@/server/request";

export const metadata: Metadata = { title: "Baja de promociones", referrer: "no-referrer" };

// Baja de promociones. Se confirma con un botón (POST) para que los antivirus de correo que abren
// los enlaces no den de baja a nadie sin querer.
async function confirmAction(token: string) {
  "use server";
  const r = await unsubscribe(token, await requestMeta());
  redirect(r ? `/baja/hecho?estudio=${encodeURIComponent(r.studioName)}` : "/baja/hecho?error=1");
}

export default async function UnsubscribePage({ params, searchParams }: PageProps<"/baja/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  const t = await getTranslations("unsubscribe");
  if (token === "hecho") {
    return (
      <main className="login"><div className="card">
        <h1>{t("title")}</h1>
        <p>{sp.error ? t("invalid") : t("done", { studio: typeof sp.estudio === "string" ? sp.estudio.slice(0, 80) : "" })}</p>
      </div></main>
    );
  }
  return (
    <main className="login">
      <form className="card" action={confirmAction.bind(null, token)}>
        <h1>{t("title")}</h1>
        <p className="muted">{t("lead")}</p>
        <button className="btn block lg">{t("confirm")}</button>
      </form>
    </main>
  );
}
