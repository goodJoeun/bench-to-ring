CREATE TABLE "careers" (
	"id" text PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"ruleset" integer NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"imported" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"num" integer NOT NULL,
	"pos" text NOT NULL,
	"mvp" integer NOT NULL,
	"peak" integer NOT NULL,
	"personal" integer NOT NULL,
	"pts" integer NOT NULL,
	"reb" integer NOT NULL,
	"ast" integer NOT NULL,
	"rings" integer NOT NULL,
	"seasons" integer NOT NULL,
	"ret_age" integer NOT NULL,
	"legacy" text NOT NULL,
	"summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "careers_pos_check" CHECK ("careers"."pos" in ('PG','SG','SF','PF','C'))
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"nickname" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "careers" ADD CONSTRAINT "careers_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "careers_rank" ON "careers" USING btree ("ruleset","verified","mvp" DESC NULLS LAST,"peak" DESC NULLS LAST,"personal" DESC NULLS LAST,"pts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "careers_pos_rank" ON "careers" USING btree ("ruleset","verified","pos","mvp" DESC NULLS LAST,"peak" DESC NULLS LAST,"personal" DESC NULLS LAST,"pts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "careers_player" ON "careers" USING btree ("player_id","created_at" DESC NULLS LAST);