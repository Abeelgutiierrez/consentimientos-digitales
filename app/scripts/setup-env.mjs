// Crea .env.local a partir de .env.example con claves aleatorias nuevas.
// No sobrescribe un .env.local existente (podrías perder la clave de cifrado).
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, ".env.local");

if (existsSync(target)) {
  console.log(".env.local ya existe: no lo toco.");
  process.exit(0);
}

const key = () => randomBytes(32).toString("base64");
const content = readFileSync(join(root, ".env.example"), "utf8")
  .replace("DATA_ENCRYPTION_KEYS=k1:CAMBIA_ESTO_POR_32_BYTES_EN_BASE64", `DATA_ENCRYPTION_KEYS=k1:${key()}`)
  .replace("BLIND_INDEX_KEY=CAMBIA_ESTO_POR_32_BYTES_EN_BASE64", `BLIND_INDEX_KEY=${key()}`);

writeFileSync(target, content);
console.log("Creado .env.local con claves aleatorias. Guarda una copia segura de las claves.");
