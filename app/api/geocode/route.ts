import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  accuracy: "coordinates" | "geocoded" | "google" | "reverse";
}

function parseCoordinates(query: string): { lat: number; lng: number } | null {
  const match = query.trim().match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { lat, lng };
}

/** Special-case named locations (poles, oceans) for better UX */
function getSpecialName(lat: number, lng: number): string | null {
  if (lat > 89.5) return "North Pole";
  if (lat < -89.5) return "South Pole";
  if (lat > 66.5) return `Arctic Circle (${lat.toFixed(2)}°N)`;
  if (lat < -66.5) return `Antarctic Circle (${Math.abs(lat).toFixed(2)}°S)`;

  // Pacific Ocean remoteness — Point Nemo area
  if (Math.abs(lat) < 50 && (lng < -100 || lng > 150) && Math.abs(lat) > 5) {
    return `Pacific Ocean (${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"})`;
  }
  return null;
}

async function reverseGeocodeNominatim(lat: number, lng: number): Promise<GeocodeResult | null> {
  const special = getSpecialName(lat, lng);
  if (special) {
    return { lat, lng, displayName: special, accuracy: "reverse" };
  }

  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "ProjectZenith/1.0 (hackathon; contact@zenith.app)",
        "Accept-Language": "en",
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) {
      // Nominatim returns {error: "Unable to geocode"} for ocean coords
      return {
        lat, lng,
        displayName: `Open Ocean (${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? "E" : "W"})`,
        accuracy: "reverse",
      };
    }
    const name = data.display_name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    return { lat, lng, displayName: name, accuracy: "reverse" };
  } catch {
    return null;
  }
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
    // If input looks like coordinates, do REVERSE geocoding
    const coords = parseCoordinates(q);
    if (coords) {
      const reversed = await reverseGeocodeNominatim(coords.lat, coords.lng);
      if (reversed) return NextResponse.json(reversed);
      // Fallback: return bare coordinates
      return NextResponse.json({
        lat: coords.lat,
        lng: coords.lng,
        displayName: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
        accuracy: "coordinates",
      });
    }

    // Otherwise do forward geocoding
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
