"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface APODData {
  title: string;
  explanation: string;
  url: string;
  hdurl?: string;
  date: string;
  copyright?: string;
  mediaType: "image" | "video";
}

export function APODDisplay() {
  const [apod, setAPOD] = useState<APODData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAPOD() {
      try {
        setLoading(true);
        const res = await fetch("/api/apod");
        if (!res.ok) {
          throw new Error(`API returned ${res.status}`);
        }
        const data = await res.json();
        setAPOD(data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch APOD:", err);
        setError("Could not load astronomy picture");
        setAPOD(null);
      } finally {
        setLoading(false);
      }
    }

    fetchAPOD();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 backdrop-blur-xl animate-pulse">
        <div className="h-64 bg-slate-800/50 rounded-lg mb-4" />
        <div className="h-4 bg-slate-800/50 rounded w-3/4 mb-3" />
        <div className="h-4 bg-slate-800/50 rounded w-1/2" />
      </div>
    );
  }

  if (error || !apod) {
    return (
      <div className="rounded-2xl border border-orange-500/20 bg-orange-950/20 p-6 backdrop-blur-xl">
        <p className="font-mono text-sm text-orange-400">{error || "APOD not available"}</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-sky-500/20 bg-slate-950/70 p-6 backdrop-blur-xl overflow-hidden group"
    >
      <div className="relative overflow-hidden rounded-lg mb-4 bg-black/40 aspect-video">
        {apod.mediaType === "image" ? (
          <img
            src={apod.url}
            alt={apod.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-900">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-slate-600"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
      </div>

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-sky-400">
              Astronomy Picture of the Day
            </p>
            <h3 className="text-lg font-semibold text-white mt-1 leading-tight">
              {apod.title}
            </h3>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">
          {apod.explanation}
        </p>

        <div className="flex items-center justify-between text-xs text-slate-500 font-mono pt-2 border-t border-white/5">
          <span>{new Date(apod.date).toLocaleDateString()}</span>
          {apod.copyright && <span className="text-right">© {apod.copyright}</span>}
        </div>

        <div className="flex gap-2 pt-2">
          <a
            href={apod.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center px-3 py-2 rounded-lg border border-sky-500/30 hover:border-sky-500/60 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-sm font-mono uppercase tracking-wider transition-all"
          >
            View Full
          </a>
          {apod.hdurl && (
            <a
              href={apod.hdurl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center px-3 py-2 rounded-lg border border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-mono uppercase tracking-wider transition-all"
            >
              HD Download
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
