import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import { inkFor, safeColor } from "@/core/color";
import { LocaleSwitch } from "@/components/locale-switch";
import { Producto, SelloCasa } from "@/components/marca";
import { requireUser, withUser } from "@/server/auth";
import { getStudio } from "@/server/studios";
import { logoutAction } from "./actions";
import { type NavItem, PanelNav } from "./nav";

// Marco del panel. Ojo: la autorización NO depende de este layout (no se re-renderiza al navegar);
// cada página y acción vuelve a comprobar la sesión con requireUser()/withUser().
export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const user = await requireUser();
  const studio = await withUser((scope) => getStudio(scope));
  const t = await getTranslations("nav");
  const items: NavItem[] = [
    { href: "/panel", label: t("dashboard"), icon: "home" },
    { href: "/panel/consentimientos", label: t("consents"), icon: "doc" },
    { href: "/panel/clientes", label: t("clients"), icon: "users" },
    { href: "/panel/qr", label: t("qr"), icon: "qr" },
    { href: "/panel/cumpleanos", label: t("birthdays"), icon: "gift" },
    { href: "/panel/correos", label: t("emails"), icon: "mail" },
    ...(user.role === "owner"
      ? ([
          { href: "/panel/ajustes", label: t("settings"), icon: "cog" },
          { href: "/panel/equipo", label: t("team"), icon: "team" },
          { href: "/panel/auditoria", label: t("audit"), icon: "shield" },
        ] satisfies NavItem[])
      : []),
  ];
  // El panel lleva la marca común; el color del estudio solo identifica su insignia.
  const studioColor = safeColor(studio.color);
  const initials = studio.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="panel">
      <aside className="side">
        <Producto sub={t("panel")} />
        <div className="brand">
          <div className="dot" style={{ "--studio": studioColor, "--studio-ink": inkFor(studioColor) } as CSSProperties}>
            {studio.logo ? <img src={`/s/${studio.slug}/logo`} alt="" /> : initials}
          </div>
          <div>
            <b>{studio.name}</b>
            <small>{studio.city}</small>
          </div>
        </div>
        <PanelNav items={items} />
        <div className="bottom">
          <p><a href={`/s/${studio.slug}`} target="_blank" rel="noopener">{t("openForm")}</a></p>
          <div className="user">
            <b>{user.name}</b>
            <small>{t(`roles.${user.role}`)} · <a href="/panel/cuenta">{t("account")}</a></small>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <form action={logoutAction}>
                <button className="btn ghost small" style={{ color: "#d9dce3", borderColor: "#2a2c33" }}>{t("logout")}</button>
              </form>
              <LocaleSwitch dark />
            </div>
          </div>
          <SelloCasa />
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
