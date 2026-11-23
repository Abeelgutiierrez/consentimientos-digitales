"use server";
import { redirect } from "next/navigation";
import { withUser } from "@/server/auth";
import { EmailError, sendBirthday } from "@/server/email";
import { publicBaseUrl } from "@/server/public-url";
import { updateBirthdaySettings } from "@/server/settings";
import { getStudio } from "@/server/studios";

export async function saveBirthdayAction(f: FormData) {
  await withUser(async (scope) => {
    const studio = await getStudio(scope);
    await updateBirthdaySettings(scope, {
      enabled: f.get("enabled") === "on", discount: f.get("discount"), validDays: f.get("validDays"),
      subject: String(f.get("subject") ?? ""), body: String(f.get("body") ?? ""),
    }, studio.birthday);
  }, { ownerOnly: true });
  redirect("/panel/cumpleanos?ok=guardado");
}

/** Envía la felicitación ahora (para enseñarla o si falló la automática). Solo dueño/a. */
export async function simulateBirthdayAction(clientId: string, back: string) {
  const base = (await publicBaseUrl()).url;
  let result: { id: string } | null = null;
  let code: string | null = null;
  try {
    result = await withUser((scope) => sendBirthday(scope, clientId, { manual: true, baseUrl: base }), { ownerOnly: true });
  } catch (err) {
    if (err instanceof EmailError) code = err.code;
    else throw err;
  }
  const safeBack = back === "cliente" ? `/panel/clientes/${clientId}` : "/panel/cumpleanos";
  redirect(result ? `/panel/correos/${result.id}?ok=enviado` : `${safeBack}?error=${code}`);
}
