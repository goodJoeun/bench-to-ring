"use client";

import { useEffect, useRef } from "react";
import { useTextOnly } from "@/shared/lib/text-only";
import { portraitCourt } from "./sprite/courtArt";

export function CourtBackdrop({ color, compact = false, shadow = true }: { color: string; compact?: boolean; shadow?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const textOnly = useTextOnly();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || textOnly) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function paint() {
      if (!canvas || !ctx) return;
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      const density = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(width * density);
      canvas.height = Math.round(height * density);
      ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      portraitCourt(ctx, width, height, color, compact, shadow);
    }

    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [color, compact, shadow, textOnly]);

  return textOnly ? null : <canvas ref={ref} className="court-backdrop" aria-hidden="true" />;
}
