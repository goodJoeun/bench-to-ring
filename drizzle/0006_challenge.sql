ALTER TABLE "careers" ADD COLUMN "challenge_day" text;--> statement-breakpoint
ALTER TABLE "careers" ADD COLUMN "challenge_pos" text;--> statement-breakpoint
CREATE INDEX "careers_challenge" ON "careers" USING btree ("challenge_day","challenge_pos") WHERE "careers"."challenge_day" is not null;