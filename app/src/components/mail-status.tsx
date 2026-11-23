import { getTranslations } from "next-intl/server";

export async function MailStatus({ status }: { status: "simulado" | "enviado" | "error" }) {
  const t = await getTranslations("emails.statuses");
  return <span className={`badge ${status === "enviado" ? "ok" : status === "error" ? "bad" : ""}`}>{t(status)}</span>;
}
