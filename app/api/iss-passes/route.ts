import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const revalidate = 0; // Do not cache, we want live polling

interface ISSPass {
  rise_time: number;
  visible_seconds: number;
  max_elevation: number;
}

interface PassPrediction {
  passes: ISSPass[];
  message: string;
  request: {
    latitude: number;
    longitude: number;
    altitude: number;
  };
}

function formatPassPrediction(data: PassPrediction): string {
  if (!data.passes || data.passes.length === 0) {
    return "NO - No visible passes predicted in the next 24 hours.";
  }

  const firstPass = data.passes[0];
  const riseTime = new Date(firstPass.rise_time * 1000);
  const visibleSeconds = firstPass.visible_seconds;
  const maxElevation = Math.round(firstPass.max_elevation);

  const timeUntilPass = riseTime.getTime() - Date.now();
  const hoursUntil = Math.floor(timeUntilPass / (1000 * 60 * 60));
  const minutesUntil = Math.floor((timeUntilPass % (1000 * 60 * 60)) / (1000 * 60));

  const durationMinutes = Math.round(visibleSeconds / 60);

  if (hoursUntil < 0) {
    // Pass is in the past, check the next one
    if (data.passes.length > 1) {
      const nextPass = data.passes[1];
      const nextRiseTime = new Date(nextPass.rise_time * 1000);
      const nextTimeUntilPass = nextRiseTime.getTime() - Date.now();
      const nextHoursUntil = Math.floor(nextTimeUntilPass / (1000 * 60 * 60));
      const nextMinutesUntil = Math.floor((nextTimeUntilPass % (1000 * 60 * 60)) / (1000 * 60));
      const nextMaxElevation = Math.round(nextPass.max_elevation);
      const nextDurationMinutes = Math.round(nextPass.visible_seconds / 60);

      return `YES - Next pass in ${nextHoursUntil}h ${nextMinutesUntil}m at ${nextMaxElevation}° elevation for ${nextDurationMinutes}min.`;
    }
    return "NO - No visible passes predicted in the next 24 hours.";
  }

  return `YES - Pass predicted in ${hoursUntil}h ${minutesUntil}m at ${maxElevation}° elevation for ${durationMinutes}min.`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");

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

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { error: "Latitude must be between -90 and 90, longitude between -180 and 180" },
        { status: 400 }
      );
    }

    const url = `https://api.open-notify.org/iss-pass.json?lat=${latitude}&lon=${longitude}&n=5`;
    const res = await fetch(url, {
      cache: "no-store"
    });

    if (!res.ok) {
      throw new Error(`Open Notify API returned status: ${res.status}`);
    }

    const data: PassPrediction = await res.json();
    const prediction = formatPassPrediction(data);

    return NextResponse.json({
      prediction,
      raw: data
    });
  } catch (error) {
    console.error("Failed to fetch ISS pass predictions:", error);
    return NextResponse.json(
      { error: "Failed to fetch ISS pass predictions" },
      { status: 500 }
    );
  }
}
