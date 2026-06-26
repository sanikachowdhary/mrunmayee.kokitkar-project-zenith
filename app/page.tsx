"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useScroll, useTransform, AnimatePresence, type Variants } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LocationSearch as DynamicLocationSearch } from "./components/LocationSearch";
import { useLocationStore } from "./lib/api-client";
import { APODDisplay } from "./components/APODDisplay";

/* ------------------------------------------------------------------ */
/*  Animated Particle Canvas                                           */
/* ------------------------------------------------------------------ */

function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const isDark = true;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Generate particles
    const NUM = 120;
    const particles = Array.from({ length: NUM }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      alpha: Math.random() * 0.7 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 -z-10"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Shooting stars                                                     */
/* ------------------------------------------------------------------ */

function ShootingStars() {
  const [streaks, setStreaks] = useState<{ id: number; top: number; left: number }[]>([]);
  useEffect(() => {
    const interval = setInterval(() => {
      setStreaks(prev => [
        ...prev.slice(-2),
        { id: Date.now(), top: Math.random() * 40, left: Math.random() * 60 + 20 },
      ]);
    }, 4500);
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
            onAnimationComplete={() => setStreaks(prev => prev.filter(p => p.id !== s.id))}
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
  hidden: { opacity: 0, y: 32 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] },
  }),
};

/* ------------------------------------------------------------------ */
/*  Live clock telemetry bar                                           */
/* ------------------------------------------------------------------ */

function TelemetryBar() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString("en-US", { hour12: false }) + " UTC");
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="mb-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.25em]"
      style={{ color: "var(--text-muted)" }}
    >
      <span className="flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
        Live observation stream
      </span>
      <span style={{ color: "var(--border-strong)" }}>·</span>
      <span>{time || "00:00:00 UTC"}</span>
      <span style={{ color: "var(--border-strong)" }}>·</span>
      <span>Zenith Observation Network</span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Orbit ring decoration                                              */
/* ------------------------------------------------------------------ */

function OrbitRings() {
  const opacity = 0.08;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      {[400, 600, 800, 1050].map((size, i) => (
        <motion.div
          key={size}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{ duration: 60 + i * 20, repeat: Infinity, ease: "linear" }}
          className="absolute rounded-full border"
          style={{
            width: size,
            height: size,
            borderColor: `rgba(56,189,248,${opacity})`,
          }}
        />
      ))}
      {/* ISS dot on the outermost ring */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
        className="absolute"
        style={{ width: 1050, height: 1050 }}
      >
        <div
          className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-sky-400 shadow-[0_0_12px_4px_rgba(56,189,248,0.6)]"
        />
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature cards                                                      */
/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    code: "ISS",
    icon: "🛸",
    title: "Live Station Track",
    body: "Real-time ISS position, altitude, and orbital path updated every 5 seconds as it crosses your sky.",
    href: "/dashboard",
    color: "from-sky-500/20 to-cyan-400/5",
    accent: "#38bdf8",
  },
  {
    code: "GLOBE",
    icon: "🌍",
    title: "3D Earth Observatory",
    body: "Interactive WebGL globe with elevation terrain, landmark fly-through, and satellite orbit overlays.",
    href: "/globe",
    color: "from-emerald-500/20 to-teal-400/5",
    accent: "#34d399",
  },
  {
    code: "TIME",
    icon: "⏳",
    title: "Sky Time Machine",
    body: "Reconstruct the exact celestial alignment for any location on Earth, -100 to +100 years from now.",
    href: "/sky",
    color: "from-violet-500/20 to-purple-400/5",
    accent: "#a78bfa",
  },
  {
    code: "TWIN",
    icon: "🔭",
    title: "Cosmic Twin Score",
    body: "AI-computed 0–100 score rating observation quality, sky clarity, and planetary visibility for your site.",
    href: "/dashboard",
    color: "from-amber-500/20 to-orange-400/5",
    accent: "#fbbf24",
  },
] as const;

