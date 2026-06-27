import { NextResponse } from "next/server";
import * as satellite from "satellite.js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Cache for 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedPasses: { data: PassResult; lat: number; lng: number; timestamp: number } | null = null;

interface PassResult {
  passes: ISSPass[];
}

interface ISSPass {
  riseTime: string;       // UTC ISO string
  maxElevation: number;   // degrees
  duration: number;       // seconds
  direction: string;      // compass direction
}

async function fetchISSTLE(): Promise<[string, string]> {
  try {
    const res = await fetch(
      "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE",
      { next: { revalidate: 1800 } }
    );
    if (!res.ok) throw new Error(`CelesTrak status: ${res.status}`);
    const text = await res.text();
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length >= 3) {
      return [lines[1], lines[2]];
    }
    if (lines.length >= 2 && lines[0].startsWith("1 ")) {
      return [lines[0], lines[1]];
    }
    throw new Error("Invalid TLE response format");
  } catch (error) {
    console.warn("Failed to fetch live TLE, using fallback:", error);
    return [
      "1 25544U 98067A   26177.58156177  .00017006  00000-0  30188-3 0  9990",
      "2 25544  51.6416  60.2917 0005234 321.8415  38.2588 15.49845341573983",
    ];
  }
}

function azimuthToCompass(azDeg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(azDeg / 45) % 8;
  return dirs[idx];
}

function calculateISSPasses(
  line1: string,
  line2: string,
  obsLat: number,
  obsLng: number,
  windowHours = 24
): ISSPass[] {
  const satrec = satellite.twoline2satrec(line1, line2);
  const observerGd: satellite.GeodeticLocation = {
    latitude: satellite.degreesToRadians(obsLat),
    longitude: satellite.degreesToRadians(obsLng),
    height: 0.1,
  };

  const passes: ISSPass[] = [];
  let inPass = false;
  let passStartMs = 0;
  let maxEl = 0;
  let riseAzDeg = 0;

  const now = new Date();
  const startTimeMs = now.getTime();
  const stepSeconds = 10;
  const totalSteps = Math.floor((windowHours * 3600) / stepSeconds);

  for (let i = 0; i < totalSteps && passes.length < 5; i++) {
    const time = new Date(startTimeMs + i * stepSeconds * 1000);
    const posVel = satellite.propagate(satrec, time);
    if (!posVel || !posVel.position || typeof posVel.position === "boolean")
      continue;

    const gmst = satellite.gstime(time);
    const posEcf = satellite.eciToEcf(
      posVel.position as satellite.EciVec3<number>,
      gmst
    );
    const lookAngles = satellite.ecfToLookAngles(observerGd, posEcf);
    const elDegrees = satellite.radiansToDegrees(lookAngles.elevation);
    const azDegrees = satellite.radiansToDegrees(lookAngles.azimuth);

    if (elDegrees >= 10) {
      if (!inPass) {
        inPass = true;
        passStartMs = time.getTime();
        maxEl = elDegrees;
        riseAzDeg = azDegrees;
      } else {
        if (elDegrees > maxEl) {
          maxEl = elDegrees;
        }
      }
    } else {
      if (inPass) {
        inPass = false;
        const endMs = time.getTime();
        const duration = Math.round((endMs - passStartMs) / 1000);
        if (duration > 30) {
          passes.push({
            riseTime: new Date(passStartMs).toISOString(),
            maxElevation: Math.round(maxEl),
            duration,
            direction: azimuthToCompass(riseAzDeg),
          });
        }
        maxEl = 0;
        riseAzDeg = 0;
      }
    }
  }

  return passes;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon") ?? searchParams.get("lng");

    if (!lat || !lon) {
      return NextResponse.json(
        { error: "Missing latitude or longitude parameters" },
        { status: 400 }
      );
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: "Invalid latitude or longitude values" },
        { status: 400 }
      );
    }

    if (
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        { error: "Latitude or longitude out of range" },
        { status: 400 }
      );
    }

    // 5-minute cache (same location ±0.5°)
    const now = Date.now();
    if (
      cachedPasses &&
      now - cachedPasses.timestamp < CACHE_TTL_MS &&
      Math.abs(cachedPasses.lat - latitude) < 0.5 &&
      Math.abs(cachedPasses.lng - longitude) < 0.5
    ) {
      return NextResponse.json(cachedPasses.data);
    }

    const [line1, line2] = await fetchISSTLE();
    const passes = calculateISSPasses(line1, line2, latitude, longitude, 24);

    const result: PassResult = { passes };
    cachedPasses = {
      data: result,
      lat: latitude,
      lng: longitude,
      timestamp: now,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to calculate ISS pass predictions:", error);
    return NextResponse.json(
      { error: "Failed to calculate ISS pass predictions" },
      { status: 500 }
    );
  }
}
