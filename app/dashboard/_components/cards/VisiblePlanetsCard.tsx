import { TelemetryCard } from "../TelemetryCard";
import type { PlanetData } from "../lib/api-mock";

export function VisiblePlanetsCard({ data, loading, lastUpdated }: { data?: PlanetData[]; loading: boolean; lastUpdated?: string }) {
  return (
    <TelemetryCard 
      title="Estimated Visible Planets" 
      loading={loading} 
      delay={0.1}
      lastUpdated={lastUpdated}
      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>}
    >
      <div className="flex flex-col gap-3">
        {data?.length === 0 ? (
          <p className="font-mono text-xs text-slate-500">No planets currently visible.</p>
        ) : (
          data?.map((planet) => (
            <div key={planet.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span 
                  className="h-2 w-2 rounded-full animate-pulse" 
                  style={{ backgroundColor: planet.color, boxShadow: `0 0 8px ${planet.color}` }}
                />
                <span className="font-sans text-sm font-medium text-slate-200">{planet.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                  <div 
                    className="h-full rounded-full transition-all duration-1000" 
                    style={{ width: `${planet.visibility}%`, backgroundColor: planet.color }}
                  />
                </div>
                <span className="font-mono text-[10px] text-slate-400 w-6 text-right">{planet.visibility}%</span>
              </div>
            </div>
          ))
        )}
      </div>
    </TelemetryCard>
  );
}
