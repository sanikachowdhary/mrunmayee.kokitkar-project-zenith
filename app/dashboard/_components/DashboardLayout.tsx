"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  fetchISSPosition,
  fetchSatellites,
  fetchHorizons,
  generateLocalTelemetryMock,
  getZenithObject,
  type ISSData,
  type SatelliteProxyData,
} from "./lib/real-api";
import { VisiblePlanetsCard } from "./cards/VisiblePlanetsCard";
import { ISSPositionCard } from "./cards/ISSPositionCard";
import { ActiveSatellitesCard } from "./cards/ActiveSatellitesCard";
import { ObservationConditions } from "./cards/ObservationConditions";
import { CosmicTwinScore } from "./cards/CosmicTwinScore";
import { LocationSearch } from "../../components/LocationSearch";
import { useLocationStore, hydrateLocationStore } from "../../lib/api-client";
import { useLiveTimestamp } from "../../lib/useLiveTimestamp";

const FALLBACK_DATA = generateLocalTelemetryMock(19.076, 72.8777);

function DashboardContent() {
  const searchParams = useSearchParams();
  const { latitude, longitude, locationName, setLocation } = useLocationStore();
  const lastUpdated = useLiveTimestamp(5000);

  const [lat, setLat] = useState(19.076);
  const [lng, setLng] = useState(72.8777);
  const [issData, setIssData] = useState<ISSData | null>(null);
  const [satData, setSatData] = useState<SatelliteProxyData | null>(null);
  const [localData, setLocalData] = useState(FALLBACK_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [zenithObject, setZenithObject] = useState("Jupiter");

  useEffect(() => {
    hydrateLocationStore();
  }, []);

  useEffect(() => {
    const urlLat = searchParams.get("lat");
    const urlLng = searchParams.get("lng");
    if (urlLat && urlLng) {
      const parsedLat = parseFloat(urlLat);
      const parsedLng = parseFloat(urlLng);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        setLocation(parsedLat, parsedLng);
        setLat(parsedLat);
        setLng(parsedLng);
        return;
      }
    }
    setLat(latitude);
    setLng(longitude);
  }, [searchParams, latitude, longitude, setLocation]);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation && !searchParams.get("lat")) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation(pos.coords.latitude, pos.coords.longitude, "Your Location");
        },
        () => {},
        { timeout: 5000 }
      );
    }
  }, [searchParams, setLocation]);

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);

    const mock = generateLocalTelemetryMock(lat, lng);
    setLocalData(mock);
    setZenithObject(getZenithObject(lat, lng));

    try {
      const [iss, sats, horizons] = await Promise.all([
        fetchISSPosition().catch(() => null),
        fetchSatellites().catch(() => null),
        fetchHorizons(lat, lng).catch(() => null),
      ]);

      if (iss) setIssData(iss);
      if (sats) setSatData(sats);
      if (horizons?.zenithObject) setZenithObject(horizons.zenithObject);
      setCachedAt(new Date().toISOString());
    } catch {
      setError("API unavailable");
      if (!cachedAt) setCachedAt(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }, [lat, lng, cachedAt]);

  useEffect(() => {
    loadData(true);
  }, [lat, lng]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const interval = setInterval(async () => {
      const freshISS = await fetchISSPosition();
      if (freshISS) setIssData(freshISS);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCopySkyLink = () => {
    const timestamp = new Date().toISOString();
    const link = `${window.location.origin}/dashboard?lat=${lat}&lng=${lng}&t=${timestamp}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 backdrop-blur-xl shadow-2xl flex flex-col md:flex-row gap-4 items-end justify-between">
        <div className="w-full md:w-[400px]">
          <LocationSearch
            defaultQuery={locationName}
            onLocationSelect={(newLat, newLng) => {
              setLat(newLat);
              setLng(newLng);
            }}
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Link
            href="/dashboard/challenge"
            className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 font-mono text-[10px] uppercase tracking-widest px-4 py-3 transition-colors min-h-[44px]"
          >
            🎯 Challenge Mode
          </Link>
          <button
            type="button"
            onClick={handleCopySkyLink}
            className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 font-mono text-[10px] uppercase tracking-widest px-4 py-3 transition-colors min-h-[44px] cursor-pointer"
          >
            {copySuccess ? "Copied!" : "Copy Sky Link"}
          </button>
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-mono text-[10px] uppercase tracking-widest px-6 py-3 transition-colors disabled:opacity-50 min-h-[44px] cursor-pointer font-semibold"
          >
            {loading ? (
              <span className="h-4 w-4 rounded-full border-2 border-slate-950/20 border-t-slate-950 animate-spin" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            )}
            Sync Telemetry
          </button>
        </div>
      </div>

      {error && (
        <p className="font-mono text-xs text-amber-400 text-center">
          Data unavailable — showing cache from {cachedAt ? new Date(cachedAt).toLocaleTimeString() + " UTC" : "earlier session"}
        </p>
      )}

      <div className="bg-yellow-100/10 border-2 border-yellow-500/50 p-6 rounded-2xl shadow-lg backdrop-blur-xl">
        <h3 className="font-bold text-lg text-yellow-300">🎯 Zenith Object (Directly Overhead)</h3>
        <p className="text-4xl font-bold text-yellow-400 mt-2">{zenithObject}</p>
        <p className="text-sm text-slate-400 mt-2">
          The celestial body at exactly 90° altitude directly above {locationName} right now
        </p>
        <p className="text-xs text-gray-500 mt-2 font-mono">Last updated: {lastUpdated}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <CosmicTwinScore score={localData?.twinScore ?? 82} loading={loading && !localData} lastUpdated={lastUpdated} />
        <ObservationConditions data={localData?.weather} loading={loading && !localData} lastUpdated={lastUpdated} />
        <VisiblePlanetsCard data={localData?.visiblePlanets} loading={loading && !localData} lastUpdated={lastUpdated} />
        <ISSPositionCard data={issData ?? undefined} loading={loading && !issData} lastUpdated={lastUpdated} />
        <ActiveSatellitesCard data={satData} loading={loading && !satData} lastUpdated={lastUpdated} />
      </div>
    </div>
  );
}

export function DashboardLayout() {
  return (
    <Suspense fallback={<div className="text-center py-20 font-mono text-slate-500">Loading dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
