CREATE TABLE "programmes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_sha256" text NOT NULL,
	"source_file_url" text NOT NULL,
	"source_format" text DEFAULT 'pdf' NOT NULL,
	"source_tool_detected" text,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"detected_columns" jsonb,
	"raw_rows" jsonb,
	"extraction_error" text,
	"uploaded_by" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"extracted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "programmes" ADD CONSTRAINT "programmes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programmes" ADD CONSTRAINT "programmes_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "programmes_project_idx" ON "programmes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "programmes_sha_idx" ON "programmes" USING btree ("file_sha256");