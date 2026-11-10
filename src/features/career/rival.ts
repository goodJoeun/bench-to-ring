import type { Career, Look } from "@/game";

/** 라이벌 생김새 세 가지. 커리어마다 하나로 정해져요. 라이벌 도발 삽화와 라이벌전 장면 그림이 같은 라이벌을 그려요. */
const RIVALS: { look: Look; color: string }[] = [
  { look: { kind: "black", skin: "#6B4428", hair: "#111111", style: "braids", beard: "goatee", eyes: "#2A1A10", band: "#E8505B" }, color: "#5B2A86" },
  { look: { kind: "white", skin: "#F2D3BC", hair: "#C8A060", style: "spiky", beard: "stubble", eyes: "#3B6EA5" }, color: "#1F7A4D" },
  { look: { kind: "hispanic", skin: "#C98F62", hair: "#1B1B1B", style: "mohawk", beard: "full", eyes: "#4A2E1A" }, color: "#E2571E" },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** 이 커리어의 라이벌. 내 유니폼과 같은 색이면 어두운 남색 유니폼을 입혀요. */
export function rivalOf(c: Career, mine: string): { look: Look; color: string } {
  const r = RIVALS[hash(c.id) % RIVALS.length];
  return { look: r.look, color: r.color.toLowerCase() === mine.toLowerCase() ? "#232A3B" : r.color };
}
