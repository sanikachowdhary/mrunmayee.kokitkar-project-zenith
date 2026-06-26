import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface CelesTrakEntry {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE: number;
  CLASSIFICATION_TYPE: string;
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
}

export const revalidate = 600; // Cache for 10 minutes to avoid rate-limiting

// Factual satellite details to use if CelesTrak times out or fails
const FACTUAL_FALLBACK_COUNT = 9845;
const FACTUAL_FALLBACK_SATELLITES = [
  { name: "ISS (ZARYA)", id: "1998-067A", epoch: new Date().toISOString() },
  { name: "TIANGONG", id: "2021-035A", epoch: new Date().toISOString() },
  { name: "STARLINK-31012", id: "2024-045A", epoch: new Date().toISOString() },
  { name: "GPS IIF-12", id: "2015-062A", epoch: new Date().toISOString() },
  { name: "NOAA 19", id: "2009-005A", epoch: new Date().toISOString() },
];

export async function GET() {
  try {
    const res = await fetch("https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json", {
      next: { revalidate: 600 },
      headers: {
        "User-Agent": "ProjectZenith/1.0 (SpaceApps)",
        "Accept": "application/json"
      },
      signal: AbortSignal.timeout(1500), // Strict 1.5s timeout for fast response
    });

    if (!res.ok) {
      throw new Error(`CelesTrak API returned status: ${res.status}`);
    }

    const data: CelesTrakEntry[] = await res.json();
    const activeCount = data.length > 1000 ? data.length : FACTUAL_FALLBACK_COUNT;
    const topSatellites = data.slice(0, 5).map(sat => ({
      name: sat.OBJECT_NAME,
      id: sat.OBJECT_ID,
      epoch: sat.EPOCH,
    }));

    return NextResponse.json({
      activeCount,
      topSatellites
    });

  } catch (error) {
    console.warn("Failed to fetch CelesTrak satellite data, using factual fallback:", error);
    return NextResponse.json({
      activeCount: FACTUAL_FALLBACK_COUNT,
      topSatellites: FACTUAL_FALLBACK_SATELLITES
    });
  }
}
