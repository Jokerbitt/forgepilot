ALTER TYPE "public"."delegation_status" ADD VALUE 'rejected';--> statement-breakpoint
ALTER TABLE "delegations" ADD COLUMN "context_snapshot" jsonb;