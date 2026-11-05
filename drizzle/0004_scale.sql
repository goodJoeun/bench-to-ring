CREATE TABLE "career_counts" (
	"ruleset" integer NOT NULL,
	"pos" text NOT NULL,
	"careers" integer DEFAULT 0 NOT NULL,
	"nba" integer DEFAULT 0 NOT NULL,
	"nba_mvp" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "career_counts_ruleset_pos_pk" PRIMARY KEY("ruleset","pos")
);
--> statement-breakpoint
CREATE TABLE "career_totals" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"players" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "career_totals_one_row" CHECK ("career_totals"."id" = 1)
);
--> statement-breakpoint
DROP INDEX "careers_score";--> statement-breakpoint
DROP INDEX "careers_pos_score";--> statement-breakpoint
ALTER TABLE "careers" ADD COLUMN "stl" integer;--> statement-breakpoint
ALTER TABLE "careers" ADD COLUMN "blk" integer;--> statement-breakpoint
ALTER TABLE "careers" ADD COLUMN "tpm" integer;--> statement-breakpoint
ALTER TABLE "careers" ADD COLUMN "donated" double precision;--> statement-breakpoint
ALTER TABLE "careers" ADD COLUMN "nba" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "careers" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "careers_rank" ON "careers" USING btree ("score" DESC NULLS LAST,"mvp" DESC NULLS LAST,"peak" DESC NULLS LAST,"pts" DESC NULLS LAST,"created_at");--> statement-breakpoint
CREATE INDEX "careers_pos_rank" ON "careers" USING btree ("pos","score" DESC NULLS LAST,"mvp" DESC NULLS LAST,"peak" DESC NULLS LAST,"pts" DESC NULLS LAST,"created_at");--> statement-breakpoint
CREATE INDEX "careers_created" ON "careers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "careers_pts" ON "careers" USING btree ("pts" DESC NULLS LAST,"created_at");--> statement-breakpoint
CREATE INDEX "careers_reb" ON "careers" USING btree ("reb" DESC NULLS LAST,"created_at");--> statement-breakpoint
CREATE INDEX "careers_ast" ON "careers" USING btree ("ast" DESC NULLS LAST,"created_at");--> statement-breakpoint
CREATE INDEX "careers_stl" ON "careers" USING btree ("stl" DESC NULLS LAST,"created_at") WHERE "careers"."stl" is not null;--> statement-breakpoint
CREATE INDEX "careers_blk" ON "careers" USING btree ("blk" DESC NULLS LAST,"created_at") WHERE "careers"."blk" is not null;--> statement-breakpoint
CREATE INDEX "careers_tpm" ON "careers" USING btree ("tpm" DESC NULLS LAST,"created_at") WHERE "careers"."tpm" is not null;--> statement-breakpoint
CREATE INDEX "careers_donated" ON "careers" USING btree ("donated" DESC NULLS LAST,"created_at") WHERE "careers"."donated" is not null;--> statement-breakpoint
-- 예전 기록 채우기. 스틸·블록·3점슛·기부금은 은퇴 요약에서, NBA 진출은 NBA 팀에서 뛰어 봤는지(playedNba)로 봐요.
-- 팀 이름은 src/game/world/leagues.ts의 TEAMS.nba예요. 계산이 바뀌면 npm run db:rescore로 다시 맞춰요.
UPDATE "careers" SET
	"stl" = ("summary"->>'stl')::int,
	"blk" = ("summary"->>'blk')::int,
	"tpm" = ("summary"->>'tpm')::int,
	"donated" = nullif(("summary"->>'donated')::float8, 0),
	"nba" = "summary"->'teams' ?| array['애틀랜타 호크스', '보스턴 셀틱스', '브루클린 네츠', '샬럿 호네츠', '시카고 불스', '클리블랜드 캐벌리어스', '댈러스 매버릭스', '덴버 너기츠', '디트로이트 피스톤스', '골든스테이트 워리어스', '휴스턴 로키츠', '인디애나 페이서스', 'LA 클리퍼스', 'LA 레이커스', '멤피스 그리즐리스', '마이애미 히트', '밀워키 벅스', '미네소타 팀버울브스', '뉴올리언스 펠리컨스', '뉴욕 닉스', '오클라호마시티 썬더', '올랜도 매직', '필라델피아 76ers', '피닉스 선즈', '포틀랜드 트레일블레이저스', '새크라멘토 킹스', '샌안토니오 스퍼스', '토론토 랩터스', '유타 재즈', '워싱턴 위저즈']::text[];--> statement-breakpoint
