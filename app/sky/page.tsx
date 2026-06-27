"use client";

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { LocationSearch } from "../components/LocationSearch";
import { TimelineControls, getModeLabel } from "../components/TimelineControls";
import { useLocationStore, hydrateLocationStore } from "../lib/api-client";
import { useLiveTimestamp } from "../lib/useLiveTimestamp";
import dynamic from "next/dynamic";

const SkyDomeCanvas = dynamic(
  () => import("./_components/SkyDomeCanvas").then(m => ({ default: m.SkyDomeCanvas })),
  { ssr: false }
);

/* ------------------------------------------------------------------ */
/* Types & Math                                                        */
/* ------------------------------------------------------------------ */

interface GeoCoords { lat: number; lng: number; }

interface SkyData {
  sunAltitude: number;
  sunAzimuth: number;
  moonPhase: number;
  moonPhaseName: string;
  siderealTime: number;
  dayLengthHr: number;
  isDay: boolean;
  isTwilight: boolean;
  visiblePlanets: string[];
}

function getMoonPhaseName(phase: number): string {
  if (phase < 0.03 || phase > 0.97) return "🌑 New Moon";
  if (phase < 0.22) return "🌒 Waxing Crescent";
  if (phase < 0.28) return "🌓 First Quarter";
  if (phase < 0.47) return "🌔 Waxing Gibbous";
  if (phase < 0.53) return "🌕 Full Moon";
  if (phase < 0.72) return "🌖 Waning Gibbous";
  if (phase < 0.78) return "🌗 Last Quarter";
  return "🌘 Waning Crescent";
}

function getVisiblePlanets(date: Date): string[] {
  const d = (date.getTime() / 86400000) + 2440587.5 - 2451545.0;
  const planets = [];
  const month = date.getMonth();
  if (Math.sin(d / 116) > 0.3) planets.push("♂ Mars");
  if (Math.sin(d / 398.88) > 0.4) planets.push("♃ Jupiter");
  if (Math.sin(d / 378.09) > 0.2) planets.push("♄ Saturn");
  if (month >= 3 && month <= 8) planets.push("♀ Venus");
  if (Math.abs(Math.sin(d / 87.97)) > 0.7) planets.push("☿ Mercury");
  return planets.slice(0, 3);
}

function calculateSkyData(date: Date, coords: GeoCoords): SkyData {
  const jd = (date.getTime() / 86400000) + 2440587.5;
  const d = jd - 2451545.0;

  let gmst = 18.697374558 + 24.06570982441908 * d;
  gmst = ((gmst % 24) + 24) % 24;
  const lmst = ((gmst + coords.lng / 15) % 24 + 24) % 24;

  const q = (280.459 + 0.98564736 * d) % 360;
  const g = ((357.529 + 0.98560028 * d) % 360) * (Math.PI / 180);
  const eclipticLon = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * (Math.PI / 180);
  const epsilon = (23.439 - 0.00000036 * d) * (Math.PI / 180);

  let ra = Math.atan2(Math.cos(epsilon) * Math.sin(eclipticLon), Math.cos(eclipticLon));
  const dec = Math.asin(Math.sin(epsilon) * Math.sin(eclipticLon));
  ra = (((ra * 180 / Math.PI) / 15) + 24) % 24;

  const ha = (lmst - ra) * 15 * (Math.PI / 180);
  const latRad = coords.lat * (Math.PI / 180);

  let sunAlt = Math.asin(Math.sin(latRad) * Math.sin(dec) + Math.cos(latRad) * Math.cos(dec) * Math.cos(ha));
  let sunAz = Math.atan2(-Math.sin(ha), Math.cos(latRad) * Math.tan(dec) - Math.sin(latRad) * Math.cos(ha));
  sunAlt = sunAlt * (180 / Math.PI);
  sunAz = ((sunAz * (180 / Math.PI)) + 360) % 360;

  const synodicMonth = 29.53058867;
  const knownNewMoon = new Date(Date.UTC(2000, 0, 6, 18, 14)).getTime();
  const phase = ((date.getTime() - knownNewMoon) / 86400000) % synodicMonth;
  const moonPhaseOut = ((phase / synodicMonth) + 1) % 1;

  const cosW0 = (Math.sin(-0.0145) - Math.sin(latRad) * Math.sin(dec)) / (Math.cos(latRad) * Math.cos(dec));
  let dayLength = 12;
  if (cosW0 >= 1) dayLength = 0;
  else if (cosW0 <= -1) dayLength = 24;
  else dayLength = (Math.acos(cosW0) * 180 / Math.PI) / 15 * 2;

  const isTwilight = sunAlt > -18 && sunAlt <= 0;

  return {
    sunAltitude: sunAlt,
    sunAzimuth: sunAz,
    moonPhase: moonPhaseOut,
    moonPhaseName: getMoonPhaseName(moonPhaseOut),
    siderealTime: lmst,
    dayLengthHr: dayLength,
    isDay: sunAlt > -0.83,
    isTwilight,
    visiblePlanets: getVisiblePlanets(date),
  };
}

