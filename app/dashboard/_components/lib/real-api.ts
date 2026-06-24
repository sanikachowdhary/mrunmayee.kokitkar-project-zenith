import { WeatherData, PlanetData } from "./api-mock";

export interface ISSData {
  lat: number;
  lng: number;
  timestamp: number;
  altitude: number; // Open Notify doesn't give altitude, we'll estimate or hardcode a realistic one
  velocity: number; // Estimated
}

export interface SatelliteProxyData {
  activeCount: number;
  topSatellites: {
    name: string;
    id: string;
    epoch: string;
  }[];
}

/**
 * Fetches real-time ISS coordinates from Open Notify
 */
export async function fetchISSPosition(): Promise<ISSData | null> {
  try {
    const res = await fetch("http://api.open-notify.org/iss-now.json", {
      cache: "no-store", // We want this as fresh as possible (updated every few seconds)
    });
    const data = await res.json();

    if (data.message === "success") {
      return {
        lat: parseFloat(data.iss_position.latitude),
        lng: parseFloat(data.iss_position.longitude),
        timestamp: data.timestamp,
        altitude: 408, // Standard approximate ISS altitude km
        velocity: 27600, // Standard approximate ISS velocity km/h
      };
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch ISS data:", error);
    return null;
  }
}

/**
 * Fetches active satellite counts from our own Next.js API proxy
 */
export async function fetchSatellites(): Promise<SatelliteProxyData | null> {
  try {
    const res = await fetch("/api/satellites");
    if (!res.ok) throw new Error("Proxy error");
    return await res.json();
  } catch (error) {
    console.error("Failed to fetch Satellite proxy data:", error);
    return null;
  }
}

/**
 * Generates deterministic weather/planet mock data based on lat/lng
 * (Since we don't have a free weather/astronomy API key for this exercise)
 */
export function generateLocalTelemetryMock(lat: number, lng: number) {
  const seed = Math.abs(lat * lng);
  const score = Math.floor(40 + (seed % 60)); // 40-100
  
  const allPlanets = [
    { name: "Venus", color: "#fcd34d" },
    { name: "Mars", color: "#f87171" },
    { name: "Jupiter", color: "#fdba74" },
    { name: "Saturn", color: "#fde047" },
  ];
  
  const numPlanets = 1 + Math.floor(seed % 4);
  const visiblePlanets = allPlanets.slice(0, numPlanets).map((p, i) => ({
    ...p,
    visibility: Math.floor(40 + ((seed + i * 13) % 60)),
  }));

  const transparencyLevels = ["Poor", "Average", "Good", "Excellent"];

  return {
    weather: {
      cloudCover: seed % 100,
      seeing: 3 + (seed % 7),
      transparency: transparencyLevels[seed % 4],
    },
    visiblePlanets,
    twinScore: score,
  };
}
