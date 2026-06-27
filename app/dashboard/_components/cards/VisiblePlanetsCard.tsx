"use client";

interface Planet {
  name: string;
  altitude: number;
  azimuth: number;
  magnitude: number;
  color: string;
}

const FALLBACK_PLANETS: Planet[] = [
  { name: "Jupiter", altitude: 42, azimuth: 128, magnitude: -2.3, color: "#fde68a" },
  { name: "Venus",   altitude: -12, azimuth: 270, magnitude: -4.2, color: "#ffffff" },
  { name: "Mars",    altitude: 18, azimuth: 245, magnitude: 1.1,  color: "#f87171" },
  { name: "Saturn",  altitude: 31, azimuth: 152, magnitude: 0.8,  color: "#fcd34d" },
  { name: "Mercury", altitude: -5, azimuth: 260, magnitude: 0.5,  color: "#d1d5db" },
];

function CompassSVG({ azimuth, color }: { azimuth: number; color: string }) {
  const arrowRad = (azimuth - 90) * (Math.PI / 180);
  const cx = 14, cy = 14, r = 10;
  const ax = cx + r * Math.cos(arrowRad);
  const ay = cy + r * Math.sin(arrowRad);
  return (
    <svg width="28" height="28" viewBox="0 0 28 28">
      <circle cx="14" cy="14" r="12" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <text x="14" y="5" textAnchor="middle" fontSize="4" fill="rgba(255,255,255,0.4)" dominantBaseline="middle">N</text>
      <text x="14" y="23" textAnchor="middle" fontSize="4" fill="rgba(255,255,255,0.4)" dominantBaseline="middle">S</text>
      <text x="4" y="14" textAnchor="middle" fontSize="4" fill="rgba(255,255,255,0.4)" dominantBaseline="middle">W</text>
      <text x="24" y="14" textAnchor="middle" fontSize="4" fill="rgba(255,255,255,0.4)" dominantBaseline="middle">E</text>
      <line x1="14" y1="14" x2={ax} y2={ay} stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="14" cy="14" r="2" fill={color} />
    </svg>
  );
}

export function VisiblePlanetsCard({
  data,
  loading,
  lastUpdated,
}: {
  data?: { name: string; visibility: number; color: string }[];
  loading: boolean;
  lastUpdated?: string;
}) {
  const planets = FALLBACK_PLANETS;

  // Best visible = highest altitude above horizon
  const bestPlanet = planets
    .filter((p) => p.altitude > 0)
    .sort((a, b) => b.altitude - a.altitude)[0];

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col gap-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-32 h-32 rounded-full bg-yellow-500/5 blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fcd34d" strokeWidth="2">
          <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
          Visible Planets — Jun 2026
        </span>
      </div>

      {loading && !data ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-white/5 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {planets.map((planet) => {
            const isVisible = planet.altitude > 0;
            const isBest = bestPlanet?.name === planet.name;
            return (
              <div
                key={planet.name}
                className={`rounded-xl border px-3 py-2.5 flex items-center gap-3 transition-all ${
                  isBest
                    ? "border-yellow-500/30 bg-yellow-500/5"
                    : isVisible
                    ? "border-white/10 bg-white/[0.02]"
                    : "border-white/5 bg-transparent opacity-50"
                }`}
              >
                {/* Planet dot */}
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{
                    backgroundColor: isVisible ? planet.color : "#374151",
                    boxShadow: isVisible ? `0 0 8px ${planet.color}80` : "none",
                  }}
                />

                {/* Name + data */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-200">
                      {planet.name}
                    </span>
                    {isBest && (
                      <span className="font-mono text-[8px] uppercase tracking-wider bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded px-1.5 py-0.5">
                        ✦ ZENITH REGION
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 mt-0.5">
                    <span className="font-mono text-[9px] text-slate-500">
                      Alt: {planet.altitude > 0 ? `+${planet.altitude}°` : `${planet.altitude}°`}
                    </span>
                    <span className="font-mono text-[9px] text-slate-500">
                      Az: {planet.azimuth}°
                    </span>
                    <span className="font-mono text-[9px] text-slate-500">
                      Mag: {planet.magnitude.toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Compass */}
                {isVisible && <CompassSVG azimuth={planet.azimuth} color={planet.color} />}

                {/* Visibility badge */}
                <span
                  className={`font-mono text-[8px] uppercase tracking-wider rounded px-1.5 py-0.5 border shrink-0 ${
                    isVisible
                      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                      : "text-gray-500 border-gray-700 bg-transparent"
                  }`}
                >
                  {isVisible ? "Visible" : "Below"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="font-mono text-[9px] text-slate-600 text-right mt-auto">
        Fallback ephemeris · Jun 2026 · {lastUpdated}
      </p>
    </div>
  );
}
