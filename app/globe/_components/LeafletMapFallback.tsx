"use client";

import { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLocationStore } from "../../../lib/api-client";
import { SpaceEventStream } from "../../components/SpaceEventStream";

interface StargazingPreset {
  name: string;
  lat: number;
  lng: number;
  desc: string;
}

interface LeafletMapFallbackProps {
  presets: StargazingPreset[];
}

// Custom pulsing icons using standard leaflet DivIcon
const createIssIcon = () => {
  if (typeof window === "undefined") return null;
  return L.divIcon({
    html: `
      <div class="relative flex h-8 w-8 items-center justify-center">
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
        <div class="relative flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 border border-sky-400 text-xs shadow-lg">🛰️</div>
      </div>
    `,
    className: "iss-pulsing-icon",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const createUserIcon = () => {
  if (typeof window === "undefined") return null;
  return L.divIcon({
    html: `
      <div class="relative flex h-6 w-6 items-center justify-center">
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60"></span>
        <div class="h-3 w-3 rounded-full bg-red-500 border border-white shadow-md"></div>
      </div>
    `,
    className: "user-pulsing-icon",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Component to handle map view updates when coordinate props change
function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 3, { animate: true });
  }, [lat, lng, map]);
  return null;
}

// Component to handle clicks on the Leaflet Map
function MapEventsHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LeafletMapFallback({ presets }: LeafletMapFallbackProps) {
  const { latitude, longitude, locationName, setLocation } = useLocationStore();
  const [issPos, setIssPos] = useState<{ lat: number; lng: number; altitude: number; velocity: number } | null>(null);
  const [passMessage, setPassMessage] = useState<string>("Calculating ISS passes...");
  const [selectedDetails, setSelectedDetails] = useState<{ lat: number; lng: number; name: string }>({
    lat: latitude,
    lng: longitude,
    name: locationName,
  });

  const fetchISS = useCallback(async () => {
    try {
      const res = await fetch("/api/iss", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setIssPos({
          lat: parseFloat(data.iss_position.latitude),
          lng: parseFloat(data.iss_position.longitude),
          altitude: data.altitude ?? 418.5,
          velocity: data.velocity ?? 27580,
        });
      }
    } catch (e) {
      console.error("Failed to fetch ISS inside fallback:", e);
    }
  }, []);

  const fetchPasses = useCallback(async (lat: number, lng: number) => {
    try {
      setPassMessage("Querying SGP4 visibility models...");
      const res = await fetch(`/api/iss-passes?lat=${lat}&lon=${lng}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setPassMessage(data.prediction || "No passes predicted for this region.");
      } else {
        setPassMessage("SGP4 model query failed.");
      }
    } catch {
      setPassMessage("Error predicting ISS passes.");
    }
  }, []);

  // Poll ISS position every 5 seconds
  useEffect(() => {
    fetchISS();
    const interval = setInterval(fetchISS, 5000);
    return () => clearInterval(interval);
  }, [fetchISS]);

  // Recalculate passes when selected location updates
  useEffect(() => {
    fetchPasses(selectedDetails.lat, selectedDetails.lng);
  }, [selectedDetails.lat, selectedDetails.lng, fetchPasses]);

  // Handle map click
  const handleMapClick = (clickLat: number, clickLng: number) => {
    const name = `${clickLat.toFixed(4)}°, ${clickLng.toFixed(4)}`;
    setSelectedDetails({ lat: clickLat, lng: clickLng, name });
    setLocation(clickLat, clickLng, name);
  };

  // Handle preset click
  const handlePresetSelect = (preset: StargazingPreset) => {
    setSelectedDetails({ lat: preset.lat, lng: preset.lng, name: preset.name });
    setLocation(preset.lat, preset.lng, preset.name);
  };

  const issIconObj = createIssIcon();
  const userIconObj = createUserIcon();

  return (
    <div className="relative h-full w-full bg-[#03040a] flex flex-col lg:flex-row overflow-hidden">
      {/* 2D Leaflet Map */}
      <div className="flex-1 relative h-[50dvh] lg:h-full z-10">
        <MapContainer
          center={[selectedDetails.lat, selectedDetails.lng]}
          zoom={3}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          {/* Dark Mode CartoDB tiles to match overall aesthetic */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          
          <MapRecenter lat={selectedDetails.lat} lng={selectedDetails.lng} />
          <MapEventsHandler onMapClick={handleMapClick} />

          {/* User Location Marker */}
          {userIconObj && (
            <Marker position={[selectedDetails.lat, selectedDetails.lng]} icon={userIconObj}>
              <Popup>
                <div className="font-mono text-xs">
                  <p className="font-bold text-slate-800">Selected Site</p>
                  <p className="text-slate-600">{selectedDetails.name}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* ISS Marker */}
          {issPos && issIconObj && (
            <Marker position={[issPos.lat, issPos.lng]} icon={issIconObj}>
              <Popup>
                <div className="font-mono text-xs text-slate-800">
                  <p className="font-bold">International Space Station</p>
                  <p>Altitude: {issPos.altitude.toFixed(1)} km</p>
                  <p>Velocity: {issPos.velocity.toLocaleString(undefined, { maximumFractionDigits: 0 })} km/h</p>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Custom Map Zoom Controls styling */}
        <div className="absolute top-24 left-6 z-[400] flex flex-col gap-1.5 pointer-events-auto">
          <div className="px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded text-amber-400 font-mono text-[9px] uppercase tracking-wider select-none animate-pulse">
            Cesium Fallback Mode (2D Map)
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-white/5 bg-slate-950/70 p-6 flex flex-col gap-4 overflow-y-auto z-20 shrink-0 h-[50dvh] lg:h-full backdrop-blur-xl">
        <div>
          <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-slate-400 block mb-1">Observation Site</span>
          <h2 className="font-sans text-xl font-black text-slate-100">{selectedDetails.name}</h2>
          <p className="font-mono text-[10px] text-slate-500 mt-1">
            {selectedDetails.lat.toFixed(4)}° {selectedDetails.lat >= 0 ? "N" : "S"} &middot; {selectedDetails.lng.toFixed(4)}° {selectedDetails.lng >= 0 ? "E" : "W"}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
          <h3 className="font-mono text-[9px] uppercase tracking-wider text-sky-400 mb-2 font-bold">🛰️ Live ISS Pass Predictions</h3>
          <p className="font-sans text-xs text-slate-200 leading-relaxed">{passMessage}</p>
        </div>

        {/* Live Space Event Stream */}
        <SpaceEventStream />

        {/* Landmarks presets */}
        <div>
          <h3 className="font-mono text-[9px] uppercase tracking-[0.25em] text-slate-400 mb-3">Preset Landmarks</h3>
          <div className="flex flex-col gap-2">
            {presets.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => handlePresetSelect(p)}
                className="w-full flex items-center justify-between text-left rounded-xl border border-white/5 bg-slate-900/30 p-3 hover:border-sky-500/20 hover:bg-slate-900/60 transition-all cursor-pointer group font-mono text-[10px]"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-sans text-slate-200 font-bold group-hover:text-sky-300 transition-colors">{p.name}</span>
                  <span className="text-slate-600 text-[8px]">{p.desc}</span>
                </div>
                <span className="text-slate-500 text-[8px]">{p.lat.toFixed(1)}°N, {p.lng.toFixed(1)}°E</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
