"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { StrategyDescriptions, StrategyTypeLabels } from "./translations";
import { API_URL } from "./api-client";

type StrategyData = {
  code: string;
  name: string;
  type: string;
  description: string;
  applies: string[];
  goal: string;
  duration: string;
  tactics: string[];
};

type Overrides = Record<string, Partial<StrategyData>>;

interface StrategyContextValue {
  getStrategy: (key: string) => StrategyData;
  getLabel: (key: string) => string;
  overrides: Overrides;
  loaded: boolean;
}

const StrategyContext = createContext<StrategyContextValue>({
  getStrategy: (key) => StrategyDescriptions[key],
  getLabel: (key) => StrategyTypeLabels[key] || key,
  overrides: {},
  loaded: false,
});

export function StrategyProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Overrides>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { setLoaded(true); return; }

    // Only admins can access /admin/settings
    try {
      const userData = localStorage.getItem("user");
      if (userData) {
        const user = JSON.parse(userData);
        if (user.role !== "ADMIN") { setLoaded(true); return; }
      }
    } catch {}

    fetch(`${API_URL}/admin/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((settings: { key: string; value: string }[]) => {
        const found = settings.find((s) => s.key === "strategy_overrides");
        if (found) {
          try { setOverrides(JSON.parse(found.value)); } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const getStrategy = (key: string): StrategyData => {
    const base = StrategyDescriptions[key];
    if (!base) return { code: key, name: key, type: "", description: "", applies: [], goal: "", duration: "", tactics: [] };
    const ov = overrides[key];
    if (!ov) return base;
    return { ...base, ...ov, applies: ov.applies ?? base.applies, tactics: ov.tactics ?? base.tactics };
  };

  const getLabel = (key: string): string => {
    const ov = overrides[key];
    if (ov?.name) {
      const base = StrategyDescriptions[key];
      return `${base?.code || key} ${ov.name}`;
    }
    return StrategyTypeLabels[key] || key;
  };

  return (
    <StrategyContext.Provider value={{ getStrategy, getLabel, overrides, loaded }}>
      {children}
    </StrategyContext.Provider>
  );
}

export function useStrategy() {
  return useContext(StrategyContext);
}
