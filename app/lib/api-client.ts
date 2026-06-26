"use client";

import { useSyncExternalStore } from "react";

type SetState<T> = (partial: Partial<T> | ((state: T) => Partial<T>)) => void;

function createStore<T extends object>(initializer: (set: SetState<T>, get: () => T) => T) {
  let state: T;
  const listeners = new Set<() => void>();

  const get = () => state;
  const set: SetState<T> = (partial) => {
    const patch = typeof partial === "function" ? partial(state) : partial;
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };

  state = initializer(set, get);

  function useStore(): T;
  function useStore<S>(selector: (s: T) => S): S;
  function useStore<S>(selector?: (s: T) => S): T | S {
    return useSyncExternalStore(
      (cb) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      () => (selector ? selector(state) : state),
      () => (selector ? selector(state) : state)
    );
  }

  return { useStore, getState: get, setState: set };
}

interface LocationState {
  latitude: number;
  longitude: number;
  locationName: string;
  setLocation: (lat: number, lng: number, name?: string) => void;
  searchAndSetLocation: (query: string) => Promise<{ success: boolean; error?: string }>;
}

const DEFAULT_LAT = 19.076;
const DEFAULT_LNG = 72.8777;
const DEFAULT_NAME = "Mumbai";

const locationStore = createStore<LocationState>((set) => ({
  latitude: DEFAULT_LAT,
  longitude: DEFAULT_LNG,
  locationName: DEFAULT_NAME,

  setLocation: (lat, lng, name) => {
    set({
      latitude: lat,
      longitude: lng,
      locationName: name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    });
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          "zenith-location",
          JSON.stringify({ lat, lng, name: name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}` })
        );
      } catch {
        /* ignore storage errors */
      }
    }
  },

  searchAndSetLocation: async (query) => {
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, error: err.error ?? "Location not found" };
      }
      const data = await res.json();
      const name = data.displayName.split(",")[0];
      set({
        latitude: data.lat,
        longitude: data.lng,
        locationName: name,
      });
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            "zenith-location",
            JSON.stringify({ lat: data.lat, lng: data.lng, name })
          );
        } catch {
          /* ignore */
        }
      }
      return { success: true };
    } catch {
      return { success: false, error: "Geocoding service unavailable" };
    }
  },
}));

export const useLocationStore = locationStore.useStore;
export const getLocationState = locationStore.getState;

/** Hydrate store from localStorage on client mount */
export function hydrateLocationStore() {
  if (typeof window === "undefined") return;
  try {
    const saved = localStorage.getItem("zenith-location");
    if (saved) {
      const { lat, lng, name } = JSON.parse(saved);
      if (typeof lat === "number" && typeof lng === "number") {
        locationStore.setState({
          latitude: lat,
          longitude: lng,
          locationName: name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        });
      }
    }
  } catch {
    /* ignore */
  }
}
