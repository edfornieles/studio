import { useEffect, useRef } from 'react';

/**
 * A slow microscopic field: drifting specks and cell outlines with parallax.
 * `depth` shifts the palette as the visitor travels deeper (0 = surface, 1 = molecular).
 */
export function Backdrop({ depth = 0.5 }: { depth?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const depthRef = useRef(depth);
  depthRef.current = depth;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const specks = Array.from({ length: 46 }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: 0.2 + Math.random() * 0.8,
      r: 0.5 + Math.random() * 2.2,
      cell: Math.random() < 0.14,
      ph: Math.random() * 6,
    }));
    let raf = 0;
    let t = 0;
    let shown = depthRef.current;
    const resize = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    addEventListener('resize', resize);
    const frame = () => {
      t += 1 / 60;
      shown += (depthRef.current - shown) * 0.03;
      const W = innerWidth;
      const H = innerHeight;
      ctx.clearRect(0, 0, W, H);
      const hue = 150 + shown * 60; // green surface → deep blue molecular
      for (const s of specks) {
        if (!still) {
          s.y -= 0.00012 * s.z;
          s.x += Math.sin(t * 0.3 + s.ph) * 0.00008;
          if (s.y < -0.05) s.y = 1.05;
        }
        const x = s.x * W;
        const y = s.y * H;
        const a = 0.12 + 0.3 * s.z;
        if (s.cell) {
          ctx.strokeStyle = `hsla(${hue}, 60%, 60%, ${a * 0.35})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(x, y, 14 * s.z + 6, 10 * s.z + 5, s.ph, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = `hsla(${hue}, 70%, 70%, ${a})`;
          ctx.beginPath();
          ctx.arc(x, y, s.r * s.z, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (!still) raf = requestAnimationFrame(frame);
    };
    frame();
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="backdrop" aria-hidden />;
}
