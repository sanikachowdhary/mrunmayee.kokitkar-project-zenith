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
  { name: "Mount Everest", lat: 27.9881, lng: 86.925, desc: "Highest mountain" },
  { name: "Svalbard", lat: 78.2232, lng: 15.6267, desc: "Arctic polar region" },
  { name: "Atacama Desert", lat: -23.0645, lng: -68.3725, desc: "Lowest light pollution" },
  { name: "Pacific Ocean", lat: 0, lng: -150, desc: "Open ocean" },
  { name: "Sahara Desert", lat: 25.0, lng: 10.0, desc: "Desert region" },
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

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(preset.lng, preset.lat, 100000),
      duration: 2.2,
      complete: () => {
        viewer.camera.lookAt(
          Cesium.Cartesian3.fromDegrees(preset.lng, preset.lat, 50000),
          new Cesium.HeadingPitchRange(0, -Math.PI / 4, 100000)
        );
      },
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
      <span className="font-mono text-[8px] text-slate-500 uppercase tracking-wider mt-0.5">
        {formatDegrees(preset.lat, "lat")}
      </span>
      <span className="font-mono text-[7px] text-slate-600 mt-0.5">{preset.desc}</span>
    </button>
  );
}
