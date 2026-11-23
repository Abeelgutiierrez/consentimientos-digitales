import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "./config";

// Sin prefijo de idioma en la URL: el idioma sale de una cookie (selector en la interfaz).
export default getRequestConfig(async () => {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE;
  return {
    locale,
    timeZone: "Europe/Madrid",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
