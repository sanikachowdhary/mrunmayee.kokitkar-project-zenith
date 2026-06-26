"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useLocationStore } from "../../lib/api-client";

export default function ChallengePage() {
  const router = useRouter();
  const setLocation = useLocationStore((s) => s.setLocation);
  const [coords, setCoords] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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

    setLocation(lat, lng, `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    router.push(`/dashboard?lat=${lat}&lng=${lng}&t=${Date.now()}`);
  };

  const examples = [
    { label: "New Delhi", coords: "28.6139,77.2090" },
    { label: "New York", coords: "40.7128,-74.0060" },
    { label: "Svalbard", coords: "78.2232,15.6267" },
  ];

  return (
    <main className="page-with-nav flex-1 px-6 py-10">
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
            onChange={(e) => setCoords(e.target.value)}
            placeholder="28.6139,77.2090"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm text-slate-200 outline-none focus:border-sky-500/50 min-h-[44px] mb-4"
          />

          {error && <p className="text-red-400 text-sm mb-4 font-mono">{error}</p>}

          <button
            type="submit"
            className="w-full rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-mono text-xs uppercase tracking-widest py-3 font-semibold transition-colors min-h-[44px] cursor-pointer"
          >
            Load Cosmic Twin Data
          </button>
        </form>

        <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-3">Examples</p>
          <div className="flex flex-col gap-2">
            {examples.map((ex) => (
              <button
                key={ex.coords}
                type="button"
                onClick={() => setCoords(ex.coords)}
                className="text-left font-mono text-xs text-slate-300 hover:text-sky-300 transition-colors cursor-pointer min-h-[44px] py-2"
              >
                {ex.coords} ({ex.label})
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
