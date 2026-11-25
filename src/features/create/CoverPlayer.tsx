import { useLayoutEffect, useRef } from "react";
import type { CoverStage } from "./CareerEffects";
import poses from "./coverPoses.generated.json";
import styles from "./create.module.css";

type FillLayer = { color: string; outline: Path2D };
const paths = new WeakMap<string[][], FillLayer[]>();

function paintLayers(ctx: CanvasRenderingContext2D, layers: string[][]) {
  let fills = paths.get(layers);
  if (!fills) {
    fills = layers.map(([color, outline]) => ({ color, outline: new Path2D(outline) }));
    paths.set(layers, fills);
  }
  for (const { color, outline } of fills) {
    ctx.fillStyle = color;
    ctx.fill(outline);
  }
}

export function CoverPlayer({ stage, active, replay }: { stage: CoverStage; active: boolean; replay: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const art = poses[stage];

  useLayoutEffect(() => {
    const surface = canvas.current;
    const ctx = surface?.getContext("2d");
    if (!surface || !ctx) return;
    ctx.setTransform(surface.width / art.width, 0, 0, surface.height / art.height, 0, 0);
    let frame = active ? 0 : art.poses.length - 1;
    let nextChange = performance.now();
    let timer: number | undefined;
    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, art.width, art.height);
      paintLayers(ctx, art.base);
      paintLayers(ctx, art.poses[frame]);
      if (frame < art.poses.length - 1) {
        nextChange += art.durations[frame];
        frame++;
        timer = window.setTimeout(draw, Math.max(0, nextChange - performance.now()));
      }
    }
    draw();
    return () => window.clearTimeout(timer);
  }, [art, active, replay]);

  return <canvas ref={canvas} className={styles.evoArt} width={art.width * 2} height={art.height * 2} />;
}
