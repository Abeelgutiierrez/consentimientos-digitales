import { Topbar } from "@/components/topbar";
import { requireUser } from "@/server/auth";

// Provisional: se completa en el siguiente hito.
export default async function Page() {
  await requireUser();
  return <Topbar title="En preparación" sub="Esta sección se completa en el siguiente hito." />;
}
