"use client";

import { useEffect, useRef, useCallback } from "react";

interface Props {
  lat: number;
  lng: number;
  date: Date;
  issLat?: number;
  issLng?: number;
}

// ─── Astronomical Math ───────────────────────────────────────────────

function julianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

function gmstDeg(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  let theta =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T -
    (T * T * T) / 38710000.0;
  return ((theta % 360) + 360) % 360;
}

function lstDeg(jd: number, lngDeg: number): number {
  return ((gmstDeg(jd) + lngDeg) % 360 + 360) % 360;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function raDecToAltAz(
  raDeg: number,
  decDeg: number,
  latDeg: number,
  lstDegVal: number
): { alt: number; az: number } {
  const ha = toRad(((lstDegVal - raDeg) % 360 + 360) % 360);
  const dec = toRad(decDeg);
  const lat = toRad(latDeg);
  const sinAlt =
    Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
  const alt = Math.asin(clamp(sinAlt, -1, 1));
  const cosAz =
    (Math.sin(dec) - Math.sin(alt) * Math.sin(lat)) /
    (Math.cos(alt) * Math.cos(lat));
  const azRaw = Math.acos(clamp(cosAz, -1, 1));
  const az = Math.sin(ha) > 0 ? 2 * Math.PI - azRaw : azRaw;
  return { alt: toDeg(alt), az: toDeg(az) };
}

function altAzToCanvas(
  alt: number,
  az: number,
  cx: number,
  cy: number,
  r: number
): { x: number; y: number } | null {
  if (alt < 0) return null;
  const dist = r * (1 - alt / 90);
  const azRad = toRad(az);
  return {
    x: cx + dist * Math.sin(azRad),
    y: cy - dist * Math.cos(azRad),
  };
}

// ─── Catalogs ───────────────────────────────────────────────────────

const BRIGHT_STARS = [
  { name: "Sirius",     ra: 101.29, dec: -16.72, mag: -1.46 },
  { name: "Canopus",    ra: 95.99,  dec: -52.70, mag: -0.74 },
  { name: "Arcturus",   ra: 213.92, dec: 19.18,  mag: -0.05 },
  { name: "Vega",       ra: 279.23, dec: 38.78,  mag: 0.03  },
  { name: "Capella",    ra: 79.17,  dec: 45.99,  mag: 0.08  },
  { name: "Rigel",      ra: 78.63,  dec: -8.20,  mag: 0.12  },
  { name: "Procyon",    ra: 114.83, dec: 5.22,   mag: 0.34  },
  { name: "Betelgeuse", ra: 88.79,  dec: 7.41,   mag: 0.42  },
  { name: "Achernar",   ra: 24.43,  dec: -57.24, mag: 0.46  },
  { name: "Hadar",      ra: 210.96, dec: -60.37, mag: 0.61  },
  { name: "Altair",     ra: 297.70, dec: 8.87,   mag: 0.76  },
  { name: "Aldebaran",  ra: 68.98,  dec: 16.51,  mag: 0.85  },
  { name: "Antares",    ra: 247.35, dec: -26.43, mag: 1.06  },
  { name: "Spica",      ra: 201.30, dec: -11.16, mag: 1.04  },
  { name: "Pollux",     ra: 116.33, dec: 28.03,  mag: 1.14  },
  { name: "Fomalhaut",  ra: 344.41, dec: -29.62, mag: 1.16  },
  { name: "Deneb",      ra: 310.36, dec: 45.28,  mag: 1.25  },
  { name: "Mimosa",     ra: 191.93, dec: -59.69, mag: 1.25  },
  { name: "Regulus",    ra: 152.09, dec: 11.97,  mag: 1.35  },
  { name: "Adhara",     ra: 104.66, dec: -28.97, mag: 1.50  },
];

const PLANETS_J2026 = [
  { name: "Jupiter", ra: 95.0,  dec: 23.0,  mag: -2.3, color: "#fde68a" },
  { name: "Saturn",  ra: 330.0, dec: -14.0, mag: 0.8,  color: "#fcd34d" },
  { name: "Mars",    ra: 110.0, dec: 24.0,  mag: 1.1,  color: "#f87171" },
  { name: "Venus",   ra: 85.0,  dec: 21.0,  mag: -4.2, color: "#ffffff" },
  { name: "Mercury", ra: 75.0,  dec: 18.0,  mag: 0.5,  color: "#d1d5db" },
];

const CONSTELLATIONS = [
  {
    name: "Orion",
    lines: [["Betelgeuse", "Rigel"], ["Betelgeuse", "Procyon"]],
  },
  {
    name: "Canis Major",
    lines: [["Sirius", "Adhara"]],
  },
  {
    name: "Leo",
    lines: [["Regulus", "Spica"]],
  },
];

// ─── Draw function ──────────────────────────────────────────────────

function drawSkyDome(
  canvas: HTMLCanvasElement,
  lat: number,
  lng: number,
  date: Date,
  issLat?: number,
  issLng?: number
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const size = canvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;

  ctx.clearRect(0, 0, size, size);

  // Clip to circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // Background gradient
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  bg.addColorStop(0, "#0d1117");
  bg.addColorStop(1, "#010409");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Random background stars (seeded per session)
  const rng = (n: number) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 200; i++) {
    const sx = rng(i * 3) * size;
    const sy = rng(i * 3 + 1) * size;
    const sr = rng(i * 3 + 2) * 1.5 + 0.5;
    const alpha = rng(i) * 0.7 + 0.3;
    const dx = sx - cx;
    const dy = sy - cy;
    if (dx * dx + dy * dy > r * r) continue;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fill();
  }

  ctx.restore();

  // Altitude rings
  const ringAlts = [30, 60];
  ringAlts.forEach((alt) => {
    const ringR = r * (1 - alt / 90);
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.setLineDash([]);
    // Label
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = "10px monospace";
    ctx.fillText(`${alt}°`, cx + ringR + 3, cy);
  });

  // Horizon circle
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.stroke();

  // Cardinal labels
  const cardinals = [
    { label: "N", az: 0 },
    { label: "E", az: 90 },
    { label: "S", az: 180 },
    { label: "W", az: 270 },
  ];
  ctx.font = "bold 12px monospace";
  ctx.fillStyle = "rgba(56,189,248,0.8)";
  cardinals.forEach(({ label, az }) => {
    const azRad = toRad(az);
    const lx = cx + (r + 2) * Math.sin(azRad);
    const ly = cy - (r + 2) * Math.cos(azRad);
    ctx.fillText(label, lx - 4, ly + 4);
  });

  // Compute LST
  const jd = julianDate(date);
  const lst = lstDeg(jd, lng);

  // Compute star positions
  const starPositions: Record<string, { x: number; y: number } | null> = {};
  BRIGHT_STARS.forEach((star) => {
    const { alt, az } = raDecToAltAz(star.ra, star.dec, lat, lst);
    const pos = altAzToCanvas(alt, az, cx, cy, r);
    starPositions[star.name] = pos;

    if (!pos) return;
    // Star size by magnitude
    let sr = 1.5;
    if (star.mag < 0) sr = 4;
    else if (star.mag < 1) sr = 3;
    else if (star.mag < 1.5) sr = 2;

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, sr, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.shadowColor = "rgba(255,255,255,0.6)";
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Label brighter stars
    if (star.mag < 0.9) {
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(200,220,255,0.7)";
      ctx.fillText(star.name, pos.x + sr + 3, pos.y - 2);
    }
  });

  // Constellation lines
  CONSTELLATIONS.forEach((cons) => {
    let midX = 0;
    let midY = 0;
    let count = 0;

    cons.lines.forEach(([a, b]) => {
      const pa = starPositions[a];
      const pb = starPositions[b];
      if (!pa || !pb) return;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.strokeStyle = "rgba(34,211,238,0.35)";
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.stroke();
      midX += (pa.x + pb.x) / 2;
      midY += (pa.y + pb.y) / 2;
      count++;
    });

    // Constellation label
    if (count > 0) {
      midX /= count;
      midY /= count;
      ctx.font = "9px monospace";
      ctx.fillStyle = "rgba(34,211,238,0.5)";
      ctx.fillText(cons.name, midX - 15, midY - 8);
    }
  });

  // Planets
  PLANETS_J2026.forEach((planet) => {
    // Rough RA offset for date difference from J2026.0 (~Jan 1 2026)
    const j2026 = 2461042.5;
    const daysDiff = jd - j2026;
    const raOffset = (daysDiff / 365.25) * 1.0; // ~1°/year motion approx
    const { alt, az } = raDecToAltAz(planet.ra + raOffset, planet.dec, lat, lst);
    const pos = altAzToCanvas(alt, az, cx, cy, r);
    if (!pos) return;

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = planet.color;
    ctx.shadowColor = planet.color;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.font = "bold 11px monospace";
    ctx.fillStyle = planet.color;
    ctx.fillText(planet.name, pos.x + 7, pos.y + 4);
  });

  // ISS position (if above horizon)
  if (issLat !== undefined && issLng !== undefined) {
    // Approximate ISS altitude as 408km above given lat/lng
    // Convert ISS ground track to alt/az from observer
    const dLat = toRad(issLat - lat);
    const dLng = toRad(issLng - lng);
    const obsLatR = toRad(lat);
    const issLatR = toRad(issLat);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(obsLatR) * Math.cos(issLatR) * Math.sin(dLng / 2) ** 2;
    const groundDistKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const issAltKm = 408;
    const issElevRad = Math.atan2(issAltKm, groundDistKm);
    const issElevDeg = toDeg(issElevRad);

    if (issElevDeg > 0) {
      // Bearing from observer to ISS
      const y2 = Math.sin(dLng) * Math.cos(issLatR);
      const x2 =
        Math.cos(obsLatR) * Math.sin(issLatR) -
        Math.sin(obsLatR) * Math.cos(issLatR) * Math.cos(dLng);
      const bearing = (toDeg(Math.atan2(y2, x2)) + 360) % 360;
      const pos = altAzToCanvas(issElevDeg, bearing, cx, cy, r);
      if (pos) {
        const t = Date.now() / 500;
        const blink = Math.sin(t) > 0;
        if (blink) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#22d3ee";
          ctx.shadowColor = "#22d3ee";
          ctx.shadowBlur = 12;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        ctx.font = "9px monospace";
        ctx.fillStyle = "#22d3ee";
        ctx.fillText("ISS", pos.x + 6, pos.y + 4);
      }
    }
  }

  // Zenith crosshair
  ctx.strokeStyle = "#22d3ee";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy);
  ctx.lineTo(cx + 8, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx, cy + 8);
  ctx.stroke();
  ctx.font = "9px monospace";
  ctx.fillStyle = "rgba(34,211,238,0.7)";
  ctx.fillText("ZENITH", cx + 6, cy - 6);
}

