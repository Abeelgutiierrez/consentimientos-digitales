// Tareas programadas. En producción, ejecutar a diario con cron (p. ej. a las 9:00, hora de Madrid):
//   npm run jobs
// En local o en un único servidor también puede ejecutarlas el propio Next con JOBS_IN_PROCESS=1.
import { runJobs } from "@/server/jobs";

runJobs()
  .then((r) => { console.log(`Tareas completadas: ${r.birthdays} felicitación(es) enviada(s).`); process.exit(0); })
  .catch((err) => { console.error(err); process.exit(1); });