INSERT INTO "career_counts" ("ruleset", "pos", "careers", "nba", "nba_mvp")
	SELECT "ruleset", "pos", count(*), count(*) FILTER (WHERE "nba"), count(*) FILTER (WHERE "mvp" > 0)
	FROM "careers" GROUP BY "ruleset", "pos";--> statement-breakpoint
UPDATE "players" p SET "careers" = c.n FROM (SELECT "player_id", count(*)::int n FROM "careers" GROUP BY "player_id") c WHERE p."id" = c."player_id";--> statement-breakpoint
INSERT INTO "career_totals" ("id", "players") SELECT 1, count(*) FROM "players" WHERE "careers" > 0;--> statement-breakpoint
-- career_counts·players.careers·career_totals를 careers와 맞춰 둬요. 기록을 넣고 빼거나 룰셋·포지션·NBA 진출·NBA MVP가 바뀌면
-- 옛 값을 빼고 새 값을 더해요. 플레이어 수는 그 플레이어의 기록 수가 0에서 1이 될 때 늘고 1에서 0이 될 때 줄어요.
-- 플레이어 줄을 고치며 잠그니, 같은 플레이어의 제출이 겹치거나 한 문장으로 여러 줄을 바꿔도 한 번씩만 세요.
CREATE FUNCTION "career_counts_sync"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
	n int;
BEGIN
	IF TG_OP IN ('UPDATE', 'DELETE') THEN
		UPDATE "career_counts" SET
			"careers" = "careers" - 1,
			"nba" = "nba" - OLD."nba"::int,
			"nba_mvp" = "nba_mvp" - (OLD."mvp" > 0)::int
		WHERE "ruleset" = OLD."ruleset" AND "pos" = OLD."pos";
	END IF;
	IF TG_OP IN ('INSERT', 'UPDATE') THEN
		INSERT INTO "career_counts" AS c ("ruleset", "pos", "careers", "nba", "nba_mvp")
		VALUES (NEW."ruleset", NEW."pos", 1, NEW."nba"::int, (NEW."mvp" > 0)::int)
		ON CONFLICT ("ruleset", "pos") DO UPDATE SET
			"careers" = c."careers" + 1,
			"nba" = c."nba" + excluded."nba",
			"nba_mvp" = c."nba_mvp" + excluded."nba_mvp";
	END IF;
	IF TG_OP = 'INSERT' THEN
		UPDATE "players" SET "careers" = "careers" + 1 WHERE "id" = NEW."player_id" RETURNING "careers" INTO n;
		IF n = 1 THEN
			INSERT INTO "career_totals" AS t ("id", "players") VALUES (1, 1)
			ON CONFLICT ("id") DO UPDATE SET "players" = t."players" + 1;
		END IF;
	ELSIF TG_OP = 'DELETE' THEN
		UPDATE "players" SET "careers" = "careers" - 1 WHERE "id" = OLD."player_id" RETURNING "careers" INTO n;
		IF n = 0 THEN
			UPDATE "career_totals" SET "players" = "players" - 1 WHERE "id" = 1;
		END IF;
	END IF;
	RETURN NULL;
END
$$;--> statement-breakpoint
CREATE TRIGGER "careers_counts" AFTER INSERT OR DELETE OR UPDATE OF "ruleset", "pos", "nba", "mvp" ON "careers"
	FOR EACH ROW EXECUTE FUNCTION "career_counts_sync"();
