import { TelemetryCard } from "../TelemetryCard";
import type { WeatherData } from "../lib/api-mock";

export function ObservationConditions({ data, loading, lastUpdated }: { data?: WeatherData; loading: boolean; lastUpdated?: string }) {
  return (
    <TelemetryCard 
      title="Estimated Observation Conditions" 
      loading={loading} 
      delay={0.4}
      lastUpdated={lastUpdated}
      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.5 19c2.5 0 4.5-2 4.5-4.5S20 10 17.5 10c-.5-3.5-3.5-6-7-6-3.8 0-7 3.1-7 7 0 .2.1.4.1.6C1.6 12.1 0 14.1 0 16.5 0 19.3 2.2 21.5 5 21.5h12.5z"/></svg>}
    >
      {data && (
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Cloud Cover</span>
              <span className="font-mono text-[10px] text-slate-300">{data.cloudCover}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-slate-400 transition-all duration-1000" 
                style={{ width: `${data.cloudCover}%` }}
              />
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Atmospheric Seeing</span>
              <span className="font-mono text-[10px] text-slate-300">{data.seeing}/10</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-1000" 
                style={{ width: `${(data.seeing / 10) * 100}%` }}
              />
            </div>
          </div>

          <div className="mt-2 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-center">
            <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-1">Transparency</p>
            <p className="font-sans text-sm font-medium text-slate-200">{data.transparency}</p>
          </div>
        </div>
      )}
    </TelemetryCard>
  );
}
