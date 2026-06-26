import { NextResponse } from "next/server";
import * as satellite from "satellite.js";

export const dynamic = "force-dynamic";
export const revalidate = 0; // live data, no cache for client responses

async function fetchISSTLE(): Promise<[string, string]> {
  try {
    const res = await fetch("https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE", {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(2000), // Fast 2-second timeout to avoid build/runtime freezes
    });
    if (!res.ok) throw new Error(`CelesTrak status: ${res.status}`);
    const text = await res.text();
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    
    if (lines.length >= 3) {
      return [lines[1], lines[2]];
    }
    if (lines.length >= 2) {
      if (lines[0].startsWith("1 ") && lines[1].startsWith("2 ")) {
        return [lines[0], lines[1]];
      }
    }
    throw new Error("Invalid TLE response format");
  } catch (error) {
    console.warn("Failed to fetch live TLE from CelesTrak, using fallback:", error);
    // Recent TLE for ISS (approximate but extremely close)
    return [
      "1 25544U 98067A   26177.58156177  .00017006  00000-0  30188-3 0  9990",
      "2 25544  51.6416  60.2917 0005234 321.8415  38.2588 15.49845341573983"
    ];
  }
}

export async function GET() {
  try {
    const [line1, line2] = await fetchISSTLE();
    const now = new Date();
    const satrec = satellite.twoline2satrec(line1, line2);
    const positionAndVelocity = satellite.propagate(satrec, now);
    
    if (
      !positionAndVelocity ||
      !positionAndVelocity.position ||
      !positionAndVelocity.velocity ||
      typeof positionAndVelocity.position === "boolean" ||
      typeof positionAndVelocity.velocity === "boolean"
    ) {
      throw new Error("SGP4 propagation failed");
    }

    const gmst = satellite.gstime(now);
    const positionGd = satellite.eciToGeodetic(positionAndVelocity.position as satellite.EciVec3<number>, gmst);

    const lat = satellite.radiansToDegrees(positionGd.latitude);
    const lng = satellite.radiansToDegrees(positionGd.longitude);
    const alt = positionGd.height; // in km

    const velEci = positionAndVelocity.velocity as satellite.EciVec3<number>;
    const velocity = Math.sqrt(velEci.x * velEci.x + velEci.y * velEci.y + velEci.z * velEci.z);
    const velocityKmh = velocity * 3600; // convert km/s to km/h

    return NextResponse.json({
      timestamp: Math.floor(now.getTime() / 1000),
      message: "success",
      iss_position: {
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6),
      },
      altitude: alt,
      velocity: velocityKmh,
    });
  } catch (error) {
    console.error("Failed to propagate ISS orbit:", error);
    try {
      // Fallback to simple OpenNotify if SGP4 breaks
      const res = await fetch("http://api.open-notify.org/iss-now.json", {
        cache: "no-store",
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({
          ...data,
          altitude: 418.5,
          velocity: 27580,
        });
      }
    } catch (e) {
      console.error("Fallback OpenNotify also failed:", e);
    }

    return NextResponse.json(
      { error: "Failed to fetch ISS data" },
      { status: 500 }
    );
  }
}
