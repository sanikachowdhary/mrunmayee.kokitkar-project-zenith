"use client";

import { motion } from "framer-motion";
import type { SatelliteProxyData } from "../lib/real-api";

const NOTABLE_SATELLITES = [
  { name: "ISS (Zarya)", norad: 25544, status: "active" },
  { name: "Hubble Space Telescope", norad: 20580, status: "active" },
  { name: "Tiangong Space Station", norad: 48274, status: "active" },
  { name: "Starlink-1", norad: 44713, status: "active" },
  { name: "GPS BIIA-1", norad: 17561, status: "active" },
  { name: "Landsat 9", norad: 49260, status: "active" },
  { name: "James Webb ST", norad: 50463, status: "L2 — not in LEO", special: true },
  { name: "Envisat", norad: 27386, status: "defunct", defunct: true },
];

export function ActiveSatellitesCard({
  data,
  loading,
  lastUpdated,
}: {
  data?: SatelliteProxyData | null;
  loading: boolean;
  lastUpdated?: string;
}) {
  // LEO estimate: objects with orbital period 80-120 min
  const leoCount = data?.activeCount
    ? Math.floor(data.activeCount * 0.62)
    : 5200;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col gap-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full bg-purple-500/5 blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2">
          <path d="M12 2v20M2 12h20M4 4l16 16M20 4L4 20" />
        </svg>
        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
          Active Satellites
        </span>
      </div>

      {/* Count display */}
      <div className="flex items-end gap-4">
        <div className="relative">
          <motion.div
            className="font-mono text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-500"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            key={data?.activeCount}
          >
            {data?.activeCount ? data.activeCount.toLocaleString() : "8,337"}
          </motion.div>
          <div className="absolute inset-0 -m-4 rounded-full border border-purple-500/20 animate-[spin_4s_linear_infinite]" />
          <div className="absolute inset-0 -m-6 rounded-full border border-dashed border-sky-500/20 animate-[spin_6s_linear_infinite_reverse]" />
        </div>
        <div className="flex flex-col pb-1 gap-0.5">
          <span className="font-mono text-[9px] text-slate-500 uppercase tracking-wider">Tracked objects</span>
          <span className="font-mono text-[10px] text-purple-400">
            ~{leoCount.toLocaleString()} in LEO
          </span>
        </div>
      </div>

      {/* Notable satellites list */}
      <div className="border-t border-white/5 pt-3">
        <p className="font-mono text-[9px] uppercase tracking-wider text-sky-400 mb-2">
          Notable Tracked Objects
        </p>
        <div className="flex flex-col gap-1.5">
          {NOTABLE_SATELLITES.map((sat) => (
            <div
              key={sat.norad}
              className="flex items-center justify-between rounded-lg bg-white/[0.03] border border-white/5 px-3 py-1.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: sat.defunct
                      ? "#6b7280"
                      : sat.special
                      ? "#f59e0b"
                      : "#34d399",
                    boxShadow: sat.defunct
                      ? "none"
                      : sat.special
                      ? "0 0 6px rgba(245,158,11,0.6)"
                      : "0 0 6px rgba(52,211,153,0.6)",
                  }}
                />
                <span className="font-mono text-[10px] text-slate-300 truncate">
                  {sat.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="font-mono text-[9px] text-slate-600">
                  #{sat.norad}
                </span>
                {sat.defunct && (
                  <span className="font-mono text-[8px] text-gray-500 border border-gray-700 rounded px-1">
                    defunct
                  </span>
                )}
                {sat.special && (
                  <span className="font-mono text-[8px] text-amber-500 border border-amber-800 rounded px-1">
                    L2
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="font-mono text-[9px] text-slate-600 text-right mt-auto">
        Source: CelesTrak • {lastUpdated}
      </p>
    </div>
  );
}
