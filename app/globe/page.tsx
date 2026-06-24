// app/globe/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type * as CesiumNS from "cesium";

interface GeographicCoordinate {
  latitude: number;
  longitude: number;
  height: number;
}

interface Landmark {
  name: string;
  latitude: number;
  longitude: number;
  range: number;
  pitch: number;
  heading: number;
  description: string;
}

const LANDMARKS: Landmark[] = [
  {
    name: "Mount Everest",
    latitude: 27.9881,
    longitude: 86.9250,
    range: 15000,
    pitch: -20,
    heading: 90,
    description: "Highest peak on Earth, located in the Himalayas."
  },
  {
    name: "Grand Canyon",
    latitude: 36.0544,
    longitude: -112.1401,
    range: 22000,
    pitch: -25,
    heading: 45,
    description: "Stunning steep-sided canyon carved by the Colorado River."
  },
  {
    name: "Mount Fuji",
    latitude: 35.3606,
    longitude: 138.7274,
    range: 16000,
    pitch: -20,
    heading: 180,
    description: "Japan's tallest peak, an iconic active stratovolcano."
  },
  {
    name: "Mount Vesuvius",
    latitude: 40.8224,
    longitude: 14.4289,
    range: 12000,
    pitch: -25,
    heading: -45,
    description: "Infamous volcano looking over the Bay of Naples, Italy."
  }
];

