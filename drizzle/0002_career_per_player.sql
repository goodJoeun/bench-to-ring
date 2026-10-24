ALTER TABLE "careers" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "careers" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "careers" ADD COLUMN "career_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "careers" ADD CONSTRAINT "careers_player_career" UNIQUE("player_id","career_id");