-- Supabase Data API(anon·authenticated 역할)로 표를 읽고 쓰지 못하게 RLS를 켜요. 정책은 두지 않아요. 표 주인인 서버 연결은 RLS를 건너뛰어요.
ALTER TABLE "career_counts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "career_totals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "careers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "players" ENABLE ROW LEVEL SECURITY;