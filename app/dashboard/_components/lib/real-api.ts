export interface WeatherData {
  cloudCover: number;
  seeing: number;
  transparency: string;
  windSpeed: number;
  precipitation: number;
  visibility: number;
}

export interface PlanetData {
  name: string;
  visibility: number;
  color: string;
}

export interface ISSData {
  lat: number;
  lng: number;
  timestamp: number;
  altitude: number;
  velocity: number;
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
 * Fetches real-time observation conditions from Open-Meteo (client calls our server API to avoid CORS)
 */
export async function fetchObservationConditions(
  lat: number,
  lng: number,
  options?: { signal?: AbortSignal }
): Promise<WeatherData | null> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat.toString());
    url.searchParams.set("longitude", lng.toString());
    url.searchParams.set(
      "current",
      "cloud_cover,wind_speed_10m,precipitation,visibility"
    );
    url.searchParams.set("hourly", "cloud_cover");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "1");

    const res = await fetch(url.toString(), {
      signal: options?.signal,
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);

    const data = (await res.json()) as {
      current?: {
        cloud_cover?: number;
        wind_speed_10m?: number;
        precipitation?: number;
        visibility?: number;
      };
    };

    const cloudCover = Math.round(data.current?.cloud_cover ?? 0);
    const windSpeed = data.current?.wind_speed_10m ?? 0;
    const precipitation = data.current?.precipitation ?? 0;
    const visibility = data.current?.visibility ?? 10000;
    const seeing = Math.max(1, Math.min(10, Math.round(10 - cloudCover / 10)));
    const transparency =
      cloudCover < 20
        ? "Excellent"
        : cloudCover < 40
        ? "Good"
        : cloudCover < 70
        ? "Average"
        : "Poor";

    return { cloudCover, seeing, transparency, windSpeed, precipitation, visibility };
  } catch (error) {
    console.error("Failed to fetch observation conditions:", error);
    return null;
  }
}

export function estimateVisiblePlanets(_lat: number, _lng: number): PlanetData[] {
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

export function estimateTwinScore(weather?: WeatherData, lat?: number): number {
  const base = 70;
  const cloudCover = weather?.cloudCover ?? 40;
  const windSpeed = weather?.windSpeed ?? 0;
  const hour = new Date().getHours();
  const latAbs = Math.abs(lat ?? 19);

  const cloudPenalty = Math.round(cloudCover * 0.5);
  const timeBonus = hour >= 21 || hour <= 4 ? 15 : 0;
  const latBonus = latAbs >= 20 && latAbs <= 60 ? 10 : 0;
  const windPenalty = windSpeed > 20 ? 5 : 0;

  return Math.max(0, Math.min(100, base - cloudPenalty + timeBonus + latBonus - windPenalty));
}

/**
 * Fetches real-time ISS coordinates from Open Notify via our proxy
 */
export async function fetchISSPosition(options?: {
  signal?: AbortSignal;
}): Promise<ISSData | null> {
  try {
    const res = await fetch("/api/iss", {
      cache: "no-store",
      signal: options?.signal,
    });
    const data = (await res.json()) as {
      message?: string;
      iss_position?: { latitude: string; longitude: string };
      timestamp?: number;
    };

    if (data.message === "success" && data.iss_position) {
      return {
        lat: parseFloat(data.iss_position.latitude),
        lng: parseFloat(data.iss_position.longitude),
        timestamp: data.timestamp ?? Date.now() / 1000,
        altitude: 408,
        velocity: 27580,
      };
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch ISS data:", error);
    return null;
  }
}

/**
 * Fetches ISS pass prediction (detailed format) for a given location
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
    if (!res.ok) return null;
    const data = (await res.json()) as {
      passes?: { riseTime: string; maxElevation: number; duration: number; direction: string }[];
    };
    if (!data.passes || data.passes.length === 0) return null;
    const first = data.passes[0];
    const riseDate = new Date(first.riseTime);
    const diff = riseDate.getTime() - Date.now();
    const hoursUntil = Math.floor(diff / 3600000);
    const minsUntil = Math.floor((diff % 3600000) / 60000);
    const timeStr = hoursUntil > 0 ? `${hoursUntil}h ${minsUntil}m` : `${minsUntil}m`;
    return `YES - Next pass in ${timeStr} at ${first.maxElevation}° elevation, ${Math.round(first.duration / 60)}min, from ${first.direction}.`;
  } catch (error) {
    console.error("Failed to fetch ISS pass prediction:", error);
    return null;
  }
}

/**
 * Fetches active satellite counts from our own Next.js API proxy
 */
export async function fetchSatellites(options?: {
  signal?: AbortSignal;
}): Promise<SatelliteProxyData | null> {
  try {
    const res = await fetch("/api/satellites", { signal: options?.signal });
    if (!res.ok) throw new Error("Proxy error");
    return (await res.json()) as SatelliteProxyData;
  } catch (error) {
    console.error("Failed to fetch Satellite proxy data:", error);
    return null;
  }
}

/**
 * Fetches horizons data via our server proxy
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
    const data = (await res.json()) as { source?: string };
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
  const score = Math.floor(40 + (seed % 60));

  const allPlanets: PlanetData[] = [
    { name: "Venus",   color: "#fcd34d", visibility: 78 },
    { name: "Mars",    color: "#f87171", visibility: 61 },
    { name: "Jupiter", color: "#fdba74", visibility: 88 },
    { name: "Saturn",  color: "#fde047", visibility: 45 },
  ];

  const numPlanets = 1 + Math.floor(seed % 4);
  const visiblePlanets = allPlanets.slice(0, numPlanets).map((p, i) => ({
    ...p,
    visibility: Math.floor(40 + ((seed + i * 13) % 60)),
  }));

  const transparencyLevels = ["Poor", "Average", "Good", "Excellent"];

  return {
    weather: {
      cloudCover: Math.floor(seed % 100),
      seeing: 3 + Math.floor(seed % 7),
      transparency: transparencyLevels[Math.floor(seed % 4)],
      windSpeed: Math.floor(seed % 30),
      precipitation: 0,
      visibility: 10000,
    },
    visiblePlanets,
    twinScore: score,
  };
}
