// Fechas siempre en hora de Madrid, con independencia de dónde corra el servidor.
export const TIME_ZONE = "Europe/Madrid";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function parts(d: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), hh: p.hour ?? "00", mm: p.minute ?? "00" };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Fecha de hoy (o de `d`) en Madrid como AAAA-MM-DD. */
export function isoDateInMadrid(d: Date = new Date()): string {
  const p = parts(d);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

function parseIsoDate(value: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

/** Edad cumplida en la fecha de referencia (en Madrid). null si la fecha no es válida. */
export function ageOn(birthDate: string, ref: Date = new Date()): number | null {
  const b = parseIsoDate(birthDate);
  if (!b) return null;
  const t = parts(ref);
  let age = t.y - b.y;
  if (t.m < b.m || (t.m === b.m && t.d < b.d)) age--;
  return age;
}

/** Días que faltan para el próximo cumpleaños (0 = hoy). El 29 de febrero se celebra el 28 en años no bisiestos. */
export function daysToBirthday(birthDate: string, ref: Date = new Date()): number | null {
  const b = parseIsoDate(birthDate);
  if (!b) return null;
  const t = parts(ref);
  const today = Date.UTC(t.y, t.m - 1, t.d);
  const at = (year: number) => {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const day = b.m === 2 && b.d === 29 && !leap ? 28 : b.d;
    return Date.UTC(year, b.m - 1, day);
  };
  let next = at(t.y);
  if (next < today) next = at(t.y + 1);
  return Math.round((next - today) / 86_400_000);
}

/** dd/mm/aaaa para fechas (AAAA-MM-DD) o instantes (ISO / Date). */
export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") {
    const b = parseIsoDate(value);
    if (b) return `${pad(b.d)}/${pad(b.m)}/${b.y}`;
  }
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const p = parts(d);
  return `${pad(p.d)}/${pad(p.m)}/${p.y}`;
}

/** dd/mm/aaaa hh:mm en hora de Madrid. */
export function fmtDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const p = parts(d);
  return `${pad(p.d)}/${pad(p.m)}/${p.y} ${p.hh}:${p.mm}`;
}

const MONTHS: Record<string, string[]> = {
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  ca: ["de gener", "de febrer", "de març", "d'abril", "de maig", "de juny", "de juliol", "d'agost", "de setembre", "d'octubre", "de novembre", "de desembre"],
};

/** «5 de marzo de 2027» / «5 de març de 2027». */
export function fmtLongDate(isoDate: string, locale: "es" | "ca" = "es"): string {
  const b = parseIsoDate(isoDate);
  if (!b) return "";
  const month = MONTHS[locale]![b.m - 1]!;
  return locale === "es" ? `${b.d} de ${month} de ${b.y}` : `${b.d} ${month} de ${b.y}`;
}

/** Suma días a una fecha AAAA-MM-DD. */
export function addDays(isoDate: string, days: number): string {
  const b = parseIsoDate(isoDate);
  if (!b) throw new Error("Fecha no válida");
  const d = new Date(Date.UTC(b.y, b.m - 1, b.d + days));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Suma años a una fecha AAAA-MM-DD (el 29 de febrero pasa al 28 en años no bisiestos), como make_interval de Postgres. */
export function addYears(isoDate: string, years: number): string {
  const b = parseIsoDate(isoDate);
  if (!b) throw new Error("Fecha no válida");
  const y = b.y + years;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const day = b.m === 2 && b.d === 29 && !leap ? 28 : b.d;
  return `${y}-${pad(b.m)}-${pad(day)}`;
}
