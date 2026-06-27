// app/dashboard/challenge/page.tsx — Server Component wrapper for metadata
import type { Metadata } from "next";
import ChallengeClient from "./ChallengeClient";

export const metadata: Metadata = {
  title: "Coordinate Challenge | Project Zenith",
  description: "Enter any coordinates to generate a full Cosmic Twin analysis for that exact location on Earth.",
};

export default function ChallengePage() {
  return <ChallengeClient />;
}
