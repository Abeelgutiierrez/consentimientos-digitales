// Los errores de consulta de Drizzle incluyen los valores de los parámetros en el mensaje
// («Failed query: … params: Laura,Puig,…») y Next los imprime en la consola del servidor.
// Para que nunca acaben datos personales en los logs, se ocultan antes de escribirlos.

const PARAMS_RE = /(\bparams:)[\s\S]*$/m;

export function redactText(text: string): string {
  return text.replace(PARAMS_RE, "$1 [oculto]");
}

function redactArg(arg: unknown): unknown {
  if (typeof arg === "string") return redactText(arg);
  if (arg instanceof Error) {
    const copy = new Error(redactText(arg.message));
    copy.name = arg.name;
    copy.stack = arg.stack ? redactText(arg.stack) : undefined;
    const cause = (arg as { cause?: unknown }).cause;
    if (cause instanceof Error) (copy as { cause?: unknown }).cause = redactArg(cause);
    return copy;
  }
  return arg;
}

let installed = false;

export function installErrorRedaction() {
  if (installed) return;
  installed = true;
  for (const level of ["error", "warn", "log"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => original(...args.map(redactArg));
  }
}
