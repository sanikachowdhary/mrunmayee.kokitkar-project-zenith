"use client";

import { useEffect, useRef, useState } from "react";

interface ISSData {
  lat: number;
  lng: number;
  altitude: number;
  velocity: number;
}

function ISSWorldMap({ lat, lng }: { lat: number; lng: number }) {
  // Map lat/lng to SVG coordinates (equirectangular, SVG is 200x100)
  const x = ((lng + 180) / 360) * 200;
  const y = ((90 - lat) / 180) * 100;

  return (
    <svg
      viewBox="0 0 200 100"
      className="w-full h-auto opacity-60"
      style={{ maxHeight: 80 }}
    >
      {/* Simplified world outline — major landmasses as paths */}
      <rect x="0" y="0" width="200" height="100" fill="rgba(10,15,40,0.6)" rx="4" />
      {/* Continents as simplified rectangles/paths */}
      {/* North America */}
      <path d="M 20 15 L 55 15 L 55 50 L 35 55 L 20 45 Z" fill="rgba(30,60,100,0.5)" stroke="rgba(56,189,248,0.3)" strokeWidth="0.5" />
      {/* South America */}
      <path d="M 35 55 L 55 55 L 52 80 L 38 82 Z" fill="rgba(30,60,100,0.5)" stroke="rgba(56,189,248,0.3)" strokeWidth="0.5" />
      {/* Europe */}
      <path d="M 88 10 L 105 10 L 108 28 L 88 30 Z" fill="rgba(30,60,100,0.5)" stroke="rgba(56,189,248,0.3)" strokeWidth="0.5" />
      {/* Africa */}
      <path d="M 90 30 L 108 30 L 106 72 L 92 72 Z" fill="rgba(30,60,100,0.5)" stroke="rgba(56,189,248,0.3)" strokeWidth="0.5" />
      {/* Asia */}
      <path d="M 105 5 L 165 5 L 165 50 L 105 50 Z" fill="rgba(30,60,100,0.5)" stroke="rgba(56,189,248,0.3)" strokeWidth="0.5" />
      {/* Australia */}
      <path d="M 148 58 L 170 58 L 170 75 L 148 75 Z" fill="rgba(30,60,100,0.5)" stroke="rgba(56,189,248,0.3)" strokeWidth="0.5" />
      {/* Orbit path (dashed line at ~52° inclination) */}
      <ellipse cx="100" cy="50" rx="98" ry="28" fill="none" stroke="rgba(56,189,248,0.15)" strokeWidth="0.5" strokeDasharray="3,3" />
      {/* ISS dot */}
      <circle cx={x} cy={y} r="3" fill="#22d3ee" className="animate-pulse" style={{ filter: "drop-shadow(0 0 4px rgba(34,211,238,0.9))" }} />
      {/* Dot glow ring */}
      <circle cx={x} cy={y} r="5" fill="none" stroke="rgba(34,211,238,0.3)" strokeWidth="0.5" />
    </svg>
  );
}

export function ISSPositionCard({
  data,
  loading,
  lastUpdated,
}: {
  data?: ISSData;
  loading: boolean;
  lastUpdated?: string;
}) {
  const [liveTime, setLiveTime] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tick = () => setLiveTime(new Date().toUTCString().slice(17, 25) + " UTC");
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const latDir = data ? (data.lat >= 0 ? "N" : "S") : "N";
  const lngDir = data ? (data.lng >= 0 ? "E" : "W") : "E";
  const latAbs = data ? Math.abs(data.lat).toFixed(4) : "--";
  const lngAbs = data ? Math.abs(data.lng).toFixed(4) : "--";

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col gap-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-cyan-500/5 blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2">
            <path d="M12 2v20M2 12h20M12 12l8-8M12 12l-8 8" />
          </svg>
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
            ISS Telemetry
          </span>
        </div>
        {/* LIVE badge */}
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1">
          <span
            className="block h-1.5 w-1.5 rounded-full bg-emerald-400"
            style={{ animation: "issPulse 1.5s ease-in-out infinite" }}
          />
          <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400 font-bold">
            LIVE
          </span>
        </div>
      </div>

      <style>{`
        @keyframes issPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      {loading && !data ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-4 bg-white/5 rounded w-3/4" />
          <div className="h-4 bg-white/5 rounded w-1/2" />
          <div className="h-16 bg-white/5 rounded" />
        </div>
      ) : (
        <>
          {/* World map with ISS dot */}
          <div className="rounded-xl overflow-hidden border border-white/5 bg-slate-900/50">
            <ISSWorldMap lat={data?.lat ?? 0} lng={data?.lng ?? 0} />
          </div>

          {/* Telemetry grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">
                Latitude
              </p>
              <p className="font-mono text-sm font-bold text-slate-100">
                {latAbs}°{latDir}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">
                Longitude
              </p>
              <p className="font-mono text-sm font-bold text-slate-100">
                {lngAbs}°{lngDir}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">
                Altitude
              </p>
              <p className="font-mono text-sm font-bold text-cyan-400">
                {data?.altitude?.toFixed(0) ?? "408"} km
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">
                Velocity
              </p>
              <p className="font-mono text-sm font-bold text-purple-400">
                {(data?.velocity ?? 27580).toLocaleString()} km/h
              </p>
            </div>
          </div>

          {/* Last updated */}
          <p className="font-mono text-[9px] text-slate-600 text-right">
            Updated: {lastUpdated ?? liveTime}
          </p>
        </>
      )}
    </div>
  );
}
