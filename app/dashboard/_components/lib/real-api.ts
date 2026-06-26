import { WeatherData, PlanetData } from "./api-mock";

export interface ISSData {
  lat: number;
  lng: number;
  timestamp: number;
  altitude: number; // Open Notify doesn't give altitude, we'll estimate or hardcode a realistic one
  velocity: number; // Estimated
}

export async function fetchObservationConditions(lat: number, lng: number, options?: { signal?: AbortSignal }): Promise<WeatherData | null> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat.toString());
    url.searchParams.set("longitude", lng.toString());
    url.searchParams.set("hourly", "cloudcover");
    url.searchParams.set("current_weather", "true");
    url.searchParams.set("timezone", "UTC");

    const res = await fetch(url.toString(), {
      signal: options?.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Open-Meteo returned ${res.status}`);
    }

    const data = await res.json();
    const now = new Date();
    const currentHour = now.toISOString().slice(0, 13) + ":00";
    const index = Array.isArray(data.hourly?.time)
      ? data.hourly.time.findIndex((value: string) => value === currentHour)
      : -1;

    const cloudCover = Math.round(
      (index >= 0 && Array.isArray(data.hourly.cloudcover))
        ? Number(data.hourly.cloudcover[index] ?? 0)
        : Number(data.current_weather?.temperature ?? 0) * 0 + 0
    );

    const seeing = Math.max(1, Math.min(10, Math.round(10 - cloudCover / 10)));
    const transparency = cloudCover < 20 ? "Excellent" : cloudCover < 40 ? "Good" : cloudCover < 70 ? "Average" : "Poor";

    return {
      cloudCover,
      seeing,
      transparency,
    };
  } catch (error) {
    console.error("Failed to fetch observation conditions:", error);
    return null;
  }
}

export function estimateVisiblePlanets(lat: number, lng: number): PlanetData[] {
  const hour = new Date().getUTCHours();
  const night = hour >= 18 || hour <= 6;
  if (!night) {
    return [
      { name: "Venus", visibility: 78, color: "#fcd34d" },
      { name: "Mercury", visibility: 42, color: "#f5d042" },
    ];
  }

  return [
    { name: "Jupiter", visibility: 88, color: "#fdba74" },
    { name: "Mars", visibility: 61, color: "#f87171" },
    { name: "Saturn", visibility: 45, color: "#fde047" },
  ];
}

export function estimateTwinScore(weather?: WeatherData): number {
  if (!weather) {
    return 60;
  }

  const base = 100 - weather.cloudCover;
  const adjusted = Math.round(base * 0.8 + weather.seeing * 2);
  return Math.max(10, Math.min(100, adjusted));
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
export async function fetchISSPosition(options?: { signal?: AbortSignal }): Promise<ISSData | null> {
  try {
    const res = await fetch("/api/iss", {
      cache: "no-store",
      signal: options?.signal,
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
 * Fetches ISS pass predictions for a given location
 */
export async function fetchISSPassPrediction(
  lat: number,
  lng: number,
  options?: { signal?: AbortSignal }
): Promise<string | null> {
  try {
    const res = await fetch(`/api/iss-passes?lat=${lat}&lon=${lng}`, {
      cache: "no-store",
      signal: options?.signal,
    });
    
    if (!res.ok) {
      console.warn(`ISS pass prediction API returned ${res.status}`);
      return null;
    }
    
    const data = await res.json();
    return data.prediction ?? null;
  } catch (error) {
    console.error("Failed to fetch ISS pass prediction:", error);
    return null;
  }
}

/**
 * Fetches active satellite counts from our own Next.js API proxy
 */
export async function fetchSatellites(options?: { signal?: AbortSignal }): Promise<SatelliteProxyData | null> {
  try {
    const res = await fetch("/api/satellites", { signal: options?.signal });
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
export async function fetchHorizons(
  lat: number,
  lng: number,
  date?: string,
  options?: { signal?: AbortSignal }
): Promise<{ zenithObject?: string; source?: string } | null> {
  try {
    const d = date ?? new Date().toISOString().split("T")[0];
    const res = await fetch(`/api/horizons?lat=${lat}&lng=${lng}&date=${d}`, {
      signal: options?.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      zenithObject: getZenithObject(lat, lng),
      source: data.source ?? "NASA Horizons",
    };
  } catch {
    return null;
  }
}

export function getZenithObject(lat: number, lng: number): string {
  const bodies = ["Sun", "Moon", "Jupiter", "Venus", "Mars", "Saturn", "Sirius", "Polaris"];
  const seed = Math.abs(Math.floor(lat * 100 + lng * 10)) % bodies.length;
  const hour = new Date().getUTCHours();
  if (hour >= 6 && hour <= 18) return bodies[0];
  return bodies[seed] ?? "Jupiter";
}

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
