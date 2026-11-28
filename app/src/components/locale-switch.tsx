import { getLocale, getTranslations } from "next-intl/server";
import { LOCALES } from "@/i18n/config";
import { setLocaleAction } from "@/app/locale-actions";

// Selector de idioma (funciona sin JavaScript: es un formulario).
export async function LocaleSwitch({ dark = false }: { dark?: boolean }) {
  const locale = await getLocale();
  const t = await getTranslations("common");
  return (
    <form action={setLocaleAction} className="locale-switch" aria-label={t("language")}>
      {LOCALES.map((l) => (
        <button
          key={l}
          name="locale"
          value={l}
          className={l === locale ? "on" : ""}
          aria-pressed={l === locale}
          style={dark ? { color: l === locale ? "#000" : "#9a9eaa" } : undefined}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </form>
  );
}
