CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"programme_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"external_id" text,
	"wbs_path" text,
	"name" text NOT NULL,
	"description" text,
	"start_date" date,
	"finish_date" date,
	"start_is_actual" boolean DEFAULT false NOT NULL,
	"finish_is_actual" boolean DEFAULT false NOT NULL,
	"start_is_constrained" boolean DEFAULT false NOT NULL,
	"finish_is_constrained" boolean DEFAULT false NOT NULL,
	"remaining_duration_days" integer,
	"total_float_days" integer,
	"predecessor_ids" jsonb,
	"resource" text,
	"by_others" boolean DEFAULT false NOT NULL,
	"category_3" boolean DEFAULT false NOT NULL,
	"activity_type" text DEFAULT 'task' NOT NULL,
	"raw_json" jsonb,
	"order_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "programmes" ADD COLUMN "activities_committed_at" timestamp;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_programme_id_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_programme_idx" ON "activities" USING btree ("programme_id");--> statement-breakpoint
CREATE INDEX "activities_project_idx" ON "activities" USING btree ("project_id");