"use client";

import { useState, useEffect } from "react";

export function useLiveTimestamp(intervalMs = 5000): string {
  const [lastUpdated, setLastUpdated] = useState(() => formatUtc());

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(formatUtc());
    }, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  return lastUpdated;
}

function formatUtc(): string {
  return (
    new Date().toLocaleTimeString("en-US", {
      hour12: false,
      timeZone: "UTC",
    }) + " UTC"
  );
}
