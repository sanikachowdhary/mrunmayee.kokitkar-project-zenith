// app/sky/page.tsx — Server Component wrapper for metadata
import type { Metadata } from "next";
import { SkyTimeMachineClient } from "./SkyClient";

export const metadata: Metadata = {
  title: "Sky Time Machine | Project Zenith",
  description: "Travel through time to see the night sky from any location on Earth — past or future.",
};

export default function SkyPage() {
  return <SkyTimeMachineClient />;
}
