import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// CelesTrak TLE JSON format approximation
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

export async function GET() {
  try {
    const res = await fetch("https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json", {
      next: { revalidate: 600 },
      headers: {
        "User-Agent": "ProjectZenith/1.0 (SpaceApps)",
        "Accept": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`CelesTrak API returned status: ${res.status}`);
    }

    const data: CelesTrakEntry[] = await res.json();
    
    // We get back an array of thousands of active satellites
    const activeCount = data.length;
    
    // Grab a few notable ones for potential display (ISS is usually here, plus some others)
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
    console.error("Failed to fetch CelesTrak data:", error);
    return NextResponse.json({ error: "Failed to fetch satellite data" }, { status: 500 });
  }
}
