// app/globe/page.tsx — Server Component wrapper for metadata
import type { Metadata } from "next";
import { GlobeClient } from "./GlobeClient";

export const metadata: Metadata = {
  title: "Globe Observatory | Project Zenith",
  description: "3D interactive Earth globe with live ISS tracking, satellite radar mode, stargazing presets and constellation overlays.",
};

export default function GlobePage() {
  return <GlobeClient />;
}