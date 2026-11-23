"use server";
import { redirect } from "next/navigation";
import { withUser } from "@/server/auth";
import { type AnnexInput, findPdfByHash, saveAnnex } from "@/server/consents";

/** Busca una versión de PDF del estudio por su huella (el archivo nunca sale del navegador). */
export async function checkCopyAction(hash: string): Promise<{ consentId: string; version: number } | null> {
  if (!/^[0-9a-f]{64}$/i.test(hash)) return null;
  return withUser(async (scope) => {
    const found = await findPdfByHash(scope, hash);
    return found ? { consentId: found.consentId, version: found.version } : null;
  });
}

/** Guarda el anexo (tintas, agujas, observaciones) y regenera el PDF. */
export async function saveAnnexAction(consentId: string, form: FormData) {
  const all = (k: string) => form.getAll(k).map(String);
  const brands = all("brand");
  const input: Partial<AnnexInput> = {
    inks: brands.map((_, i) => ({
      brand: brands[i] ?? "", color: all("color")[i] ?? "", lot: all("lot")[i] ?? "",
      expiry: all("expiry")[i] ?? "", aemps: all("aemps")[i] ?? "",
    })),
    needles: String(form.get("needles") ?? ""),
    notes: String(form.get("notes") ?? ""),
    applicator: String(form.get("applicator") ?? ""),
  };
  await withUser((scope) => saveAnnex(scope, consentId, input));
  redirect(`/panel/consentimientos/${consentId}?ok=anexo`);
}
