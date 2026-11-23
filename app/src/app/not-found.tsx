import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <main className="login">
      <div className="card">
        <h1>{t("notFound")}</h1>
        <p className="muted">{t("notFoundHint")}</p>
        <Link className="btn" href="/">{t("goHome")}</Link>
      </div>
    </main>
  );
}
