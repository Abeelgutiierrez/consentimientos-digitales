import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ConsentRows } from "@/components/panel-bits";
import { Topbar } from "@/components/topbar";
import { withUser } from "@/server/auth";
import { listConsents } from "@/server/consents";
import { CheckCopyForm } from "./check-copy";

export const metadata: Metadata = { title: "Consentimientos" };

export default async function ConsentsPage({ searchParams }: PageProps<"/panel/consentimientos">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const items = await withUser((scope) => listConsents(scope, { q }));
  const t = await getTranslations("consents");
  const tc = await getTranslations("common");
  return (
    <>
      <Topbar title={t("title")} sub={t("results", { n: items.length })} />
      <div className="card">
        <form className="search" method="get" action="/panel/consentimientos" role="search">
          <input type="search" name="q" defaultValue={q} placeholder={t("searchPh")} aria-label={t("searchPh")} />
          <button className="btn ghost">{tc("search")}</button>
          {q && <Link className="btn ghost" href="/panel/consentimientos">{tc("clear")}</Link>}
        </form>
        <ConsentRows items={items} />
      </div>
      <div className="card">
        <h2>{t("checkCopy")}</h2>
        <p className="muted" style={{ fontSize: ".88rem" }}>{t("checkCopyHint")}</p>
        <CheckCopyForm />
      </div>
    </>
  );
}
