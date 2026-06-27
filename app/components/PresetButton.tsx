"use client";

import { useCallback } from "react";
import type * as CesiumNS from "cesium";
import { useLocationStore } from "../lib/api-client";

export interface StargazingPreset {
  name: string;
  lat: number;
  lng: number;
  desc: string;
}

export const STARGAZING_PRESETS: StargazingPreset[] = [
  { name: "Mount Everest", lat: 27.9881, lng: 86.9250, desc: "Thin atmosphere high observatory" },
  { name: "Atacama Desert", lat: -22.9068, lng: -67.9290, desc: "Premier observation site on Earth" },
  { name: "Svalbard", lat: 78.2232, lng: 15.6267, desc: "Arctic circle auroral window" },
  { name: "Sahara Desert", lat: 23.4162, lng: 25.6628, desc: "Cloudless thermal desert region" },
  { name: "Pacific Ocean", lat: -0.0000, lng: -170.0000, desc: "Remote maritime void stargazing" },
];

interface PresetButtonProps {
  preset: StargazingPreset;
  viewerRef: React.RefObject<CesiumNS.Viewer | null>;
  cesiumRef: React.RefObject<typeof CesiumNS | null>;
  onSelect?: (lat: number, lng: number, name: string) => void;
}

function formatDegrees(value: number, axis: "lat" | "lon"): string {
  const hemisphere = axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${Math.abs(value).toFixed(4)}° ${hemisphere}`;
}

export function PresetButton({ preset, viewerRef, cesiumRef, onSelect }: PresetButtonProps) {
  const setLocation = useLocationStore((s) => s.setLocation);

  const handleClick = useCallback(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium) return;

    setLocation(preset.lat, preset.lng, preset.name);
    onSelect?.(preset.lat, preset.lng, preset.name);

    // Reset camera tracking constraints
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

    // Fly to 12 km altitude and tilt 35 degrees UP to view the sky
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(preset.lng, preset.lat, 12000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(35),
        roll: 0.0
      },
      duration: 2.2,
    });
  }, [preset, viewerRef, cesiumRef, setLocation, onSelect]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex flex-col items-start text-left rounded-xl border border-white/5 bg-slate-900/40 p-2.5 hover:border-sky-400/20 hover:bg-slate-900/80 transition-all cursor-pointer group min-h-[44px]"
    >
      <span className="font-sans text-[11px] font-semibold text-slate-200 group-hover:text-sky-300 transition-colors">
        {preset.name}
      </span>
      <span className="font-mono text-[8px] text-slate-400 uppercase tracking-wider mt-0.5">
        {formatDegrees(preset.lat, "lat")}, {formatDegrees(preset.lng, "lon")}
      </span>
      <span className="font-mono text-[7px] text-slate-500 mt-0.5 leading-normal">{preset.desc}</span>
    </button>
  );
}
