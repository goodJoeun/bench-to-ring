DROP INDEX "careers_rank";--> statement-breakpoint
DROP INDEX "careers_pos_rank";--> statement-breakpoint
ALTER TABLE "careers" ADD COLUMN "score" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "careers_score" ON "careers" USING btree ("ruleset","score" DESC NULLS LAST,"mvp" DESC NULLS LAST,"peak" DESC NULLS LAST,"pts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "careers_pos_score" ON "careers" USING btree ("ruleset","pos","score" DESC NULLS LAST,"mvp" DESC NULLS LAST,"peak" DESC NULLS LAST,"pts" DESC NULLS LAST);