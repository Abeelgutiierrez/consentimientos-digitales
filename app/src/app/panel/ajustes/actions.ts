"use server";
import { redirect } from "next/navigation";
import { withUser } from "@/server/auth";
import { SettingsError, setLogo, updateStudioSettings } from "@/server/settings";

export async function saveSettingsAction(f: FormData) {
  const str = (k: string) => String(f.get(k) ?? "");
  let code: string | null = null;
  try {
    await withUser(async (scope) => {
      await updateStudioSettings(scope, {
        name: str("name"), cif: str("cif"), phone: str("phone"), address: str("address"), city: str("city"),
        email: str("email"), color: str("color"), services: f.getAll("services").map(String),
      });
      const file = f.get("logo");
      if (f.get("removeLogo") === "1") await setLogo(scope, null);
      else if (file instanceof File && file.size > 0) await setLogo(scope, new Uint8Array(await file.arrayBuffer()));
    }, { ownerOnly: true });
  } catch (err) {
    if (err instanceof SettingsError) code = err.code;
    else throw err;
  }
  redirect(code ? `/panel/ajustes?error=${code}` : "/panel/ajustes?ok=1");
}
