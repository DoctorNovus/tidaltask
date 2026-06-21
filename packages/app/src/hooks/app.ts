import { createContext, useContext, useReducer } from "react";
import { Logger } from "@/utils/logger";

import { Task } from "./tasks";


// Allow docker / hosted environments to inject an API base URL at build time.
export const SERVER_IP = import.meta.env.DEV ? `http://localhost:8080` : `https://api.tidaltask.app`;

Logger.log(`Running in ${import.meta.env.DEV ? "Development" : "Production"} mode.`);

// TODO: remove tempActiveDate.
type ThemeChoice = "light" | "dark" | "auto";

export const FONT_SCALE_OPTIONS = [
  { id: "sm", label: "Small",    zoom: 0.875 },
  { id: "md", label: "Default",  zoom: 1     },
  { id: "lg", label: "Large",    zoom: 1.125 },
  { id: "xl", label: "X-Large",  zoom: 1.25  },
] as const;

export type FontScaleId = typeof FONT_SCALE_OPTIONS[number]["id"];

export function applyFontScale(id: FontScaleId) {
  const opt = FONT_SCALE_OPTIONS.find(o => o.id === id) ?? FONT_SCALE_OPTIONS[1];
  const el = document.getElementById("zoom-content");
  if (!el) return;
  el.style.zoom = opt.zoom === 1 ? "" : String(opt.zoom);
}

export interface AppOptions {
  storedDate?: Date;
  activeDate?: Date;
  tempActiveDate?: Date;
  activeTask?: Task;
  activeTags?: string[];

  theme?: ThemeChoice;
  fontScale?: FontScaleId;

  authorized: boolean;
}

const initialData: AppOptions = {
  storedDate: undefined,
  activeDate: new Date(),
  tempActiveDate: undefined,
  activeTask: undefined,
  activeTags: [],

  theme: "auto",
  fontScale: "md",
  authorized: false
};

const reducer = (data: AppOptions, payload: Partial<AppOptions>): AppOptions => ({ ...data, ...payload });

export function useAppReducer(): [AppOptions, React.Dispatch<Partial<AppOptions>>] {
  const initializer = () => {
    let theme = initialData.theme;
    let fontScale = initialData.fontScale;

    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("tidaltask-theme")
        ?? window.localStorage.getItem("sequenced-theme");
      if (stored === "light" || stored === "dark" || stored === "auto") {
        theme = stored;
      } else {
        const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
        theme = prefersDark ? "dark" : "light";
      }

      const storedScale = window.localStorage.getItem("tidaltask-font-scale") as FontScaleId | null;
      if (storedScale && FONT_SCALE_OPTIONS.some(o => o.id === storedScale)) {
        fontScale = storedScale;
      }
    }

    return { ...initialData, theme, fontScale };
  };

  return useReducer(reducer, initialData, initializer);
}

export const AppContext = createContext<[AppOptions, React.Dispatch<Partial<AppOptions>>] | null>(null);

export function useApp(): [AppOptions, React.Dispatch<Partial<AppOptions>>] {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("AppContext must have it's provider initialized before useApp() is called.");
  }

  return context;
}
