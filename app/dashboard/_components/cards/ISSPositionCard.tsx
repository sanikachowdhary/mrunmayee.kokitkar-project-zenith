import { TelemetryCard } from "../TelemetryCard";

export function ISSPositionCard({ data, loading, lastUpdated }: { data?: { lat: number; lng: number; altitude: number; velocity: number }; loading: boolean; lastUpdated?: string }) {
  return (
    <TelemetryCard 
      title="ISS Telemetry" 
      loading={loading} 
      delay={0.2}
      lastUpdated={lastUpdated}
      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20M12 12l8-8M12 12l-8 8"/></svg>}
    >
      {data && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Latitude</p>
              <p className="font-mono text-base text-slate-200">{data.lat.toFixed(4)}°</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Longitude</p>
              <p className="font-mono text-base text-slate-200">{data.lng.toFixed(4)}°</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Altitude</p>
              <p className="font-mono text-sm text-slate-300">{data.altitude.toFixed(1)} km</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Velocity</p>
              <p className="font-mono text-sm text-slate-300">{data.velocity.toLocaleString()} km/h</p>
            </div>
          </div>
          
          {/* Radar animation aesthetic */}
          <div className="relative mt-2 h-1 w-full overflow-hidden rounded-full bg-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-sky-400 to-transparent w-[30%] animate-[slide_2s_ease-in-out_infinite]" />
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </TelemetryCard>
  );
}
