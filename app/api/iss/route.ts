import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const revalidate = 0; // Do not cache, we want live polling

export async function GET() {
  try {
    const res = await fetch("https://api.open-notify.org/iss-now.json", {
      cache: "no-store"
    });

    if (!res.ok) {
      throw new Error(`Open Notify API returned status: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch ISS data:", error);
    return NextResponse.json({ error: "Failed to fetch ISS data" }, { status: 500 });
  }
}
