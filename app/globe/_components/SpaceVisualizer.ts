import type * as CesiumNS from "cesium";

export function setupISSOrbit(
  viewer: CesiumNS.Viewer,
  Cesium: typeof CesiumNS
): CesiumNS.CustomDataSource {
  const ds = new Cesium.CustomDataSource("ISS_ORBIT");

  // Orbit parameters (simplified for visualization)
  const earthRadius = Cesium.Ellipsoid.WGS84.maximumRadius; // ~6378 km
  const alt = 408000; // 408 km
  const radius = earthRadius + alt;
  const inclination = Cesium.Math.toRadians(51.6);
  const periodSecs = 92 * 60; // 92 mins

  // 1. Draw the static glowing orbit ring
  const orbitPositions: CesiumNS.Cartesian3[] = [];
  const numSegments = 360;
  for (let i = 0; i <= numSegments; i++) {
    const angle = Cesium.Math.TWO_PI * (i / numSegments);
    // Simple parametric circle with inclination
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle) * Math.cos(inclination);
    const z = radius * Math.sin(angle) * Math.sin(inclination);
    orbitPositions.push(new Cesium.Cartesian3(x, y, z));
  }

  ds.entities.add({
    name: "ISS Orbit Path",
    polyline: {
      positions: orbitPositions,
      width: 3,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.2,
        color: Cesium.Color.CYAN.withAlpha(0.6),
      }),
      arcType: Cesium.ArcType.NONE, // Direct line between Cartesian points
    },
  });

  // 2. Animate the ISS Point along the orbit
  const positionProperty = new Cesium.SampledPositionProperty();
  const startTime = viewer.clock.currentTime;
  
  // Plot positions for the next 24 hours to ensure continuous animation
  for (let t = 0; t <= 86400; t += 60) {
    const time = Cesium.JulianDate.addSeconds(startTime, t, new Cesium.JulianDate());
    // Current angle based on time and orbital period
    const angle = Cesium.Math.TWO_PI * (t / periodSecs);
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle) * Math.cos(inclination);
    const z = radius * Math.sin(angle) * Math.sin(inclination);
    positionProperty.addSample(time, new Cesium.Cartesian3(x, y, z));
  }

  ds.entities.add({
    name: "International Space Station",
    position: positionProperty,
    point: {
      pixelSize: 8,
      color: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.CYAN,
      outlineWidth: 3,
    },
    path: {
      resolution: 1,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.4,
        color: Cesium.Color.WHITE.withAlpha(0.8),
      }),
      width: 5,
      leadTime: 0,
      trailTime: 1800, // Show trail for 30 minutes behind
    },
    label: {
      text: "ISS",
      font: "12px monospace",
      fillColor: Cesium.Color.CYAN,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -15),
    }
  });

  // Optional: add a few generic satellite orbits to make it look cool
  for (let k = 1; k <= 3; k++) {
    const satPositions: CesiumNS.Cartesian3[] = [];
    const satInc = Cesium.Math.toRadians(30 + k * 15);
    const satAlt = 600000 + (k * 200000);
    const satRad = earthRadius + satAlt;
    for (let i = 0; i <= numSegments; i++) {
      const angle = Cesium.Math.TWO_PI * (i / numSegments);
      // Offset starting rotation
      const xOffset = Math.cos(k) * satRad;
      const x = satRad * Math.cos(angle + k);
      const y = satRad * Math.sin(angle + k) * Math.cos(satInc);
      const z = satRad * Math.sin(angle + k) * Math.sin(satInc);
      satPositions.push(new Cesium.Cartesian3(x, y, z));
    }
    ds.entities.add({
      polyline: {
        positions: satPositions,
        width: 1.5,
        material: Cesium.Color.WHITE.withAlpha(0.15),
        arcType: Cesium.ArcType.NONE,
      },
    });
  }

  viewer.dataSources.add(ds);
  // Ensure time is progressing
  viewer.clock.shouldAnimate = true;
  
  return ds;
}

