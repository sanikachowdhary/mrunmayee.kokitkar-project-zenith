"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import Link from "next/link";
import { useLocationStore } from "../../lib/api-client";

// Special named regions that are edge cases
function getSpecialLocationName(lat: number, lng: number): string | null {
  if (lat > 88) return "North Pole";
  if (lat < -88) return "South Pole";
  if (lat > 66.5) return `Arctic Circle (${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E)`;
  if (lat < -66.5) return `Antarctic Circle (${Math.abs(lat).toFixed(2)}°S, ${Math.abs(lng).toFixed(2)}°W)`;

  if (Math.abs(lat) < 50 && (lng < -120 || lng > 140) && Math.abs(lat) > 5) {
    return `Pacific Ocean (${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"})`;
  }
  if (Math.abs(lat) < 5 && (lng < -80 || lng > 150)) {
    return "Equatorial Pacific Ocean";
  }
  if (Math.abs(lat) < 55 && lng > -50 && lng < -15) {
    return "Atlantic Ocean";
  }
  if (lat < 30 && lat > -45 && lng > 40 && lng < 100) {
    return "Indian Ocean";
  }

  return null;
}

function getCosmicTwinScore(lat: number, lng: number): {
  score: number;
  title: string;
  summary: string;
  darkSkyRating: string;
  issVisibility: string;
  note?: string;
} {
  const isHighAltitude = Math.abs(lat) > 30 && Math.abs(lat) < 60;
  const isRemote = Math.abs(Math.sin(lat * lng * 0.01)) > 0.7;
  const isNearEquator = Math.abs(lat) < 25;
  const isHighLat = Math.abs(lat) > 66.5;
  const isOcean = Math.abs(Math.cos(lng * 0.03) * Math.sin(lat * 0.04)) < 0.25;

  let score = 50;
  if (isHighAltitude) score += 15;
  if (isRemote) score += 10;
  if (isNearEquator) score += 5;
  if (isOcean) score += 12;
  if (isHighLat) score -= 5;

  score = Math.max(12, Math.min(98, score));

  let title = "Standard Observer";
  if (score >= 85) title = "Elite Dark Sky Zone";
  else if (score >= 70) title = "Prime Stargazer";
  else if (score >= 55) title = "Active Observer";

  const darkSkyRating = isOcean ? "Bortle 1 (Perfect)" : isRemote ? "Bortle 2-3 (Excellent)" : "Bortle 4-6 (Good–Moderate)";
  const issVisibility = Math.abs(lat) <= 60
    ? `ISS passes visible (inclination zone: ${lat.toFixed(1)}°)`
    : `Polar region — ISS passes rare at ${lat.toFixed(1)}°`;

  let note: string | undefined;
  if (Math.abs(lat) > 66.5) {
    note = `⚠ Polar region: ${lat > 0 ? "Midnight sun" : "Polar night"} in summer/winter — sky conditions vary dramatically.`;
  } else if (isOcean) {
    note = "🌊 Open ocean location detected — no light pollution, ideal sky but remote access.";
  }

  const summary = `${isRemote ? "Remote, pristine dark sky site." : "Accessible observation point."} ${isNearEquator ? "Equatorial belt provides year-round visibility of both hemispheres." : ""}`;

  return { score, title, summary, darkSkyRating, issVisibility, note };
}

