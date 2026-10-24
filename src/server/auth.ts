import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { players } from "./schema";

// 익명 플레이어: 브라우저가 토큰 원문을 갖고, DB에는 TOKEN_SECRET으로 만든 해시만 둬요.

function hashToken(token: string): string {
  const secret = process.env.TOKEN_SECRET;
  if (!secret) throw new Error("TOKEN_SECRET이 없어요. .env.local을 확인해 주세요.");
  return createHmac("sha256", secret).update(token).digest("hex");
}

/** 새 플레이어를 만들고 토큰 원문을 돌려줘요. */
export async function createPlayer(): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db().insert(players).values({ tokenHash: hashToken(token) });
  return token;
}

/** `Authorization: Bearer <토큰>`의 플레이어 id. 없거나 모르는 토큰이면 null이에요. */
export async function playerFrom(req: Request): Promise<string | null> {
  const token = req.headers.get("authorization")?.match(/^Bearer ([\w-]{20,100})$/)?.[1];
  if (!token) return null;
  const [p] = await db()
    .select({ id: players.id })
    .from(players)
    .where(eq(players.tokenHash, hashToken(token)))
    .limit(1);
  return p?.id ?? null;
}
