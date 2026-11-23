import { withUser } from "@/server/auth";
import { birthdayEmail } from "@/server/email";
import { getStudio } from "@/server/studios";

// Vista previa del correo con un nombre ficticio (no usa datos de clientes reales).
export async function GET() {
  const html = await withUser(async (scope) => birthdayEmail(await getStudio(scope), { firstName: "Laura" }, { unsubscribeUrl: "#" }).html);
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      // El HTML del correo no necesita ejecutar nada: lo bloqueamos igualmente.
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
    },
  });
}
