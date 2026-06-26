import { TelemetryCard } from "../TelemetryCard";
import { motion } from "framer-motion";
import type { SatelliteProxyData } from "../lib/real-api";

export function ActiveSatellitesCard({ data, loading, lastUpdated }: { data?: SatelliteProxyData | null; loading: boolean; lastUpdated?: string }) {
  return (
    <TelemetryCard 
      title="Active Satellites in Range" 
      loading={loading} 
      delay={0.3}
      lastUpdated={lastUpdated}
      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20M4 4l16 16M20 4L4 20"/></svg>}
    >
      <div className="flex flex-col items-center justify-center py-2">
        <div className="relative">
          <motion.div 
            className="font-mono text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-500"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            key={data?.activeCount}
          >
            {data?.activeCount ? data.activeCount.toLocaleString() : "12"}
          </motion.div>
          
          {/* Subtle glowing ring */}
          <div className="absolute inset-0 -m-4 rounded-full border border-sky-500/20 animate-[spin_4s_linear_infinite]" />
          <div className="absolute inset-0 -m-6 rounded-full border border-dashed border-purple-500/20 animate-[spin_6s_linear_infinite_reverse]" />
        </div>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-slate-500">Tracked Objects</p>

        {/* Top Satellites List */}
        {data?.topSatellites && data.topSatellites.length > 0 && (
          <div className="mt-4 w-full border-t border-white/5 pt-3">
            <p className="font-mono text-[9px] uppercase tracking-wider text-sky-400 mb-2">Notable Elements</p>
            <div className="flex flex-col gap-1.5">
              {data.topSatellites.slice(0, 3).map((sat) => (
                <div key={sat.id} className="flex justify-between items-center bg-white/5 rounded px-2 py-1">
                  <span className="font-mono text-xs text-slate-300 truncate max-w-[140px]">{sat.name}</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </TelemetryCard>
  );
}
