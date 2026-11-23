// Normaliza texto para buscar: sin acentos y en minúsculas («Núria» → «nuria»).
// Equivale a la función SQL norm_txt() (drizzle/0002_busqueda.sql) para los caracteres habituales.
export function normText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/·/g, ".").toLowerCase().trim();
}

/** Escapa los comodines de LIKE para que «%» o «_» del usuario se busquen literalmente. */
export function likePattern(s: string): string {
  return `%${normText(s).replace(/[\%_]/g, (c) => "\\" + c)}%`;
}
