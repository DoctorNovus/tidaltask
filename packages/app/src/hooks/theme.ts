/* ─── Semantic surface variables ─── */
export interface SemanticVars {
  background: string;
  card: string;
  raised: string;
  border: string;
  navBorder: string;
  text: string;
  mutedText: string;
}

/* ─── Accent shade scale ─── */
export interface AccentShades {
  shade50: string; shade100: string; shade200: string; shade300: string; shade400: string;
  shade500: string; shade600: string; shade700: string; shade800: string; shade900: string;
  shade950: string;
}

/* ─── Agenda capsule colours (one base hex per slot) ─── */
export interface CapsuleColors {
  today: string;
  tomorrow: string;
  week: string;
  overdue: string;
}

const DEFAULT_CAPSULES: CapsuleColors = {
  today:    "#3b82f6",
  tomorrow: "#f59e0b",
  week:     "#8b5cf6",
  overdue:  "#ef4444",
};

const PRIDE_CAPSULES: CapsuleColors = {
  today:    "#ef4444",  // red
  tomorrow: "#eab308",  // yellow
  week:     "#22c55e",  // green
  overdue:  "#a855f7",  // purple
};

/* ─── Preset theme ─── */
export interface ColorThemePreset {
  id: string;
  name: string;
  accent: string;
  shades: AccentShades;
  light: SemanticVars;
  dark: SemanticVars;
  capsules: CapsuleColors;
  special?: "pride";
}

/* ─── Custom theme — flat, all-optional overrides ─── */
export type ColorThemeConfig =
  | { type: "preset"; id: string }
  | {
      type: "custom";
      accent: string;
      // light mode overrides
      lightBg?: string;
      lightCard?: string;
      lightBorder?: string;
      lightText?: string;
      lightMuted?: string;
      // dark mode overrides
      darkBg?: string;
      darkCard?: string;
      darkRaised?: string;
      darkBorder?: string;
      darkText?: string;
      darkMuted?: string;
      // capsule colour overrides
      capsuleToday?: string;
      capsuleTomorrow?: string;
      capsuleWeek?: string;
      capsuleOverdue?: string;
    };

/* ─── Defaults (matches index.css :root / .dark) ─── */
const LIGHT_DEFAULTS: SemanticVars = {
  background: "#f5f5f5",
  card: "rgba(255,255,255,0.97)",
  raised: "#ffffff",
  border: "#e6e6e6",
  navBorder: "rgba(255,255,255,0.7)",
  text: "#0f172a",
  mutedText: "#727272",
};

const DARK_DEFAULTS: SemanticVars = {
  background: "#111319",
  card: "#1a1d26",
  raised: "#222630",
  border: "#2d3244",
  navBorder: "#22263a",
  text: "#e2e5ee",
  mutedText: "#52586e",
};

