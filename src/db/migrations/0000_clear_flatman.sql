CREATE TYPE "public"."delegation_status" AS ENUM('pending', 'approved', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."execution_route" AS ENUM('direct-chat', 'local-agent', 'runner', 'ollama-agent', 'n8n', 'manual');--> statement-breakpoint
CREATE TYPE "public"."knowledge_card_type" AS ENUM('learning', 'pattern', 'decision', 'risk', 'reference');--> statement-breakpoint
CREATE TYPE "public"."project_brief_status" AS ENUM('draft', 'in_review', 'research', 'accepted', 'archived');--> statement-breakpoint
CREATE TYPE "public"."risk_class" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TABLE "delegations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"status" "delegation_status" DEFAULT 'pending' NOT NULL,
	"risk_class" "risk_class" DEFAULT 'B' NOT NULL,
	"execution_route" "execution_route" DEFAULT 'manual' NOT NULL,
	"contract" jsonb NOT NULL,
	"summary_report" jsonb,
	"logs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cost_estimate_usd" real DEFAULT 0 NOT NULL,
	"actual_cost_usd" real,
	"trace_id" text,
	"agent_run_id" text,
	"pr_url" text,
	"error_message" text,
	"failure_feedback" text,
	"note" text,
	"auto_orchestrate" boolean DEFAULT false NOT NULL,
	"priority" integer,
	"brief_id" text,
	"critic_score" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_cards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" "knowledge_card_type" DEFAULT 'learning' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"source" text,
	"delegation_id" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" real DEFAULT 0.8 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_briefs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"status" "project_brief_status" DEFAULT 'draft' NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "delegations_status_idx" ON "delegations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "delegations_brief_id_idx" ON "delegations" USING btree ("brief_id");--> statement-breakpoint
CREATE INDEX "delegations_created_at_idx" ON "delegations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "knowledge_cards_type_idx" ON "knowledge_cards" USING btree ("type");--> statement-breakpoint
CREATE INDEX "knowledge_cards_delegation_idx" ON "knowledge_cards" USING btree ("delegation_id");--> statement-breakpoint
CREATE INDEX "knowledge_cards_created_at_idx" ON "knowledge_cards" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "project_briefs_status_idx" ON "project_briefs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_briefs_created_at_idx" ON "project_briefs" USING btree ("created_at");