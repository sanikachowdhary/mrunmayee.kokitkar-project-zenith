"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchISSPosition,
  fetchSatellites,
  fetchHorizons,
  fetchObservationConditions,
  estimateTwinScore,
  generateLocalTelemetryMock,
  getZenithObject,
  type ISSData,
  type SatelliteProxyData,
  type WeatherData,
} from "./lib/real-api";
import { VisiblePlanetsCard } from "./cards/VisiblePlanetsCard";
import { ISSPositionCard } from "./cards/ISSPositionCard";
import { ActiveSatellitesCard } from "./cards/ActiveSatellitesCard";
import { ObservationConditions } from "./cards/ObservationConditions";
import { CosmicTwinScore } from "./cards/CosmicTwinScore";
import { PassPredictCard } from "./cards/PassPredictCard";
import { ZenithCard } from "./cards/ZenithCard";
import { ISSSpeedCard } from "./cards/ISSSpeedCard";
import { LocationSearch } from "../../components/LocationSearch";
import { APODDisplay } from "../../components/APODDisplay";
import { useLocationStore, hydrateLocationStore } from "../../lib/api-client";
import { useLiveTimestamp } from "../../lib/useLiveTimestamp";

const FALLBACK_DATA = generateLocalTelemetryMock(19.076, 72.8777);

