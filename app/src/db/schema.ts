// Esquema de la base de datos.
//
// Multi-tenant: todas las tablas con datos de un estudio llevan `studio_id` y tienen
// Row-Level Security (ver drizzle/0001_rls.sql). Las columnas *_enc van cifradas con
// AES-256-GCM a nivel de aplicación (src/server/crypto.ts).
import { sql } from "drizzle-orm";
import {
  bigserial, boolean, customType, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export interface BirthdaySettings {
  enabled: boolean;
  discount: number;
  validDays: number;
  subject: string;
  body: string;
}

export const studios = pgTable("studios", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  cif: text("cif").notNull().default(""),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),
  email: text("email").notNull().default(""),
  color: text("color").notNull().default("#111111"),
  logo: bytea("logo"),
  logoMime: text("logo_mime"),
  services: text("services").array().notNull().default(sql`'{}'::text[]`),
  defaultLocale: text("default_locale").notNull().default("es"),
  // Conservación: años desde la firma. null = pendiente de definir con el asesor (no se purga nada).
  retentionYears: integer("retention_years"),
  retentionNote: text("retention_note").notNull().default(""),
  birthday: jsonb("birthday").$type<BirthdaySettings>().notNull(),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  studioId: text("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["owner", "artist"] }).notNull(),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  locale: text("locale").notNull().default("es"),
  createdAt: createdAt(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("users_email_unique").on(sql`lower(${t.email})`),
  index("users_studio_idx").on(t.studioId),
]);

export const sessions = pgTable("sessions", {
  // Hash SHA-256 del token de la cookie: si se filtra la tabla, no sirve para entrar.
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  studioId: text("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  ip: text("ip").notNull().default(""),
  userAgent: text("user_agent").notNull().default(""),
});

export const loginAttempts = pgTable("login_attempts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  // Hash de (email | ip): no se guarda el correo en claro.
  keyHash: text("key_hash").notNull(),
  createdAt: createdAt(),
}, (t) => [index("login_attempts_key_idx").on(t.keyHash, t.createdAt)]);

export const artists = pgTable("artists", {
  id: text("id").primaryKey(),
  studioId: text("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  createdAt: createdAt(),
}, (t) => [index("artists_studio_idx").on(t.studioId)]);

export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  studioId: text("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dniEnc: bytea("dni_enc").notNull(),
  dniHash: text("dni_hash").notNull(),
  birthDate: date("birth_date").notNull(),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""),
  marketing: boolean("marketing").notNull().default(false),
  marketingAt: timestamp("marketing_at", { withTimezone: true }),
  unsubscribeTokenHash: text("unsubscribe_token_hash"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("clients_studio_dni_unique").on(t.studioId, t.dniHash),
  uniqueIndex("clients_unsubscribe_unique").on(t.unsubscribeTokenHash),
]);

export const marketingEvents = pgTable("marketing_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  studioId: text("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  granted: boolean("granted").notNull(),
  source: text("source", { enum: ["consentimiento", "baja", "panel"] }).notNull(),
  consentId: text("consent_id"),
  createdAt: createdAt(),
}, (t) => [index("marketing_events_client_idx").on(t.studioId, t.clientId)]);

export const consents = pgTable("consents", {
  id: text("id").primaryKey(),
  studioId: text("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "restrict" }),
  artistId: text("artist_id").references(() => artists.id, { onDelete: "set null" }),
  // Copias en claro solo de lo necesario para listar y buscar (sin datos de salud).
  service: text("service").notNull(),
  zone: text("zone").notNull(),
  artistName: text("artist_name").notNull(),
  isMinor: boolean("is_minor").notNull(),
  locale: text("locale").notNull(),
  consentVersion: text("consent_version").notNull(),
  signedAt: timestamp("signed_at", { withTimezone: true }).notNull(),
  // Evidencias: inmutables (el rol de la app no tiene permiso de UPDATE sobre estas columnas).
  signedPayloadEnc: bytea("signed_payload_enc").notNull(),
  signHash: text("sign_hash").notNull(),
  ip: text("ip").notNull().default(""),
  userAgent: text("user_agent").notNull().default(""),
  // Resumen cifrado para el listado ({ healthYes: n }) sin descifrar todo lo firmado.
  flagsEnc: bytea("flags_enc").notNull(),
  publicTokenHash: text("public_token_hash").notNull(),
  publicTokenExpiresAt: timestamp("public_token_expires_at", { withTimezone: true }).notNull(),
  // Mutables
  pdfVersion: integer("pdf_version").notNull().default(0),
  annexVersion: integer("annex_version").notNull().default(0),
  purgeAfter: date("purge_after"),
  createdAt: createdAt(),
}, (t) => [
  index("consents_studio_signed_idx").on(t.studioId, t.signedAt),
  index("consents_client_idx").on(t.studioId, t.clientId),
  uniqueIndex("consents_public_token_unique").on(t.publicTokenHash),
]);

export interface InkRow {
  brand: string;
  color: string;
  lot: string;
  expiry: string;
  aemps: string;
}

export const consentAnnexes = pgTable("consent_annexes", {
  id: text("id").primaryKey(),
  studioId: text("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  consentId: text("consent_id").notNull().references(() => consents.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  inks: jsonb("inks").$type<InkRow[]>().notNull(),
  needles: text("needles").notNull().default(""),
  notes: text("notes").notNull().default(""),
  applicator: text("applicator").notNull().default(""),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("consent_annexes_version_unique").on(t.consentId, t.version)]);

export const consentPdfs = pgTable("consent_pdfs", {
  id: text("id").primaryKey(),
  studioId: text("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  consentId: text("consent_id").notNull().references(() => consents.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  reason: text("reason", { enum: ["firma", "anexo"] }).notNull(),
  sha256: text("sha256").notNull(),
  size: integer("size").notNull(),
  bytesEnc: bytea("bytes_enc").notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("consent_pdfs_version_unique").on(t.consentId, t.version)]);

export const auditEvents = pgTable("audit_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  studioId: text("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  actorType: text("actor_type", { enum: ["user", "client", "system"] }).notNull(),
  actorUserId: text("actor_user_id"),
  actorName: text("actor_name").notNull().default(""),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  ip: text("ip").notNull().default(""),
  userAgent: text("user_agent").notNull().default(""),
  // Sin datos personales: solo detalles técnicos (versión del PDF, resultado…).
  meta: jsonb("meta").$type<Record<string, string | number | boolean>>().notNull().default({}),
  createdAt: createdAt(),
}, (t) => [
  index("audit_studio_created_idx").on(t.studioId, t.createdAt),
  index("audit_entity_idx").on(t.studioId, t.entityType, t.entityId),
]);

export const emails = pgTable("emails", {
  id: text("id").primaryKey(),
  studioId: text("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
  kind: text("kind", { enum: ["cumpleanos"] }).notNull(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  code: text("code").notNull().default(""),
  validUntil: date("valid_until"),
  status: text("status", { enum: ["simulado", "enviado", "error"] }).notNull(),
  error: text("error").notNull().default(""),
  manual: boolean("manual").notNull().default(false),
  year: integer("year").notNull(),
  createdAt: createdAt(),
}, (t) => [index("emails_studio_created_idx").on(t.studioId, t.createdAt)]);
