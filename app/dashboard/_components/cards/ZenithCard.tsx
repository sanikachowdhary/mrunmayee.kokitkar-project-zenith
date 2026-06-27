"use client";

// Constellation → month lookup (for lat 0-60°N)
const CONSTELLATION_BY_MONTH: Record<number, string> = {
  0: "Gemini",
  1: "Gemini",
  2: "Cancer",
  3: "Leo",
  4: "Virgo",
  5: "Cancer / Gemini", // June — zenith for Mumbai lat 19°
  6: "Leo",
  7: "Aquila",
  8: "Aquarius",
  9: "Pisces",
  10: "Aries",
  11: "Taurus",
};

interface Planet {
  name: string;
  altitude: number;
  type: "Planet";
}

const PLANETS: Planet[] = [
  { name: "Jupiter", altitude: 42, type: "Planet" },
  { name: "Mars",    altitude: 18, type: "Planet" },
  { name: "Saturn",  altitude: 31, type: "Planet" },
];

interface ZenithObject {
  name: string;
  altitude: number;
  type: string;
  distFromZenith: number;
}

function computeZenithObject(issAlt?: number): ZenithObject {
  const allObjects: { name: string; altitude: number; type: string }[] = [
    ...PLANETS,
    ...(issAlt && issAlt > 0
      ? [{ name: "ISS", altitude: issAlt, type: "Satellite" }]
      : []),
  ];

  if (allObjects.length === 0) {
    const month = new Date().getMonth();
    return {
      name: CONSTELLATION_BY_MONTH[month] ?? "Gemini",
      altitude: 72,
      type: "Constellation",
      distFromZenith: 18,
    };
  }

  const best = allObjects.reduce((a, b) => (a.altitude > b.altitude ? a : b));
  return {
    name: best.name,
    altitude: best.altitude,
    type: best.type,
    distFromZenith: Math.max(0, 90 - best.altitude),
  };
}

export function ZenithCard({
  issAlt,
  lastUpdated,
}: {
  issAlt?: number;
  lastUpdated?: string;
}) {
  const obj = computeZenithObject(issAlt);

  const typeColors: Record<string, string> = {
    Planet: "#fcd34d",
    Satellite: "#22d3ee",
    Constellation: "#a855f7",
    Star: "#f9fafb",
  };
  const color = typeColors[obj.type] ?? "#f9fafb";

  // Ring position: 0° zenith at center, 90° at edge
  const ringPct = (obj.distFromZenith / 90) * 100;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col gap-4 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-10"
        style={{ background: `radial-gradient(circle at 50% 50%, ${color}, transparent 70%)` }}
      />

      {/* Header */}
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
        </svg>
        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
          Zenith Object
        </span>
      </div>

      {/* Object display */}
      <div className="flex items-center gap-5">
        {/* Zenith position SVG */}
        <div className="relative shrink-0 w-24 h-24">
          <svg viewBox="0 0 96 96" width="96" height="96">
            {/* Horizon */}
            <circle cx="48" cy="48" r="44" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            {/* 60° ring */}
            <circle cx="48" cy="48" r="29" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="2,2" />
            {/* 30° ring */}
            <circle cx="48" cy="48" r="14" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="2,2" />
            {/* N/S/E/W */}
            <text x="48" y="6" textAnchor="middle" fontSize="5" fill="rgba(255,255,255,0.3)" dominantBaseline="middle">N</text>
            <text x="48" y="92" textAnchor="middle" fontSize="5" fill="rgba(255,255,255,0.3)" dominantBaseline="middle">S</text>
            {/* Object dot — placed based on dist from zenith */}
            <circle
              cx="48"
              cy={48 - (44 * (1 - ringPct / 100))}
              r="4"
              fill={color}
              style={{ filter: `drop-shadow(0 0 6px ${color})` }}
            />
            {/* Zenith crosshair */}
            <line x1="44" y1="48" x2="52" y2="48" stroke="#22d3ee" strokeWidth="1" opacity="0.5" />
            <line x1="48" y1="44" x2="48" y2="52" stroke="#22d3ee" strokeWidth="1" opacity="0.5" />
          </svg>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-2">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">
              Nearest to Zenith
            </p>
            <p className="font-mono text-xl font-bold" style={{ color }}>
              {obj.name}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border"
                style={{ color, borderColor: `${color}50`, backgroundColor: `${color}15` }}
              >
                {obj.type}
              </span>
            </div>
            <p className="font-mono text-[10px] text-slate-400">
              Alt: <span className="text-slate-200 font-semibold">{obj.altitude}°</span>
            </p>
            <p className="font-mono text-[10px] text-slate-400">
              From zenith: <span className="text-slate-200 font-semibold">{obj.distFromZenith.toFixed(1)}°</span>
            </p>
          </div>
        </div>
      </div>

      {/* Constellation context */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
        <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">
          Zenith Constellation — Jun 2026, Mumbai
        </p>
        <p className="font-mono text-sm font-semibold text-purple-400">
          {CONSTELLATION_BY_MONTH[new Date().getMonth()]}
        </p>
        <p className="font-mono text-[9px] text-slate-500 mt-1">
          The zenith point passes through this constellation at lat ~19°N during June
        </p>
      </div>

      <p className="font-mono text-[9px] text-slate-600 text-right">{lastUpdated}</p>
    </div>
  );
}