/* ------------------------------------------------------------------ */
/* Premium Sky Visualization Panel                                     */
/* ------------------------------------------------------------------ */

function SkyVisualization({ data, mode, activeDate, lat }: { data: SkyData; mode: "past" | "future"; activeDate: Date; lat: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Choose constellation based on latitude and month
  const constellation = useMemo(() => {
    const month = activeDate.getMonth(); // 0 = Jan, 5 = Jun
    if (lat < 0) {
      return {
        name: "Southern Cross (Crux)",
        elements: (
          <>
            <circle cx="200" cy="40" r="2.5" fill="white" className="animate-pulse" />
            <circle cx="200" cy="140" r="3.0" fill="white" className="animate-pulse" />
            <circle cx="160" cy="90" r="2.5" fill="white" className="animate-pulse" />
            <circle cx="240" cy="90" r="2.8" fill="white" className="animate-pulse" />
            <circle cx="215" cy="110" r="1.5" fill="white" />
            
            <line x1="200" y1="40" x2="200" y2="140" stroke="white" strokeWidth="0.75" strokeDasharray="3 3" />
            <line x1="160" y1="90" x2="240" y2="90" stroke="white" strokeWidth="0.75" strokeDasharray="3 3" />
          </>
        )
      };
    } else if (month >= 4 && month <= 9) {
      return {
        name: "Scorpius",
        elements: (
          <>
            <circle cx="180" cy="70" r="2.5" fill="#f87171" className="animate-pulse" />
            <circle cx="160" cy="60" r="1.5" fill="white" />
            <circle cx="150" cy="50" r="1.5" fill="white" />
            <circle cx="195" cy="90" r="1.5" fill="white" />
            <circle cx="210" cy="110" r="1.5" fill="white" />
            <circle cx="205" cy="130" r="1.5" fill="white" />
            <circle cx="190" cy="145" r="2.0" fill="white" />
            <circle cx="175" cy="140" r="1.5" fill="white" />
            
            <line x1="150" y1="50" x2="160" y2="60" stroke="white" strokeWidth="0.5" />
            <line x1="160" y1="60" x2="180" y2="70" stroke="white" strokeWidth="0.5" />
            <line x1="180" y1="70" x2="195" y2="90" stroke="white" strokeWidth="0.5" />
            <line x1="195" y1="90" x2="210" y2="110" stroke="white" strokeWidth="0.5" />
            <line x1="210" y1="110" x2="205" y2="130" stroke="white" strokeWidth="0.5" />
            <line x1="205" y1="130" x2="190" y2="145" stroke="white" strokeWidth="0.5" />
            <line x1="190" y1="145" x2="175" y2="140" stroke="white" strokeWidth="0.5" />
          </>
        )
      };
    } else {
      return {
        name: "Orion",
        elements: (
          <>
            <circle cx="150" cy="60" r="2.8" fill="#f87171" className="animate-pulse" />
            <circle cx="230" cy="140" r="2.8" fill="#60a5fa" className="animate-pulse" />
            <circle cx="210" cy="70" r="1.8" fill="white" />
            <circle cx="170" cy="130" r="1.8" fill="white" />
            
            <circle cx="185" cy="100" r="1.5" fill="white" />
            <circle cx="190" cy="100" r="1.5" fill="white" />
            <circle cx="195" cy="100" r="1.5" fill="white" />
            
            <line x1="150" y1="60" x2="210" y2="70" stroke="white" strokeWidth="0.5" />
            <line x1="150" y1="60" x2="185" y2="100" stroke="white" strokeWidth="0.5" />
            <line x1="210" y1="70" x2="195" y2="100" stroke="white" strokeWidth="0.5" />
            <line x1="185" y1="100" x2="195" y2="100" stroke="white" strokeWidth="0.75" />
            <line x1="185" y1="100" x2="170" y2="130" stroke="white" strokeWidth="0.5" />
            <line x1="195" y1="100" x2="230" y2="140" stroke="white" strokeWidth="0.5" />
            <line x1="170" y1="130" x2="230" y2="140" stroke="white" strokeWidth="0.5" />
          </>
        )
      };
    }
  }, [lat, activeDate]);

  // Sky gradient based on conditions
  const skyGradient = useMemo(() => {
    if (data.isDay) {
      return mode === "past"
        ? ["#c9a227", "#e8c97a", "#fef3c7"]
        : ["#0369a1", "#0ea5e9", "#7dd3fc"];
    } else if (data.isTwilight) {
      return mode === "past"
        ? ["#1e1b4b", "#7c3aed", "#f97316"]
        : ["#0c1445", "#1d4ed8", "#06b6d4"];
    } else {
      return mode === "past"
        ? ["#000000", "#0a0a1a", "#1a1025"]
        : ["#050517", "#0f0f3d", "#1b1b5a"];
    }
  }, [data.isDay, data.isTwilight, mode]);

  // Draw stars on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.isDay) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const starCount = data.isTwilight ? 40 : 200;
    for (let i = 0; i < starCount; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height * 0.8;
      const r = Math.random() * 1.5 + 0.3;
      const alpha = Math.random() * 0.8 + 0.2;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = mode === "past"
        ? `rgba(255, 220, 180, ${alpha * (data.isTwilight ? 0.3 : 1)})`
        : `rgba(200, 230, 255, ${alpha * (data.isTwilight ? 0.3 : 1)})`;
      ctx.fill();

      // Occasional larger stars with glow
      if (r > 1.2) {
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
        grd.addColorStop(0, `rgba(255,255,255,0.3)`);
        grd.addColorStop(1, "rgba(255,255,255,0)");
        ctx.beginPath();
        ctx.arc(x, y, r * 4, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      }
    }
  }, [data.isDay, data.isTwilight, mode]);

  // Sun/moon position mapping
  const sunX = (data.sunAzimuth / 360) * 100;
  const sunY = Math.max(5, Math.min(90, 50 - (data.sunAltitude / 90) * 40));
  const orbVisible = data.sunAltitude > -20;

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl" style={{ minHeight: 320 }}>
      {/* Sky gradient background */}
      <motion.div
        key={skyGradient.join(",")}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, ${skyGradient[0]} 0%, ${skyGradient[1]} 50%, ${skyGradient[2]} 100%)`,
        }}
      />

      {/* Star canvas */}
      {!data.isDay && (
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      )}

      {/* Horizon line */}
      <div className="absolute bottom-[22%] left-0 right-0 h-px opacity-20 bg-white" />

      {/* Ground */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[22%] opacity-80"
        style={{
          background: data.isDay
            ? "linear-gradient(to bottom, rgba(74,120,50,0.6), rgba(30,60,20,0.9))"
            : "linear-gradient(to bottom, rgba(10,15,30,0.8), rgba(0,0,0,0.95))",
        }}
      />

      {/* Atmosphere glow (twilight) */}
      {data.isTwilight && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute bottom-[22%] left-0 right-0 h-24 pointer-events-none"
          style={{
            background: mode === "past"
              ? "linear-gradient(to top, rgba(249,115,22,0.4), transparent)"
              : "linear-gradient(to top, rgba(6,182,212,0.3), transparent)",
          }}
        />
      )}

      {/* Sun or Moon orb */}
      <AnimatePresence>
        {orbVisible && (
          <motion.div
            key={`orb-${data.sunAzimuth.toFixed(0)}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: Math.max(0.1, (data.sunAltitude + 20) / 50), scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
            style={{
              left: `${sunX}%`,
              top: `${sunY}%`,
              width: data.isDay ? 70 : 48,
              height: data.isDay ? 70 : 48,
              background: data.isDay
                ? "radial-gradient(circle, #fff 10%, rgba(255,240,150,0.6) 50%, transparent 75%)"
                : "radial-gradient(circle, #e8eaff 20%, rgba(200,210,255,0.3) 60%, transparent 80%)",
              boxShadow: data.isDay
                ? "0 0 80px 30px rgba(255,220,100,0.4), 0 0 200px 80px rgba(255,200,50,0.15)"
                : "0 0 30px 10px rgba(180,190,255,0.2)",
            }}
          />
        )}
      </AnimatePresence>

      {/* Constellation hints at night */}
      {!data.isDay && !data.isTwilight && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
          <svg viewBox="0 0 400 200" className="w-full h-full absolute top-0 left-0">
            <text x="20" y="30" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="monospace" letterSpacing="1">
              CONSTELLATION: {constellation.name.toUpperCase()}
            </text>
            {constellation.elements}
          </svg>
        </div>
      )}

      {/* HUD Overlays */}
      {/* Time indicator top center */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
        <span
          className="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-widest border backdrop-blur-sm"
          style={{
            borderColor: data.isDay ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.15)",
            backgroundColor: "rgba(0,0,0,0.3)",
            color: data.isDay ? "rgba(255,255,255,0.9)" : "rgba(200,230,255,0.9)",
          }}
        >
          {data.isDay ? "☀️ Day" : data.isTwilight ? "🌆 Twilight" : "🌙 Night"}
        </span>
      </div>

      {/* Compass bottom center */}
      <div className="absolute bottom-[25%] right-4 flex flex-col items-center gap-0.5">
        <div
          className="rounded-full w-8 h-8 flex items-center justify-center border backdrop-blur-sm"
          style={{ borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(0,0,0,0.4)" }}
        >
          <svg viewBox="0 0 24 24" width="14" fill="none" stroke="currentColor" strokeWidth="1.5"
            style={{ color: "white", transform: `rotate(${data.sunAzimuth}deg)` }}>
            <path d="M12 2L8 12h8L12 2z" fill="rgba(251,191,36,0.7)" stroke="none" />
            <path d="M12 22L16 12H8l4 10z" fill="rgba(100,116,139,0.5)" stroke="none" />
          </svg>
        </div>
        <span className="font-mono text-[8px] text-white/50">N</span>
      </div>

      {/* Mode badge top-right */}
      <div className="absolute top-4 right-4">
        <span
          className="rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-widest backdrop-blur-sm border"
          style={{
            color: mode === "past" ? "#fbbf24" : "#a78bfa",
            borderColor: mode === "past" ? "rgba(251,191,36,0.3)" : "rgba(167,139,250,0.3)",
            backgroundColor: mode === "past" ? "rgba(251,191,36,0.1)" : "rgba(167,139,250,0.1)",
          }}
        >
          {mode === "past" ? "● Historical" : "● Future"}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Metric Row Component                                                */
/* ------------------------------------------------------------------ */

function MetricRow({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <div className="flex items-baseline gap-1">
        <motion.span
          key={value}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="font-mono text-sm font-semibold text-slate-100"
        >
          {value}
        </motion.span>
        {unit && <span className="font-mono text-[9px] text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Page                                                           */
/* ------------------------------------------------------------------ */

function SkyTimeMachineContent() {
  const { latitude, longitude, locationName, setLocation } = useLocationStore();
  const lastUpdated = useLiveTimestamp(5000);
  const searchParams = useSearchParams();
  const now = useMemo(() => new Date(), []);

  const [lat, setLat] = useState(latitude);
  const [lng, setLng] = useState(longitude);
  const [locName, setLocName] = useState(locationName);
  const [baseDate, setBaseDate] = useState(() => now.toISOString().split("T")[0]);
  const [baseTime, setBaseTime] = useState(() => now.toISOString().split("T")[1].substring(0, 5));
  const [offsetYears, setOffsetYears] = useState(0);
  const [activeDate, setActiveDate] = useState<Date>(now);
  const [skyData, setSkyData] = useState<SkyData | null>(() => calculateSkyData(now, { lat: latitude, lng: longitude }));
  const [transitionKey, setTransitionKey] = useState(0);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    hydrateLocationStore();
  }, []);

  // Read URL params on mount to restore shared sky links
  useEffect(() => {
    const urlLat = searchParams.get("lat");
    const urlLng = searchParams.get("lng");
    const urlDate = searchParams.get("date");
    const urlTime = searchParams.get("time");
    if (urlLat && urlLng) {
      const pLat = parseFloat(urlLat);
      const pLng = parseFloat(urlLng);
      if (!isNaN(pLat) && !isNaN(pLng)) {
        setLat(pLat);
        setLng(pLng);
        setLocation(pLat, pLng);
      }
    }
    if (urlDate) setBaseDate(urlDate);
    if (urlTime) setBaseTime(urlTime);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLat(latitude);
    setLng(longitude);
    setLocName(locationName);
  }, [latitude, longitude, locationName]);

  const modeLabel = useMemo(() => getModeLabel(activeDate, new Date()), [activeDate]);
  const vizMode: "past" | "future" | "live" = modeLabel === "Historical Mode" ? "past" : modeLabel === "Future Mode" ? "future" : "live";

  useEffect(() => {
    const d = new Date(`${baseDate}T${baseTime}:00`);
    if (!isNaN(d.getTime())) {
      d.setFullYear(d.getFullYear() + offsetYears);
      setActiveDate(d);
      setSkyData(calculateSkyData(d, { lat, lng }));
    }
  }, [baseDate, baseTime, lat, lng, offsetYears]);

  const handleNow = () => {
    const current = new Date();
    setOffsetYears(0);
    setBaseDate(current.toISOString().split("T")[0]);
    setBaseTime(current.toISOString().split("T")[1].substring(0, 5));
    setTransitionKey((p) => p + 1);
  };

  const handleScrub = (val: number) => {
    setOffsetYears(val);
    setTransitionKey((p) => p + 1);
  };

  const handleShareSky = useCallback(() => {
    const url = `${window.location.origin}/sky?lat=${lat}&lng=${lng}&date=${baseDate}&time=${baseTime}`;
    navigator.clipboard.writeText(url).then(() => {
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 2500);
    });
  }, [lat, lng, baseDate, baseTime]);

  return (
    <main className="flex-1 page-with-nav flex flex-col overflow-hidden" style={{ background: "#030409" }}>
      {/* Toast */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] transition-all duration-300"
        style={{ opacity: toastVisible ? 1 : 0, transform: `translateX(-50%) translateY(${toastVisible ? 0 : 20}px)`, pointerEvents: toastVisible ? "auto" : "none" }}
      >
        <div className="rounded-full border border-emerald-500/30 bg-slate-950/90 backdrop-blur-xl px-6 py-3 shadow-2xl flex items-center gap-2">
          <span className="text-emerald-400">🔗</span>
          <span className="font-mono text-[11px] text-slate-200">Sky link copied to clipboard!</span>
        </div>
      </div>

      {/* ── Title bar ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 backdrop-blur-xl bg-slate-950/60">
        <div className="flex items-center gap-3">
          <span className="text-lg">⏳</span>
          <div>
            <h1 className="font-mono text-sm uppercase tracking-widest text-white">Sky Time Machine</h1>
            <p className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">
              {locName} · {activeDate.getFullYear()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleShareSky}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-slate-300 transition-colors cursor-pointer"
          >
            📋 Share This Sky
          </button>
          <AnimatePresence mode="wait">
            <motion.span
              key={modeLabel}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-widest border"
              style={{
                color: modeLabel === "Historical Mode" ? "#fbbf24" : modeLabel === "Future Mode" ? "#a78bfa" : "#34d399",
                borderColor: modeLabel === "Historical Mode" ? "rgba(251,191,36,0.3)" : modeLabel === "Future Mode" ? "rgba(167,139,250,0.3)" : "rgba(52,211,153,0.3)",
                backgroundColor: modeLabel === "Historical Mode" ? "rgba(251,191,36,0.08)" : modeLabel === "Future Mode" ? "rgba(167,139,250,0.08)" : "rgba(52,211,153,0.08)",
              }}
            >
              {modeLabel === "Live Mode" ? "● Live Mode" : modeLabel === "Historical Mode" ? "◀ Historical Mode" : "▶ Future Mode"}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">

        {/* Left Control Panel */}
        <div className="flex w-full lg:w-[300px] shrink-0 flex-col border-r border-white/5 bg-slate-950/70 backdrop-blur-2xl overflow-y-auto">
          <div className="p-5 flex flex-col gap-4 flex-1">

            {/* Location */}
            <div>
              <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-slate-500">📍 Observation Site</p>
              <LocationSearch
                defaultQuery={locName}
                onLocationSelect={(l, lo, name) => {
                  setLat(l);
                  setLng(lo);
                  if (name) setLocName(name);
                  setLocation(l, lo, name);
                }}
              />
            </div>

            <div className="h-px bg-white/5" />

            <TimelineControls
              yearOffset={offsetYears}
              dateString={baseDate}
              timeString={baseTime}
              onYearOffsetChange={handleScrub}
              onDateChange={setBaseDate}
              onTimeChange={setBaseTime}
              onNow={handleNow}
            />

            <p className="text-xs text-gray-500 font-mono">Last updated: {lastUpdated}</p>

            <div className="h-px bg-white/5" />

            {/* Sky Data Metrics */}
            {skyData && (
              <div>
                <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-slate-500">📊 Sky Telemetry</p>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4">
                  <MetricRow label="Sun Altitude" value={skyData.sunAltitude.toFixed(1)} unit="°" />
                  <MetricRow label="Sun Azimuth" value={skyData.sunAzimuth.toFixed(1)} unit="°" />
                  <MetricRow label="Sidereal Time" value={skyData.siderealTime.toFixed(2)} unit="hr" />
                  <MetricRow label="Day Length" value={skyData.dayLengthHr.toFixed(1)} unit="hr" />
                  <MetricRow label="Moon Phase" value={(skyData.moonPhase * 100).toFixed(0)} unit="%" />
                </div>
              </div>
            )}

            {/* Moon Phase Card */}
            {skyData && (
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-slate-500">🌙 Lunar Phase</p>
                <p className="text-sm font-medium text-slate-200">{skyData.moonPhaseName}</p>
                <div className="mt-2 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-slate-400 to-white transition-all duration-500"
                    style={{ width: `${skyData.moonPhase * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Visible Planets */}
            {skyData && skyData.visiblePlanets.length > 0 && (
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-slate-500">🔭 Visible Planets</p>
                <div className="flex flex-wrap gap-2">
                  {skyData.visiblePlanets.map(p => (
                    <span
                      key={p}
                      className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 font-mono text-[10px] text-violet-300"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Sky Canvas */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* Sky Visualization */}
          <div className="relative flex-1 min-h-[300px] lg:min-h-0">
            <AnimatePresence mode="wait">
              {skyData ? (
                <motion.div
                  key={`sky-${transitionKey}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                  className="absolute inset-0"
                >
                  <SkyVisualization data={skyData} mode={vizMode === "past" ? "past" : "future"} activeDate={activeDate} lat={lat} />

                  {/* Warp flash on scrub */}
                  <motion.div
                    key={`warp-${transitionKey}`}
                    initial={{ opacity: 0.4 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="pointer-events-none absolute inset-0 bg-white mix-blend-overlay"
                  />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 flex items-center justify-center bg-slate-950"
                >
                  <div className="text-center">
                    <div className="relative mx-auto mb-4 h-12 w-12">
                      <span className="absolute inset-0 animate-spin rounded-full border-2 border-violet-500/10 border-t-violet-400" />
                    </div>
                    <p className="font-mono text-xs uppercase tracking-widest text-slate-500">Calculating sky...</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Epoch info — top left */}
            {skyData && (
              <div className="absolute top-4 left-4 z-10">
                <div className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-md">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Epoch</p>
                  <p className="font-mono text-sm font-semibold text-white">
                    {activeDate.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                  </p>
                  <p className="font-mono text-[10px] text-slate-400">{activeDate.toLocaleTimeString()}</p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Scrubber */}
          <div className="border-t border-white/5 bg-slate-950/80 backdrop-blur-xl p-5">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-5">
              {/* Mode glow */}
              <div
                className="pointer-events-none absolute inset-0 opacity-10 transition-all duration-1000"
                style={{
                  background: vizMode === "past"
                    ? "linear-gradient(to right, transparent, rgba(251,191,36,0.4))"
                    : vizMode === "future"
                    ? "linear-gradient(to right, transparent, rgba(167,139,250,0.4))"
                    : "linear-gradient(to right, transparent, rgba(52,211,153,0.4))",
                }}
              />

              <div className="relative z-10 flex items-center justify-between mb-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                    Temporal Offset
                  </p>
                  <motion.p
                    key={offsetYears}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="font-mono text-xl font-black text-white mt-0.5"
                  >
                    {offsetYears === 0
                      ? "Present"
                      : offsetYears > 0
                      ? `+${offsetYears} years into the future`
                      : `${offsetYears} years into the past`}
                  </motion.p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-slate-600">Target Year</p>
                  <motion.p
                    key={activeDate.getFullYear()}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="font-mono text-2xl font-black"
                    style={{ color: vizMode === "past" ? "#fbbf24" : vizMode === "future" ? "#a78bfa" : "#34d399" }}
                  >
                    {activeDate.getFullYear()}
                  </motion.p>
                </div>
              </div>

              <div className="relative z-10 flex items-center gap-4">
                <span className="font-mono text-[10px] text-amber-400/70 whitespace-nowrap">◀ -100y</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={offsetYears}
                  onChange={e => handleScrub(Number(e.target.value))}
                  className="zenith-scrubber flex-1"
                />
                <span className="font-mono text-[10px] text-violet-400/70 whitespace-nowrap">+100y ▶</span>
              </div>

              {/* Year ticks */}
              <div className="relative z-10 flex justify-between px-3 mt-1">
                {[-100, -50, 0, 50, 100].map(y => (
                  <button
                    key={y}
                    onClick={() => handleScrub(y)}
                    className="font-mono text-[8px] text-slate-600 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {y > 0 ? `+${y}` : y}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2D Sky Dome Canvas */}
          <div className="border-t border-white/5 bg-slate-950/80 backdrop-blur-xl p-5">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                <span className="block h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                2D Sky Dome — {locName} · {activeDate.toDateString()}
              </p>
              <SkyDomeCanvas lat={lat} lng={lng} date={activeDate} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function SkyTimeMachine() {
  return (
    <Suspense fallback={<div className="flex-1 page-with-nav flex items-center justify-center"><p className="font-mono text-slate-500">Loading sky machine...</p></div>}>
      <SkyTimeMachineContent />
    </Suspense>
  );
}
