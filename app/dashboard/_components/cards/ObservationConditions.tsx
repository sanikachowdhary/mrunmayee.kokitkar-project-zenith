"use client";

interface FullWeatherData {
  cloudCover: number;
  seeing: number | string;
  transparency: string;
  windSpeed?: number;
  precipitation?: number;
  visibility?: number;
}

function getSeeingLabel(cloudCover: number): string {
  if (cloudCover <= 20) return "Excellent";
  if (cloudCover <= 50) return "Good";
  if (cloudCover <= 80) return "Fair";
  return "Poor";
}

function getSeeingColor(label: string): string {
  switch (label) {
    case "Excellent": return "#10b981";
    case "Good": return "#22d3ee";
    case "Fair": return "#f59e0b";
    default: return "#ef4444";
  }
}

function MetricRow({
  icon,
  label,
  value,
  sub,
  barPct,
  barColor,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  barPct?: number;
  barColor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">{icon}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">{label}</span>
        </div>
        <div className="text-right">
          <span className="font-mono text-[11px] font-semibold text-slate-200">{value}</span>
          {sub && <span className="font-mono text-[9px] text-slate-500 ml-1">{sub}</span>}
        </div>
      </div>
      {barPct !== undefined && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${barPct}%`, backgroundColor: barColor ?? "#22d3ee" }}
          />
        </div>
      )}
    </div>
  );
}

export function ObservationConditions({
  data,
  loading,
  lastUpdated,
}: {
  data?: FullWeatherData;
  loading: boolean;
  lastUpdated?: string;
}) {
  const cloudCover = data?.cloudCover ?? 0;
  const windSpeed = data?.windSpeed ?? 0;
  const precipitation = data?.precipitation ?? 0;
  const seeingLabel = getSeeingLabel(cloudCover);
  const seeingColor = getSeeingColor(seeingLabel);
  const transparencyLabel = cloudCover < 20 ? "Excellent" : cloudCover < 40 ? "Good" : cloudCover < 70 ? "Average" : "Poor";

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col gap-4 relative overflow-hidden">
      <div className="absolute bottom-0 right-0 w-32 h-32 rounded-full bg-sky-500/5 blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2">
          <path d="M17.5 19c2.5 0 4.5-2 4.5-4.5S20 10 17.5 10c-.5-3.5-3.5-6-7-6-3.8 0-7 3.1-7 7 0 .2.1.4.1.6" />
        </svg>
        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
          Observation Conditions
        </span>
      </div>

      {loading && !data ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-8 bg-white/5 rounded" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          <MetricRow
            icon="☁️"
            label="Cloud Cover"
            value={`${cloudCover}%`}
            barPct={cloudCover}
            barColor="#38bdf8"
          />
          <MetricRow
            icon="👁️"
            label="Atmospheric Seeing"
            value={seeingLabel}
            barPct={cloudCover <= 20 ? 95 : cloudCover <= 50 ? 70 : cloudCover <= 80 ? 40 : 15}
            barColor={seeingColor}
          />
          <MetricRow
            icon="🌫️"
            label="Transparency"
            value={transparencyLabel}
            barPct={cloudCover < 20 ? 90 : cloudCover < 40 ? 65 : cloudCover < 70 ? 35 : 10}
            barColor="#a78bfa"
          />
          <MetricRow
            icon="💨"
            label="Wind Speed"
            value={`${windSpeed.toFixed(1)} km/h`}
            sub={windSpeed > 20 ? "⚠ turbulent" : windSpeed > 10 ? "moderate" : "calm"}
            barPct={Math.min(100, (windSpeed / 50) * 100)}
            barColor={windSpeed > 20 ? "#f59e0b" : "#10b981"}
          />
          {precipitation > 0 && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 flex items-center gap-2">
              <span>🌧️</span>
              <span className="font-mono text-[10px] text-red-400 font-semibold">
                Rain: {precipitation.toFixed(1)} mm — Poor observing conditions
              </span>
            </div>
          )}

          {/* Bortle scale */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                🌃 Bortle Scale (Mumbai)
              </span>
              <span className="font-mono text-[11px] font-bold text-amber-400">8 / 9</span>
            </div>
            <p className="font-mono text-[9px] text-slate-500 mt-1">
              Inner-city sky — heavy light pollution. Milky Way invisible. Only brightest stars/planets visible.
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-600" style={{ width: "88%" }} />
            </div>
          </div>
        </div>
      )}

      <p className="font-mono text-[9px] text-slate-600 text-right">
        Open-Meteo · {lastUpdated}
      </p>
    </div>
  );
}