export function setupConstellations(
  viewer: CesiumNS.Viewer,
  Cesium: typeof CesiumNS
): CesiumNS.CustomDataSource {
  const ds = new Cesium.CustomDataSource("CONSTELLATIONS");

  const skyRadius = 50_000_000; // Far out into space

  // Helper to convert RA/Dec to Cartesian on our massive sphere
  function radecToCartesian(raHours: number, decDegrees: number): CesiumNS.Cartesian3 {
    const raRad = Cesium.Math.toRadians(raHours * 15);
    const decRad = Cesium.Math.toRadians(decDegrees);
    
    // Standard spherical coordinates to Cartesian
    const x = skyRadius * Math.cos(decRad) * Math.cos(raRad);
    const y = skyRadius * Math.cos(decRad) * Math.sin(raRad);
    const z = skyRadius * Math.sin(decRad);
    
    return new Cesium.Cartesian3(x, y, z);
  }

  const constellationsData = [
    {
      name: "Orion",
      // Simplified RA(hours)/Dec(degrees)
      stars: [
        [5.91, 7.4],   // Betelgeuse
        [5.25, 6.3],   // Bellatrix
        [5.53, -0.3],  // Mintaka (belt)
        [5.6, -1.2],   // Alnilam (belt)
        [5.68, -2.0],  // Alnitak (belt)
        [5.24, -8.2],  // Rigel
        [5.79, -9.6],  // Saiph
      ],
      lines: [
        [0, 1], [1, 2], [2, 3], [3, 4], [4, 6], [2, 5], [5, 6], [0, 4]
      ]
    },
    {
      name: "Ursa Major",
      stars: [
        [11.06, 61.7], // Dubhe
        [11.03, 56.3], // Merak
        [11.89, 53.7], // Phecda
        [12.25, 57.0], // Megrez
        [12.9, 55.9],  // Alioth
        [13.39, 54.9], // Mizar
        [13.79, 49.3], // Alkaid
      ],
      lines: [
        [0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]
      ]
    },
    {
      name: "Cassiopeia",
      stars: [
        [0.15, 59.1], // Caph
        [0.67, 56.5], // Schedar
        [0.94, 60.7], // Gamma Cas
        [1.43, 60.2], // Ruchbah
        [1.9, 63.6],  // Segin
      ],
      lines: [
        [0, 1], [1, 2], [2, 3], [3, 4]
      ]
    }
  ];

  const material = new Cesium.PolylineGlowMaterialProperty({
    glowPower: 0.1,
    color: Cesium.Color.LIGHTSKYBLUE.withAlpha(0.3),
  });

  const font = "18px 'Inter', sans-serif";
  const labelColor = Cesium.Color.LIGHTSKYBLUE.withAlpha(0.6);

  constituenciesLoop: for (const cons of constellationsData) {
    const pts = cons.stars.map(s => radecToCartesian(s[0], s[1]));
    
    // Draw connecting lines
    for (const [i1, i2] of cons.lines) {
      ds.entities.add({
        polyline: {
          positions: [pts[i1], pts[i2]],
          width: 1.5,
          material: material,
          arcType: Cesium.ArcType.NONE,
        }
      });
    }

    // Add Label at the first star
    ds.entities.add({
      position: pts[0],
      label: {
        text: cons.name,
        font: font,
        fillColor: labelColor,
        style: Cesium.LabelStyle.FILL,
        pixelOffset: new Cesium.Cartesian2(0, -20),
        scaleByDistance: new Cesium.NearFarScalar(1.0e6, 1.5, 5.0e7, 0.5),
        translucencyByDistance: new Cesium.NearFarScalar(1.0e6, 1.0, 5.0e7, 0.0),
      }
    });

    // Draw little glowing points for the stars
    for (const p of pts) {
      ds.entities.add({
        position: p,
        point: {
          pixelSize: 4,
          color: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.LIGHTSKYBLUE,
          outlineWidth: 1,
        }
      });
    }
  }

  viewer.dataSources.add(ds);
  return ds;
}

