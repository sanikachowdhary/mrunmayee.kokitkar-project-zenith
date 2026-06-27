import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface APODResponse {
  copyright?: string;
  date: string;
  explanation: string;
  hdurl?: string;
  media_type: "image" | "video";
  service_version: string;
  title: string;
  url: string;
}

// Fallback APOD if API is unavailable
const FALLBACK_APOD = {
  title: "The Pillars of Creation",
  date: "2026-06-26",
  explanation: "Eagle Nebula's iconic pillars of gas and dust, as seen by the Hubble Space Telescope.",
  url: "https://apod.nasa.gov/apod/image/2301/PillarsEagle_HubblePescador_960.jpg",
  hdurl: "https://apod.nasa.gov/apod/image/2301/PillarsEagle_HubblePescador_960.jpg",
  media_type: "image",
  copyright: "NASA/ESA/Hubble"
};

export async function GET() {
  const key = process.env.NASA_API_KEY ?? "DEMO_KEY";

  try {
    const url = new URL("https://api.nasa.gov/planetary/apod");
    url.searchParams.set("api_key", key);

    const res = await fetch(url.toString(), {
      cache: "force-cache", // Cache for 24 hours by default
      next: { revalidate: 86400 } // Revalidate every 24 hours
    });

    if (!res.ok) {
      console.warn(`NASA APOD API returned status: ${res.status}. Using fallback.`);
      return NextResponse.json({
        title: FALLBACK_APOD.title,
        explanation: FALLBACK_APOD.explanation,
        url: FALLBACK_APOD.url,
        hdurl: FALLBACK_APOD.hdurl,
        date: FALLBACK_APOD.date,
        copyright: FALLBACK_APOD.copyright,
        mediaType: FALLBACK_APOD.media_type,
      });
    }

    const data: APODResponse = await res.json();

    return NextResponse.json({
      title: data.title,
      explanation: data.explanation,
      url: data.url,
      hdurl: data.hdurl,
      date: data.date,
      copyright: data.copyright,
      mediaType: data.media_type,
    });
  } catch (error) {
    console.error("Failed to fetch NASA APOD, returning fallback:", error);
    return NextResponse.json({
      title: FALLBACK_APOD.title,
      explanation: FALLBACK_APOD.explanation,
      url: FALLBACK_APOD.url,
      hdurl: FALLBACK_APOD.hdurl,
      date: FALLBACK_APOD.date,
      copyright: FALLBACK_APOD.copyright,
      mediaType: FALLBACK_APOD.media_type,
    });
  }
}
