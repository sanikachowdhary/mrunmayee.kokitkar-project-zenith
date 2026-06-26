import { NextRequest, NextResponse } from "next/server";

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  accuracy: "coordinates" | "geocoded" | "google";
}

function parseCoordinates(query: string): GeocodeResult | null {
  const match = query.trim().match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return {
    lat,
    lng,
    displayName: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    accuracy: "coordinates",
  };
}

async function geocodeNominatim(query: string): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "ProjectZenith/1.0 (hackathon; contact@zenith.app)",
      "Accept-Language": "en",
    },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const item = data[0];
  return {
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    displayName: item.display_name,
    accuracy: "geocoded",
  };
}

async function geocodeGoogle(query: string, apiKey: string): Promise<GeocodeResult | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.[0]) return null;
  const result = data.results[0];
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    displayName: result.formatted_address,
    accuracy: "google",
  };
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q?.trim()) {
    return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
  }

  try {
    const coordResult = parseCoordinates(q);
    if (coordResult) {
      return NextResponse.json(coordResult);
    }

    let result = await geocodeNominatim(q);

    if (!result && process.env.GOOGLE_GEOCODING_API_KEY) {
      result = await geocodeGoogle(q, process.env.GOOGLE_GEOCODING_API_KEY);
    }

    if (!result) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Geocoding failed:", error);
    return NextResponse.json({ error: "Geocoding service unavailable" }, { status: 503 });
  }
}
