CREATE TYPE "public"."todo_priority" AS ENUM('low', 'medium', 'high');
--> statement-breakpoint
CREATE TYPE "public"."todo_status" AS ENUM('open', 'in_progress', 'done');
--> statement-breakpoint
CREATE TABLE "todo_items" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "priority" "todo_priority" DEFAULT 'medium' NOT NULL,
  "status" "todo_status" DEFAULT 'open' NOT NULL,
  "is_sample" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "todo_items_status_idx" ON "todo_items" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "todo_items_created_at_idx" ON "todo_items" USING btree ("created_at");
