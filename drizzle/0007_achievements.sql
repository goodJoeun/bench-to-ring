CREATE TABLE "achievement_counts" (
	"achv_id" text PRIMARY KEY NOT NULL,
	"players" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "achievement_counts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "player_achievements" (
	"player_id" uuid NOT NULL,
	"achv_id" text NOT NULL,
	CONSTRAINT "player_achievements_player_id_achv_id_pk" PRIMARY KEY("player_id","achv_id")
);
--> statement-breakpoint
ALTER TABLE "player_achievements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP INDEX "careers_player";--> statement-breakpoint
ALTER TABLE "player_achievements" ADD CONSTRAINT "player_achievements_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- achievement_counts를 player_achievements와 맞춰 둬요. 줄을 넣으면 그 업적의 플레이어 수를 1 올리고, 빼면 1 내려요.
-- 같은 플레이어·업적은 기본키라 한 번만 들어가서 두 번 세지 않아요. achv_id '*'는 업적 목록을 보낸 플레이어 수(달성률의 분모)예요.
CREATE FUNCTION "achievement_counts_sync"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		INSERT INTO "achievement_counts" AS c ("achv_id", "players") VALUES (NEW."achv_id", 1)
		ON CONFLICT ("achv_id") DO UPDATE SET "players" = c."players" + 1;
	ELSIF TG_OP = 'DELETE' THEN
		UPDATE "achievement_counts" SET "players" = "players" - 1 WHERE "achv_id" = OLD."achv_id";
	END IF;
	RETURN NULL;
END
$$;--> statement-breakpoint
CREATE TRIGGER "player_achievements_counts" AFTER INSERT OR DELETE ON "player_achievements"
	FOR EACH ROW EXECUTE FUNCTION "achievement_counts_sync"();
