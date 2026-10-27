"use client";

import { useEffect, useRef } from "react";
import type { Galaxy, Match } from "@/lib/galaxy";

export interface Highlight {
  key: string; // a new key restarts the animation and moves the camera
  focus: number | null;
  neighbours: Match[];
  analogy: { a: number; b: number; c: number; r: number } | null;
}

interface Props {
  galaxy: Galaxy;
  highlight: Highlight;
  onPick: (i: number) => void;
}

export const PALETTE = [
  "#8AB4F8", "#F6AEA9", "#FDE293", "#A8DAB5", "#D7AEFB",
  "#8FDCEB", "#FCC48F", "#FDA8D3", "#C6D8FF",
];
const GOLD = "255,210,122";
const BLUE = "158,197,255";
const HOME = { x: 0, y: 0, z: 0, dist: 2.5 };

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const span = (p: number, a: number, b: number) => ease((p - a) / (b - a));

export function Sky({ galaxy, highlight, onPick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hl = useRef(highlight);
  const pick = useRef(onPick);
  hl.current = highlight;
  pick.current = onPick;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const { pos, group, words } = galaxy;
    const n = words.length;

    // star indices grouped by colour, so fillStyle changes only 9 times per frame
    const byGroup: number[][] = PALETTE.map(() => []);
    for (let i = 0; i < n; i++) byGroup[group[i] % PALETTE.length].push(i);
    const centroids = byGroup.map((ids) => [0, 1, 2].map((k) => ids.reduce((a, i) => a + pos[i * 3 + k], 0) / Math.max(1, ids.length)));
    const gx = new Float32Array(PALETTE.length), gy = new Float32Array(PALETTE.length), gz = new Float32Array(PALETTE.length);
    const phase = Float32Array.from({ length: n }, (_, i) => ((i * 9301 + 49297) % 233280) / 233280 * 6.28);
    const dust = Array.from({ length: 260 }, () => ({
      x: Math.random(), y: Math.random(), r: Math.random() * 0.9 + 0.2, a: Math.random() * 0.3 + 0.05,
    }));

    const cam = { yaw: 0.5, pitch: -0.3, ...HOME };
    const goal = { ...HOME };
    const sx = new Float32Array(n), sy = new Float32Array(n), sz = new Float32Array(n);

    let W = 0, H = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    let dragging = false, moved = 0, lastX = 0, lastY = 0;
    let mouseX = -1, mouseY = -1, hover = -1, lastTouch = -1e9;
    let animKey = "", animStart = 0;

    const project = () => {
      const cy = Math.cos(cam.yaw), syaw = Math.sin(cam.yaw);
      const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      const f = Math.min(W, H) * 1.25;
      for (let i = 0; i < n; i++) {
        const x = pos[i * 3] - cam.x, y = pos[i * 3 + 1] - cam.y, z = pos[i * 3 + 2] - cam.z;
        const x1 = x * cy + z * syaw;
        const z1 = -x * syaw + z * cy;
        const y2 = y * cp - z1 * sp;
        const z2 = y * sp + z1 * cp + cam.dist;
        sz[i] = z2;
        if (z2 < 0.08) { sx[i] = -1e5; continue; }
        sx[i] = W / 2 + (x1 * f) / z2;
        sy[i] = H / 2 + (y2 * f) / z2;
      }
      centroids.forEach(([px, py, pz], g) => {
        const x = px - cam.x, y = py - cam.y, z = pz - cam.z;
        const x1 = x * cy + z * syaw;
        const z1 = -x * syaw + z * cy;
        const z2 = y * sp + z1 * cp + cam.dist;
        gz[g] = z2;
        gx[g] = W / 2 + (x1 * f) / Math.max(0.1, z2);
        gy[g] = H / 2 + ((y * cp - z1 * sp) * f) / Math.max(0.1, z2);
      });
    };

    const setGoal = (h: Highlight) => {
      if (h.analogy) {
        const ids = [h.analogy.a, h.analogy.b, h.analogy.c, h.analogy.r];
        const c = [0, 1, 2].map((k) => ids.reduce((s, i) => s + pos[i * 3 + k], 0) / 4);
        const spread = Math.max(...ids.map((i) => Math.hypot(pos[i * 3] - c[0], pos[i * 3 + 1] - c[1], pos[i * 3 + 2] - c[2])));
        Object.assign(goal, { x: c[0], y: c[1], z: c[2], dist: Math.min(3.2, Math.max(0.5, spread * 3.4 + 0.3)) });
      } else if (h.focus !== null) {
        const i = h.focus;
        Object.assign(goal, { x: pos[i * 3], y: pos[i * 3 + 1], z: pos[i * 3 + 2], dist: 1.6 });
      } else {
        Object.assign(goal, HOME);
      }
    };

    const glow = (x: number, y: number, r: number, rgb: string, a: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${rgb},${0.55 * a})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    const line = (i: number, j: number, p: number, rgb: string, a: number, w: number, dashed = false, arrow = false) => {
      if (p <= 0) return;
      const x1 = sx[i], y1 = sy[i];
      const x2 = x1 + (sx[j] - x1) * p, y2 = y1 + (sy[j] - y1) * p;
      ctx.strokeStyle = `rgba(${rgb},${a})`;
      ctx.lineWidth = w;
      ctx.setLineDash(dashed ? [4, 6] : []);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (arrow && p > 0.98) {
        const ang = Math.atan2(y2 - y1, x2 - x1);
        const ux = Math.cos(ang), uy = Math.sin(ang);
        const tx = x2 - ux * 7, ty = y2 - uy * 7; // stop just short of the star
        ctx.fillStyle = `rgba(${rgb},${a})`;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx - ux * 10 + uy * 4.5, ty - uy * 10 - ux * 4.5);
        ctx.lineTo(tx - ux * 10 - uy * 4.5, ty - uy * 10 + ux * 4.5);
        ctx.closePath();
        ctx.fill();
      }
    };

    // labels avoid each other: try right, left, above, below
    let boxes: number[][] = [];
    const labelAt = (x: number, y: number, text: string, size: number, a: number, weight = 500, prefer: "right" | "left" = "right") => {
      if (a <= 0) return;
      ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`;
      const w = ctx.measureText(text).width, h = size + 4;
      const opts = [
        [x + 10, y - h / 2], [x - 10 - w, y - h / 2], [x - w / 2, y - 10 - h], [x - w / 2, y + 10],
      ];
      if (prefer === "left") [opts[0], opts[1]] = [opts[1], opts[0]];
      const hit = (bx: number, by: number) => boxes.some(([cx, cy, cw, ch]) => bx < cx + cw && bx + w > cx && by < cy + ch && by + h > cy);
      const [bx, by] = opts.find(([ox, oy]) => !hit(ox, oy)) ?? opts[0];
      boxes.push([bx, by, w, h]);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.textBaseline = "middle";
      ctx.fillText(text, bx, by + h / 2);
    };
    const label = (i: number, text: string, size: number, a: number, weight = 500) => labelAt(sx[i], sy[i], text, size, a, weight);

    let raf = 0;
    const frame = (t: number) => {
      const h = hl.current;
      if (h.key !== animKey) {
        animKey = h.key;
        animStart = t;
        setGoal(h);
      }
      const p = (t - animStart) / 1100;

      // camera easing and idle drift
      cam.x += (goal.x - cam.x) * 0.06;
      cam.y += (goal.y - cam.y) * 0.06;
      cam.z += (goal.z - cam.z) * 0.06;
      cam.dist += (goal.dist - cam.dist) * 0.06;
      if (!dragging && t - lastTouch > 2500) cam.yaw += 0.0008;

      project();
      ctx.clearRect(0, 0, W, H);
      boxes = [];

      // far dust (does not move)
      ctx.fillStyle = "#fff";
      for (const d of dust) {
        ctx.globalAlpha = d.a;
        ctx.fillRect(d.x * W, d.y * H, d.r, d.r);
      }

      // which stars are lit
      const lit = new Set<number>();
      if (h.focus !== null) lit.add(h.focus);
      if (h.analogy) [h.analogy.a, h.analogy.b, h.analogy.c, h.analogy.r].forEach((i) => lit.add(i));
      const active = lit.size > 0;
      const dim = active ? 0.18 + 0.82 * (1 - span(p, 0, 0.5)) : 1;

      // nebulae: one soft cloud per colour region
      ctx.globalCompositeOperation = "lighter";
      for (let g = 0; g < PALETTE.length; g++) {
        if (gz[g] < 0.1) continue;
        const r = (Math.min(W, H) * 0.5) / gz[g];
        const grad = ctx.createRadialGradient(gx[g], gy[g], 0, gx[g], gy[g], r);
        grad.addColorStop(0, PALETTE[g] + (active ? "0d" : "1c"));
        grad.addColorStop(1, PALETTE[g] + "00");
        ctx.fillStyle = grad;
        ctx.fillRect(gx[g] - r, gy[g] - r, r * 2, r * 2);
      }

      // stars
      for (let g = 0; g < byGroup.length; g++) {
        ctx.fillStyle = PALETTE[g];
        for (const i of byGroup[g]) {
          const z = sz[i];
          if (sx[i] < -50 || sx[i] > W + 50 || sy[i] < -50 || sy[i] > H + 50) continue;
          const depth = Math.min(1, Math.max(0.2, 2 / z));
          const tw = 0.7 + 0.3 * Math.sin(t * 0.0018 + phase[i]);
          ctx.globalAlpha = depth * tw * (lit.has(i) ? 1 : dim);
          const r = Math.max(1, 2.1 * Math.min(2.4, 2.8 / z));
          ctx.beginPath();
          ctx.arc(sx[i], sy[i], r / 2, 0, 6.283);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      // neighbours fan out around the focus word: closer in meaning = closer in
      if (h.focus !== null && h.neighbours.length) {
        const f = h.focus;
        const fx = sx[f], fy = sy[f];
        const max = h.neighbours[0].sim;
        const min = h.neighbours[h.neighbours.length - 1].sim;
        const R = Math.min(W, H) * 0.13;
        glow(fx, fy, 30 + 3 * Math.sin(t * 0.004), GOLD, 1);
        labelAt(fx, fy, words[f], 16, 1, 600);
        h.neighbours.forEach((m, k) => {
          const rel = (max - m.sim) / Math.max(1e-6, max - min); // 0 = closest
          const ang = -Math.PI / 2 + (k * 2 * Math.PI) / h.neighbours.length + 0.35;
          const dist = R + rel * R * 0.9;
          const q = span(p, 0.1 + k * 0.05, 0.75 + k * 0.05);
          const x = sx[m.i] + (fx + Math.cos(ang) * dist - sx[m.i]) * q;
          const y = sy[m.i] + (fy + Math.sin(ang) * dist - sy[m.i]) * q;
          ctx.strokeStyle = `rgba(${BLUE},${(0.55 - rel * 0.35) * q})`;
          ctx.lineWidth = 1.8 - rel;
          ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(x, y); ctx.stroke();
          glow(x, y, 14, BLUE, q);
          ctx.fillStyle = `rgba(255,255,255,${q})`;
          ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fill();
          labelAt(x, y, words[m.i], 13, 0.85 * q, 500, Math.cos(ang) < 0 ? "left" : "right");
        });
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(fx, fy, 3.2, 0, 7); ctx.fill();
      }

      // analogy: b → a, then the same jump from c lands on r
      if (h.analogy) {
        const { a, b, c, r } = h.analogy;
        line(b, c, span(p, 0.3, 0.6), "255,255,255", 0.18, 1, true);
        line(a, r, span(p, 0.55, 0.9), "255,255,255", 0.18, 1, true);
        line(b, a, span(p, 0.05, 0.4), BLUE, 0.85, 1.6, false, true);
        line(c, r, span(p, 0.5, 0.95), GOLD, 0.95, 2, false, true);
        const ar = span(p, 0.85, 1.2);
        if (ar > 0) labelAt(sx[r], sy[r], words[r], 16, ar, 600);
        for (const i of [a, b, c]) {
          glow(sx[i], sy[i], 14, BLUE, 1);
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.arc(sx[i], sy[i], 2.2, 0, 7); ctx.fill();
          label(i, words[i], 13, 0.85);
        }
        glow(sx[r], sy[r], (22 + 4 * Math.sin(t * 0.004)) * ar + 1, GOLD, ar);
        ctx.fillStyle = `rgba(255,255,255,${ar})`;
        ctx.beginPath(); ctx.arc(sx[r], sy[r], 3.2, 0, 7); ctx.fill();
      }

      // hover
      hover = -1;
      if (mouseX >= 0 && !dragging) {
        let best = 144;
        for (let i = 0; i < n; i++) {
          const dx = sx[i] - mouseX, dy = sy[i] - mouseY;
          const d2 = dx * dx + dy * dy;
          if (d2 < best) { best = d2; hover = i; }
        }
        if (hover >= 0) {
          ctx.strokeStyle = "rgba(255,255,255,0.7)";
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(sx[hover], sy[hover], 6, 0, 7); ctx.stroke();
          if (!lit.has(hover)) label(hover, words[hover], 12, 0.9);
        }
      }
      canvas.style.cursor = dragging ? "grabbing" : hover >= 0 ? "pointer" : "grab";

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // interaction
    const down = (e: PointerEvent) => {
      dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; lastTouch = performance.now();
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left; mouseY = e.clientY - rect.top;
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      cam.yaw += dx * 0.005;
      cam.pitch = Math.max(-1.4, Math.min(1.4, cam.pitch + dy * 0.005));
      lastTouch = performance.now();
    };
    const up = () => {
      dragging = false;
      lastTouch = performance.now();
      if (moved < 5 && hover >= 0) pick.current(hover);
    };
    const leave = () => { mouseX = -1; };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      goal.dist = Math.max(0.6, Math.min(6, goal.dist * Math.exp(e.deltaY * 0.0012)));
      lastTouch = performance.now();
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("wheel", wheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("wheel", wheel);
    };
  }, [galaxy]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />;
}