/* ─── Presets ─── */
export const COLOR_THEME_PRESETS: ColorThemePreset[] = [
  {
    id: "ocean", name: "Ocean",
    accent: "#307acf",
    shades: {
      shade50: "#f0f9fe", shade100: "#def0fb", shade200: "#c5e6f8",
      shade300: "#9dd7f3", shade400: "#6ec0ec", shade500: "#4ca5e5",
      shade600: "#378bd9", shade700: "#307acf", shade800: "#2b5fa2",
      shade900: "#285180", shade950: "#1d324e",
    },
    light: LIGHT_DEFAULTS,
    dark: DARK_DEFAULTS,
    capsules: DEFAULT_CAPSULES,
  },
  {
    id: "pride", name: "Pride",
    accent: "#d946ef",
    shades: {
      shade50: "#fdf4ff", shade100: "#fae8ff", shade200: "#f5d0fe",
      shade300: "#f0abfc", shade400: "#e879f9", shade500: "#d946ef",
      shade600: "#c026d3", shade700: "#a21caf", shade800: "#86198f",
      shade900: "#701a75", shade950: "#4a044e",
    },
    light: {
      ...LIGHT_DEFAULTS,
      background: "#fdf4ff",
      border: "#f5d0fe",
      navBorder: "rgba(255,255,255,0.8)",
    },
    dark: {
      ...DARK_DEFAULTS,
      background: "#160d1a",
      card: "#1e1026",
      raised: "#271630",
      border: "#3a1e4a",
      navBorder: "#2d1840",
    },
    capsules: PRIDE_CAPSULES,
    special: "pride",
  },
  {
    id: "forest", name: "Forest",
    accent: "#16a34a",
    shades: {
      shade50: "#f0fdf4", shade100: "#dcfce7", shade200: "#bbf7d0",
      shade300: "#86efac", shade400: "#4ade80", shade500: "#22c55e",
      shade600: "#16a34a", shade700: "#15803d", shade800: "#166534",
      shade900: "#14532d", shade950: "#052e16",
    },
    light: {
      ...LIGHT_DEFAULTS,
      background: "#f0fdf4",
      border: "#bbf7d0",
      navBorder: "rgba(255,255,255,0.75)",
    },
    dark: {
      ...DARK_DEFAULTS,
      background: "#0a150e",
      card: "#0d1f12",
      raised: "#132016",
      border: "#1c3224",
      navBorder: "#182b1e",
    },
    capsules: DEFAULT_CAPSULES,
  },
  {
    id: "sunset", name: "Sunset",
    accent: "#ea6c10",
    shades: {
      shade50: "#fff7ed", shade100: "#ffedd5", shade200: "#fed7aa",
      shade300: "#fdba74", shade400: "#fb923c", shade500: "#f97316",
      shade600: "#ea6c10", shade700: "#c2410c", shade800: "#9a3412",
      shade900: "#7c2d12", shade950: "#431407",
    },
    light: {
      ...LIGHT_DEFAULTS,
      background: "#fff7ed",
      border: "#fed7aa",
      navBorder: "rgba(255,255,255,0.8)",
    },
    dark: {
      ...DARK_DEFAULTS,
      background: "#180d04",
      card: "#231305",
      raised: "#2e1a07",
      border: "#45280c",
      navBorder: "#3a2008",
    },
    capsules: DEFAULT_CAPSULES,
  },
  {
    id: "rose", name: "Rose",
    accent: "#db2777",
    shades: {
      shade50: "#fdf2f8", shade100: "#fce7f3", shade200: "#fbcfe8",
      shade300: "#f9a8d4", shade400: "#f472b6", shade500: "#ec4899",
      shade600: "#db2777", shade700: "#be185d", shade800: "#9d174d",
      shade900: "#831843", shade950: "#500724",
    },
    light: {
      ...LIGHT_DEFAULTS,
      background: "#fdf2f8",
      border: "#fbcfe8",
    },
    dark: {
      ...DARK_DEFAULTS,
      background: "#180a12",
      card: "#22101c",
      raised: "#2e1626",
      border: "#3f1f35",
      navBorder: "#34192c",
    },
    capsules: DEFAULT_CAPSULES,
  },
  {
    id: "midnight", name: "Midnight",
    accent: "#7c3aed",
    shades: {
      shade50: "#f5f3ff", shade100: "#ede9fe", shade200: "#ddd6fe",
      shade300: "#c4b5fd", shade400: "#a78bfa", shade500: "#8b5cf6",
      shade600: "#7c3aed", shade700: "#6d28d9", shade800: "#5b21b6",
      shade900: "#4c1d95", shade950: "#2e1065",
    },
    light: {
      ...LIGHT_DEFAULTS,
      background: "#f5f3ff",
      border: "#ddd6fe",
    },
    dark: {
      ...DARK_DEFAULTS,
      background: "#0e0c1a",
      card: "#141229",
      raised: "#1c1938",
      border: "#2d2860",
      navBorder: "#231f50",
    },
    capsules: DEFAULT_CAPSULES,
  },
];

/* ─── Storage ─── */
const STORAGE_KEY = "tidaltask-color-theme";

