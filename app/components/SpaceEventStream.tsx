"use client";

import { useState, useEffect, useCallback } from "react";
import { useLiveTimestamp } from "../lib/useLiveTimestamp";

interface SpaceEvent {
  id: string;
  time: string;
  lat: number;
  lng: number;
  alt: number;
}

interface ISSResponse {
  message?: string;
  timestamp?: number;
  iss_position?: { latitude: string; longitude: string };
  altitude?: number;
  velocity?: number;
}

export function SpaceEventStream() {
  const [events, setEvents] = useState<SpaceEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(false);
  const lastUpdated = useLiveTimestamp(1000);

  const fetchISSEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/iss", { cache: "no-store" });
      if (!res.ok) throw new Error("ISS API failed");
      const data: ISSResponse = await res.json();

      if (data.message === "success" && data.iss_position) {
        const utcTime =
          new Date((data.timestamp ?? Date.now()) * 1000).toLocaleTimeString("en-US", {
            hour12: false,
            timeZone: "UTC",
          }) + " UTC";

        const latVal = parseFloat(data.iss_position.latitude);
        const lngVal = parseFloat(data.iss_position.longitude);
        const altVal = data.altitude ?? 418.5;

        const newEvent: SpaceEvent = {
          id: `iss-${data.timestamp ?? Date.now()}`,
          time: utcTime,
          lat: latVal,
          lng: lngVal,
          alt: altVal,
        };

        setEvents((prev) => {
          const filtered = prev.filter((e) => e.id !== newEvent.id);
          // Return last 5 entries sorted chronologically descending
          return [newEvent, ...filtered].slice(0, 5);
        });
        setConnected(true);
        setError(false);
      } else {
        throw new Error("Invalid ISS response");
      }
    } catch {
      setError(true);
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchISSEvents();
    const interval = setInterval(fetchISSEvents, 10000); // 10 seconds polling
    return () => clearInterval(interval);
  }, [fetchISSEvents]);

  return (
    <div className="flex flex-col h-[320px] min-h-[320px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20 shrink-0">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-amber-500 animate-ping"}`} />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-200 font-bold">
            ISS Live Telemetry Log
          </span>
        </div>
        <span className="font-mono text-[8px] uppercase tracking-wider text-slate-400">
          {connected ? "Live Stream" : "Connecting..."}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 font-mono text-[10px] leading-relaxed">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
            <span className="h-4 w-4 rounded-full border-2 border-sky-500/20 border-t-sky-500 animate-spin" />
            <p className="text-slate-400 animate-pulse text-[10px]">Connecting to ISS Stream...</p>
          </div>
        ) : (
          events.map((e) => (
            <div
              key={e.id}
              className="p-3 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all grid grid-cols-2 gap-x-4 gap-y-2"
            >
              <div className="col-span-2 flex items-center justify-between border-b border-white/5 pb-1">
                <span className="text-sky-400/80 font-bold uppercase tracking-wider text-[8px]">TIME UTC</span>
                <span className="text-slate-300 font-semibold">{e.time}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-500 text-[8px] uppercase tracking-wider">ISS Latitude</span>
                <span className="text-slate-300 font-semibold mt-0.5">{e.lat.toFixed(4)}° {e.lat >= 0 ? "N" : "S"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-500 text-[8px] uppercase tracking-wider">ISS Longitude</span>
                <span className="text-slate-300 font-semibold mt-0.5">{e.lng.toFixed(4)}° {e.lng >= 0 ? "E" : "W"}</span>
              </div>
              <div className="col-span-2 flex items-center justify-between border-t border-white/5 pt-1.5 mt-0.5">
                <span className="text-slate-500 text-[8px] uppercase tracking-wider">Altitude</span>
                <span className="text-emerald-400 font-semibold">{e.alt.toFixed(1)} km</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-2 border-t border-white/5 shrink-0 bg-black/10">
        <p className="text-[9px] text-gray-500 font-mono">Telemetry Clock: {lastUpdated}</p>
      </div>
    </div>
  );
}
