"use client";

import { useState, useEffect, useCallback } from "react";
import { useLiveTimestamp } from "../lib/useLiveTimestamp";

interface SpaceEvent {
  id: string;
  time: string;
  text: string;
  category: string;
}

interface ISSResponse {
  message?: string;
  timestamp?: number;
  iss_position?: { latitude: string; longitude: string };
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

        const lat = parseFloat(data.iss_position.latitude).toFixed(4);
        const lng = parseFloat(data.iss_position.longitude).toFixed(4);

        const newEvent: SpaceEvent = {
          id: `iss-${data.timestamp ?? Date.now()}`,
          time: utcTime,
          text: `ISS position update: ${lat}°N, ${lng}°E — altitude ~408 km, velocity ~27,600 km/h`,
          category: "iss",
        };

        setEvents((prev) => {
          const filtered = prev.filter((e) => e.id !== newEvent.id);
          return [newEvent, ...filtered].slice(0, 12);
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
    const interval = setInterval(fetchISSEvents, 30000);
    return () => clearInterval(interval);
  }, [fetchISSEvents]);

  return (
    <div className="flex flex-col h-[200px] min-h-[200px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20 shrink-0">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${connected ? "bg-red-500" : "bg-amber-500"}`} />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-200 font-bold">
            Space Event Stream
          </span>
        </div>
        <span className="font-mono text-[8px] uppercase tracking-wider text-slate-400">
          {connected ? "Connected" : "Reconnecting"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 font-mono text-[10px] leading-relaxed">
        {error && events.length === 0 ? (
          <div className="p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
            <p className="text-slate-300">Zenith network online. Telemetry streaming.</p>
            <p className="text-emerald-400 text-[8px] mt-1">Connected</p>
          </div>
        ) : (
          events.map((e) => (
            <div
              key={e.id}
              className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-500 text-[8px]">{e.time}</span>
                <span className="px-1.5 py-0.5 rounded-[4px] text-[7px] uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-400/20">
                  {e.category}
                </span>
              </div>
              <p className="text-slate-300">{e.text}</p>
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-2 border-t border-white/5 shrink-0">
        <p className="text-xs text-gray-500 font-mono">Last updated: {lastUpdated}</p>
      </div>
    </div>
  );
}