export function getColorThemeConfig(): ColorThemeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.type === "preset" || parsed?.type === "custom") return parsed;
    }
  } catch {}
  return { type: "preset", id: "ocean" };
}

export function saveColorThemeConfig(config: ColorThemeConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/* ─── Colour math helpers ─── */
export function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

export function hslToHex(h: number, s: number, l: number): string {
  h /= 360; s /= 100; l /= 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

export function computeShadesFromHex(accent: string): AccentShades {
  const [h, s] = hexToHsl(accent);
  const sat = Math.min(s, 95);
  return {
    shade50:  hslToHex(h, Math.min(sat * 0.35, 95), 97),
    shade100: hslToHex(h, Math.min(sat * 0.45, 90), 94),
    shade200: hslToHex(h, Math.min(sat * 0.55, 85), 88),
    shade300: hslToHex(h, Math.min(sat * 0.65, 82), 78),
    shade400: hslToHex(h, Math.min(sat * 0.80, 80), 67),
    shade500: hslToHex(h, sat, 57),
    shade600: hslToHex(h, sat, 48),
    shade700: hslToHex(h, sat, 40),
    shade800: hslToHex(h, sat, 31),
    shade900: hslToHex(h, sat, 23),
    shade950: hslToHex(h, Math.min(sat * 0.75, 80), 13),
  };
}

/* Derives subtle tinted backgrounds from any accent colour */
export function computeSemanticFromAccent(accent: string): { light: SemanticVars; dark: SemanticVars } {
  const [h, s] = hexToHsl(accent);
  const tint = Math.min(s * 0.3, 25);
  return {
    light: {
      ...LIGHT_DEFAULTS,
      background: hslToHex(h, Math.min(tint, 18), 96),
      border: hslToHex(h, Math.min(tint * 2, 40), 88),
    },
    dark: {
      ...DARK_DEFAULTS,
      background: hslToHex(h, Math.min(tint * 2.5, 28), 8),
      card:        hslToHex(h, Math.min(tint * 2, 24), 11),
      raised:      hslToHex(h, Math.min(tint * 1.8, 20), 14),
      border:      hslToHex(h, Math.min(tint * 3, 32), 20),
      navBorder:   hslToHex(h, Math.min(tint * 2, 24), 16),
    },
  };
}

/* Builds light+dark CSS variable strings for one capsule slot */
function capsuleSlotCss(name: string, hex: string): [string, string] {
  const [r, g, b] = hexToRgb(hex);
  const [h, s] = hexToHsl(hex);
  const sat = Math.min(s, 90);
  const lightVars = [
    `--capsule-${name}-bg:rgba(${r},${g},${b},0.09)`,
    `--capsule-${name}-text:${hslToHex(h, sat, 26)}`,
    `--capsule-${name}-muted:${hslToHex(h, sat, 36)}`,
  ].join(";");
  const darkVars = [
    `--capsule-${name}-bg:rgba(${r},${g},${b},0.15)`,
    `--capsule-${name}-text:${hslToHex(h, sat, 73)}`,
    `--capsule-${name}-muted:${hslToHex(h, sat, 64)}`,
  ].join(";");
  return [lightVars, darkVars];
}

/* ─── CSS injection ─── */
const ACCENT_INLINE_PROPS = [
  "--color-accent-blue", "--color-accent-blue-50", "--color-accent-blue-100",
  "--color-accent-blue-200", "--color-accent-blue-300", "--color-accent-blue-400",
  "--color-accent-blue-500", "--color-accent-blue-600", "--color-accent-blue-700",
  "--color-accent-blue-800", "--color-accent-blue-900", "--color-accent-blue-950",
];

function semanticCss(v: SemanticVars) {
  return [
    `--app-background:${v.background}`,
    `--surface-card:${v.card}`,
    `--surface-raised:${v.raised}`,
    `--surface-border:${v.border}`,
    `--nav-border:${v.navBorder}`,
    `--app-text:${v.text}`,
    `--muted-text:${v.mutedText}`,
  ].join(";");
}

function accentCss(accent: string, shades: AccentShades) {
  return [
    `--color-accent-blue:${accent}`,
    `--color-accent-blue-50:${shades.shade50}`,
    `--color-accent-blue-100:${shades.shade100}`,
    `--color-accent-blue-200:${shades.shade200}`,
    `--color-accent-blue-300:${shades.shade300}`,
    `--color-accent-blue-400:${shades.shade400}`,
    `--color-accent-blue-500:${shades.shade500}`,
    `--color-accent-blue-600:${shades.shade600}`,
    `--color-accent-blue-700:${shades.shade700}`,
    `--color-accent-blue-800:${shades.shade800}`,
    `--color-accent-blue-900:${shades.shade900}`,
    `--color-accent-blue-950:${shades.shade950}`,
  ].join(";");
}

export function applyColorTheme(config: ColorThemeConfig) {
  const el = document.documentElement;
  el.removeAttribute("data-color-theme");

  // Clear any accent vars that may have been set via the old element.style approach
  for (const prop of ACCENT_INLINE_PROPS) el.style.removeProperty(prop);

  let accent: string;
  let shades: AccentShades;
  let light: SemanticVars;
  let dark: SemanticVars;
  let capsules: CapsuleColors;
  let special: string | undefined;

  if (config.type === "preset") {
    const preset = COLOR_THEME_PRESETS.find(p => p.id === config.id) ?? COLOR_THEME_PRESETS[0];
    accent = preset.accent;
    shades = preset.shades;
    light = preset.light;
    dark = preset.dark;
    capsules = preset.capsules;
    special = preset.special;
  } else {
    accent = config.accent;
    shades = computeShadesFromHex(accent);
    const computed = computeSemanticFromAccent(accent);
    light = {
      ...computed.light,
      ...(config.lightBg     && { background: config.lightBg }),
      ...(config.lightCard   && { card:        config.lightCard }),
      ...(config.lightBorder && { border:      config.lightBorder }),
      ...(config.lightText   && { text:        config.lightText }),
      ...(config.lightMuted  && { mutedText:   config.lightMuted }),
    };
    dark = {
      ...computed.dark,
      ...(config.darkBg     && { background: config.darkBg }),
      ...(config.darkCard   && { card:        config.darkCard }),
      ...(config.darkRaised && { raised:      config.darkRaised }),
      ...(config.darkBorder && { border:      config.darkBorder }),
      ...(config.darkText   && { text:        config.darkText }),
      ...(config.darkMuted  && { mutedText:   config.darkMuted }),
    };
    capsules = {
      today:    config.capsuleToday    ?? DEFAULT_CAPSULES.today,
      tomorrow: config.capsuleTomorrow ?? DEFAULT_CAPSULES.tomorrow,
      week:     config.capsuleWeek     ?? DEFAULT_CAPSULES.week,
      overdue:  config.capsuleOverdue  ?? DEFAULT_CAPSULES.overdue,
    };
  }

  // Build capsule CSS vars
  const [todayL, todayD]       = capsuleSlotCss("today", capsules.today);
  const [tomorrowL, tomorrowD] = capsuleSlotCss("tomorrow", capsules.tomorrow);
  const [weekL, weekD]         = capsuleSlotCss("week", capsules.week);
  const [overdueL, overdueD]   = capsuleSlotCss("overdue", capsules.overdue);
  const capsuleLight = [todayL, tomorrowL, weekL, overdueL].join(";");
  const capsuleDark  = [todayD, tomorrowD, weekD, overdueD].join(";");

  const acc = accentCss(accent, shades);
  const darkAccentExtra = `--accent:${accent};--accent-hover:${shades.shade700};`;

  let styleEl = document.getElementById("tidaltask-theme-override") as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "tidaltask-theme-override";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent =
    `:root{${acc};${semanticCss(light)};${capsuleLight}}` +
    `.dark{${acc};${semanticCss(dark)};${darkAccentExtra};${capsuleDark}}`;

  if (special) el.setAttribute("data-color-theme", special);
}