function FeatureCard({ f, i }: { f: (typeof FEATURES)[number]; i: number }) {
  return (
    <motion.div
      custom={i}
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
    >
      <Link href={f.href} className="group block h-full">
        <div
          className="relative h-full overflow-hidden rounded-2xl border p-6 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl"
          style={{
            background: `linear-gradient(135deg, ${f.color.replace("from-", "").replace(" to-", ", ")})`,
            borderColor: "var(--border)",
            backgroundColor: "var(--glass-bg)",
          }}
        >
          <div
            className="absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              background: `linear-gradient(135deg, ${f.accent}15, transparent 60%)`,
              border: `1px solid ${f.accent}30`,
            }}
          />
          <div className="mb-4 text-3xl">{f.icon}</div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest" style={{ color: f.accent }}>
            {f.code}
          </div>
          <h3 className="mb-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            {f.title}
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {f.body}
          </p>
          <div
            className="mt-4 flex items-center gap-1 text-xs font-mono uppercase tracking-widest opacity-60 transition-all duration-300 group-hover:gap-2 group-hover:opacity-100"
            style={{ color: f.accent }}
          >
            Launch <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stats strip                                                        */
/* ------------------------------------------------------------------ */

const STATS = [
  { value: "27,600", unit: "km/h", label: "ISS orbital velocity" },
  { value: "408", unit: "km", label: "Station altitude" },
  { value: "16×", unit: "/ day", label: "Earth orbits completed" },
  { value: "∞", unit: "", label: "Cosmic discoveries" },
] as const;

/* ------------------------------------------------------------------ */
/*  Search wrapper                                                     */
/* ------------------------------------------------------------------ */

