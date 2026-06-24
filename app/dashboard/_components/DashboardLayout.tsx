"use client";

import { useState, useEffect } from "react";
import { fetchISSPosition, fetchSatellites, generateLocalTelemetryMock, type ISSData, type SatelliteProxyData } from "./lib/real-api";
import { VisiblePlanetsCard } from "./cards/VisiblePlanetsCard";
import { ISSPositionCard } from "./cards/ISSPositionCard";
import { ActiveSatellitesCard } from "./cards/ActiveSatellitesCard";
import { ObservationConditions } from "./cards/ObservationConditions";
import { CosmicTwinScore } from "./cards/CosmicTwinScore";
import { LocationSearch } from "../../components/LocationSearch";

export function DashboardLayout() {
  const [lat, setLat] = useState(19.0760); // Default Mumbai
  const [lng, setLng] = useState(72.8777);
  const [issData, setIssData] = useState<ISSData | null>(null);
  const [satData, setSatData] = useState<SatelliteProxyData | null>(null);
  const [localData, setLocalData] = useState<ReturnType<typeof generateLocalTelemetryMock> | null>(null);
  
  const [loading, setLoading] = useState(true);

  // Initial load & Location-based data
  useEffect(() => {
    let active = true;
    setLoading(true);
    
    // Update local deterministic data
    setLocalData(generateLocalTelemetryMock(lat, lng));

    // Fetch initial satellite data (this doesn't change frequently)
    fetchSatellites().then(res => {
      if (active && res) setSatData(res);
    });

    // Initial ISS fetch
    fetchISSPosition().then(res => {
      if (active && res) {
        setIssData(res);
        setLoading(false);
      }
    });

    return () => { active = false; };
  }, [lat, lng]);

  // ISS Live Polling (every 5 seconds)
  useEffect(() => {
    const interval = setInterval(async () => {
      const freshISS = await fetchISSPosition();
      if (freshISS) setIssData(freshISS);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = () => {
    setLoading(true);
    setLocalData(generateLocalTelemetryMock(lat, lng));
    
    Promise.all([
      fetchISSPosition().then(res => { if (res) setIssData(res); }),
      fetchSatellites().then(res => { if (res) setSatData(res); })
    ]).finally(() => setLoading(false));
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      
      {/* ── Input Header ── */}
      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 backdrop-blur-xl shadow-2xl flex flex-col md:flex-row gap-4 items-end justify-between">
        <div className="w-full md:w-[400px]">
          <LocationSearch 
            defaultQuery="Mumbai"
            onLocationSelect={(newLat, newLng) => {
              setLat(newLat);
              setLng(newLng);
            }} 
          />
        </div>
        
        <button 
          onClick={handleManualRefresh}
          disabled={loading}
          className="w-full md:w-auto flex items-center justify-center gap-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-mono text-[10px] uppercase tracking-widest px-6 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
        >
          {loading ? (
            <span className="h-4 w-4 rounded-full border-2 border-slate-950/20 border-t-slate-950 animate-spin" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          )}
          <span>Sync Telemetry</span>
        </button>
      </div>

      {/* ── Dashboard Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <CosmicTwinScore score={localData?.twinScore} loading={loading} />
        <ObservationConditions data={localData?.weather} loading={loading} />
        <VisiblePlanetsCard data={localData?.visiblePlanets} loading={loading} />
        <ISSPositionCard data={issData || undefined} loading={loading} />
        <ActiveSatellitesCard data={satData} loading={loading} />
      </div>

    </div>
  );
}
