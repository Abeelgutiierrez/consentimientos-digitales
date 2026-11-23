import "server-only";
import { hash, verify } from "@node-rs/argon2";

// argon2id con los parámetros recomendados por OWASP (19 MiB, 2 iteraciones).
const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const MIN_PASSWORD_LENGTH = 10;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTS);
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

// Hash ficticio para igualar tiempos cuando el usuario no existe (evita adivinar correos por tiempo).
let dummy: Promise<string> | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummy ??= hashPassword("contraseña-ficticia-para-igualar-tiempos");
  await verifyPassword(await dummy, password);
}