// ─── Component ──────────────────────────────────────────────────────

export function SkyDomeCanvas({ lat, lng, date, issLat, issLng }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  const getSize = useCallback(() => {
    const w = containerRef.current?.offsetWidth ?? 560;
    return Math.min(w - 16, 560);
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = getSize();
    canvas.width = size;
    canvas.height = size;
    drawSkyDome(canvas, lat, lng, date, issLat, issLng);
  }, [lat, lng, date, issLat, issLng, getSize]);

  // Re-render on prop change
  useEffect(() => {
    render();
  }, [render]);

  // Blink ISS every 500ms
  useEffect(() => {
    if (issLat === undefined || issLng === undefined) return;
    const id = setInterval(() => render(), 500);
    return () => clearInterval(id);
  }, [render, issLat, issLng]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => render());
    observer.observe(el);
    return () => observer.disconnect();
  }, [render]);

  return (
    <div ref={containerRef} className="w-full flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        className="rounded-full border border-cyan-500/20 shadow-[0_0_40px_rgba(34,211,238,0.1)]"
        style={{ maxWidth: "100%", cursor: "crosshair" }}
      />
      <div className="flex flex-wrap gap-4 text-[9px] font-mono text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white inline-block" /> Stars</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-300 inline-block" /> Planets</span>
        <span className="flex items-center gap-1"><span className="w-2 h-1 bg-cyan-400/50 inline-block" /> Constellations</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> ISS / Zenith</span>
      </div>
    </div>
  );
}
