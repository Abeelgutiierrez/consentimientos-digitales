"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Point, Signature } from "@/core/signature";

// Panel de firma con el dedo. Guarda trazos vectoriales { w, h, strokes } (igual que la demo),
// nítidos en pantalla y en el PDF. Sin dependencias.

export interface SignaturePadHandle {
  isEmpty(): boolean;
  toData(): Signature;
  clear(): void;
}

interface Props {
  hint: string;
  clearLabel: string;
  footer?: React.ReactNode;
  label: string;
  onChange?: () => void;
  testId?: string;
}

export const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad({ hint, clearLabel, footer, label, onChange, testId }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const current = useRef<Point[] | null>(null);
  const size = useRef({ w: 0, h: 0 });
  const [signed, setSigned] = useState(false);

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const { w, h } = size.current;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "#1b1f3b";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokes.current) {
      const first = s[0];
      if (!first) continue;
      ctx.beginPath();
      ctx.moveTo(first[0], first[1]);
      if (s.length === 1) ctx.lineTo(first[0] + 0.5, first[1] + 0.5);
      for (let j = 1; j < s.length - 1; j++) {
        const a = s[j]!;
        const b = s[j + 1]!;
        ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      }
      const last = s[s.length - 1]!;
      if (s.length > 1) ctx.lineTo(last[0], last[1]);
      ctx.stroke();
    }
  }, []);

  const resize = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = size.current;
    // Reescalar los trazos existentes al nuevo tamaño (p. ej. al girar el móvil)
    if (w && h && (w !== r.width || h !== r.height)) {
      const sx = r.width / w;
      const sy = r.height / h;
      strokes.current = strokes.current.map((s) => s.map(([x, y]) => [x * sx, y * sy] as Point));
    }
    size.current = { w: r.width, h: r.height };
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
    c.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }, [redraw]);

  useEffect(() => {
    resize();
    const c = canvasRef.current!;
    const pos = (e: PointerEvent): Point => {
      const r = c.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const down = (e: PointerEvent) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      try { c.setPointerCapture(e.pointerId); } catch { /* ignorar */ }
      current.current = [pos(e)];
      strokes.current.push(current.current);
      redraw();
    };
    const move = (e: PointerEvent) => {
      if (!current.current) return;
      e.preventDefault();
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of events.length ? events : [e]) {
        const p = pos(ev);
        const last = current.current[current.current.length - 1]!;
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 1.2) current.current.push(p);
      }
      redraw();
    };
    const end = () => {
      if (!current.current) return;
      current.current = null;
      setSigned(strokes.current.some((s) => s.length > 1));
      onChange?.();
    };
    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
    c.addEventListener("pointerleave", end);
    const ro = new ResizeObserver(() => resize());
    ro.observe(c);
    return () => {
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", end);
      c.removeEventListener("pointercancel", end);
      c.removeEventListener("pointerleave", end);
      ro.disconnect();
    };
  }, [resize, redraw, onChange]);

  const clear = useCallback(() => {
    strokes.current = [];
    current.current = null;
    setSigned(false);
    redraw();
    onChange?.();
  }, [redraw, onChange]);

  useImperativeHandle(ref, () => ({
    isEmpty: () => !strokes.current.some((s) => s.length > 1),
    toData: () => ({ w: size.current.w, h: size.current.h, strokes: strokes.current.filter((s) => s.length > 0) }),
    clear,
  }), [clear]);

  return (
    <>
      <div className={`sig-pad${signed ? " signed" : ""}`}>
        <canvas ref={canvasRef} role="img" aria-label={label} data-testid={testId} />
        <div className="line" />
        <div className="hint">{hint}</div>
      </div>
      <div className="sig-tools">
        {footer ?? <span />}
        <button type="button" onClick={clear}>{clearLabel}</button>
      </div>
    </>
  );
});