export interface SatelliteData {
  name: string;
  status: string;
  type: string;
  inclination: number; // degrees
  altitude: number; // meters
  phaseOffset: number; // radians
  period: number; // seconds
}

export const SATELLITES_LIST: SatelliteData[] = [
  { name: "Starlink-1042", status: "Active", type: "Communications", inclination: 53.2, altitude: 550000, phaseOffset: 0.1, period: 95 * 60 },
  { name: "Starlink-2215", status: "Active", type: "Communications", inclination: 53.2, altitude: 550000, phaseOffset: 0.8, period: 95 * 60 },
  { name: "Starlink-3091", status: "Active", type: "Communications", inclination: 53.2, altitude: 550000, phaseOffset: 1.5, period: 95 * 60 },
  { name: "Starlink-4120", status: "Active", type: "Communications", inclination: 53.2, altitude: 550000, phaseOffset: 2.2, period: 95 * 60 },
  { name: "NOAA-19", status: "Active", type: "Weather / Earth Obs", inclination: 99.2, altitude: 870000, phaseOffset: 0.5, period: 102 * 60 },
  { name: "NOAA-20", status: "Active", type: "Weather / Earth Obs", inclination: 98.7, altitude: 824000, phaseOffset: 1.8, period: 101 * 60 },
  { name: "GPS IIF-12", status: "Active", type: "Navigation / GPS", inclination: 55.0, altitude: 20200000, phaseOffset: 0.2, period: 12 * 3600 },
  { name: "GPS IIR-10", status: "Active", type: "Navigation / GPS", inclination: 55.0, altitude: 20200000, phaseOffset: 1.1, period: 12 * 3600 },
  { name: "Galileo-24", status: "Active", type: "Navigation / GPS", inclination: 56.0, altitude: 23222000, phaseOffset: 2.5, period: 14 * 3600 },
  { name: "Hubble Space Telescope", status: "Active", type: "Research / Telescope", inclination: 28.5, altitude: 540000, phaseOffset: 3.1, period: 95 * 60 },
  { name: "ISS (Zarya)", status: "Active", type: "Space Station", inclination: 51.6, altitude: 418000, phaseOffset: 0.0, period: 92.8 * 60 },
  { name: "Aqua", status: "Active", type: "Climate Research", inclination: 98.2, altitude: 705000, phaseOffset: 0.9, period: 99 * 60 },
  { name: "Terra", status: "Active", type: "Climate Research", inclination: 98.2, altitude: 705000, phaseOffset: 2.7, period: 99 * 60 },
  { name: "Envisat", status: "Inactive", type: "Space Debris", inclination: 98.5, altitude: 790000, phaseOffset: 4.2, period: 100 * 60 },
  { name: "Iridium-105", status: "Active", type: "Communications", inclination: 86.4, altitude: 780000, phaseOffset: 1.0, period: 100 * 60 },
  { name: "Iridium-132", status: "Active", type: "Communications", inclination: 86.4, altitude: 780000, phaseOffset: 2.1, period: 100 * 60 },
  { name: "Sentinel-1A", status: "Active", type: "Radar Earth Obs", inclination: 98.18, altitude: 693000, phaseOffset: 0.3, period: 98.6 * 60 },
  { name: "Sentinel-2B", status: "Active", type: "Optical Earth Obs", inclination: 98.62, altitude: 786000, phaseOffset: 1.4, period: 100.6 * 60 },
  { name: "Landsat 8", status: "Active", type: "Land Observatory", inclination: 98.2, altitude: 705000, phaseOffset: 3.5, period: 99 * 60 },
  { name: "GOES-16", status: "Active", type: "Geostationary Weather", inclination: 0.0, altitude: 35786000, phaseOffset: 1.2, period: 24 * 3600 },
  { name: "Himawari-9", status: "Active", type: "Geostationary Weather", inclination: 0.0, altitude: 35786000, phaseOffset: 2.8, period: 24 * 3600 },
  { name: "Oneweb-0124", status: "Active", type: "Communications", inclination: 87.9, altitude: 1200000, phaseOffset: 0.4, period: 109 * 60 },
  { name: "Oneweb-0235", status: "Active", type: "Communications", inclination: 87.9, altitude: 1200000, phaseOffset: 1.6, period: 109 * 60 },
  { name: "Tiangong Space Station", status: "Active", type: "Space Station", inclination: 41.5, altitude: 389000, phaseOffset: 2.9, period: 92 * 60 },
];

