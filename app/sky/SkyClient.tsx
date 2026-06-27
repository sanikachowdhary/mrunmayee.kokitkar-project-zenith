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

interface PlanetPosition {
  name: string;
  symbol: string;
  altitude: number;  // degrees above horizon
  azimuth: number;   // degrees 0-360
  color: string;
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

/** Compute approximate planet Alt/Az from simplified orbital elements */
function getPlanetPositions(date: Date, coords: GeoCoords): PlanetPosition[] {
  const jd = (date.getTime() / 86400000) + 2440587.5;
  const d = jd - 2451545.0;
  const latRad = coords.lat * (Math.PI / 180);

  let gmst = 18.697374558 + 24.06570982441908 * d;
  gmst = ((gmst % 24) + 24) % 24;
  const lmst = ((gmst + coords.lng / 15) % 24 + 24) % 24;

  function raDecToAltAz(ra_h: number, dec_deg: number): { alt: number; az: number } {
    const decRad = dec_deg * (Math.PI / 180);
    const ha = ((lmst - ra_h) * 15) * (Math.PI / 180);
    const alt = Math.asin(
      Math.sin(latRad) * Math.sin(decRad) +
      Math.cos(latRad) * Math.cos(decRad) * Math.cos(ha)
    ) * (180 / Math.PI);
    const az = ((Math.atan2(
      -Math.sin(ha),
      Math.cos(latRad) * Math.tan(decRad) - Math.sin(latRad) * Math.cos(ha)
    ) * (180 / Math.PI)) + 360) % 360;
    return { alt, az };
  }

  // Simplified planet mean longitudes and RA/Dec approximations
  const T = d / 36525.0;

  // Sun
  const sunLon = (280.460 + 36000.771 * T) % 360;
  const sunRa_h = (sunLon / 15 + 24) % 24;
  const sunDec = 23.4 * Math.sin((sunLon - 80) * Math.PI / 180);
  const sun = raDecToAltAz(sunRa_h, sunDec);

  // Moon (simplified)
  const moonLon = (218.316 + 13.176396 * d) % 360;
  const moonRa_h = (moonLon / 15 + 24) % 24;
  const moonDec = 5.1 * Math.sin((moonLon * 2) * Math.PI / 180);
  const moon = raDecToAltAz(moonRa_h, moonDec);

  // Mercury
  const mercL = (252.251 + 4.092335 * d) % 360;
  const mercRa = (mercL / 15 + 24) % 24;
  const mercDec = 7.0 * Math.sin(mercL * Math.PI / 180);
  const mercury = raDecToAltAz(mercRa, mercDec);

  // Venus
  const venL = (181.979 + 1.602130 * d) % 360;
  const venRa = (venL / 15 + 24) % 24;
  const venDec = 3.4 * Math.sin(venL * Math.PI / 180);
  const venus = raDecToAltAz(venRa, venDec);

  // Mars
  const marsL = (355.433 + 0.524033 * d) % 360;
  const marsRa = (marsL / 15 + 24) % 24;
  const marsDec = 1.9 * Math.sin(marsL * Math.PI / 180);
  const mars = raDecToAltAz(marsRa, marsDec);

  // Jupiter
  const jupL = (34.336 + 0.083057 * d) % 360;
  const jupRa = (jupL / 15 + 24) % 24;
  const jupDec = 1.3 * Math.sin(jupL * Math.PI / 180);
  const jupiter = raDecToAltAz(jupRa, jupDec);

  // Saturn
  const satL = (50.077 + 0.033460 * d) % 360;
  const satRa = (satL / 15 + 24) % 24;
  const satDec = 2.5 * Math.sin(satL * Math.PI / 180);
  const saturn = raDecToAltAz(satRa, satDec);

  return [
    { name: "Sun",     symbol: "☀",  ...sun,     color: "#FCD34D" },
    { name: "Moon",    symbol: "🌙",  ...moon,    color: "#CBD5E1" },
    { name: "Mercury", symbol: "☿",  ...mercury, color: "#94A3B8" },
    { name: "Venus",   symbol: "♀",  ...venus,   color: "#FBBF24" },
    { name: "Mars",    symbol: "♂",  ...mars,    color: "#F87171" },
    { name: "Jupiter", symbol: "♃",  ...jupiter, color: "#A78BFA" },
    { name: "Saturn",  symbol: "♄",  ...saturn,  color: "#34D399" },
  ];
}

/* Constellation line data (normalized to Alt/Az anchor points) */
const CONSTELLATIONS = [
  {
    name: "Orion",
    // Betelgeuse~(55°,215°), Rigel~(30°,195°), belt stars
    segments: [
      { az1: 210, alt1: 55, az2: 215, alt2: 45 },
      { az1: 215, alt1: 45, az2: 220, alt2: 30 },
      { az1: 220, alt1: 30, az2: 215, alt2: 25 },
      { az1: 215, alt1: 25, az2: 205, alt2: 30 },
      { az1: 205, alt1: 30, az2: 210, alt2: 55 },
    ],
    labelAz: 212, labelAlt: 40,
  },
  {
    name: "Ursa Major",
    segments: [
      { az1: 15, alt1: 65, az2: 25, alt2: 68 },
      { az1: 25, alt1: 68, az2: 35, alt2: 66 },
      { az1: 35, alt1: 66, az2: 45, alt2: 60 },
      { az1: 45, alt1: 60, az2: 40, alt2: 55 },
      { az1: 40, alt1: 55, az2: 30, alt2: 55 },
      { az1: 30, alt1: 55, az2: 20, alt2: 58 },
    ],
    labelAz: 30, labelAlt: 62,
  },
  {
    name: "Cassiopeia",
    segments: [
      { az1: 345, alt1: 62, az2: 350, alt2: 70 },
      { az1: 350, alt1: 70, az2: 355, alt2: 62 },
      { az1: 355, alt1: 62, az2: 0,   alt2: 70 },
      { az1: 0,   alt1: 70, az2: 5,   alt2: 62 },
    ],
    labelAz: 357, labelAlt: 66,
  },
  {
    name: "Scorpius",
    segments: [
      { az1: 175, alt1: 20, az2: 180, alt2: 22 },
      { az1: 180, alt1: 22, az2: 182, alt2: 18 },
      { az1: 182, alt1: 18, az2: 185, alt2: 15 },
      { az1: 185, alt1: 15, az2: 188, alt2: 12 },
      { az1: 188, alt1: 12, az2: 190, alt2: 10 },
    ],
    labelAz: 183, labelAlt: 16,
  },
  {
    name: "Leo",
    segments: [
      { az1: 125, alt1: 48, az2: 130, alt2: 52 },
      { az1: 130, alt1: 52, az2: 138, alt2: 50 },
      { az1: 138, alt1: 50, az2: 140, alt2: 44 },
      { az1: 140, alt1: 44, az2: 135, alt2: 40 },
      { az1: 135, alt1: 40, az2: 125, alt2: 43 },
      { az1: 125, alt1: 43, az2: 125, alt2: 48 },
    ],
    labelAz: 132, labelAlt: 47,
  },
];

/* ------------------------------------------------------------------ */
/* Premium Sky Visualization Panel                                     */
/* ------------------------------------------------------------------ */

function SkyVisualization({ data, mode, activeDate, lat, lng }: {
  data: SkyData;
  mode: "past" | "future";
  activeDate: Date;
  lat: number;
  lng: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  // Planet positions
  const planetPositions = useMemo(
    () => getPlanetPositions(activeDate, { lat, lng }),
    [activeDate, lat, lng]
  );

  // Draw stars + planets + constellations on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth || 600;
    canvas.height = canvas.offsetHeight || 320;
    const W = canvas.width;
    const H = canvas.height;
    const horizonY = H * 0.78; // horizon at 78% down

    ctx.clearRect(0, 0, W, H);

    // Map Alt/Az to canvas coords
    const toXY = (az: number, alt: number) => {
      const x = (az / 360) * W;
      const y = alt > 0
        ? horizonY - (alt / 90) * horizonY
        : horizonY + (Math.abs(alt) / 18) * (H - horizonY) * 0.5;
      return { x, y };
    };

    // Stars (night only)
    if (!data.isDay) {
      const starCount = data.isTwilight ? 40 : 200;
      for (let i = 0; i < starCount; i++) {
        const x = Math.random() * W;
        const y = Math.random() * horizonY;
        const r = Math.random() * 1.5 + 0.3;
        const alpha = Math.random() * 0.8 + 0.2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = mode === "past"
          ? `rgba(255, 220, 180, ${alpha * (data.isTwilight ? 0.3 : 1)})`
          : `rgba(200, 230, 255, ${alpha * (data.isTwilight ? 0.3 : 1)})`;
        ctx.fill();
      }
    }

    // Constellation lines
    if (!data.isDay) {
      ctx.strokeStyle = "rgba(0, 255, 255, 0.2)";
      ctx.lineWidth = 0.8;
      for (const c of CONSTELLATIONS) {
        for (const seg of c.segments) {
          const p1 = toXY(seg.az1, seg.alt1);
          const p2 = toXY(seg.az2, seg.alt2);
          if (p1.y < H && p2.y < H) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
        // Label
        const lp = toXY(c.labelAz, c.labelAlt);
        if (lp.y > 0 && lp.y < horizonY) {
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.font = "9px monospace";
          ctx.textAlign = "center";
          ctx.fillText(c.name.toUpperCase(), lp.x, lp.y - 6);
        }
      }
    }

    // Planet markers
    for (const planet of planetPositions) {
      if (planet.altitude < -5) continue;
      const { x, y } = toXY(planet.azimuth, planet.altitude);
      if (y < 0 || y > H) continue;

      // Glow
      const grd = ctx.createRadialGradient(x, y, 0, x, y, 8);
      grd.addColorStop(0, planet.color + "cc");
      grd.addColorStop(1, planet.color + "00");
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Dot
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = planet.color;
      ctx.fill();

      // Label
      ctx.fillStyle = "#67E8F9"; // cyan-300
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText(planet.name, x, y - 10);
    }
  }, [data.isDay, data.isTwilight, mode, planetPositions]);

  // Sun/moon position mapping for CSS overlay
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

      {/* Main canvas (stars + planets + constellations) */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

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

      {/* HUD overlays */}
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

      {/* Compass */}
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

      {/* Mode badge */}
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
/* Metric Row                                                           */
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
/* Main Page Content                                                    */
/* ------------------------------------------------------------------ */

function SkyTimeMachineContent() {
  const { latitude, longitude, locationName, setLocation } = useLocationStore();
  const lastUpdated = useLiveTimestamp(5000);
  const searchParams = useSearchParams();
  const now = useMemo(() => new Date(), []);

  const [lat, setLat] = useState(19.076);   // Default to Mumbai for immediate render
  const [lng, setLng] = useState(72.8777);
  const [locName, setLocName] = useState("Mumbai");
  const [baseDate, setBaseDate] = useState(() => now.toISOString().split("T")[0]);
  const [baseTime, setBaseTime] = useState(() => now.toISOString().split("T")[1].substring(0, 5));
  const [offsetYears, setOffsetYears] = useState(0);
  const [activeDate, setActiveDate] = useState<Date>(now);
  // Immediately calculate sky data on mount with Mumbai defaults — eliminates "Calculating sky..." 
  const [skyData, setSkyData] = useState<SkyData>(() => calculateSkyData(now, { lat: 19.076, lng: 72.8777 }));
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

  // Sync location store changes after initial mount
  useEffect(() => {
    if (latitude !== 19.076 || longitude !== 72.8777) {
      setLat(latitude);
      setLng(longitude);
      setLocName(locationName);
    }
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
          <span className="font-mono text-[11px] text-slate-200">Copied! Sky link in clipboard.</span>
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
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-slate-300 transition-colors cursor-pointer min-h-[36px]"
          >
            📋 Share This Sky
          </button>
          <AnimatePresence mode="wait">
            <motion.span
              key={modeLabel}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-widest border hidden sm:inline-flex"
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
                  <SkyVisualization
                    data={skyData}
                    mode={vizMode === "past" ? "past" : "future"}
                    activeDate={activeDate}
                    lat={lat}
                    lng={lng}
                  />

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
                // Skeleton loader instead of "Calculating sky..."
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
                  <div className="animate-pulse grid grid-cols-3 gap-4 w-full max-w-md p-8">
                    <div className="h-20 bg-white/5 rounded-xl col-span-2" />
                    <div className="h-20 bg-white/5 rounded-xl" />
                    <div className="h-20 bg-white/5 rounded-xl" />
                    <div className="h-20 bg-white/5 rounded-xl col-span-2" />
                  </div>
                </div>
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
                  <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Temporal Offset</p>
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

export function SkyTimeMachineClient() {
  return (
    <Suspense fallback={
      <div className="flex-1 page-with-nav flex items-center justify-center">
        <div className="animate-pulse space-y-3 w-full max-w-lg px-8">
          <div className="h-8 bg-white/5 rounded-xl w-1/2" />
          <div className="h-4 bg-white/5 rounded w-3/4" />
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="h-32 bg-white/5 rounded-xl" />
            <div className="h-32 bg-white/5 rounded-xl" />
          </div>
        </div>
      </div>
    }>
      <SkyTimeMachineContent />
    </Suspense>
  );
}