export default function ChallengeClient() {
  const router = useRouter();
  const setLocation = useLocationStore((s) => s.setLocation);
  const [coords, setCoords] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{
    lat: number; lng: number; name: string;
    twin: ReturnType<typeof getCosmicTwinScore>;
  } | null>(null);

  const resolveLocationName = useCallback(async (lat: number, lng: number): Promise<string> => {
    const special = getSpecialLocationName(lat, lng);
    if (special) return special;

    try {
      const res = await fetch(`/api/geocode?q=${lat},${lng}`);
      if (res.ok) {
        const data = await res.json();
        if (data.displayName) {
          const parts = data.displayName.split(",");
          return parts.slice(0, 3).join(",").trim();
        }
      }
    } catch {
      // silent fallback
    }
    return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`;
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPreview(null);

    const match = coords.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) {
      setError("Enter coordinates as latitude,longitude (e.g. 28.6139,77.2090)");
      return;
    }

    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setError("Latitude must be between -90 and 90");
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setError("Longitude must be between -180 and 180");
      return;
    }

    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const name = await resolveLocationName(lat, lng);
    const twin = getCosmicTwinScore(lat, lng);

    setLoading(false);
    setPreview({ lat, lng, name, twin });
  }, [coords, resolveLocationName]);

  const handleConfirm = () => {
    if (!preview) return;
    setLocation(preview.lat, preview.lng, preview.name);
    router.push(`/dashboard?lat=${preview.lat}&lng=${preview.lng}&t=${Date.now()}`);
  };

  const handleRandomCoord = () => {
    const lat = parseFloat((Math.random() * 160 - 80).toFixed(4));
    const lng = parseFloat((Math.random() * 360 - 180).toFixed(4));
    setCoords(`${lat},${lng}`);
    setPreview(null);
    setError(null);
  };

  const examples = [
    { label: "New Delhi", coords: "28.6139,77.2090" },
    { label: "New York", coords: "40.7128,-74.0060" },
    { label: "Svalbard", coords: "78.2232,15.6267" },
    { label: "Pacific Ocean", coords: "-0.0000,-170.0000" },
  ];

  return (
    <main className="page-with-nav flex-1 px-6 py-10" style={{ background: "#030409" }}>
      <div className="mx-auto max-w-xl">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-slate-500 hover:text-sky-400 transition-colors"
        >
          ← Back to Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-white mb-2">🎯 Coordinate Challenge Mode</h1>
        <p className="text-slate-400 text-sm mb-8">
          Enter any latitude and longitude to load the Cosmic Twin engine for that exact point on Earth.
        </p>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 backdrop-blur-xl">
          <label className="mb-2 block font-mono text-[9px] uppercase tracking-wider text-slate-500">
            Enter coordinates: latitude,longitude
          </label>
          <input
            type="text"
            value={coords}
            onChange={(e) => { setCoords(e.target.value); setPreview(null); }}
            placeholder="28.6139,77.2090"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm text-slate-200 outline-none focus:border-sky-500/50 min-h-[44px] mb-4"
          />

          {error && <p className="text-red-400 text-sm mb-4 font-mono">{error}</p>}

          <div className="flex gap-2 mb-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 font-mono text-xs uppercase tracking-widest py-3 font-semibold transition-colors min-h-[44px] cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-slate-950/20 border-t-slate-950 animate-spin" />
                  Analyzing coordinates...
                </>
              ) : (
                "Load Cosmic Twin Data"
              )}
            </button>
            <button
              type="button"
              onClick={handleRandomCoord}
              className="px-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 font-mono text-xs uppercase tracking-widest transition-colors min-h-[44px] cursor-pointer whitespace-nowrap"
              title="Test with Random Coordinate"
            >
              🎲 Random
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {examples.map(ex => (
              <button
                key={ex.label}
                type="button"
                onClick={() => { setCoords(ex.coords); setPreview(null); setError(null); }}
                className="rounded-full border border-white/10 bg-white/5 hover:bg-sky-500/20 hover:border-sky-500/30 px-3 py-1.5 font-mono text-[10px] text-slate-400 hover:text-sky-300 transition-all cursor-pointer"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </form>

        {loading && (
          <div className="mt-6 rounded-2xl border border-sky-500/20 bg-slate-950/60 p-6 backdrop-blur-xl">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-white/10 rounded w-2/3" />
              <div className="h-8 bg-white/10 rounded w-1/2" />
              <div className="h-3 bg-white/10 rounded w-full" />
              <div className="h-3 bg-white/10 rounded w-5/6" />
              <div className="h-3 bg-white/10 rounded w-3/4" />
            </div>
            <p className="font-mono text-[10px] text-sky-400 uppercase tracking-widest mt-4 animate-pulse">
              ⚡ Resolving location intelligence...
            </p>
          </div>
        )}

        {preview && !loading && (
          <div className="mt-6 rounded-2xl border border-sky-500/20 bg-slate-950/60 p-6 backdrop-blur-xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-sky-400">Location Resolved</p>
                <h2 className="text-lg font-bold text-white mt-1 leading-tight">{preview.name}</h2>
                <p className="font-mono text-[10px] text-slate-500 mt-0.5">
                  {preview.lat.toFixed(4)}°, {preview.lng.toFixed(4)}°
                </p>
              </div>
              <div className="flex flex-col items-center shrink-0">
                <div className="relative h-16 w-16">
                  <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke={preview.twin.score >= 70 ? "#34D399" : preview.twin.score >= 50 ? "#FBBF24" : "#F87171"}
                      strokeWidth="3"
                      strokeDasharray={`${preview.twin.score} 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-black text-lg text-white">{preview.twin.score}</span>
                  </div>
                </div>
                <span className="font-mono text-[8px] text-slate-400 mt-1 uppercase tracking-wider">Twin Score</span>
              </div>
            </div>

            <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4 space-y-2.5 font-mono text-[10px]">
              <div className="flex justify-between">
                <span className="text-slate-500 uppercase">Classification</span>
                <span className="text-sky-300 font-semibold">{preview.twin.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 uppercase">Dark Sky Rating</span>
                <span className="text-slate-200">{preview.twin.darkSkyRating}</span>
              </div>
              <div className="flex justify-between items-start gap-4">
                <span className="text-slate-500 uppercase shrink-0">ISS Visibility</span>
                <span className="text-slate-200 text-right">{preview.twin.issVisibility}</span>
              </div>
              <p className="text-slate-400 leading-relaxed pt-1 border-t border-white/5">{preview.twin.summary}</p>
            </div>

            {preview.twin.note && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 font-mono text-[10px] text-amber-300">
                {preview.twin.note}
              </div>
            )}

            <button
              type="button"
              onClick={handleConfirm}
              className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-xs uppercase tracking-widest py-3 font-semibold transition-colors min-h-[44px] cursor-pointer"
            >
              🚀 Open Full Dashboard for This Location
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
