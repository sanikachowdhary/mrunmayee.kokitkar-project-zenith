"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useScroll, useTransform, AnimatePresence, type Variants } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LocationSearch as DynamicLocationSearch } from "./components/LocationSearch";

/* ------------------------------------------------------------------ */
/*  Starfield                                                          */
/* ------------------------------------------------------------------ */

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  layer: 0 | 1 | 2;
}

function useStarfield(count: number) {
  return useMemo<Star[]>(() => {
    return Array.from({ length: count }, (_, i) => {
      const layer = (i % 3) as 0 | 1 | 2;
      return {
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: layer === 0 ? Math.random() * 1 + 0.5 : layer === 1 ? Math.random() * 1.4 + 1 : Math.random() * 1.8 + 1.6,
        delay: Math.random() * 6,
        duration: Math.random() * 3 + 2.5,
        layer,
      };
    });
  }, [count]);
}

function Starfield() {
  const stars = useStarfield(220);
  const { scrollYProgress } = useScroll();
  const y0 = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const y1 = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 260]);
  const layerY = [y0, y1, y2];

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#03040a]">
      {/* gradient nebula wash */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_-10%,rgba(56,90,160,0.22),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_85%_85%,rgba(123,77,194,0.14),transparent_60%)]" />

      {[0, 1, 2].map((layerIdx) => (
        <motion.div key={layerIdx} className="absolute inset-0" style={{ y: layerY[layerIdx] }}>
          {stars
            .filter((s) => s.layer === layerIdx)
            .map((star) => (
              <motion.span
                key={star.id}
                className="absolute rounded-full bg-white"
                style={{
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: star.size,
                  height: star.size,
                  boxShadow: star.layer === 2 ? "0 0 6px 1px rgba(255,255,255,0.55)" : undefined,
                }}
                animate={{ opacity: [0.15, 1, 0.15] }}
                transition={{
                  duration: star.duration,
                  delay: star.delay,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
        </motion.div>
      ))}

      {/* fine grain vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_90%_at_50%_50%,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shooting star — signature ambient detail                          */
/* ------------------------------------------------------------------ */

function ShootingStars() {
  const [streaks, setStreaks] = useState<{ id: number; top: number; left: number; delay: number }[]>([]);

  useEffect(() => {
    const spawn = () => {
      setStreaks((prev) => [
        ...prev.slice(-2),
        { id: Date.now(), top: Math.random() * 40, left: Math.random() * 60 + 20, delay: 0 },
      ]);
    };
    const interval = setInterval(spawn, 4500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-[5] overflow-hidden">
      <AnimatePresence>
        {streaks.map((s) => (
          <motion.div
            key={s.id}
            className="absolute h-px w-32 rounded-full bg-gradient-to-r from-transparent via-white to-transparent"
            style={{ top: `${s.top}%`, left: `${s.left}%`, rotate: "-35deg" }}
            initial={{ opacity: 0, x: -40, y: -10 }}
            animate={{ opacity: [0, 1, 0], x: 180, y: 90 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.3, ease: "easeOut" }}
            onAnimationComplete={() =>
              setStreaks((prev) => prev.filter((p) => p.id !== s.id))
            }
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Motion variants                                                    */
/* ------------------------------------------------------------------ */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] },
  }),
};

/* ------------------------------------------------------------------ */
/*  Telemetry strip — eyebrow that behaves like real mission data      */
/* ------------------------------------------------------------------ */

function TelemetryBar() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) + " UTC"
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="mb-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.25em] text-slate-400/80"
    >
      <span className="flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
        Sky link active
      </span>
      <span className="text-slate-600">·</span>
      <span>{time || "00:00:00 UTC"}</span>
      <span className="text-slate-600">·</span>
      <span>Zenith Observation Network</span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Glass card primitive                                               */
/* ------------------------------------------------------------------ */

function GlassCard({
  children,
  className = "",
  glow = false,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={`relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.45)] ${className}`}
    >
      {glow && (
        <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br from-sky-400/10 via-transparent to-violet-400/10" />
      )}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Search field                                                       */
/* ------------------------------------------------------------------ */

function LocationSearch() {
  const router = useRouter();

  return (
    <div className="w-full">
      <DynamicLocationSearch 
        onLocationSelect={(lat, lng) => {
          // You could pass lat/lng as URL params here if Dashboard supported it.
          // For now, redirecting to the Intelligence Layer.
          router.push("/dashboard");
        }} 
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Primary CTA                                                        */
/* ------------------------------------------------------------------ */

function ExploreButton() {
  return (
    <Link href="/globe" className="block w-full sm:inline-block sm:w-auto">
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="group relative w-full overflow-hidden rounded-full bg-white px-8 py-4 text-sm font-semibold tracking-wide text-[#03040a] shadow-[0_0_30px_rgba(255,255,255,0.15)] sm:w-auto sm:text-base cursor-pointer"
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          Explore The Sky
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
          >
            <path
              d="M7 17 17 7M9 7h8v8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-sky-100/60 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      </motion.button>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature data — what the product actually does                     */
/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    code: "ISS",
    title: "Track the Station",
    body: "Live orbital position of the International Space Station, updated every few seconds as it crosses your horizon.",
  },
  {
    code: "SAT",
    title: "Satellite Passes",
    body: "See which satellites will be visible overhead tonight, with rise time, peak altitude, and direction.",
  },
  {
    code: "MOON",
    title: "Moon & Planets",
    body: "Current phase, rise and set times, and the planets currently bright enough to find with the naked eye.",
  },
  {
    code: "DARK",
    title: "Sky Darkness",
    body: "Light pollution and cloud cover for your exact coordinates, so you know if tonight is worth looking up.",
  },
] as const;

function FeatureGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {FEATURES.map((f, i) => (
        <motion.div
          key={f.code}
          custom={i}
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
        >
          <GlassCard
            glow
            className="group h-full p-6 transition-colors duration-300 hover:border-white/20 hover:bg-white/[0.06]"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[11px] tracking-[0.2em] text-sky-300/70">
                {f.code}
              </span>
              <span className="h-px w-8 bg-gradient-to-r from-sky-400/60 to-transparent" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-slate-100">{f.title}</h3>
            <p className="text-sm leading-relaxed text-slate-400">{f.body}</p>
          </GlassCard>
        </motion.div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mission stats strip                                                */
/* ------------------------------------------------------------------ */

const STATS = [
  { value: "27,000", unit: "km/h", label: "ISS orbital velocity" },
  { value: "408", unit: "km", label: "Average station altitude" },
  { value: "16", unit: "/ day", label: "Orbits of Earth completed" },
] as const;

function StatsStrip() {
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] sm:grid-cols-3">
      {STATS.map((s, i) => (
        <motion.div
          key={s.label}
          custom={i}
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="flex flex-col items-center gap-1 px-6 py-8 text-center sm:border-l sm:border-white/10 sm:first:border-l-0"
        >
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold text-slate-50 sm:text-4xl">{s.value}</span>
            <span className="font-mono text-xs text-sky-300/70">{s.unit}</span>
          </div>
          <span className="text-xs uppercase tracking-wider text-slate-500">{s.label}</span>
        </motion.div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function Page() {
  return (
    <main className="relative min-h-screen overflow-x-hidden text-slate-100">
      <Starfield />
      <ShootingStars />

      {/* ---------------- Nav ---------------- */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
        <div className="flex items-center gap-2.5">
          <span className="block h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_12px_2px_rgba(56,167,255,0.7)]" />
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-slate-300">
            Zenith
          </span>
        </div>
        <nav className="hidden items-center gap-8 text-xs uppercase tracking-wider text-slate-400 sm:flex">
          <a href="#mission" className="transition-colors hover:text-slate-100">
            Mission
          </a>
          <a href="#capabilities" className="transition-colors hover:text-slate-100">
            Capabilities
          </a>
          <a href="#data" className="transition-colors hover:text-slate-100">
            Data
          </a>
        </nav>
      </header>

      {/* ---------------- Hero ---------------- */}
      <section className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-10 pb-28 text-center sm:px-10 sm:pt-16">
        <TelemetryBar />

        <motion.h1
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="text-[13vw] font-semibold leading-[0.95] tracking-tight text-slate-50 sm:text-7xl lg:text-8xl"
        >
          PROJECT
          <br />
          <span className="bg-gradient-to-b from-white via-sky-100 to-sky-300/80 bg-clip-text text-transparent">
            ZENITH
          </span>
        </motion.h1>

        <motion.p
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-6 max-w-xl text-balance text-base text-slate-400 sm:text-xl"
        >
          What Is Above You?
        </motion.p>

        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-10 w-full max-w-xl"
        >
          <LocationSearch />
        </motion.div>

        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="show" className="mt-6">
          <ExploreButton />
        </motion.div>

        <motion.p
          custom={5}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-5 font-mono text-[11px] uppercase tracking-widest text-slate-600"
        >
          No account required &middot; Real-time orbital data
        </motion.p>
      </section>

      {/* ---------------- Stats ---------------- */}
      <section id="mission" className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-24 sm:px-10">
        <StatsStrip />
      </section>

      {/* ---------------- Capabilities ---------------- */}
      <section
        id="capabilities"
        className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-28 sm:px-10"
      >
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mb-10 max-w-xl"
        >
          <span className="mb-3 block font-mono text-[11px] uppercase tracking-[0.25em] text-sky-300/70">
            Capabilities
          </span>
          <h2 className="text-3xl font-semibold text-slate-50 sm:text-4xl">
            Everything overhead, in one view.
          </h2>
        </motion.div>
        <FeatureGrid />
      </section>

      {/* ---------------- Closing CTA ---------------- */}
      <section id="data" className="relative z-10 mx-auto w-full max-w-3xl px-6 pb-28 text-center sm:px-10">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
        >
          <GlassCard glow className="px-8 py-12 sm:px-16">
            <h2 className="text-2xl font-semibold text-slate-50 sm:text-3xl">
              The sky changes every night.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-slate-400 sm:text-base">
              Set your location once and Zenith keeps watch, so you always know what&apos;s
              worth stepping outside for.
            </p>
            <div className="mt-8 flex justify-center">
              <ExploreButton />
            </div>
          </GlassCard>
        </motion.div>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="relative z-10 mx-auto w-full max-w-6xl border-t border-white/10 px-6 py-8 sm:px-10">
        <div className="flex flex-col items-center justify-between gap-4 text-xs text-slate-500 sm:flex-row">
          <span>&copy; {new Date().getFullYear()} Project Zenith</span>
          <span className="font-mono uppercase tracking-widest text-slate-600">
            Eyes up. Always.
          </span>
        </div>
      </footer>
    </main>
  );
}
