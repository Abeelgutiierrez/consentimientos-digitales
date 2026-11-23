import { getTranslations } from "next-intl/server";
import { Topbar } from "@/components/topbar";
import { withUser } from "@/server/auth";
import { getStudio } from "@/server/studios";

export default async function DashboardPage({ searchParams }: PageProps<"/panel">) {
  const studio = await withUser((scope) => getStudio(scope));
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");
  const { prohibido } = await searchParams;
  return (
    <>
      {prohibido && <div className="notice warn" role="alert">{tc("forbidden")}</div>}
      <Topbar title={t("hello", { name: studio.name })} sub={t("sub")} />
    </>
  );
}
