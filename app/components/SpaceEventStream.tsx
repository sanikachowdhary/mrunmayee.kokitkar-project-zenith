"use client";

import { useState, useEffect, useCallback } from "react";
import { useLiveTimestamp } from "../lib/useLiveTimestamp";

interface SpaceEvent {
  id: string;
  time: string;
  lat: number;
  lng: number;
  alt: number;
  type: "iss" | "satellite" | "weather";
  label: string;
}

interface ISSResponse {
  message?: string;
  timestamp?: number;
  iss_position?: { latitude: string; longitude: string };
  altitude?: number;
  velocity?: number;
}

// Static seed events to show immediately on page load
const STATIC_EVENTS: SpaceEvent[] = [
  {
    id: "static-celestrak-1",
    time: "Pre-loaded",
    lat: 51.6,
    lng: -3.2,
    alt: 408.3,
    type: "satellite",
    label: "CelesTrak: Sentinel-6A passed over Atlantic corridor",
  },
  {
    id: "static-weather-1",
    time: "Pre-loaded",
    lat: 23.5,
    lng: 121.0,
    alt: 705.0,
    type: "weather",
    label: "NOAA-20: Tropical cyclone imagery captured over Pacific",
  },
];

export function SpaceEventStream() {
  const [events, setEvents] = useState<SpaceEvent[]>(STATIC_EVENTS);
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
          type: "iss",
          label: `ISS now at ${latVal.toFixed(2)}°, ${lngVal.toFixed(2)}° — altitude ${altVal.toFixed(1)}km`,
        };

        setEvents((prev) => {
          const filtered = prev.filter((e) => e.id !== newEvent.id);
          return [newEvent, ...filtered].slice(0, 10);
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
    // Fetch immediately on mount
    fetchISSEvents();
    // Then poll every 30 seconds
    const interval = setInterval(fetchISSEvents, 30000);
    return () => clearInterval(interval);
  }, [fetchISSEvents]);

  const getEventIcon = (type: SpaceEvent["type"]) => {
    if (type === "iss") return "🛸";
    if (type === "satellite") return "🛰";
    return "🌦";
  };

  const getEventColor = (type: SpaceEvent["type"]) => {
    if (type === "iss") return "text-cyan-400";
    if (type === "satellite") return "text-violet-400";
    return "text-sky-400";
  };

  return (
    <div className="flex flex-col h-[320px] min-h-[320px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20 shrink-0">
        <div className="flex items-center gap-2">
          {/* Red pulsing live badge */}
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400/80 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 live-badge" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-200 font-bold">
            Space Event Stream
          </span>
        </div>
        <span className="font-mono text-[8px] uppercase tracking-wider text-slate-400">
          {connected ? "● Live" : error ? "⚠ Reconnecting" : "Connecting..."}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {events.map((e) => (
          <div
            key={e.id}
            className="p-2.5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all"
          >
            <div className="flex items-start gap-2">
              <span className="text-sm shrink-0 mt-0.5">{getEventIcon(e.type)}</span>
              <div className="min-w-0">
                <p className={`font-mono text-[10px] font-semibold leading-snug ${getEventColor(e.type)}`}>
                  {e.label}
                </p>
                <div className="flex items-center gap-3 mt-1 font-mono text-[8px] text-slate-500">
                  <span>{e.time}</span>
                  {e.type === "iss" && (
                    <span className="text-emerald-400/70">alt: {e.alt.toFixed(1)}km</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-2 border-t border-white/5 shrink-0 bg-black/10">
        <p className="text-[9px] text-gray-500 font-mono">Stream clock: {lastUpdated} · polling every 30s</p>
      </div>
    </div>
  );
}