function LocationSearchWrapper() {
  const router = useRouter();
  const setLocation = useLocationStore((s) => s.setLocation);
  return (
    <DynamicLocationSearch
      onLocationSelect={(lat, lng, name) => {
        setLocation(lat, lng, name);
        router.push(`/dashboard?lat=${lat}&lng=${lng}`);
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function Page() {
  return (
    <main className="page-with-nav relative min-h-screen overflow-x-hidden" style={{ color: "var(--foreground)" }}>
      <ParticleBackground />
      <ShootingStars />

      {/* ── HERO ── */}
      <section className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 text-center">
        <OrbitRings />

        <div className="relative z-10 flex flex-col items-center gap-0">
          <TelemetryBar />

          {/* Badge */}
          <motion.div
            variants={fadeUp}
            custom={0.5}
            initial="hidden"
            animate="show"
            className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5"
            style={{
              borderColor: "var(--border-strong)",
              backgroundColor: "rgba(56,189,248,0.05)",
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: "var(--accent)" }}>
              26 Jun 2026 · Celestial Intelligence Platform
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="text-[min(14vw,88px)] font-black leading-[0.9] tracking-tighter"
          >
            <span
              className="block"
              style={{
                background: "linear-gradient(135deg, #fff 30%, #93c5fd 60%, #a78bfa)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              PROJECT
            </span>
            <span
              className="block"
              style={{
                background: "linear-gradient(135deg, #38bdf8, #818cf8 50%, #c084fc)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              ZENITH
            </span>
          </motion.h1>

          {/* Tagline */}
          <motion.p
            custom={2}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-6 max-w-lg text-balance text-lg sm:text-xl"
            style={{ color: "var(--text-secondary)" }}
          >
            The universe above you, decoded. Explore Earth in 3D, track the ISS live, 
            and travel through time to reconstruct any night sky.
          </motion.p>

          {/* Search */}
          <motion.div
            custom={3}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-10 w-full max-w-lg"
          >
            <LocationSearchWrapper />
          </motion.div>

          {/* CTA Row */}
          <motion.div
            custom={4}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-6 flex flex-wrap items-center justify-center gap-3"
          >
            <Link href="/globe">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="relative overflow-hidden rounded-full px-8 py-3.5 text-sm font-semibold tracking-wide shadow-lg cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, #38bdf8, #818cf8)",
                  color: "#fff",
                  boxShadow: `0 0 40px rgba(56,189,248,0.3)`,
                }}
              >
                <span className="relative z-10 flex items-center gap-2">
                  🌍 Open Globe
                </span>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 hover:translate-x-full" />
              </motion.button>
            </Link>
            <Link href="/sky">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="cursor-pointer rounded-full border px-8 py-3.5 text-sm font-semibold tracking-wide backdrop-blur-sm transition-all"
                style={{
                  borderColor: "var(--border-strong)",
                  color: "var(--foreground)",
                  backgroundColor: "var(--glass-bg)",
                }}
              >
                <span className="flex items-center gap-2">⏳ Time Machine</span>
              </motion.button>
            </Link>
          </motion.div>

          <motion.p
            custom={5}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-5 font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Open science · Real-time telemetry · Any coordinate on Earth
          </motion.p>
        </div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
          style={{ color: "var(--text-muted)" }}
        >
          <span className="font-mono text-[9px] uppercase tracking-widest">Scroll</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </section>

      {/* ── STATS ── */}
      <section className="relative z-10 mx-auto w-full max-w-5xl px-6 py-20 sm:px-10">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border sm:grid-cols-4" style={{ borderColor: "var(--border)" }}>
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="flex flex-col items-center gap-1 px-6 py-10 text-center"
              style={{ backgroundColor: "var(--glass-bg)" }}
            >
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black sm:text-4xl" style={{ color: "var(--foreground)" }}>
                  {s.value}
                </span>
                <span className="font-mono text-xs" style={{ color: "var(--accent)" }}>{s.unit}</span>
              </div>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                {s.label}
              </span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-28 sm:px-10">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <span className="mb-3 block font-mono text-[11px] uppercase tracking-[0.25em]" style={{ color: "var(--accent)" }}>
            Mission Modules
          </span>
          <h2 className="text-3xl font-black tracking-tight sm:text-5xl" style={{ color: "var(--foreground)" }}>
            Everything overhead,{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #38bdf8, #a78bfa)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              in one view.
            </span>
          </h2>
        </motion.div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => <FeatureCard key={f.code} f={f} i={i} />)}
        </div>
      </section>

      {/* ── ASTRONOMY PICTURE OF THE DAY ── */}
      <section className="relative z-10 mx-auto w-full max-w-3xl px-6 py-20 sm:px-10">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Featured: Astronomy Picture
          </h2>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            NASA&apos;s daily exploration of the cosmos
          </p>
        </motion.div>
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
        >
          <APODDisplay />
        </motion.div>
      </section>

      {/* ── CLOSING CTA ── */}
      <section className="relative z-10 mx-auto w-full max-w-3xl px-6 pb-28 text-center sm:px-10">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
        >
          <div
            className="relative overflow-hidden rounded-3xl border p-12 sm:p-16"
            style={{
              borderColor: "var(--border-strong)",
              background: "linear-gradient(135deg, rgba(15,23,42,0.8), rgba(30,10,60,0.6))",
              backdropFilter: "blur(24px)",
            }}
          >
            {/* Glow */}
            <div
              className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-40 w-80 rounded-full blur-3xl"
              style={{ background: "rgba(56,189,248,0.08)" }}
            />
            <div className="relative z-10">
              <div className="mb-4 text-4xl">🌌</div>
              <h2 className="text-2xl font-black sm:text-4xl" style={{ color: "var(--foreground)" }}>
                The sky changes every night.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-base" style={{ color: "var(--text-secondary)" }}>
                Set your location and Zenith keeps watch — so you always know what&apos;s worth stepping outside for.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/globe">
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="cursor-pointer rounded-full px-8 py-3.5 text-sm font-semibold text-white shadow-xl"
                    style={{
                      background: "linear-gradient(135deg, #38bdf8, #818cf8)",
                      boxShadow: "0 0 40px rgba(56,189,248,0.25)",
                    }}
                  >
                    Launch Observatory
                  </motion.button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer
        className="relative z-10 mx-auto w-full max-w-6xl border-t px-6 py-8 sm:px-10"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex flex-col items-center justify-between gap-4 text-xs sm:flex-row" style={{ color: "var(--text-muted)" }}>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
            <span className="font-mono uppercase tracking-widest">© {new Date().getFullYear()} Project Zenith</span>
          </div>
          <span className="font-mono uppercase tracking-widest">Eyes up. Always.</span>
        </div>
      </footer>
    </main>
  );
}
