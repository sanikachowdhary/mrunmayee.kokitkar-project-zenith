# 🌌 Project Zenith: The Celestial Eye

> **AstralWeb Innovate Round 2** — A real-time space-awareness platform that fuses live orbital telemetry, astronomical simulation, and immersive 3D visualisation into a single, stunning web experience.

**Live Demo →** [mrunmayee-kokitkar-project-zenith.vercel.app](https://mrunmayee-kokitkar-project-zenith.vercel.app)

---

## ✨ What Is Project Zenith?

Project Zenith is a full-stack, real-time space-awareness dashboard built with **Next.js 14 App Router**. It streams live data from multiple space APIs, renders an interactive 3D Earth (CesiumJS), and lets you travel through time to see how the sky looked at *any point in history or the future*.

### Judging Criteria Coverage

| Criterion | Weight | Implementation |
|---|---|---|
| **UI/UX Aesthetic & Cosmic Theme** | 25 pts | Dark cosmic palette (`#0a0a1a`), glassmorphism panels, cyan `#22d3ee` accents, Framer Motion animations throughout |
| **Real-time Data Integration** | 25 pts | Live ISS position (every 5 s), weather/visibility via Open-Meteo, satellite TLEs from CelesTrak, pass predictions via N2YO proxy |
| **Feature Richness** | 20 pts | Multi-satellite orbit paths (SGP4), speed trackers, constellation overlays, Sky Time Machine (±100 yr scrubber), Observatory Mode |
| **Code Structure & Documentation** | 20 pts | Strict TypeScript, server-side proxy routes only, modular component architecture, JSDoc comments |

---

## 🗺️ App Pages

| Route | Feature |
|---|---|
| `/` | Hero landing page with animated star field and CTA |
| `/dashboard` | 8-panel telemetry dashboard: ISS position, speed, pass predictions, visible planets, cosmic twin score, observation conditions |
| `/globe` | Interactive 3D Earth (CesiumJS) with ISS orbit, multi-satellite paths, constellation overlays, Observatory & Night modes, Mission Mode gamification |
| `/sky` | **Sky Time Machine** — scrub ±100 years to simulate the sky with sun/moon/planet positions for any location |
| `/observatory` | Observatory Mode — curated dark-sky sites with real-time conditions |
| `/constellations` | Constellation explorer with mythology and visibility data |

---

## 🛰 Real-Time Data Pipeline

All external API calls run **exclusively through server-side proxy routes** (`app/api/`) — no keys are ever exposed to the browser.

```
Browser  →  /api/iss-location   →  wheretheiss.at
         →  /api/iss-passes     →  n2yo.com
         →  /api/weather        →  open-meteo.com
         →  /api/satellites     →  celestrak.org (TLE bulk)
         →  /api/planets        →  computed server-side (VSOP87)
```

### Data Sources

| Source | Data | Refresh |
|---|---|---|
| [Where the ISS At?](https://wheretheiss.at) | ISS lat/lng/altitude/velocity | 5 s |
| [N2YO](https://n2yo.com) | Pass predictions for observer location | On demand |
| [Open-Meteo](https://open-meteo.com) | Sky transparency, cloud cover, seeing | 10 min |
| [CelesTrak](https://celestrak.org) | TLE sets for Hubble, Tiangong, Starlink, Sentinel-2A, NOAA-19 | On load |

---

## 🌍 Key Features

### 🌐 3D Globe (CesiumJS)
- **ISS live orbit** — cyan glowing polyline tracks the current ISS ground track
- **Multi-satellite orbit paths** — 5 satellites propagated via SGP4 from live TLEs, each with a unique colour:
  - 🔵 Hubble Space Telescope
  - 🟡 Tiangong Space Station
  - 🩵 Starlink (prototype)
  - 🟢 Sentinel-2A
  - 🟠 NOAA-19
- **Satellite radar mode** — visualise active satellite positions as live pings
- **Constellation overlay** — toggle IAU constellation line art over the globe
- **Orbital trail** — glowing tail showing the ISS's last N minutes of track
- **Night mode** — true dark-side rendering with city lights
- **Auto-rotation** — cinematic globe spin
- **Mission Mode** — gamified checklist (inspect ISS path → observe night sky → launch radar → fly to Everest)
- **Mobile bottom drawer** — all controls accessible on phones via a slide-up panel

### ⏳ Sky Time Machine
- Scrub from **−100 to +100 years** relative to any base date/time
- **2D Sky Dome canvas** — renders stars, the Milky Way band, planets, and the Sun/Moon for the selected epoch and location
- Precise **sun altitude, azimuth, sidereal time, day length, and moon phase** calculated from first principles (Julian Date, GMST, VSOP87-approximated planet positions)
- **"Share This Sky"** button — copies a deep link (`/sky?lat=...&lng=...&date=...&time=...`) to clipboard; sharing the URL restores the exact view for the recipient
- URL param restoration on page load — shared links fully reconstruct the ephemeris state

### 📊 Dashboard Telemetry Cards
- **ISS Position** — real-time lat/lng/alt with ocean/land flag
- **ISS Speed** — orbital velocity in km/s with animated speedometer
- **Pass Predictions** — next 5 passes for your location with rise/set azimuth and max elevation
- **Visible Planets** — which planets are above the horizon right now
- **Observation Conditions** — cloud cover, atmospheric transparency, Bortle scale
- **Cosmic Twin Score** — how closely your bio-rhythm aligns with ISS orbital phase (fun metric)
- **Active Satellites** — live count from CelesTrak
- **Zenith Card** — what satellite/constellation is directly overhead

---

## 🏗️ Architecture

```
app/
├── api/                    # Server-side proxy routes (Next.js Route Handlers)
│   ├── iss-location/       # Live ISS position
│   ├── iss-passes/         # Pass prediction proxy
│   ├── weather/            # Open-Meteo proxy
│   ├── satellites/         # CelesTrak TLE bulk fetch
│   └── planets/            # Server-computed planet positions
├── components/             # Shared UI primitives
│   ├── NavBar.tsx
│   ├── LocationSearch.tsx
│   ├── ConstellationOverlay.tsx
│   └── PresetButton.tsx
├── dashboard/
│   └── _components/
│       ├── DashboardLayout.tsx
│       ├── cards/          # 8 telemetry card components
│       └── lib/
│           └── real-api.ts # Client-side data fetching (hits /api/ only)
├── globe/
│   └── _components/
│       └── SpaceVisualizer.ts  # CesiumJS orbit setup + multi-sat SGP4
├── sky/
│   ├── page.tsx            # Sky Time Machine with URL param sharing
│   └── _components/
│       └── SkyDomeCanvas.tsx   # 2D canvas star dome renderer
└── lib/
    ├── api-client.ts       # Zustand location store + SWR hooks
    └── useLiveTimestamp.ts
```

### TypeScript Principles

- **Strict mode** enforced (`"strict": true` in `tsconfig.json`)
- **No `any` types** — all external API responses typed with interfaces
- **Server-side proxy only** — `NEXT_PUBLIC_*` keys are never used for third-party auth
- **Fault tolerance** — CelesTrak TLE failures for individual satellites skip silently with `console.warn`, never crash the page

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18
- A free [N2YO API key](https://www.n2yo.com/login/register/) (for pass predictions)
- A free [Cesium Ion token](https://ion.cesium.com/) (for globe imagery)

### Setup

```bash
git clone https://github.com/sanikachowdhary/mrunmayee.kokitkar-project-zenith.git
cd mrunmayee.kokitkar-project-zenith
npm install
cp .env.example .env.local
# Fill in your keys in .env.local
npm run dev
```

### Environment Variables

See [`.env.example`](.env.example) for the full list. Required variables:

| Variable | Description |
|---|---|
| `N2YO_API_KEY` | Pass prediction API key from n2yo.com |
| `NEXT_PUBLIC_CESIUM_TOKEN` | Cesium Ion access token |
| `OPEN_METEO_URL` | Default: `https://api.open-meteo.com/v1/forecast` |

---

## 🎨 Design System

| Token | Value |
|---|---|
| Background | `#030409` / `#0a0a1a` |
| Accent (Cyan) | `#22d3ee` |
| Accent (Violet) | `#a78bfa` |
| Accent (Amber) | `#fbbf24` |
| Accent (Emerald) | `#34d399` |
| Font (Heading) | `Inter` (Google Fonts) |
| Font (Mono/Data) | `JetBrains Mono` |
| Panel style | Glassmorphism: `bg-slate-950/70 backdrop-blur-xl border border-white/10` |

All animations use **Framer Motion** with spring physics for snappy, premium feel.

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS v3 |
| 3D Globe | CesiumJS (via `resium`) |
| Animation | Framer Motion |
| State | Zustand |
| Orbital Math | satellite.js (SGP4/SDP4) |
| Data fetching | SWR + native fetch |
| Deployment | Vercel (auto-deploy from `main`) |

---

## 👩‍💻 Author

**Mrunmayee Kokitkar** — AstralWeb Innovate Round 2 submission

---

*"Look up. The sky is not the limit — it's the beginning."*
