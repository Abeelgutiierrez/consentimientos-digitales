import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { fmtDateTime } from "@/core/dates";
import { Flash } from "@/components/flash";
import { Topbar } from "@/components/topbar";
import { withUser } from "@/server/auth";
import { listTeam } from "@/server/team";
import { addArtistAction, createUserAction, resetPasswordAction, setArtistActiveAction, updateUserAction } from "./actions";

export const metadata: Metadata = { title: "Equipo" };

export default async function TeamPage({ searchParams }: PageProps<"/panel/equipo">) {
  const { users, artists, me } = await withUser(async (scope, user) => ({ ...(await listTeam(scope)), me: user.id }), { ownerOnly: true });
  const t = await getTranslations("team");
  const tn = await getTranslations("nav");
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const errorKeys = ["name", "email", "emailTaken", "passwordShort", "selfDemote", "lastOwner", "currentPassword", "forbidden"];

  return (
    <>
      <Topbar title={t("title")} sub={t("sub")} />
      {error && <div className="notice bad" role="alert">{t(`errors.${errorKeys.includes(error) ? error : "forbidden"}`)}</div>}
      <div className="cols">
        <div>
          <div className="card">
            <h2>{t("users")}</h2>
            <div className="rows">
                  {users.map((u) => (
                    <div className="row-item" key={u.id}>
                      <div>
                        <b>{u.name}</b> {u.id === me && <span className="badge accent">{t("you")}</span>}
                        {!u.active && <span className="badge bad">{t("inactive")}</span>}
                        <div className="meta">{u.email} · {tn(`roles.${u.role}`)} · {t("lastLogin")}: {u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : t("never")}</div>
                      </div>
                        {u.id !== me && (
                          <div className="table-actions">
                            <form action={updateUserAction}>
                              <input type="hidden" name="userId" value={u.id} />
                              <input type="hidden" name="role" value={u.role === "owner" ? "artist" : "owner"} />
                              <button className="btn ghost small">{u.role === "owner" ? t("makeArtist") : t("makeOwner")}</button>
                            </form>
                            <form action={updateUserAction}>
                              <input type="hidden" name="userId" value={u.id} />
                              <input type="hidden" name="active" value={u.active ? "0" : "1"} />
                              <button className={`btn small ${u.active ? "ghost" : ""}`}>{u.active ? t("deactivate") : t("activate")}</button>
                            </form>
                            <form action={resetPasswordAction} style={{ display: "flex", gap: 6 }}>
                              <input type="hidden" name="userId" value={u.id} />
                              <input type="password" name="password" placeholder={t("resetPassword")} minLength={10} required autoComplete="new-password" aria-label={`${t("resetPassword")} · ${u.name}`} />
                              <button className="btn ghost small">{t("setPassword")}</button>
                            </form>
                          </div>
                        )}
                    </div>
                  ))}
            </div>
          </div>
          <div className="card">
            <h2>{t("artists")}</h2>
            <p className="muted" style={{ fontSize: ".88rem" }}>{t("artistsHint")}</p>
            <table className="list">
              <tbody>
                {artists.map((a) => (
                  <tr key={a.id}>
                    <td><b>{a.name}</b> {a.userId && <span className="badge">{t("linked")}</span>} {!a.active && <span className="badge warn">{t("hidden")}</span>}</td>
                    <td style={{ textAlign: "right" }}>
                      <form action={setArtistActiveAction}>
                        <input type="hidden" name="artistId" value={a.id} />
                        <input type="hidden" name="active" value={a.active ? "0" : "1"} />
                        <button className="btn ghost small">{a.active ? t("hide") : t("show")}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <form action={addArtistAction} className="search" style={{ marginTop: 14 }}>
              <input type="text" name="name" placeholder={t("artistName")} required maxLength={80} aria-label={t("artistName")} />
              <button className="btn ghost">{t("add")}</button>
            </form>
          </div>
        </div>
        <form className="card" action={createUserAction}>
          <h2>{t("addUser")}</h2>
          <p className="muted" style={{ fontSize: ".88rem" }}>{t("addUserHint")}</p>
          <label className="field"><span>{t("name")}</span><input type="text" name="name" required maxLength={80} /></label>
          <label className="field"><span>{t("email")}</span><input type="email" name="email" required maxLength={160} /></label>
          <label className="field"><span>{t("role")}</span>
            <select name="role" defaultValue="artist"><option value="artist">{tn("roles.artist")}</option><option value="owner">{tn("roles.owner")}</option></select>
          </label>
          <label className="field"><span>{t("password")}</span><input type="password" name="password" required minLength={10} autoComplete="new-password" /></label>
          <label className="check"><input type="checkbox" name="isArtist" defaultChecked /><div>{t("isArtist")}</div></label>
          <button className="btn block">{t("create")}</button>
        </form>
      </div>
      {ok && <Flash text={ok === "created" ? t("created") : t("updated")} />}
    </>
  );
}
