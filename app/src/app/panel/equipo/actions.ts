"use server";
import { redirect } from "next/navigation";
import { withUser } from "@/server/auth";
import { type Scope } from "@/server/tenant";
import { TeamError, addArtist, createUser, resetPassword, setArtistActive, updateUser } from "@/server/team";

// Todas las acciones del equipo exigen ser dueño/a (withUser({ ownerOnly })) y lo vuelven a
// comprobar en el servicio (assertOwner). Los errores vuelven como ?error=<clave>.
async function run(fn: (scope: Scope) => Promise<unknown>, ok: string) {
  let code: string | null = null;
  try {
    await withUser((scope) => fn(scope), { ownerOnly: true });
  } catch (err) {
    if (err instanceof TeamError) code = err.code;
    else throw err;
  }
  redirect(code ? `/panel/equipo?error=${code}` : `/panel/equipo?ok=${ok}`);
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function createUserAction(f: FormData) {
  await run((s) => createUser(s, { name: str(f, "name"), email: str(f, "email"), role: str(f, "role"), password: str(f, "password"), isArtist: f.get("isArtist") === "on" }), "created");
}

export async function updateUserAction(f: FormData) {
  const patch: { role?: string; active?: boolean } = {};
  if (f.has("role")) patch.role = str(f, "role");
  if (f.has("active")) patch.active = str(f, "active") === "1";
  await run((s) => updateUser(s, str(f, "userId"), patch), "updated");
}

export async function resetPasswordAction(f: FormData) {
  await run((s) => resetPassword(s, str(f, "userId"), str(f, "password")), "updated");
}

export async function addArtistAction(f: FormData) {
  await run((s) => addArtist(s, str(f, "name")), "updated");
}

export async function setArtistActiveAction(f: FormData) {
  await run((s) => setArtistActive(s, str(f, "artistId"), str(f, "active") === "1"), "updated");
}
