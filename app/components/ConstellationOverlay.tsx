"use client";

import type * as CesiumNS from "cesium";

export interface Constellation {
  name: string;
  stars: { ra: number; dec: number }[];
  lines: [number, number][];
}

export const MAJOR_CONSTELLATIONS: Constellation[] = [
  {
    name: "Ursa Major",
    stars: [
      { ra: 165.46, dec: 61.75 },
      { ra: 167.81, dec: 56.38 },
      { ra: 178.46, dec: 53.69 },
      { ra: 183.86, dec: 57.03 },
      { ra: 193.51, dec: 55.96 },
      { ra: 200.98, dec: 54.92 },
      { ra: 206.88, dec: 49.31 },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
  },
  {
    name: "Orion",
    stars: [
      { ra: 88.79, dec: 7.41 },
      { ra: 78.63, dec: -8.20 },
      { ra: 81.28, dec: 6.35 },
      { ra: 84.05, dec: -1.94 },
      { ra: 86.94, dec: -9.67 },
      { ra: 83.00, dec: -0.30 },
      { ra: 89.93, dec: -8.67 },
    ],
    lines: [[0, 2], [2, 3], [3, 5], [5, 1], [1, 4], [4, 6], [3, 4]],
  },
  {
    name: "Cassiopeia",
    stars: [
      { ra: 2.29, dec: 60.72 },
      { ra: 6.90, dec: 60.24 },
      { ra: 14.17, dec: 60.72 },
      { ra: 18.43, dec: 56.54 },
      { ra: 28.60, dec: 63.67 },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
];

export function setupConstellationOverlay(
  viewer: CesiumNS.Viewer,
  Cesium: typeof CesiumNS,
  visible: boolean
): CesiumNS.CustomDataSource {
  const ds = new Cesium.CustomDataSource("CONSTELLATION_OVERLAY");
  const radius = Cesium.Ellipsoid.WGS84.maximumRadius + 500000;

  for (const constellation of MAJOR_CONSTELLATIONS) {
    for (const [startIdx, endIdx] of constellation.lines) {
      const start = constellation.stars[startIdx];
      const end = constellation.stars[endIdx];
      if (!start || !end) continue;

      const startRa = start.ra * (Math.PI / 180);
      const startDec = start.dec * (Math.PI / 180);
      const endRa = end.ra * (Math.PI / 180);
      const endDec = end.dec * (Math.PI / 180);

      const startPos = new Cesium.Cartesian3(
        radius * Math.cos(startDec) * Math.cos(startRa),
        radius * Math.cos(startDec) * Math.sin(startRa),
        radius * Math.sin(startDec)
      );
      const endPos = new Cesium.Cartesian3(
        radius * Math.cos(endDec) * Math.cos(endRa),
        radius * Math.cos(endDec) * Math.sin(endRa),
        radius * Math.sin(endDec)
      );

      ds.entities.add({
        name: `${constellation.name} line`,
        polyline: {
          positions: [startPos, endPos],
          width: 1.5,
          material: Cesium.Color.CYAN.withAlpha(0.5),
          arcType: Cesium.ArcType.NONE,
        },
      });
    }
  }

  ds.show = visible;
  viewer.dataSources.add(ds);
  return ds;
}

export function setupOrbitalTrail(
  viewer: CesiumNS.Viewer,
  Cesium: typeof CesiumNS,
  visible: boolean
): CesiumNS.CustomDataSource {
  const ds = new Cesium.CustomDataSource("ISS_ORBIT_TRAIL");
  const earthRadius = Cesium.Ellipsoid.WGS84.maximumRadius;
  const alt = 408000;
  const radius = earthRadius + alt;
  const inclination = Cesium.Math.toRadians(51.6);
  const periodSecs = 92 * 60;

  const trailPositions: CesiumNS.Cartesian3[] = [];
  const numPoints = 90;

  for (let i = 0; i <= numPoints; i++) {
    const t = (i / numPoints) * periodSecs;
    const angle = Cesium.Math.TWO_PI * (t / periodSecs) - Cesium.Math.PI;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle) * Math.cos(inclination);
    const z = radius * Math.sin(angle) * Math.sin(inclination);
    trailPositions.push(new Cesium.Cartesian3(x, y, z));
  }

  ds.entities.add({
    name: "ISS Orbit Trail",
    polyline: {
      positions: trailPositions,
      width: 2,
      material: Cesium.Color.RED.withAlpha(0.4),
      arcType: Cesium.ArcType.NONE,
    },
  });

  ds.show = visible;
  viewer.dataSources.add(ds);
  return ds;
}
