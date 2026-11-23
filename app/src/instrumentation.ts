// Al arrancar el servidor: si JOBS_IN_PROCESS=1, ejecuta las tareas al inicio y cada hora
// (como hacía la demo). Con varios servidores, mejor un cron externo con `npm run jobs`.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.JOBS_IN_PROCESS !== "1") return;
  const { runJobs } = await import("./server/jobs");
  const run = () => runJobs().catch((err) => console.error("Error en tareas programadas", err));
  setTimeout(run, 5_000);
  setInterval(run, 3600_000).unref();
}
