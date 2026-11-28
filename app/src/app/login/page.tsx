import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@/server/auth";
import { LocaleSwitch } from "@/components/locale-switch";
import { Producto } from "@/components/marca";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Acceso" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await currentUser()) redirect("/panel");
  const t = await getTranslations("login");
  const ta = await getTranslations("account");
  const { cambio } = await searchParams;
  const demo = process.env.NODE_ENV !== "production" || process.env.E2E === "1";
  return (
    <main className="login">
      <div style={{ width: "100%", maxWidth: 400 }}>
        <Producto firma />
        {cambio && <div className="notice ok" role="status">{ta("passwordChanged")}</div>}
        <LoginForm />
        {demo && <div className="demo-hint">{t("demoHint", { email: "marc@agujafina.example", password: "demo1234" })}</div>}
        <div style={{ margin: "14px 0 0", textAlign: "center", display: "flex", justifyContent: "center", gap: 14, alignItems: "center" }}>
          <Link className="muted" href="/">{t("backHome")}</Link>
          <LocaleSwitch />
        </div>
      </div>
    </main>
  );
}