function formatDegrees(value: number, axis: "lat" | "lon"): string {
  const hemisphere =
    axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${Math.abs(value).toFixed(4)}\u00B0 ${hemisphere}`;
}

export default function GlobePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumNS.Viewer | null>(null);
  const cesiumRef = useRef<typeof CesiumNS | null>(null);
  const tickRemoveRef = useRef<CesiumNS.Event.RemoveCallback | null>(null);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GeographicCoordinate | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [rotationSpeed, setRotationSpeed] = useState(0.04); // radians per second (~2.3 deg/sec)
  const [terrainEnabled, setTerrainEnabled] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);

  // Sync ref for callback handlers to prevent stale closure issues
  const selectedRef = useRef<GeographicCoordinate | null>(null);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const autoRotateRef = useRef(autoRotate);
  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  // ── 1. Initialize Cesium Viewer
  useEffect(() => {
    let cancelled = false;

    // Load Cesium from CDN via a script tag — bypasses Turbopack bundling
    // entirely, which avoids silent hangs in production builds on Vercel.
    function loadCesiumFromCDN(): Promise<typeof CesiumNS> {
      return new Promise((resolve, reject) => {
        const win = window as unknown as { Cesium?: typeof CesiumNS };
        if (win.Cesium) { resolve(win.Cesium); return; }

        // Must be set BEFORE the script executes
        (window as unknown as Record<string, unknown>).CESIUM_BASE_URL =
          "https://cdn.jsdelivr.net/npm/cesium@1.142.0/Build/Cesium/";

        const script = document.createElement("script");
        script.src =
          "https://cdn.jsdelivr.net/npm/cesium@1.142.0/Build/Cesium/Cesium.js";
        script.async = true;
        script.onload = () => {
          const w = window as unknown as { Cesium?: typeof CesiumNS };
          if (w.Cesium) resolve(w.Cesium);
          else reject(new Error("Cesium loaded but window.Cesium is undefined"));
        };
        script.onerror = () =>
          reject(new Error("Failed to load Cesium.js from CDN — check network"));
        document.head.appendChild(script);
      });
    }

    async function init() {
      try {
      const Cesium = await loadCesiumFromCDN();
      if (cancelled || !containerRef.current) { setIsLoading(false); return; }

      const token = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
      if (token) {
        Cesium.Ion.defaultAccessToken = token;
      }

      // Prepare terrain provider
      let terrainProvider: CesiumNS.TerrainProvider | undefined;
      if (token) {
        try {
          terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
        } catch (e) {
          console.warn("Failed to load initial World Terrain:", e);
        }
      }

      const viewer = new Cesium.Viewer(containerRef.current, {
        timeline: false,
        animation: false,
        homeButton: false,
        sceneModePicker: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        navigationInstructionsInitiallyVisible: false,
        geocoder: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        terrainProvider: terrainProvider,
        creditContainer: document.getElementById("zenith-cesium-credits") ?? undefined,
      });

      // Ambient environment configuration (dark sky space chrome)
      if (viewer.scene.skyAtmosphere) {
        viewer.scene.skyAtmosphere.hueShift = -0.05;
        viewer.scene.skyAtmosphere.saturationShift = -0.1;
        viewer.scene.skyAtmosphere.brightnessShift = -0.2;
      }
      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.atmosphereLightIntensity = 8.0;
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#03040a");
      viewer.scene.fog.enabled = true;
      viewer.scene.fog.density = 0.0001;
      if (viewer.scene.skyBox) {
        viewer.scene.skyBox.show = true;
      }
      viewer.scene.globe.depthTestAgainstTerrain = true;

      // Set initial orbital camera view
      const homeView = Cesium.Cartesian3.fromDegrees(0, 0, 22_000_000);
      viewer.camera.setView({ destination: homeView });

      // Click handler on Earth
      const handleClick = (movement: { position?: CesiumNS.Cartesian2 }) => {
        if (!movement.position) return;

        // Try picking terrain surface first, fall back to ellipsoid
        const ray = viewer.camera.getPickRay(movement.position);
        let cartesian: CesiumNS.Cartesian3 | undefined;
        if (ray) {
          cartesian = viewer.scene.globe.pick(ray, viewer.scene);
        }
        if (!cartesian) {
          cartesian = viewer.camera.pickEllipsoid(
            movement.position,
            viewer.scene.globe.ellipsoid
          );
        }

        if (!cartesian) return;

        const cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
        if (!cartographic) return;

        const geographic: GeographicCoordinate = {
          latitude: Cesium.Math.toDegrees(cartographic.latitude),
          longitude: Cesium.Math.toDegrees(cartographic.longitude),
          height: cartographic.height,
        };

        // Pause auto-rotation and lock camera focus
        setAutoRotate(false);
        if (interactionTimeoutRef.current) {
          clearTimeout(interactionTimeoutRef.current);
          interactionTimeoutRef.current = null;
        }

        setSelected(geographic);

        // Fly smoothly to target with a majestic 35-degree tilted perspective
        viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(cartesian, 0), {
          offset: new Cesium.HeadingPitchRange(
            Cesium.Math.toRadians(0), // Heading
            Cesium.Math.toRadians(-35), // Pitch (tilt down)
            1200000 // Range (distance in meters)
          ),
          duration: 1.8,
          easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
        });
      };

      // Register Click Handler
      viewer.screenSpaceEventHandler.setInputAction(
        handleClick,
        Cesium.ScreenSpaceEventType.LEFT_CLICK
      );

      // Handle user mouse down & scroll events to pause/resume auto-rotation
      const handleInteractionStart = () => {
        setAutoRotate(false);
        if (interactionTimeoutRef.current) {
          clearTimeout(interactionTimeoutRef.current);
          interactionTimeoutRef.current = null;
        }
      };

      const handleInteractionEnd = () => {
        // Auto-resume rotation only if there's no coordinate selected
        if (!selectedRef.current && !autoRotateRef.current) {
          if (interactionTimeoutRef.current) {
            clearTimeout(interactionTimeoutRef.current);
          }
          interactionTimeoutRef.current = setTimeout(() => {
            setAutoRotate(true);
          }, 8000);
        }
      };

      const screenHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      screenHandler.setInputAction(handleInteractionStart, Cesium.ScreenSpaceEventType.LEFT_DOWN);
      screenHandler.setInputAction(handleInteractionStart, Cesium.ScreenSpaceEventType.MIDDLE_DOWN);
      screenHandler.setInputAction(handleInteractionStart, Cesium.ScreenSpaceEventType.RIGHT_DOWN);
      
      screenHandler.setInputAction(() => {
        handleInteractionStart();
        handleInteractionEnd();
      }, Cesium.ScreenSpaceEventType.WHEEL);

      screenHandler.setInputAction(handleInteractionEnd, Cesium.ScreenSpaceEventType.LEFT_UP);
      screenHandler.setInputAction(handleInteractionEnd, Cesium.ScreenSpaceEventType.MIDDLE_UP);
      screenHandler.setInputAction(handleInteractionEnd, Cesium.ScreenSpaceEventType.RIGHT_UP);

      cesiumRef.current = Cesium;
      viewerRef.current = viewer;
      setIsLoading(false);
      } catch (err) {
        console.error("Cesium init failed:", err);
        setLoadError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
      if (tickRemoveRef.current) {
        tickRemoveRef.current();
      }
      const viewer = viewerRef.current;
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
      }
      viewerRef.current = null;
    };
  }, []);

  // ── 2. Handle Auto-Rotation (Smooth, frame-rate independent)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isLoading) return;

    if (!autoRotate) {
      if (tickRemoveRef.current) {
        tickRemoveRef.current();
        tickRemoveRef.current = null;
      }
      return;
    }

    let lastTime = performance.now();
    const onTick = () => {
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      // Restrict delta jump to avoid spin jumps when tab is unfocused
      const clampedDelta = Math.min(delta, 0.1);
      viewer.scene.camera.rotateRight(rotationSpeed * clampedDelta);
    };

    tickRemoveRef.current = viewer.clock.onTick.addEventListener(onTick);

    return () => {
      if (tickRemoveRef.current) {
        tickRemoveRef.current();
        tickRemoveRef.current = null;
      }
    };
  }, [autoRotate, isLoading, rotationSpeed]);

  // ── 3. Action Handlers (Bookmarks, Terrain, Clipboard, Reset)
  const handleFlyToLandmark = useCallback((landmark: Landmark) => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium) return;

    setAutoRotate(false);
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
      interactionTimeoutRef.current = null;
    }

    const targetCoord: GeographicCoordinate = {
      latitude: landmark.latitude,
      longitude: landmark.longitude,
      height: 0,
    };
    setSelected(targetCoord);

    const targetCartesian = Cesium.Cartesian3.fromDegrees(landmark.longitude, landmark.latitude, 0);
    viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(targetCartesian, 0), {
      offset: new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(landmark.heading),
        Cesium.Math.toRadians(landmark.pitch),
        landmark.range
      ),
      duration: 2.2,
      easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
    });
  }, []);

  const toggleTerrainProvider = useCallback(async (enable: boolean) => {
    setTerrainEnabled(enable);
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium) return;

    if (enable && process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN) {
      try {
        viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
      } catch (e) {
        console.warn("Failed to load World Terrain:", e);
        viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
      }
    } else {
      viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    }
  }, []);

  const handleResetView = useCallback(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium) return;

    setSelected(null);
    setAutoRotate(true);
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(0, 0, 22_000_000),
      duration: 1.6,
      easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
    });
  }, []);

  const copyToClipboard = useCallback(() => {
    if (!selected) return;
    const text = `Lat: ${selected.latitude.toFixed(6)}, Lng: ${selected.longitude.toFixed(6)}, Elev: ${Math.round(selected.height)}m`;
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }, [selected]);

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-[#03040a]">
      {/* 3D Globe Container */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Cesium Attribution (styled & unobtrusive) */}
      <div
        id="zenith-cesium-credits"
        className="pointer-events-none absolute bottom-1 left-3 z-10 max-w-[40vw] truncate text-[8px] text-slate-500/50 font-mono"
      />

      {/* ── Loading Overlay ── */}
      {(isLoading || loadError) && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[#03040a] transition-opacity duration-700">
          {loadError ? (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01" strokeLinecap="round"/></svg>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-red-400">Globe Failed to Load</p>
              <p className="font-mono text-[10px] text-slate-500 max-w-xs">{loadError}</p>
            </div>
          ) : (
            <>
              <div className="relative h-16 w-16">
                <span className="absolute inset-0 animate-spin rounded-full border-2 border-sky-500/10 border-t-sky-400" />
                <span className="absolute inset-2 rounded-full bg-sky-400/5 blur-md" />
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-300">
                  Initializing Earth Render
                </p>
                <p className="font-mono text-[10px] tracking-widest text-slate-500">
                  Project Zenith &middot; Loading 3D Engine
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Floating Header Chrome (pointer-events-none so mouse clicks pass through to globe) ── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between p-6">
        {/* Logo / Telemetry */}
        <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/5 bg-slate-950/40 px-4 py-2 backdrop-blur-md">
          <span className="block h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_12px_2px_rgba(56,167,255,0.7)] animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-slate-200">
            Zenith &middot; Earth Observatory
          </span>
        </div>

        {/* Global Controls */}
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            type="button"
            onClick={handleResetView}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/40 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-slate-300 backdrop-blur-md transition-all hover:border-sky-400/30 hover:bg-slate-950/70 hover:text-sky-300 cursor-pointer"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="stroke-current">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 3v5h5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Reset Globe
          </button>
        </div>
      </div>

      {/* ── Interactive Instructions Overlay ── */}
      {!selected && (
        <div className="pointer-events-none absolute bottom-6 left-6 z-20 hidden md:block animate-pulse">
          <div className="rounded-lg border border-white/5 bg-slate-950/30 px-3.5 py-2 backdrop-blur-sm">
            <p className="font-mono text-[9px] uppercase tracking-widest text-slate-400">
              Click anywhere on Earth to inspect coordinates
            </p>
          </div>
        </div>
      )}

      {/* ── Floating Dashboard Panel (Right Side, Glassmorphic UI) ── */}
      <div className="pointer-events-none absolute bottom-6 right-6 z-20 flex flex-col gap-4 w-[min(92vw,360px)]">
        
        {/* Part A: Coordinate Inspector Card */}
        {selected && (
          <div className="pointer-events-auto animate-[fadeUp_0.4s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/75 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl">
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-sky-400/10 via-transparent to-purple-400/5 pointer-events-none" />

              {/* Title row */}
              <div className="relative flex items-center justify-between gap-3 border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400/60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-sky-400 font-semibold">
                    Telemetry Lock
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Dismiss inspector"
                  className="text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              {/* Coordinate Values Grid */}
              <div className="relative mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
                    Latitude
                  </p>
                  <p className="mt-1 text-base font-semibold font-mono text-slate-100">
                    {formatDegrees(selected.latitude, "lat")}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
                    Longitude
                  </p>
                  <p className="mt-1 text-base font-semibold font-mono text-slate-100">
                    {formatDegrees(selected.longitude, "lon")}
                  </p>
                </div>
              </div>

              {/* Elevation & Copy Actions */}
              <div className="relative mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                <div>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
                    Elevation
                  </span>
                  <p className="font-mono text-sm font-semibold text-slate-300 mt-0.5">
                    {Math.round(selected.height).toLocaleString()} m
                  </p>
                </div>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-300 hover:bg-white/[0.08] hover:text-slate-100 transition-all cursor-pointer"
                >
                  {copySuccess ? (
                    <>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400">
                        <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Copy Telemetry
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Part B: Globe HUD Controls Card */}
        <div className="pointer-events-auto">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-white/5 via-transparent to-white/5 pointer-events-none" />

            {/* Toggle Rotation & Speed controls */}
            <div className="relative flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-400 font-medium">
                  Orbit Auto-Rotation
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRotate}
                    onChange={(e) => setAutoRotate(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
                </label>
              </div>

              {autoRotate && (
                <div className="flex flex-col gap-1.5 animate-[fadeIn_0.2s_ease-out]">
                  <div className="flex items-center justify-between font-mono text-[9px] text-slate-500 uppercase tracking-wider">
                    <span>Rotation Rate</span>
                    <span>{(rotationSpeed * 57.2958).toFixed(1)}&deg;/sec</span>
                  </div>
                  <input
                    type="range"
                    min="0.01"
                    max="0.25"
                    step="0.01"
                    value={rotationSpeed}
                    onChange={(e) => setRotationSpeed(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                </div>
              )}

              {/* 3D World Terrain Toggle */}
              {process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN && (
                <div className="flex items-center justify-between border-t border-white/5 pt-3.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-400 font-medium">
                    3D Elevation Terrain
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={terrainEnabled}
                      onChange={(e) => toggleTerrainProvider(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500"></div>
                  </label>
                </div>
              )}
            </div>

            {/* Landmarks Drawer */}
            <div className="relative mt-4 border-t border-white/5 pt-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-400 font-medium mb-3">
                Landmark Exploration Presets
              </p>
              <div className="grid grid-cols-2 gap-2">
                {LANDMARKS.map((landmark) => (
                  <button
                    key={landmark.name}
                    type="button"
                    onClick={() => handleFlyToLandmark(landmark)}
                    className="flex flex-col items-start text-left rounded-xl border border-white/5 bg-slate-900/40 p-2.5 hover:border-sky-400/20 hover:bg-slate-900/80 transition-all cursor-pointer group"
                  >
                    <span className="font-sans text-[11px] font-semibold text-slate-200 group-hover:text-sky-300 transition-colors">
                      {landmark.name}
                    </span>
                    <span className="font-mono text-[8px] text-slate-500 uppercase tracking-wider mt-0.5">
                      {formatDegrees(landmark.latitude, "lat")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}