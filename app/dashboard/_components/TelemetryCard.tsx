"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface TelemetryCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  loading?: boolean;
  className?: string;
  delay?: number;
  lastUpdated?: string;
  error?: string | null;
}

export function TelemetryCard({ title, icon, children, loading, className = "", delay = 0, lastUpdated, error }: TelemetryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`glass-panel flex flex-col p-6 hover-scale ${className}`}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between border-b border-white/5 pb-4">
        {icon && <div className="text-sky-400">{icon}</div>}
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
          {title}
        </h3>
      </div>

      {/* Content or Skeleton */}
      <div className="relative min-h-[100px]">
        {loading ? (
          <div className="absolute inset-0 flex flex-col gap-3">
            <div className="h-4 w-3/4 animate-pulse rounded bg-white/5" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-white/5" />
            <div className="h-4 w-full animate-pulse rounded bg-white/5" />
          </div>
        ) : error ? (
          <p className="font-mono text-xs text-amber-400">{error}</p>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {children}
          </motion.div>
        )}
      </div>
      {lastUpdated && (
        <p className="text-xs text-gray-500 mt-2 font-mono">Last updated: {lastUpdated}</p>
      )}
    </motion.div>
  );
}
