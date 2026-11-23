CREATE TABLE "artists" (
	"id" text PRIMARY KEY NOT NULL,
	"studio_id" text NOT NULL,
	"name" text NOT NULL,
	"user_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"studio_id" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_user_id" text,
	"actor_name" text DEFAULT '' NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"ip" text DEFAULT '' NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"studio_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"dni_enc" "bytea" NOT NULL,
	"dni_hash" text NOT NULL,
	"birth_date" date NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"marketing" boolean DEFAULT false NOT NULL,
	"marketing_at" timestamp with time zone,
	"unsubscribe_token_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_annexes" (
	"id" text PRIMARY KEY NOT NULL,
	"studio_id" text NOT NULL,
	"consent_id" text NOT NULL,
	"version" integer NOT NULL,
	"inks" jsonb NOT NULL,
	"needles" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"applicator" text DEFAULT '' NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_pdfs" (
	"id" text PRIMARY KEY NOT NULL,
	"studio_id" text NOT NULL,
	"consent_id" text NOT NULL,
	"version" integer NOT NULL,
	"reason" text NOT NULL,
	"sha256" text NOT NULL,
	"size" integer NOT NULL,
	"bytes_enc" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" text PRIMARY KEY NOT NULL,
	"studio_id" text NOT NULL,
	"client_id" text NOT NULL,
	"artist_id" text,
	"service" text NOT NULL,
	"zone" text NOT NULL,
	"artist_name" text NOT NULL,
	"is_minor" boolean NOT NULL,
	"locale" text NOT NULL,
	"consent_version" text NOT NULL,
	"signed_at" timestamp with time zone NOT NULL,
	"signed_payload_enc" "bytea" NOT NULL,
	"sign_hash" text NOT NULL,
	"ip" text DEFAULT '' NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	"flags_enc" "bytea" NOT NULL,
	"public_token_hash" text NOT NULL,
	"public_token_expires_at" timestamp with time zone NOT NULL,
	"pdf_version" integer DEFAULT 0 NOT NULL,
	"annex_version" integer DEFAULT 0 NOT NULL,
	"purge_after" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" text PRIMARY KEY NOT NULL,
	"studio_id" text NOT NULL,
	"client_id" text,
	"kind" text NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"html" text NOT NULL,
	"code" text DEFAULT '' NOT NULL,
	"valid_until" date,
	"status" text NOT NULL,
	"error" text DEFAULT '' NOT NULL,
	"manual" boolean DEFAULT false NOT NULL,
	"year" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"studio_id" text NOT NULL,
	"client_id" text NOT NULL,
	"granted" boolean NOT NULL,
	"source" text NOT NULL,
	"consent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"studio_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text DEFAULT '' NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studios" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"cif" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"color" text DEFAULT '#111111' NOT NULL,
	"logo" "bytea",
	"logo_mime" text,
	"services" text[] DEFAULT '{}'::text[] NOT NULL,
	"default_locale" text DEFAULT 'es' NOT NULL,
	"retention_years" integer,
	"retention_note" text DEFAULT '' NOT NULL,
	"birthday" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "studios_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"studio_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"password_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"locale" text DEFAULT 'es' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "artists" ADD CONSTRAINT "artists_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artists" ADD CONSTRAINT "artists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_annexes" ADD CONSTRAINT "consent_annexes_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_annexes" ADD CONSTRAINT "consent_annexes_consent_id_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."consents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_annexes" ADD CONSTRAINT "consent_annexes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_pdfs" ADD CONSTRAINT "consent_pdfs_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_pdfs" ADD CONSTRAINT "consent_pdfs_consent_id_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."consents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_events" ADD CONSTRAINT "marketing_events_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_events" ADD CONSTRAINT "marketing_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artists_studio_idx" ON "artists" USING btree ("studio_id");--> statement-breakpoint
CREATE INDEX "audit_studio_created_idx" ON "audit_events" USING btree ("studio_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_events" USING btree ("studio_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_studio_dni_unique" ON "clients" USING btree ("studio_id","dni_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_unsubscribe_unique" ON "clients" USING btree ("unsubscribe_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "consent_annexes_version_unique" ON "consent_annexes" USING btree ("consent_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "consent_pdfs_version_unique" ON "consent_pdfs" USING btree ("consent_id","version");--> statement-breakpoint
CREATE INDEX "consents_studio_signed_idx" ON "consents" USING btree ("studio_id","signed_at");--> statement-breakpoint
CREATE INDEX "consents_client_idx" ON "consents" USING btree ("studio_id","client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "consents_public_token_unique" ON "consents" USING btree ("public_token_hash");--> statement-breakpoint
CREATE INDEX "emails_studio_created_idx" ON "emails" USING btree ("studio_id","created_at");--> statement-breakpoint
CREATE INDEX "login_attempts_key_idx" ON "login_attempts" USING btree ("key_hash","created_at");--> statement-breakpoint
CREATE INDEX "marketing_events_client_idx" ON "marketing_events" USING btree ("studio_id","client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_studio_idx" ON "users" USING btree ("studio_id");