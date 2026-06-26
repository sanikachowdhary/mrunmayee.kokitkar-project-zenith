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

const NASA_API_KEY = process.env.NASA_API_KEY || "DEMO_KEY";

export async function GET() {
  try {
    const url = new URL("https://api.nasa.gov/planetary/apod");
    url.searchParams.set("api_key", NASA_API_KEY);

    const res = await fetch(url.toString(), {
      cache: "force-cache", // Cache for 24 hours by default
      next: { revalidate: 86400 } // Revalidate every 24 hours
    });

    if (!res.ok) {
      console.error(`NASA APOD API returned status: ${res.status}`);
      return NextResponse.json(
        { error: "Failed to fetch APOD data" },
        { status: res.status }
      );
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
    console.error("Failed to fetch NASA APOD:", error);
    return NextResponse.json(
      { error: "Failed to fetch NASA APOD data" },
      { status: 500 }
    );
  }
}
