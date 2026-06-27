"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const NAV_LINKS = [
  { name: "Home", href: "/" },
  { name: "Globe", href: "/globe" },
  { name: "Sky", href: "/sky" },
  { name: "Dashboard", href: "/dashboard" },
  { name: "Challenge", href: "/dashboard/challenge" },
];

export function NavBar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[100] h-[var(--nav-height,64px)] pointer-events-none mt-4 px-4">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between glass-panel pointer-events-auto px-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 hover-scale rounded-full py-2 transition-all">
            <span className="block h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_12px_2px_rgba(56,167,255,0.7)] animate-pulse" />
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-slate-200">
              Project Zenith
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`relative px-4 py-2 text-xs font-mono uppercase tracking-widest transition-colors hover-scale ${
                    isActive ? "text-sky-300" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {link.name}
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]"
                      initial={false}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-full hover-scale text-slate-300 transition-colors hover:text-white md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileMenuOpen ? (
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-4 top-[80px] z-[90] glass-panel p-4 shadow-2xl md:hidden"
          >
            <nav className="flex flex-col gap-2">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`rounded-xl px-4 py-3 text-sm font-mono uppercase tracking-widest transition-colors hover-scale ${
                      isActive ? "bg-sky-500/10 text-sky-300" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
