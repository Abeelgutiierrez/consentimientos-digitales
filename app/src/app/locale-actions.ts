"use server";
import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { currentUser, withUser } from "@/server/auth";
import { setLocale } from "@/server/team";

/** Cambia el idioma de la interfaz (cookie y, si hay sesión, preferencia del usuario). */
export async function setLocaleAction(form: FormData) {
  const locale = String(form.get("locale") ?? "");
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", sameSite: "lax", maxAge: 365 * 86400 });
  if (await currentUser()) await withUser((scope) => setLocale(scope, locale));
  refresh();
}