export function setupRadarSatellites(
  viewer: CesiumNS.Viewer,
  Cesium: typeof CesiumNS
): CesiumNS.CustomDataSource {
  const ds = new Cesium.CustomDataSource("RADAR_SATELLITES");
  const earthRadius = Cesium.Ellipsoid.WGS84.maximumRadius;

  const startTime = viewer.clock.currentTime;

  SATELLITES_LIST.forEach((sat) => {
    const radius = earthRadius + sat.altitude;
    const inclinationRad = Cesium.Math.toRadians(sat.inclination);
    
    // Draw orbit path polyline
    const orbitPositions: CesiumNS.Cartesian3[] = [];
    const numSegments = 90; // optimized segments
    for (let i = 0; i <= numSegments; i++) {
      const angle = Cesium.Math.TWO_PI * (i / numSegments);
      const x = radius * Math.cos(angle + sat.phaseOffset);
      const y = radius * Math.sin(angle + sat.phaseOffset) * Math.cos(inclinationRad);
      const z = radius * Math.sin(angle + sat.phaseOffset) * Math.sin(inclinationRad);
      orbitPositions.push(new Cesium.Cartesian3(x, y, z));
    }

    ds.entities.add({
      name: `${sat.name} Orbit`,
      polyline: {
        positions: orbitPositions,
        width: 1,
        material: Cesium.Color.CYAN.withAlpha(0.08),
        arcType: Cesium.ArcType.NONE,
      },
    });

    // Create sampled position property for animated motion
    const positionProperty = new Cesium.SampledPositionProperty();
    for (let t = 0; t <= 86400; t += 300) {
      const time = Cesium.JulianDate.addSeconds(startTime, t, new Cesium.JulianDate());
      const angle = Cesium.Math.TWO_PI * (t / sat.period) + sat.phaseOffset;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle) * Math.cos(inclinationRad);
      const z = radius * Math.sin(angle) * Math.sin(inclinationRad);
      positionProperty.addSample(time, new Cesium.Cartesian3(x, y, z));
    }

    const satEntity = ds.entities.add({
      id: `sat-${sat.name}`,
      name: sat.name,
      position: positionProperty,
      point: {
        pixelSize: 6,
        color: sat.type.includes("Communications") ? Cesium.Color.SKYBLUE : 
               sat.type.includes("Weather") ? Cesium.Color.LIGHTGREEN :
               sat.type.includes("Navigation") ? Cesium.Color.GOLD :
               sat.type.includes("Space Station") ? Cesium.Color.DEEPPINK :
               Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1.5,
      },
      label: {
        text: sat.name,
        font: "9px monospace",
        fillColor: Cesium.Color.LIGHTGRAY,
        style: Cesium.LabelStyle.FILL,
        pixelOffset: new Cesium.Cartesian2(0, 10),
        scaleByDistance: new Cesium.NearFarScalar(1.0e6, 1.0, 3.0e7, 0.25),
        translucencyByDistance: new Cesium.NearFarScalar(1.0e6, 1.0, 1.0e7, 0.0),
      },
    });

    // Attach custom metadata
    (satEntity as any).customData = sat;
  });

  viewer.dataSources.add(ds);
  return ds;
}
