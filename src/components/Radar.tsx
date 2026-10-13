import { ATTR_KEYS, SHORT, type Attrs } from "@/game";

const W = 240;
const H = 192;
const CX = 120;
const CY = 96;
const R = 62;

function point(i: number, v: number): [number, number] {
  const t = -Math.PI / 2 + (i * Math.PI) / 3;
  return [CX + Math.cos(t) * ((R * v) / 100), CY + Math.sin(t) * ((R * v) / 100)];
}

const polygon = (values: (i: number) => number) =>
  ATTR_KEYS.map((_, i) => point(i, values(i)).map((n) => n.toFixed(1)).join(",")).join(" ");

/** 능력치 육각형 그래프 (0~100 눈금) */
export function Radar({ attrs }: { attrs: Attrs }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="radar" role="img" aria-label="능력치 레이더 차트">
      {[25, 50, 75, 100].map((r) => (
        <polygon key={r} className="rg" points={polygon(() => r)} />
      ))}
      {ATTR_KEYS.map((k, i) => {
        const [x, y] = point(i, 100);
        return <line key={k} className="rg" x1={CX} y1={CY} x2={x.toFixed(1)} y2={y.toFixed(1)} />;
      })}
      <polygon className="rv" points={polygon((i) => attrs[ATTR_KEYS[i]])} />
      {ATTR_KEYS.map((k, i) => {
        const [x, y] = point(i, 121);
        const anchor = Math.abs(x - CX) < 4 ? "middle" : x < CX ? "end" : "start";
        return (
          <text key={k} className="rl" x={x.toFixed(1)} y={(y + 4).toFixed(1)} textAnchor={anchor}>
            {SHORT[k]}
          </text>
        );
      })}
    </svg>
  );
}
