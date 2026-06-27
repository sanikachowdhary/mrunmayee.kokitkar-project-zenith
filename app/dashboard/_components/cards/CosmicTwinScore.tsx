"use client";

import { motion } from "framer-motion";

interface WeatherData {
  cloudCover: number;
  seeing: number | string;
  transparency: string;
  windSpeed?: number;
  precipitation?: number;
}

function computeCosmicTwinScore(
  weather: WeatherData | undefined,
  lat: number
): { score: number; cloudPenalty: number; timeBonus: number; latBonus: number; windPenalty: number } {
  const base = 70;
  const cloudCover = weather?.cloudCover ?? 40;
  const windSpeed = weather?.windSpeed ?? 0;
  const hour = new Date().getHours();

  const cloudPenalty = Math.round(cloudCover * 0.5);
  const timeBonus = hour >= 21 || hour <= 4 ? 15 : 0;
  const latAbs = Math.abs(lat);
  const latBonus = latAbs >= 20 && latAbs <= 60 ? 10 : 0;
  const windPenalty = windSpeed > 20 ? 5 : 0;

  const raw = base - cloudPenalty + timeBonus + latBonus - windPenalty;
  const score = Math.max(0, Math.min(100, raw));

  return { score, cloudPenalty, timeBonus, latBonus, windPenalty };
}

function getScoreColor(score: number): string {
  if (score <= 40) return "#ef4444";
  if (score <= 70) return "#f59e0b";
  return "#10b981";
}

function getScoreLabel(score: number): string {
  if (score <= 40) return "Poor";
  if (score <= 60) return "Fair";
  if (score <= 80) return "Good";
  return "Excellent";
}

interface SubBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
}

function SubBar({ label, value, max, color }: SubBarProps) {
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
        <span className="font-mono text-[9px] text-slate-400">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export function CosmicTwinScore({
  score: externalScore,
  loading,
  lastUpdated,
  weather,
  lat,
}: {
  score?: number;
  loading: boolean;
  lastUpdated?: string;
  weather?: WeatherData;
  lat?: number;
}) {
  const { score, cloudPenalty, timeBonus, latBonus, windPenalty } =
    computeCosmicTwinScore(weather, lat ?? 19.076);

  const finalScore = externalScore ?? score;
  const color = getScoreColor(finalScore);
  const label = getScoreLabel(finalScore);

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (finalScore / 100) * circumference;

  // Sub-scores
  const cloudCover = weather?.cloudCover ?? 40;
  const skyClarity = Math.max(0, 100 - cloudCover);
  // Light pollution based on latitude (equatorial/tropical = more urban = worse)
  const latAbs = Math.abs(lat ?? 19);
  const lightPollutionIndex = latAbs > 60 ? 80 : latAbs > 20 ? 40 : 30;
  const atmosphericSeeing = Math.max(
    0,
    Math.min(100, 100 - cloudCover - (weather?.windSpeed ?? 0) * 2)
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col gap-5 relative overflow-hidden md:col-span-2">
      <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: `${color}10` }} />

      {/* Header */}
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><path d="M12 8l4 4-4 4M8 12h8" />
        </svg>
        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
          Cosmic Twin Score
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Animated ring */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg width="130" height="130" className="transform -rotate-90">
            <circle cx="65" cy="65" r={radius} stroke="rgba(255,255,255,0.05)" strokeWidth="10" fill="transparent" />
            {!loading && (
              <motion.circle
                cx="65"
                cy="65"
                r={radius}
                stroke={color}
                strokeWidth="10"
                fill="transparent"
                strokeLinecap="round"
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                style={{
                  strokeDasharray: circumference,
                  filter: `drop-shadow(0 0 8px ${color}80)`,
                }}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              className="font-mono text-3xl font-bold"
              style={{ color }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {finalScore}
            </motion.span>
            <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color }}>
              {label}
            </span>
          </div>
        </div>

        {/* Sub-scores and breakdown */}
        <div className="flex-1 w-full space-y-3">
          <SubBar label="Sky Clarity" value={skyClarity} max={100} color="#22d3ee" />
          <SubBar label="Light Pollution Index" value={lightPollutionIndex} max={100} color="#a855f7" />
          <SubBar label="Atmospheric Seeing" value={atmosphericSeeing} max={100} color="#10b981" />

          {/* Score breakdown */}
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 grid grid-cols-2 gap-2 text-[9px] font-mono mt-1">
            <span className="text-slate-500">Base score:</span>
            <span className="text-slate-300 text-right">+70</span>
            <span className="text-slate-500">Cloud penalty:</span>
            <span className="text-red-400 text-right">−{cloudPenalty}</span>
            <span className="text-slate-500">Night bonus:</span>
            <span className="text-emerald-400 text-right">+{timeBonus}</span>
            <span className="text-slate-500">Latitude bonus:</span>
            <span className="text-sky-400 text-right">+{latBonus}</span>
            <span className="text-slate-500">Wind penalty:</span>
            <span className="text-amber-400 text-right">−{windPenalty}</span>
          </div>
        </div>
      </div>

      <p className="font-mono text-[9px] text-slate-600 text-right">{lastUpdated}</p>
    </div>
  );
}
