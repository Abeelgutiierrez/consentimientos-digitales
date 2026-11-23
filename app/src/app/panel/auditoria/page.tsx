import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { fmtDateTime } from "@/core/dates";
import { Topbar } from "@/components/topbar";
import { withUser } from "@/server/auth";
import { listAudit } from "@/server/gdpr";
import { listTeam } from "@/server/team";

export const metadata: Metadata = { title: "Auditoría" };

const GROUPS = ["consent", "client", "email", "studio", "user"] as const;
const ENTITY_LINK: Record<string, (id: string) => string> = {
  consent: (id) => `/panel/consentimientos/${id}`,
  client: (id) => `/panel/clientes/${id}`,
  email: (id) => `/panel/correos/${id}`,
};

export default async function AuditPage({ searchParams }: PageProps<"/panel/auditoria">) {
  const sp = await searchParams;
  const action = typeof sp.accion === "string" && (GROUPS as readonly string[]).includes(sp.accion) ? sp.accion : "";
  const userId = typeof sp.usuario === "string" ? sp.usuario.slice(0, 40) : "";
  const page = Math.max(0, Number(sp.p) || 0);
  const { audit, team } = await withUser(async (scope) => ({
    audit: await listAudit(scope, { action: action ? `${action}.` : undefined, userId: userId || undefined, page }),
    team: await listTeam(scope),
  }), { ownerOnly: true });
  const t = await getTranslations("auditPage");
  const ta = await getTranslations("audit.actions");
  const qs = (p: number) => `/panel/auditoria?${new URLSearchParams({ ...(action ? { accion: action } : {}), ...(userId ? { usuario: userId } : {}), p: String(p) })}`;
  return (
    <>
      <Topbar title={t("title")} sub={t("sub")} />
      <div className="card">
        <form className="search" method="get" action="/panel/auditoria" style={{ flexWrap: "wrap" }}>
          <select name="accion" defaultValue={action} aria-label={t("filterAction")} style={{ maxWidth: 220 }}>
            <option value="">{t("filterAction")}: {t("all")}</option>
            {GROUPS.map((g) => <option key={g} value={g}>{t(`groups.${g}`)}</option>)}
          </select>
          <select name="usuario" defaultValue={userId} aria-label={t("filterUser")} style={{ maxWidth: 220 }}>
            <option value="">{t("filterUser")}: {t("allUsers")}</option>
            {team.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button className="btn ghost">{t("filter")}</button>
        </form>
        {audit.rows.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="list" data-testid="audit-table">
              <thead><tr><th>{t("when")}</th><th>{t("who")}</th><th>{t("what")}</th><th>{t("on")}</th><th>{t("from")}</th></tr></thead>
              <tbody>
                {audit.rows.map((e) => {
                  const link = ENTITY_LINK[e.entityType];
                  const deleted = e.action === "consent.purged" || e.action === "client.deleted";
                  return (
                    <tr key={e.id}>
                      <td><small>{fmtDateTime(e.createdAt)}</small></td>
                      <td>{e.actorName}</td>
                      <td>{ta(e.action.replace(".", "_") as never)}</td>
                      <td><small className="mono">{link && !deleted ? <Link href={link(e.entityId)}>{e.entityId}</Link> : e.entityId}{deleted ? ` (${t("deleted")})` : ""}</small></td>
                      <td><small className="muted">{e.ip || "—"}</small></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">{t("empty")}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
          {page > 0 ? <Link className="btn ghost small" href={qs(page - 1)}>{t("newer")}</Link> : <span />}
          {audit.hasMore ? <Link className="btn ghost small" href={qs(page + 1)}>{t("older")}</Link> : <span />}
        </div>
      </div>
    </>
  );
}
