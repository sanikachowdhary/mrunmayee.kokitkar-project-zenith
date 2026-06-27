"use client";

import { useEffect, useState, useCallback } from "react";

interface ISSPass {
  riseTime: string;
  maxElevation: number;
  duration: number;
  direction: string;
}

function useCountdown(targetIso: string): string {
  const [label, setLabel] = useState("--:--:--");
  useEffect(() => {
    const tick = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      if (diff <= 0) { setLabel("Passing now!"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(
        h > 0
          ? `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`
          : `${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  return label;
}

function PassRow({
  pass,
  index,
  isBest,
}: {
  pass: ISSPass;
  index: number;
  isBest: boolean;
}) {
  const countdown = useCountdown(pass.riseTime);
  const riseDate = new Date(pass.riseTime);
  const riseStr = riseDate.toUTCString().slice(0, 25);
  const durationMin = Math.floor(pass.duration / 60);
  const durationSec = pass.duration % 60;

  return (
    <div
      className={`rounded-xl border px-3.5 py-3 flex flex-col gap-2 ${
        isBest
          ? "border-yellow-500/30 bg-yellow-500/5"
          : "border-white/5 bg-white/[0.02]"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
            Pass #{index + 1}
          </span>
          {isBest && (
            <span className="font-mono text-[8px] text-yellow-400 border border-yellow-500/30 bg-yellow-500/10 rounded px-1.5 py-0.5">
              ★ BEST
            </span>
          )}
        </div>
        {/* Countdown */}
        <span className="font-mono text-[10px] font-bold text-cyan-400">
          {countdown}
        </span>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2">
          <p className="font-mono text-[8px] uppercase text-slate-500 mb-0.5">Max Elev.</p>
          <p className="font-mono text-sm font-bold text-slate-200">{pass.maxElevation}°</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2">
          <p className="font-mono text-[8px] uppercase text-slate-500 mb-0.5">Duration</p>
          <p className="font-mono text-sm font-bold text-slate-200">
            {durationMin}m{durationSec > 0 ? `${durationSec}s` : ""}
          </p>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2">
          <p className="font-mono text-[8px] uppercase text-slate-500 mb-0.5">Direction</p>
          <p className="font-mono text-sm font-bold text-slate-200">{pass.direction}</p>
        </div>
      </div>

      <p className="font-mono text-[9px] text-slate-600">{riseStr} UTC</p>
    </div>
  );
}

export function PassPredictCard({
  lat,
  lng,
  lastUpdated,
}: {
  lat: number;
  lng: number;
  lastUpdated?: string;
}) {
  const [passes, setPasses] = useState<ISSPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchPasses = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/iss-passes?lat=${lat}&lon=${lng}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("API error");
      const data = (await res.json()) as { passes: ISSPass[] };
      if (Array.isArray(data.passes)) {
        setPasses(data.passes.slice(0, 3));
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [lat, lng]);

  useEffect(() => {
    fetchPasses();
  }, [fetchPasses]);

  // Best pass = highest max elevation
  const bestIdx = passes.reduce(
    (best, p, i) => (p.maxElevation > (passes[best]?.maxElevation ?? 0) ? i : best),
    0
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col gap-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-cyan-500/5 blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.07 13 19.79 19.79 0 0 1 1 4.18 2 2 0 0 1 2.96 2h3.06a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z" />
          </svg>
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
            ISS Pass Predictor
          </span>
        </div>
        <button
          onClick={fetchPasses}
          className="font-mono text-[9px] text-sky-400 hover:text-sky-300 border border-sky-500/20 rounded px-2 py-1 cursor-pointer"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-white/5 rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
          <p className="font-mono text-[10px] text-amber-400">
            Pass prediction temporarily unavailable
          </p>
        </div>
      ) : passes.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
          <p className="font-mono text-[10px] text-slate-500">
            No ISS passes above 10° in next 24 hours
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {passes.map((pass, i) => (
            <PassRow key={pass.riseTime} pass={pass} index={i} isBest={i === bestIdx} />
          ))}
        </div>
      )}

      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
        <p className="font-mono text-[9px] text-slate-500">
          💡 Move outside with clear NE horizon for best viewing. Passes above 40° are brightest.
        </p>
      </div>

      <p className="font-mono text-[9px] text-slate-600 text-right">
        SGP4 propagator · CelesTrak TLE · {lastUpdated}
      </p>
    </div>
  );
}
