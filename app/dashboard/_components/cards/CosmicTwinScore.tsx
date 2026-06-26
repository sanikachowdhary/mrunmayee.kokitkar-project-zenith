import { TelemetryCard } from "../TelemetryCard";
import { motion } from "framer-motion";

export function CosmicTwinScore({ score, loading, lastUpdated }: { score?: number; loading: boolean; lastUpdated?: string }) {
  // Determine color based on score
  let colorClass = "text-sky-400";
  let bgClass = "bg-sky-400/20";
  if (score && score < 50) {
    colorClass = "text-red-400";
    bgClass = "bg-red-400/20";
  } else if (score && score < 75) {
    colorClass = "text-amber-400";
    bgClass = "bg-amber-400/20";
  }

  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - ((score ?? 0) / 100) * circumference;

  return (
    <TelemetryCard 
      title="Cosmic Twin Suitability" 
      loading={loading} 
      delay={0.5}
      lastUpdated={lastUpdated}
      className="md:col-span-2"
      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8l4 4-4 4M8 12h8"/></svg>}
    >
      <div className="flex flex-col md:flex-row items-center gap-6 p-2">
        <div className="relative flex items-center justify-center">
          <svg width="100" height="100" className="transform -rotate-90">
            {/* Background circle */}
            <circle 
              cx="50" cy="50" r={radius} 
              stroke="rgba(255,255,255,0.05)" 
              strokeWidth="8" 
              fill="transparent" 
            />
            {/* Progress circle */}
            {score !== undefined && (
              <motion.circle 
                cx="50" cy="50" r={radius} 
                stroke="currentColor" 
                strokeWidth="8" 
                fill="transparent"
                strokeLinecap="round"
                className={colorClass}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                style={{ strokeDasharray: circumference }}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <span className={`font-mono text-xl font-bold ${colorClass}`}>
              {score ?? 0}
            </span>
          </div>
        </div>

        <div className="flex-1 text-center md:text-left">
          <h4 className="font-sans text-sm font-medium text-slate-200 mb-1">Estimated Observation Quality</h4>
          <p className="font-sans text-xs text-slate-400 max-w-sm">
            Derived from live cloud cover and atmospheric visibility estimates. This score is an observational suitability index, not a precise telescope measurement.
          </p>
          {score !== undefined && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/5 bg-white/5 px-3 py-1">
              <span className={`h-2 w-2 rounded-full animate-pulse ${bgClass.replace('/20', '')}`} />
              <span className="font-mono text-[9px] uppercase tracking-widest text-slate-300">
                {score >= 75 ? 'Optimal' : score >= 50 ? 'Marginal' : 'Sub-Optimal'}
              </span>
            </div>
          )}
        </div>
      </div>
    </TelemetryCard>
  );
}
