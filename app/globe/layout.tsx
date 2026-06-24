// app/globe/layout.tsx
// Cesium.js and CESIUM_BASE_URL are loaded at runtime in page.tsx via a
// dynamic script tag — no imports needed here. We only add the CSS link.
import type { ReactNode } from "react";

export default function GlobeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Cesium widget CSS — loaded from CDN, same version as Cesium.js */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/cesium@1.142.0/Build/Cesium/Widgets/widgets.css"
      />
      {children}
    </>
  );
}
