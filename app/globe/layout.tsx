// app/globe/layout.tsx
import type { ReactNode } from "react";

export default function GlobeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Cesium widget styles loaded from CDN — works in all environments */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/cesium@1.142.0/Build/Cesium/Widgets/widgets.css"
      />
      {children}
    </>
  );
}
