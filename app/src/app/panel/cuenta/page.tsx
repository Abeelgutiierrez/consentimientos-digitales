import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LocaleSwitch } from "@/components/locale-switch";
import { Topbar } from "@/components/topbar";
import { logout, requireUser, withUser } from "@/server/auth";
import { TeamError, changeOwnPassword } from "@/server/team";

export const metadata: Metadata = { title: "Mi cuenta" };

async function changePasswordAction(f: FormData) {
  "use server";
  let code: string | null = null;
  try {
    await withUser((scope) => changeOwnPassword(scope, String(f.get("current") ?? ""), String(f.get("next") ?? "")));
  } catch (err) {
    if (err instanceof TeamError) code = err.code;
    else throw err;
  }
  if (code) redirect(`/panel/cuenta?error=${code}`);
  // Se han cerrado todas las sesiones del usuario, también esta.
  await logout();
  redirect("/login?cambio=1");
}

export default async function AccountPage({ searchParams }: PageProps<"/panel/cuenta">) {
  await requireUser();
  const t = await getTranslations("account");
  const te = await getTranslations("team.errors");
  const { error } = await searchParams;
  return (
    <>
      <Topbar title={t("title")} sub={t("sub")} />
      <div className="cols">
        <form className="card" action={changePasswordAction}>
          <h2>{t("changePassword")}</h2>
          {error === "currentPassword" && <div className="notice bad" role="alert">{te("currentPassword")}</div>}
          {error === "passwordShort" && <div className="notice bad" role="alert">{te("passwordShort")}</div>}
          <label className="field"><span>{t("current")}</span><input type="password" name="current" required autoComplete="current-password" /></label>
          <label className="field"><span>{t("new")}</span><input type="password" name="next" required minLength={10} autoComplete="new-password" /><small className="muted">{t("newHint")}</small></label>
          <button className="btn">{t("changePassword")}</button>
        </form>
        <div className="card">
          <h2>{t("language")}</h2>
          <LocaleSwitch />
        </div>
      </div>
    </>
  );
}