// Toast notification
function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] transition-all duration-300"
      style={{
        opacity: visible ? 1 : 0,
        transform: `translateX(-50%) translateY(${visible ? 0 : 20}px)`,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div className="rounded-full border border-emerald-500/30 bg-slate-950/90 backdrop-blur-xl px-6 py-3 shadow-2xl flex items-center gap-2">
        <span className="text-emerald-400">✓</span>
        <span className="font-mono text-[11px] text-slate-200">{message}</span>
      </div>
    </div>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { latitude, longitude, locationName, setLocation } = useLocationStore();
  const lastUpdated = useLiveTimestamp(5000);

  const [lat, setLat] = useState(19.076);
  const [lng, setLng] = useState(72.8777);
  const [issData, setIssData] = useState<ISSData | null>(null);
  const [satData, setSatData] = useState<SatelliteProxyData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [localData, setLocalData] = useState(FALLBACK_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [zenithObject, setZenithObject] = useState("Jupiter");
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    hydrateLocationStore();
  }, []);

  // Read URL params on mount
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

    // Browser geolocation attempt
    if (typeof navigator !== "undefined" && navigator.geolocation && !urlLat) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation(pos.coords.latitude, pos.coords.longitude, "Your Location");
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
        },
        () => {
          setLocation(19.076, 72.8777, "Mumbai");
          setLat(19.076);
          setLng(72.8777);
        },
        { timeout: 3000 }
      );
    } else {
      setLat(latitude);
      setLng(longitude);
    }
  }, [searchParams, latitude, longitude, setLocation]);

  const loadData = useCallback(
    async (showSpinner = true) => {
      const currentRequestId = ++requestIdRef.current;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (showSpinner) setLoading(true);
      setError(null);

      const mock = generateLocalTelemetryMock(lat, lng);
      setLocalData(mock);
      setZenithObject(getZenithObject(lat, lng));

      try {
        const [iss, sats, , wxData] = await Promise.all([
          fetchISSPosition({ signal: controller.signal }).catch((err) => {
            if (controller.signal.aborted) return null;
            console.error(err);
            return null;
          }),
          fetchSatellites({ signal: controller.signal }).catch((err) => {
            if (controller.signal.aborted) return null;
            console.error(err);
            return null;
          }),
          fetchHorizons(lat, lng, undefined, { signal: controller.signal }).catch(() => null),
          fetchObservationConditions(lat, lng, { signal: controller.signal }).catch((err) => {
            if (controller.signal.aborted) return null;
            console.error(err);
            return null;
          }),
        ]);

        if (requestIdRef.current !== currentRequestId || controller.signal.aborted) return;

        setIssData(iss ?? null);
        setSatData(sats ?? null);
        setWeather(wxData ?? null);
        setLocalData({
          ...mock,
          weather: wxData ?? mock.weather,
          twinScore: estimateTwinScore(wxData ?? mock.weather, lat),
        });
        setCachedAt(new Date().toISOString());
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
        setError("API unavailable");
        setCachedAt((prev) => prev || new Date().toISOString());
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setLoading(false);
        }
      }
    },
    [lat, lng]
  );

  // Auto-load on mount
  useEffect(() => {
    loadData(true);
  }, [lat, lng, loadData]);

  // Poll ISS every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const freshISS = await fetchISSPosition();
      if (freshISS) setIssData(freshISS);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  const handleCopySkyLink = () => {
    const timestamp = new Date().toISOString();
    const link = `${window.location.origin}/dashboard?lat=${lat}&lng=${lng}&t=${timestamp}`;
    navigator.clipboard.writeText(link).then(() => {
      showToast("Sky link copied! Share with anyone.");
    });
  };

  return (
    <>
      <Toast message={toastMsg} visible={toastVisible} />

      <div className="w-full max-w-6xl mx-auto space-y-6">
        {/* Top bar: location + controls */}
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 backdrop-blur-xl shadow-2xl flex flex-col md:flex-row gap-4 items-end justify-between">
          <div className="w-full md:w-[400px]">
            <LocationSearch
              defaultQuery={locationName}
              onLocationSelect={(newLat, newLng) => {
                setLat(newLat);
                setLng(newLng);
                router.push(`/dashboard?lat=${newLat}&lng=${newLng}&t=${Date.now()}`);
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
              🔗 Share Sky Link
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

        {loading && (
          <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-slate-100 text-sm font-mono">
            Fetching fresh telemetry for {locationName} at {lat.toFixed(4)}, {lng.toFixed(4)}…
          </div>
        )}
        {error && (
          <p className="font-mono text-xs text-amber-400 text-center">
            Data unavailable — showing cache from{" "}
            {cachedAt ? new Date(cachedAt).toLocaleTimeString() + " UTC" : "earlier session"}
          </p>
        )}

        {/* Zenith Object — full width */}
        <div className="bg-yellow-100/10 border-2 border-yellow-500/50 p-6 rounded-2xl shadow-lg backdrop-blur-xl">
          <h3 className="font-bold text-lg text-yellow-300">🎯 Projected Zenith Object</h3>
          <p className="text-4xl font-bold text-yellow-400 mt-2">{zenithObject}</p>
          <p className="text-sm text-slate-400 mt-2">
            Predicted celestial body closest to zenith for {locationName}. Actual overhead alignment
            is modeled from orbital and horizon data.
          </p>
          <p className="text-xs text-gray-500 mt-2 font-mono">Last updated: {lastUpdated}</p>
        </div>

        {/* Main grid: responsive */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* ISS Telemetry */}
          <ISSPositionCard
            data={issData ?? undefined}
            loading={loading}
            lastUpdated={lastUpdated}
          />

          {/* ISS Speed Tracker */}
          <ISSSpeedCard lastUpdated={lastUpdated} />

          {/* Cosmic Twin Score — spans 2 cols on lg */}
          <div className="sm:col-span-2 lg:col-span-1">
            <CosmicTwinScore
              score={localData?.twinScore}
              loading={loading}
              lastUpdated={lastUpdated}
              weather={weather ?? undefined}
              lat={lat}
            />
          </div>

          {/* Observation Conditions */}
          <ObservationConditions
            data={weather ?? undefined}
            loading={loading}
            lastUpdated={lastUpdated}
          />

          {/* Visible Planets */}
          <VisiblePlanetsCard
            data={localData?.visiblePlanets}
            loading={loading}
            lastUpdated={lastUpdated}
          />

          {/* Active Satellites */}
          <ActiveSatellitesCard
            data={satData}
            loading={loading}
            lastUpdated={lastUpdated}
          />

          {/* ISS Pass Predictor */}
          <PassPredictCard lat={lat} lng={lng} lastUpdated={lastUpdated} />

          {/* Zenith Object Card */}
          <ZenithCard
            issAlt={issData ? undefined : undefined}
            lastUpdated={lastUpdated}
          />

          {/* APOD — spans full width */}
          <div className="sm:col-span-2 lg:col-span-3">
            <APODDisplay />
          </div>
        </div>
      </div>
    </>
  );
}

export function DashboardLayout() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-20 font-mono text-slate-500">
          Loading dashboard…
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
