import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { FRAME_H, FRAME_W, drawMarker, markerValue } from '../smf-07-call/marker';

/**
 * SMF-8 synthetic diagnostic screen: a full-viewport canvas with a visibly changing marker
 * (counter, clock, sweeping bar) and the machine-readable marker strip, so a receiver can both
 * see and decode that the shared screen is live. Synthetic content only.
 */
export default function DiagnosticScreen() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    document.title = 'SMF Diagnostic Screen';
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const start = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const v = markerValue(now, start);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, FRAME_W, FRAME_H);
      ctx.fillStyle = '#334155';
      for (let i = 0; i < 8; i += 1) ctx.fillRect(40 + i * 70, 120, 50, 120);
      const x = 40 + (((now - start) / 10) % 560);
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(x, 110, 12, 140);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('PUMP MF-PUMP-001 · inlet temp trend (synthetic)', 24, 80);
      ctx.font = '18px monospace';
      ctx.fillText(new Date().toISOString().slice(11, 23), 24, 280);
      drawMarker(ctx, v, 'SCREEN');
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  return (
    <main>
      <canvas ref={ref} width={FRAME_W} height={FRAME_H} className="fixed inset-0 z-50 h-screen w-screen bg-slate-900" data-testid="diagnostic-canvas" />
      <Link to="/probes" className="fixed right-2 top-2 z-50 rounded bg-white/80 px-3 py-2 text-sm">
        Close
      </Link>
    </main>
  );
}
