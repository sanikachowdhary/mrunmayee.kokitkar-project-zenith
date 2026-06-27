"use client";

import { useEffect, useRef, useState } from "react";

const ISS_VELOCITY_KMH = 27580;
const ISS_ALTITUDE_KM = 408;
const ORBIT_PERIOD_SEC = 92 * 60; // 92 minutes

function useOrbitCountdown(): string {
  const [label, setLabel] = useState("--:--");
  useEffect(() => {
    const tick = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const elapsed = nowSec % ORBIT_PERIOD_SEC;
      const remaining = ORBIT_PERIOD_SEC - elapsed;
      const m = Math.floor(remaining / 60).toString().padStart(2, "0");
      const s = (remaining % 60).toString().padStart(2, "0");
      setLabel(`${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return label;
}

export function ISSSpeedCard({ lastUpdated }: { lastUpdated?: string }) {
  const orbitCountdown = useOrbitCountdown();
  const machNumber = (ISS_VELOCITY_KMH / 1078).toFixed(1);
  const velPct = (ISS_VELOCITY_KMH / 30000) * 100;
  const altPct = (ISS_ALTITUDE_KM / 600) * 100;

  // Animated velocity counter
  const [displayVel, setDisplayVel] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const start = Date.now();
    const duration = 1800;
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayVel(Math.floor(eased * ISS_VELOCITY_KMH));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col gap-4 relative overflow-hidden"
      style={{ fontFamily: "'Courier New', monospace" }}
    >
      {/* Background ambient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
            ISS Speed Tracker
          </span>
        </div>
        <span
          className="block h-1.5 w-1.5 rounded-full bg-cyan-400"
          style={{ animation: "issPulse 1.5s ease-in-out infinite" }}
        />
      </div>

      <style>{`
        @keyframes issPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      {/* Velocity */}
      <div className="relative z-10">
        <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">
          Orbital Velocity
        </p>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-bold text-cyan-400">
            {displayVel.toLocaleString()}
          </span>
          <span className="font-mono text-sm text-slate-500">km/h</span>
        </div>
        <p className="font-mono text-[10px] text-slate-500 mt-0.5">
          Mach <span className="text-slate-300 font-semibold">{machNumber}</span>
        </p>

        {/* Velocity bar */}
        <div className="mt-2 flex items-center gap-2">
          <span className="font-mono text-[8px] text-slate-600">0</span>
          <div className="flex-1 h-3 bg-slate-900 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full rounded-full transition-all duration-1500"
              style={{
                width: `${velPct}%`,
                background: "linear-gradient(to right, #0ea5e9, #22d3ee, #67e8f9)",
                boxShadow: "0 0 12px rgba(34,211,238,0.5)",
              }}
            />
          </div>
          <span className="font-mono text-[8px] text-slate-600">30k</span>
        </div>
      </div>

      {/* Altitude + Orbit countdown */}
      <div className="grid grid-cols-2 gap-3 relative z-10">
        {/* Altitude bar */}
        <div>
          <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-2">
            Altitude
          </p>
          <div className="flex gap-2 items-end h-24">
            {/* Vertical bar */}
            <div className="relative w-8 bg-slate-900 rounded border border-white/5 overflow-hidden h-full">
              <div
                className="absolute bottom-0 left-0 right-0 rounded transition-all duration-1000"
                style={{
                  height: `${altPct}%`,
                  background: "linear-gradient(to top, #7c3aed, #a855f7)",
                  boxShadow: "0 -4px 12px rgba(168,85,247,0.4)",
                }}
              />
            </div>
            <div className="flex flex-col justify-between h-full py-1">
              <span className="font-mono text-[8px] text-slate-600">600 km</span>
              <div>
                <p className="font-mono text-xs font-bold text-purple-400">{ISS_ALTITUDE_KM}</p>
                <p className="font-mono text-[8px] text-slate-500">km</p>
              </div>
              <span className="font-mono text-[8px] text-slate-600">0</span>
            </div>
          </div>
        </div>

        {/* Orbit timer */}
        <div className="flex flex-col justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">
              Orbit Countdown
            </p>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="font-mono text-2xl font-bold text-emerald-400">
                {orbitCountdown}
              </p>
              <p className="font-mono text-[8px] text-slate-500 mt-1">
                until orbit completes
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
            <p className="font-mono text-[9px] text-slate-500">Period: 92 min</p>
            <p className="font-mono text-[9px] text-slate-500">~15.6 orbits/day</p>
          </div>
        </div>
      </div>

      <p className="font-mono text-[9px] text-slate-600 text-right relative z-10">
        {lastUpdated}
      </p>
    </div>
  );
}
