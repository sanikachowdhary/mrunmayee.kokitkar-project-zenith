// app/globe/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type * as CesiumNS from "cesium";
import { setupISSOrbit, setupConstellations, setupRadarSatellites, type SatelliteData } from "./_components/SpaceVisualizer";

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

  // Core loading states
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GeographicCoordinate | null>(null);
  const [selectedSatellite, setSelectedSatellite] = useState<SatelliteData | null>(null);
  
  // Controls state
  const [autoRotate, setAutoRotate] = useState(true);
  const [rotationSpeed, setRotationSpeed] = useState(0.04);
  const [terrainEnabled, setTerrainEnabled] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showISS, setShowISS] = useState(true);
  const [showConstellations, setShowConstellations] = useState(false);

  // New features state
  const [isNightMode, setIsNightMode] = useState(true);
  const [showRadar, setShowRadar] = useState(false);
  const [timelineOffset, setTimelineOffset] = useState(0); // In hours (-24 to +24)
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ sender: "user" | "ai"; text: string }[]>([
    { sender: "ai", text: "Welcome Observer. Lock onto a coordinate or click Stargazing targets to begin telemetry report." }
  ]);
  const [eventFeed, setEventFeed] = useState<{ id: string; time: string; text: string; category: string }[]>([
    { id: "1", time: "21:38:02 UTC", text: "ISS telemetry lock established at 418km altitude.", category: "iss" },
    { id: "2", time: "21:40:15 UTC", text: "Solar wind velocity: 418 km/s, direction vector: radial.", category: "weather" },
    { id: "3", time: "21:42:30 UTC", text: "Starlink-2215 diagnostic ping payload completed.", category: "satellite" },
  ]);

  // Gamification: Mission Mode state
  const [isMissionMode, setIsMissionMode] = useState(false);
  const [missionTasks, setMissionTasks] = useState([
    { id: "iss", label: "Inspect coordinates near ISS orbital path", done: false, desc: "Click close to the glowing cyan ISS orbit line." },
    { id: "night", label: "Observe Stargazing conditions at Night", done: false, desc: "Turn on Night Mode and drag timeline offset to night time." },
    { id: "radar", label: "Launch Satellite Radar mode", done: false, desc: "Enable Radar Mode to visualize active satellites." },
    { id: "everest", label: "Fly to Mount Everest landmark preset", done: false, desc: "Use the landmark presets to inspect Everest's elevation." },
  ]);

  const issDataSourceRef = useRef<CesiumNS.CustomDataSource | null>(null);
  const constellationsDataSourceRef = useRef<CesiumNS.CustomDataSource | null>(null);
  const radarDataSourceRef = useRef<CesiumNS.CustomDataSource | null>(null);

  // Sync ref for callback handlers to prevent stale closure issues
  const selectedRef = useRef<GeographicCoordinate | null>(null);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const autoRotateRef = useRef(autoRotate);
  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  const isMissionModeRef = useRef(isMissionMode);
  useEffect(() => {
    isMissionModeRef.current = isMissionMode;
  }, [isMissionMode]);

  // Compute "Why This Location" details
  const selectedDetails = useMemo(() => {
    if (!selected) return null;
    
    const lat = selected.latitude;
    const lng = selected.longitude;
    const height = selected.height;
    
    // Proximity to landmarks or spaceports
    let spaceRelevance = "Remote geographical region, primary satellite communication link node.";
    if (Math.abs(lat - 27.9881) < 1.5 && Math.abs(lng - 86.9250) < 1.5) {
      spaceRelevance = "Mount Everest: Thin atmosphere, minimal atmospheric refraction, premier high-altitude observatory preset.";
    } else if (Math.abs(lat - 36.0544) < 1.5 && Math.abs(lng - -112.1401) < 1.5) {
      spaceRelevance = "Grand Canyon: Low light pollution corridor, protected stargazing zone.";
    } else if (Math.abs(lat - 28.5728) < 2.0 && Math.abs(lng - -80.649) < 2.0) {
      spaceRelevance = "Kennedy Space Center spaceport corridor.";
    } else if (Math.abs(lat - 5.23) < 2.0 && Math.abs(lng - -52.76) < 2.0) {
      spaceRelevance = "Kourou Guiana Space Centre equatorial launch site.";
    } else if (Math.abs(lat) < 5.0) {
      spaceRelevance = "Equatorial belt: Maximum Earth rotational boost for orbital launches.";
    } else if (Math.abs(lat) > 70) {
      spaceRelevance = "Polar region: Aurora visibility corridor, ideal for polar-orbiting satellites downlink.";
    } else if (height < -20) {
      spaceRelevance = "Deep ocean floor: Ideal for spacecraft splashdowns and atmospheric re-entry burial zones (Point Nemo region).";
    }

    // Light pollution rating (Bortle Scale 1-9)
    let lightPollutionScore = 1;
    const isLand = Math.sin(lat * 0.1) * Math.cos(lng * 0.1) > -0.25;
    if (isLand) {
      if (lat > 20 && lat < 55) {
        lightPollutionScore = Math.floor((Math.abs(Math.sin(lat * lng)) * 4) + 5); // Bortle 5-9
      } else {
        lightPollutionScore = Math.floor((Math.abs(Math.sin(lat * lng)) * 3) + 3); // Bortle 3-6
      }
    } else {
      lightPollutionScore = 1; // Bortle 1 (Oceans, Wilderness)
    }

    // Night sky quality
    let stargazingQuality: "Good" | "Moderate" | "Poor" = "Good";
    if (lightPollutionScore >= 7) stargazingQuality = "Poor";
    else if (lightPollutionScore >= 4) stargazingQuality = "Moderate";

    // ISS Visibility Prediction
    const isWithinISSInclination = Math.abs(lat) <= 60;
    const passMinutes = Math.abs(Math.floor(Math.sin((lat + lng + timelineOffset) * 0.5) * 45)) + 5;
    const issVisible = isWithinISSInclination && (passMinutes < 25);
    const issPrediction = issVisible 
      ? `YES - Pass predicted in ~${passMinutes} minutes at ${Math.floor(Math.sin(lat) * 20) + 35}° elevation.`
      : "NO - No optimal passes predicted in the next 90 minutes.";

    // Satellite Density Overhead
    let satDensity: "Low" | "Medium" | "High" = "Medium";
    if (Math.abs(lat) > 75 || Math.abs(lat) < 15) satDensity = "High";
    else if (Math.abs(lng) % 30 < 6) satDensity = "Low";

    // Cosmic Explanation text
    const explanation = `This region has a Bortle ${lightPollutionScore} light pollution level, providing a ${stargazingQuality.toLowerCase()} stargazing window. Proximity to orbital paths suggests ${satDensity.toLowerCase()} satellite traffic overhead. Proximity to spacecraft corridor: ${spaceRelevance.split(":")[0]}.`;

    return {
      spaceRelevance,
      stargazingQuality,
      lightPollutionScore,
      issPrediction,
      satDensity,
      explanation
    };
  }, [selected, timelineOffset]);

  // Mission Progress Percentage
  const missionProgress = useMemo(() => {
    const completed = missionTasks.filter(t => t.done).length;
    return Math.round((completed / missionTasks.length) * 100);
  }, [missionTasks]);

  // Bloomberg space news event generator
  useEffect(() => {
    const categories = ["iss", "weather", "satellite", "astronomy"];
    const events = [
      { text: "Solar wind speed surges to 480 km/s. Geomagnetic storm warning active.", category: "weather" },
      { text: "ISS successfully completed orbit transit over East Africa.", category: "iss" },
      { text: "GPS navigation satellite constellation updates atomic clock timing parameters.", category: "satellite" },
      { text: "NASA deep space downlink confirms Hubble space telescope orientation is nominal.", category: "astronomy" },
      { text: "Active sunspot region AR3243 triggers minor M-class solar flare.", category: "weather" },
      { text: "Tiangong Space Station crew completes orbital maintenance sequence.", category: "iss" },
      { text: "James Webb Space Telescope initiates deep field imaging calibration sequence.", category: "astronomy" },
      { text: "Starlink broadband payload deploys successfully into low earth orbit.", category: "satellite" },
    ];

    const interval = setInterval(() => {
      const randomEvent = events[Math.floor(Math.random() * events.length)];
      const utcTime = new Date().toLocaleTimeString("en-US", { hour12: false, timeZone: "UTC" }) + " UTC";
      const newEntry = {
        id: Math.random().toString(),
        time: utcTime,
        text: randomEvent.text,
        category: randomEvent.category
      };
      setEventFeed(prev => [newEntry, ...prev.slice(0, 10)]);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // AI Chat Assistant message response handler
  const handleSendChatMessage = (text: string) => {
    if (!text.trim()) return;
    
    const userMsg = { sender: "user" as const, text };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");

    setTimeout(() => {
      let aiText = "Analyzing telemetry context for your query. Select a location on the globe to feed geographic intelligence data.";
      const query = text.toLowerCase();
      
      if (selectedRef.current) {
        const latStr = selectedRef.current.latitude.toFixed(4);
        const lngStr = selectedRef.current.longitude.toFixed(4);
        const details = selectedDetails;
        
        if (query.includes("iss") || query.includes("space station")) {
          aiText = `From coordinates ${latStr}°, ${lngStr}°, the ISS is ${details?.issPrediction.includes("YES") ? "projected to be visible soon" : "not directly visible at this time"}. Details: ${details?.issPrediction}`;
        } else if (query.includes("planet") || query.includes("visible")) {
          aiText = `Tonight at coordinates ${latStr}°, ${lngStr}°, the atmospheric clarity is rated ${details?.stargazingQuality}. Jupiter is visible near zenith post-sunset; Venus is visible low on the western horizon.`;
        } else if (query.includes("stargazing") || query.includes("good") || query.includes("pollution")) {
          aiText = `Stargazing quality is rated ${details?.stargazingQuality} (Bortle ${details?.lightPollutionScore}/9). ${details?.spaceRelevance}`;
        } else if (query.includes("satellite") || query.includes("overhead")) {
          aiText = `Overhead satellite density at ${latStr}°, ${lngStr}° is ${details?.satDensity}. Enable Satellite Radar Mode to view communication and weather satellites orbiting this coordinate region.`;
        } else {
          aiText = `Analyzing locked coordinates ${latStr}°, ${lngStr}°: sky visibility index is ${details?.stargazingQuality}. Elevation: ${Math.round(selectedRef.current.height)}m. Summary: ${details?.explanation}`;
        }
      } else {
        if (query.includes("iss") || query.includes("space station")) {
          aiText = "The ISS orbits at 418km altitude. Click anywhere on the globe to calculate local visibility passes.";
        } else if (query.includes("planet") || query.includes("visible")) {
          aiText = "Visible celestial bodies depend on your lat/lng coordinates. Pick a landmark or click the globe to inspect.";
        } else if (query.includes("stargazing") || query.includes("good")) {
          aiText = "Oceans, high peaks (like Everest), and remote canyons offer the best stargazing (Bortle 1-2). Select a preset landmark to check.";
        } else {
          aiText = "Hello! I am your Cosmic AI Assistant. Lock onto a coordinate or select a landmark preset, and I will analyze custom sky conditions.";
        }
      }

      setChatMessages(prev => [...prev, { sender: "ai" as const, text: aiText }]);
    }, 600); // 600ms response time
  };

  // ── 1. Initialize Cesium Viewer
  useEffect(() => {
    let cancelled = false;

    function loadCesiumFromCDN(): Promise<typeof CesiumNS> {
      return new Promise((resolve, reject) => {
        const win = window as unknown as { Cesium?: typeof CesiumNS };
        if (win.Cesium) { resolve(win.Cesium); return; }

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

      if (viewer.scene.skyAtmosphere) {
        viewer.scene.skyAtmosphere.hueShift = -0.05;
        viewer.scene.skyAtmosphere.saturationShift = -0.1;
        viewer.scene.skyAtmosphere.brightnessShift = -0.2;
      }
      viewer.scene.globe.enableLighting = isNightMode;
      viewer.scene.globe.atmosphereLightIntensity = isNightMode ? 8.0 : 20.0;
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#03040a");
      viewer.scene.fog.enabled = true;
      viewer.scene.fog.density = 0.0001;
      if (viewer.scene.skyBox) {
        viewer.scene.skyBox.show = true;
      }
      viewer.scene.globe.depthTestAgainstTerrain = true;

      const homeView = Cesium.Cartesian3.fromDegrees(0, 0, 22_000_000);
      viewer.camera.setView({ destination: homeView });

      // Click handler on Earth (Interprets terrain coordinates vs clicked satellites)
      const handleClick = (movement: { position?: CesiumNS.Cartesian2 }) => {
        if (!movement.position) return;

        // Try picking satellite first
        const pickedObject = viewer.scene.pick(movement.position);
        if (Cesium.defined(pickedObject) && pickedObject.id) {
          const entity = pickedObject.id as CesiumNS.Entity;
          const customData = (entity as any).customData as SatelliteData | undefined;
          if (customData) {
            setSelectedSatellite(customData);
            setSelected(null); // Clear selected terrain card
            return;
          }
        }

        // Otherwise pick terrain coordinate
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

        setAutoRotate(false);
        if (interactionTimeoutRef.current) {
          clearTimeout(interactionTimeoutRef.current);
          interactionTimeoutRef.current = null;
        }

        setSelected(geographic);
        setSelectedSatellite(null); // Clear active satellite card

        // Complete mission task: Find ISS region lock
        if (isMissionModeRef.current) {
          setMissionTasks(prev => prev.map(t => t.id === "iss" ? { ...t, done: true } : t));
        }

        viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(cartesian, 0), {
          offset: new Cesium.HeadingPitchRange(
            Cesium.Math.toRadians(0),
            Cesium.Math.toRadians(-35),
            1200000
          ),
          duration: 1.8,
          easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
        });
      };

      viewer.screenSpaceEventHandler.setInputAction(
        handleClick,
        Cesium.ScreenSpaceEventType.LEFT_CLICK
      );

      const handleInteractionStart = () => {
        setAutoRotate(false);
        if (interactionTimeoutRef.current) {
          clearTimeout(interactionTimeoutRef.current);
          interactionTimeoutRef.current = null;
        }
      };

      const handleInteractionEnd = () => {
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

      issDataSourceRef.current = setupISSOrbit(viewer, Cesium);
      issDataSourceRef.current.show = showISS;

      constellationsDataSourceRef.current = setupConstellations(viewer, Cesium);
      constellationsDataSourceRef.current.show = showConstellations;

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
        if (issDataSourceRef.current) viewer.dataSources.remove(issDataSourceRef.current, true);
        if (constellationsDataSourceRef.current) viewer.dataSources.remove(constellationsDataSourceRef.current, true);
        if (radarDataSourceRef.current) viewer.dataSources.remove(radarDataSourceRef.current, true);
        viewer.destroy();
      }
      viewerRef.current = null;
    };
  }, []);

  // ── Sync Visualizer Visibility ──
  useEffect(() => {
    if (issDataSourceRef.current) {
      issDataSourceRef.current.show = showISS;
    }
  }, [showISS]);

  useEffect(() => {
    if (constellationsDataSourceRef.current) {
      constellationsDataSourceRef.current.show = showConstellations;
    }
  }, [showConstellations]);

  // ── Sync Satellite Radar Mode ──
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium) return;

    if (showRadar) {
      if (!radarDataSourceRef.current) {
        radarDataSourceRef.current = setupRadarSatellites(viewer, Cesium);
      }
      radarDataSourceRef.current.show = true;
      if (isMissionMode) {
        setMissionTasks(prev => prev.map(t => t.id === "radar" ? { ...t, done: true } : t));
      }
    } else {
      if (radarDataSourceRef.current) {
        radarDataSourceRef.current.show = false;
      }
    }
  }, [showRadar, isMissionMode]);

  // ── Sync Day/Night Lighting Mode ──
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    viewer.scene.globe.enableLighting = isNightMode;
    viewer.scene.globe.atmosphereLightIntensity = isNightMode ? 8.0 : 22.0;

    if (isNightMode && isMissionMode) {
      const Cesium = cesiumRef.current;
      if (Cesium) {
        const time = viewer.clock.currentTime;
        const date = Cesium.JulianDate.toDate(time);
        const hour = date.getUTCHours();
        if (hour >= 20 || hour <= 4) {
          setMissionTasks(prev => prev.map(t => t.id === "night" ? { ...t, done: true } : t));
        }
      }
    }
  }, [isNightMode, isMissionMode]);

  // ── Sync Timeline Scrubber Clock Time ──
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium) return;

    // Use current base date
    const baseTime = Cesium.JulianDate.fromDate(new Date("2026-06-24T12:00:00Z"));
    const newTime = Cesium.JulianDate.addHours(baseTime, timelineOffset, new Cesium.JulianDate());
    viewer.clock.currentTime = newTime;

    // Complete mission task: Observe stargazing window at night
    if (isMissionMode && isNightMode) {
      const date = Cesium.JulianDate.toDate(newTime);
      const hour = date.getUTCHours();
      if (hour >= 20 || hour <= 4) {
        setMissionTasks(prev => prev.map(t => t.id === "night" ? { ...t, done: true } : t));
      }
    }
  }, [timelineOffset, isNightMode, isMissionMode]);

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
    setSelectedSatellite(null);

    // Complete mission task: Fly to Everest preset
    if (isMissionModeRef.current && landmark.name === "Mount Everest") {
      setMissionTasks(prev => prev.map(t => t.id === "everest" ? { ...t, done: true } : t));
    }

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
    setSelectedSatellite(null);
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

      {/* ── Floating Header Chrome ── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between p-6">
        {/* Logo / Telemetry */}
        <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/5 bg-slate-950/40 px-4 py-2 backdrop-blur-md">
          <span className="block h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_12px_2px_rgba(56,167,255,0.7)] animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-slate-200">
            Zenith &middot; Earth Observatory
          </span>
        </div>

        {/* Global Controls & Mode Toggles */}
        <div className="pointer-events-auto flex items-center gap-3">
          {/* Day/Night Toggle */}
          <button
            type="button"
            onClick={() => setIsNightMode(!isNightMode)}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/40 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-slate-300 backdrop-blur-md transition-all hover:border-sky-400/30 hover:bg-slate-950/70 hover:text-sky-300 cursor-pointer"
          >
            {isNightMode ? "🌙 Night Mode" : "🌞 Day Mode"}
          </button>

          {/* Mission Mode Activation */}
          <button
            type="button"
            onClick={() => setIsMissionMode(!isMissionMode)}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-[10px] uppercase tracking-widest backdrop-blur-md transition-all cursor-pointer ${
              isMissionMode 
                ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]" 
                : "border-white/10 bg-slate-950/40 text-slate-300 hover:border-emerald-400/30 hover:text-emerald-300"
            }`}
          >
            🛰 Mission Mode
          </button>

          {/* Reset View */}
          <button
            type="button"
            onClick={handleResetView}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/40 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-slate-300 backdrop-blur-md transition-all hover:border-sky-400/30 hover:bg-slate-950/70 hover:text-sky-300 cursor-pointer"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="stroke-current">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 3v5h5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Reset
          </button>
        </div>
      </div>

      {/* ── Left Side: Mission Checklist Panel ── */}
      {isMissionMode && (
        <div className="absolute top-24 left-6 z-20 w-80 pointer-events-auto animate-[fadeIn_0.3s_ease-out]">
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-slate-950/85 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.7)] backdrop-blur-xl">
            <div className="absolute top-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500" style={{ width: `${missionProgress}%` }} />
            
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-emerald-400">Space Observer Control</p>
                <h3 className="text-sm font-semibold text-slate-100 mt-0.5">Active Mission Log</h3>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-400">{missionProgress}%</span>
            </div>

            <div className="mt-4 flex flex-col gap-3.5">
              {missionTasks.map(t => (
                <div key={t.id} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-white/10 bg-white/[0.02]">
                    {t.done && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3">
                        <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className={`text-[11px] font-medium leading-tight transition-colors ${t.done ? "text-slate-400 line-through" : "text-slate-200"}`}>
                      {t.label}
                    </p>
                    <p className="text-[9px] text-slate-500 mt-0.5 leading-normal">{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {missionProgress === 100 && (
              <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center animate-pulse">
                <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-400 font-bold">✓ Mission Complete</p>
                <p className="text-[9px] text-slate-300 mt-1">Excellent telemetry scan. Stargazing report finalized.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Right Side: Bloomberg Space News Feed Sidebar ── */}
      <div className="absolute top-24 right-6 z-20 w-80 pointer-events-auto h-[55vh] flex flex-col">
        <div className="flex-1 relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl flex flex-col">
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-white/5 via-transparent to-white/5 pointer-events-none" />
          
          {/* Header */}
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-200 font-bold">Space Event Stream</span>
            </div>
            <span className="font-mono text-[8px] uppercase tracking-wider text-slate-400">Bloomberg Mode</span>
          </div>

          {/* Scrolling Feed Container */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 font-mono text-[10px] leading-relaxed">
            {eventFeed.map((e) => (
              <div key={e.id} className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-500 text-[8px]">{e.time}</span>
                  <span className={`px-1.5 py-0.5 rounded-[4px] text-[7px] uppercase tracking-wider ${
                    e.category === "iss" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-400/20" :
                    e.category === "weather" ? "bg-amber-500/10 text-amber-400 border border-amber-400/20" :
                    e.category === "satellite" ? "bg-purple-500/10 text-purple-400 border border-purple-400/20" :
                    "bg-sky-500/10 text-sky-400 border border-sky-400/20"
                  }`}>
                    {e.category}
                  </span>
                </div>
                <p className="text-slate-300">{e.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Interactive Instructions Overlay ── */}
      {!selected && !selectedSatellite && (
        <div className="pointer-events-none absolute bottom-32 left-6 z-20 hidden md:block animate-pulse">
          <div className="rounded-lg border border-white/5 bg-slate-950/30 px-3.5 py-2 backdrop-blur-sm">
            <p className="font-mono text-[9px] uppercase tracking-widest text-slate-400">
              Click anywhere on Earth to generate localized space intelligence
            </p>
          </div>
        </div>
      )}

      {/* ── Left Side Bottom: why this location? explainer panel ── */}
      {selected && selectedDetails && (
        <div className="absolute bottom-32 left-6 z-20 w-[380px] pointer-events-auto animate-[fadeUp_0.4s_cubic-bezier(0.16,1,0.3,1)]">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/85 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-sky-400/15 via-transparent to-purple-400/5 pointer-events-none" />

            {/* Header */}
            <div className="relative flex items-center justify-between gap-3 border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400/60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-sky-400 font-bold">
                  Geographic Stargazing Report
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Geographic coordinate printout */}
            <div className="mt-4 grid grid-cols-3 gap-2 border-b border-white/5 pb-3 font-mono text-[10px]">
              <div>
                <span className="text-slate-500 uppercase tracking-wider">Latitude</span>
                <p className="text-slate-200 font-semibold mt-0.5">{formatDegrees(selected.latitude, "lat")}</p>
              </div>
              <div>
                <span className="text-slate-500 uppercase tracking-wider">Longitude</span>
                <p className="text-slate-200 font-semibold mt-0.5">{formatDegrees(selected.longitude, "lon")}</p>
              </div>
              <div>
                <span className="text-slate-500 uppercase tracking-wider">Elevation</span>
                <p className="text-slate-200 font-semibold mt-0.5">{Math.round(selected.height).toLocaleString()}m</p>
              </div>
            </div>

            {/* Dynamic Telemetry list */}
            <div className="mt-4 flex flex-col gap-3 font-mono text-[10px]">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 uppercase tracking-wider">Sky Visibility Quality</span>
                <span className={`px-2 py-0.5 rounded-[4px] text-[9px] font-bold ${
                  selectedDetails.stargazingQuality === "Good" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                  selectedDetails.stargazingQuality === "Moderate" ? "bg-amber-500/10 text-amber-400 border border-amber-400/20" :
                  "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}>
                  {selectedDetails.stargazingQuality}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 uppercase tracking-wider">Light Pollution index</span>
                <span className="text-slate-200 font-semibold">Bortle {selectedDetails.lightPollutionScore}/9</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 uppercase tracking-wider">Satellite Density</span>
                <span className="text-slate-200 font-semibold">{selectedDetails.satDensity} Overhead</span>
              </div>

              <div className="flex justify-between items-start gap-4">
                <span className="text-slate-500 uppercase tracking-wider shrink-0">ISS Pass Prediction</span>
                <span className="text-slate-200 text-right font-medium">{selectedDetails.issPrediction}</span>
              </div>

              <div className="mt-2 p-3 rounded-xl border border-sky-500/10 bg-sky-500/5 leading-relaxed text-slate-300">
                <p className="font-semibold text-sky-400 mb-0.5">Cosmic Interpretation:</p>
                {selectedDetails.explanation}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={copyToClipboard}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] py-2 font-mono text-[9px] uppercase tracking-wider text-slate-300 hover:bg-white/[0.08] hover:text-slate-100 transition-all cursor-pointer"
              >
                {copySuccess ? "Copied Telemetry!" : "Copy Telemetry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Left Side Bottom: clicked satellite info card ── */}
      {selectedSatellite && (
        <div className="absolute bottom-32 left-6 z-20 w-80 pointer-events-auto animate-[fadeUp_0.4s_cubic-bezier(0.16,1,0.3,1)]">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/85 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-purple-400/15 via-transparent to-sky-400/5 pointer-events-none" />

            <div className="relative flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-purple-400 font-bold">
                  Satellite Telemetry
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSatellite(null)}
                className="text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3 font-mono text-[10px]">
              <div className="flex justify-between">
                <span className="text-slate-500 uppercase">Satellite Identifier</span>
                <span className="text-slate-200 font-bold">{selectedSatellite.name}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500 uppercase">Orbit Status</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-400/20 font-bold text-[8px]">
                  {selectedSatellite.status}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500 uppercase">Operational Category</span>
                <span className="text-slate-300">{selectedSatellite.type}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500 uppercase">Inclination angle</span>
                <span className="text-slate-300">{selectedSatellite.inclination.toFixed(1)}&deg;</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500 uppercase">Mean Altitude</span>
                <span className="text-slate-300">{(selectedSatellite.altitude / 1000).toFixed(0)} km</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500 uppercase">Orbital Period</span>
                <span className="text-slate-300">{(selectedSatellite.period / 60).toFixed(1)} mins</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Right Side Bottom: Floating Dashboard & Scrubber Controls Card ── */}
      <div className="pointer-events-none absolute bottom-32 right-6 z-20 flex flex-col gap-4 w-[min(92vw,360px)]">
        {/* Globe HUD Controls Card */}
        <div className="pointer-events-auto">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-white/5 via-transparent to-white/5 pointer-events-none" />

            <div className="relative flex flex-col gap-4">
              {/* Timeline Scrubber Header */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center font-mono text-[9px] text-slate-500 uppercase tracking-widest">
                  <span>Simulation Timeline</span>
                  <span className="text-slate-300 font-bold">{timelineOffset === 0 ? "Realtime" : `${timelineOffset > 0 ? "+" : ""}${timelineOffset} Hours`}</span>
                </div>
                <input
                  type="range"
                  min="-24"
                  max="24"
                  step="1"
                  value={timelineOffset}
                  onChange={(e) => setTimelineOffset(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>

              {/* Satellite Radar Mode Toggle */}
              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-400 font-medium">
                  Satellite Radar mode
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRadar}
                    onChange={(e) => {
                      setShowRadar(e.target.checked);
                      setSelectedSatellite(null);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500"></div>
                </label>
              </div>

              {/* Auto Rotation */}
              <div className="flex items-center justify-between border-t border-white/5 pt-3">
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

              {/* Orbital Tracking Toggle */}
              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-400 font-medium">
                  Orbital Tracking (ISS)
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showISS}
                    onChange={(e) => setShowISS(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>
            </div>

            {/* Landmarks Drawer */}
            <div className="relative mt-4 border-t border-white/5 pt-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-400 font-medium mb-3">
                Stargazing Presets
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

      {/* ── Bottom Right: Cosmic AI Assistant Floating bubble & panel ── */}
      <div className="absolute bottom-6 right-6 z-30 pointer-events-auto flex flex-col items-end gap-3 w-80">
        {chatOpen && (
          <div className="relative overflow-hidden rounded-2xl border border-sky-500/20 bg-slate-950/90 shadow-[0_12px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl flex flex-col h-96 w-full animate-[fadeUp_0.25s_ease-out]">
            <div className="p-3.5 border-b border-white/5 flex items-center justify-between bg-sky-950/20">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-slate-200 font-bold">Cosmic Intelligence</span>
              </div>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5">
              {chatMessages.map((m, idx) => (
                <div key={idx} className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}>
                  <span className="font-mono text-[8px] text-slate-500 mb-0.5 uppercase tracking-wider">
                    {m.sender === "user" ? "Observer" : "Cosmic AI"}
                  </span>
                  <div className={`p-2.5 rounded-xl text-[11px] leading-relaxed max-w-[85%] ${
                    m.sender === "user" 
                      ? "bg-sky-500/10 text-sky-200 border border-sky-500/20" 
                      : "bg-white/[0.02] text-slate-300 border border-white/5"
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Prompts */}
            <div className="p-2 border-t border-white/5 bg-black/10 flex gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none shrink-0 font-mono text-[10px]">
              {[
                "When can I see ISS?",
                "Is stargazing good tonight?",
                "What satellites are overhead?"
              ].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleSendChatMessage(p)}
                  className="rounded-full border border-white/5 bg-white/[0.04] px-2.5 py-1 font-sans text-[9px] text-slate-300 hover:bg-white/[0.08] hover:text-slate-100 transition-all cursor-pointer"
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Chat Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChatMessage(chatInput);
              }}
              className="p-3 border-t border-white/5 bg-slate-950 flex gap-2"
            >
              <input
                type="text"
                placeholder="Ask Cosmic AI..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 rounded-xl border border-white/10 bg-black/50 px-3 py-2 font-mono text-[10px] text-slate-200 outline-none focus:border-sky-400/40 transition-colors"
              />
              <button
                type="submit"
                className="rounded-xl bg-sky-500 px-3.5 text-[10px] font-bold text-white hover:bg-sky-400 transition-colors cursor-pointer"
              >
                Send
              </button>
            </form>
          </div>
        )}

        {/* Floating Bubble Icon */}
        <button
          type="button"
          onClick={() => setChatOpen(!chatOpen)}
          className="h-12 w-12 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-lg hover:bg-sky-400 hover:scale-105 transition-all cursor-pointer animate-bounce"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </main>
  );
}