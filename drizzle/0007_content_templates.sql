CREATE TYPE "public"."input_source" AS ENUM('upload', 'sheet');--> statement-breakpoint
CREATE TYPE "public"."link_inventory_kind" AS ENUM('articles', 'products', 'pages', 'videos', 'directory');--> statement-breakpoint
CREATE TYPE "public"."sheet_target" AS ENUM('topics', 'inventory');--> statement-breakpoint
CREATE TYPE "public"."template_kind" AS ENUM('faq', 'blog', 'page');--> statement-breakpoint
ALTER TYPE "public"."ai_model_role" ADD VALUE 'utility';--> statement-breakpoint
CREATE TABLE "content_template_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"revision_no" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"note" text,
	"edited_by" uuid,
	"edited_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "content_template_revisions_template_rev_uq" UNIQUE("template_id","revision_no")
);
--> statement-breakpoint
CREATE TABLE "content_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" "template_kind" NOT NULL,
	"config" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"revision_no" integer DEFAULT 1 NOT NULL,
	"next_sequence" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "google_credentials" (
	"id" text PRIMARY KEY DEFAULT 'service_account' NOT NULL,
	"client_email" text NOT NULL,
	"key_ciphertext" text NOT NULL,
	"key_iv" text NOT NULL,
	"key_tag" text NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_inventories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" "link_inventory_kind" NOT NULL,
	"source" "input_source" DEFAULT 'upload' NOT NULL,
	"last_synced_at" timestamp,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "link_inventories_tenant_slug_uq" UNIQUE("tenant_id","slug")
);
--> statement-breakpoint
CREATE TABLE "link_inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inventory_id" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"attrs" jsonb,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "link_inventory_items_inventory_url_uq" UNIQUE("inventory_id","url")
);
--> statement-breakpoint
CREATE TABLE "sheet_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"spreadsheet_id" text NOT NULL,
	"tab" text NOT NULL,
	"range" text,
	"header_row" integer DEFAULT 1 NOT NULL,
	"column_map" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"target" "sheet_target" NOT NULL,
	"template_id" uuid,
	"inventory_id" uuid,
	"last_synced_at" timestamp,
	"last_sync_result" jsonb,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor_id" uuid,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "heuristics" ADD COLUMN "content_template_id" uuid;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "template_id" uuid;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "template_inputs" jsonb;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "generation_meta" jsonb;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "source_row_key" text;--> statement-breakpoint
ALTER TABLE "content_template_revisions" ADD CONSTRAINT "content_template_revisions_template_id_content_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."content_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_template_revisions" ADD CONSTRAINT "content_template_revisions_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_templates" ADD CONSTRAINT "content_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_templates" ADD CONSTRAINT "content_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_templates" ADD CONSTRAINT "content_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_credentials" ADD CONSTRAINT "google_credentials_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_inventories" ADD CONSTRAINT "link_inventories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_inventories" ADD CONSTRAINT "link_inventories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_inventory_items" ADD CONSTRAINT "link_inventory_items_inventory_id_link_inventories_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."link_inventories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_sources" ADD CONSTRAINT "sheet_sources_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_sources" ADD CONSTRAINT "sheet_sources_template_id_content_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."content_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_sources" ADD CONSTRAINT "sheet_sources_inventory_id_link_inventories_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."link_inventories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_sources" ADD CONSTRAINT "sheet_sources_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_events" ADD CONSTRAINT "template_events_template_id_content_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."content_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_events" ADD CONSTRAINT "template_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_events" ADD CONSTRAINT "template_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_templates_tenant_slug_uq" ON "content_templates" USING btree ("tenant_id","slug") WHERE "content_templates"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "content_templates_tenant_idx" ON "content_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sheet_sources_tenant_idx" ON "sheet_sources" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "template_events_template_idx" ON "template_events" USING btree ("template_id","created_at");--> statement-breakpoint
ALTER TABLE "heuristics" ADD CONSTRAINT "heuristics_content_template_id_content_templates_id_fk" FOREIGN KEY ("content_template_id") REFERENCES "public"."content_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_template_id_content_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."content_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_tenant_source_row_uq" UNIQUE("tenant_id","source_row_key");