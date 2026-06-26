import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const revalidate = 3600;

const HORIZONS_BASE = "https://ssd.jpl.nasa.gov/api/horizons.api";

/** Body IDs: 10=Sun, 301=Moon, 399=Earth, 499=Mars, 599=Jupiter, etc. */
const DEFAULT_COMMAND = "10";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lat = params.get("lat") ?? "19.076";
  const lng = params.get("lng") ?? "72.8777";
  const date = params.get("date") ?? new Date().toISOString().split("T")[0];
  const command = params.get("command") ?? DEFAULT_COMMAND;

  const startTime = `${date} 00:00:00`;
  const stopTime = `${date} 23:59:59`;

  const horizonsParams = new URLSearchParams({
    format: "json",
    COMMAND: `'${command}'`,
    EPHEM_TYPE: "OBSERVER",
    CENTER: "coord@399",
    COORD_TYPE: "GEODETIC",
    SITE_COORD: `'${lng},${lat},0'`,
    START_TIME: `'${startTime}'`,
    STOP_TIME: `'${stopTime}'`,
    STEP_SIZE: "'1 h'",
    QUANTITIES: "'1,9,20,31'",
    REF_SYSTEM: "ICRF",
    CAL_FORMAT: "CAL",
    TIME_DIGITS: "MINUTES",
    ANG_FORMAT: "HMS",
  });

  try {
    const cacheKey = `horizons-${lat}-${lng}-${date}-${command}`;
    const res = await fetch(`${HORIZONS_BASE}?${horizonsParams.toString()}`, {
      next: { revalidate: 3600, tags: [cacheKey] },
    });

    if (!res.ok) {
      throw new Error(`Horizons API returned ${res.status}`);
    }

    const data = await res.json();

    if (data.error) {
      return NextResponse.json(
        { error: data.error, fallback: true },
        { status: 502 }
      );
    }

    return NextResponse.json({
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      date,
      command,
      result: data.result,
      signature: data.signature,
      source: "NASA Horizons",
    });
  } catch (error) {
    console.error("Horizons API error:", error);
    return NextResponse.json(
      {
        error: "NASA Horizons unavailable",
        fallback: true,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        date,
      },
      { status: 503 }
    );
  }
}
