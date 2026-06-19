import { useState } from "react";
import {
  COLOR_THEME_PRESETS,
  ColorThemeConfig,
  CapsuleColors,
  applyColorTheme,
  getColorThemeConfig,
  saveColorThemeConfig,
  computeSemanticFromAccent,
} from "@/hooks/theme";

const DEFAULT_CAPSULES: CapsuleColors = {
  today: "#3b82f6",
  tomorrow: "#f59e0b",
  week: "#8b5cf6",
  overdue: "#ef4444",
};

type CustomFields = Exclude<ColorThemeConfig, { type: "preset" }>;

function toCustomFields(config: ColorThemeConfig, accent: string): CustomFields {
  if (config.type === "custom") return config;
  const { light, dark } = computeSemanticFromAccent(accent);
  return {
    type: "custom", accent,
    lightBg: light.background, lightCard: light.card, lightBorder: light.border,
    lightText: light.text, lightMuted: light.mutedText,
    darkBg: dark.background, darkCard: dark.card, darkRaised: dark.raised,
    darkBorder: dark.border, darkText: dark.text, darkMuted: dark.mutedText,
  };
}

function activeCapsules(config: ColorThemeConfig): CapsuleColors {
  if (config.type === "preset") {
    return COLOR_THEME_PRESETS.find(p => p.id === config.id)?.capsules ?? DEFAULT_CAPSULES;
  }
  return {
    today:    config.capsuleToday    ?? DEFAULT_CAPSULES.today,
    tomorrow: config.capsuleTomorrow ?? DEFAULT_CAPSULES.tomorrow,
    week:     config.capsuleWeek     ?? DEFAULT_CAPSULES.week,
    overdue:  config.capsuleOverdue  ?? DEFAULT_CAPSULES.overdue,
  };
}

function ColorRow({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  const isComplex = value.startsWith("rgba") || value.startsWith("rgb");
  const displayVal = isComplex ? value : value;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-primary w-32 shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <div className="relative h-8 w-10 shrink-0">
          <div
            className="absolute inset-0 rounded-md border border-(--surface-border)"
            style={{ background: value }}
          />
          {!isComplex && (
            <input
              type="color"
              value={value.startsWith("#") ? value : "#888888"}
              onChange={(e) => onChange(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              title={`Change ${label}`}
            />
          )}
        </div>
        <input
          type="text"
          value={displayVal}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-(--surface-border) bg-silver-200 dark:bg-(--surface-raised) px-2 py-1.5 text-xs font-mono text-primary focus:border-accent-blue focus:outline-hidden"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

export default function ThemeSettings() {
  const [config, setConfig] = useState<ColorThemeConfig>(getColorThemeConfig);
  const [customTab, setCustomTab] = useState<"light" | "dark">("light");

  const apply = (next: ColorThemeConfig) => {
    setConfig(next);
    saveColorThemeConfig(next);
    applyColorTheme(next);
  };

  const selectPreset = (id: string) => apply({ type: "preset", id });

  const updateCustom = (patch: Partial<CustomFields>) => {
    const base = config.type === "custom" ? config : toCustomFields(config, COLOR_THEME_PRESETS[0].accent);
    apply({ ...base, ...patch } as ColorThemeConfig);
  };

  const resetToCustomDefaults = () => {
    const accent = config.type === "custom" ? config.accent : "#307acf";
    apply(toCustomFields({ type: "preset", id: "" }, accent));
  };

  const custom = config.type === "custom" ? config : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Presets */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted">Presets</span>
        <div className="flex flex-wrap gap-2">
          {COLOR_THEME_PRESETS.map((preset) => {
            const isActive = config.type === "preset" && config.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => selectPreset(preset.id)}
                className={`flex flex-col items-center gap-1.5 rounded-xl p-2.5 border-2 transition hover:-translate-y-px ${
                  isActive
                    ? "border-current shadow-sm bg-silver-200 dark:bg-(--surface-raised)"
                    : "border-transparent hover:bg-silver-200 dark:hover:bg-(--surface-raised)"
                }`}
                style={{ color: preset.accent }}
                title={preset.name}
              >
                {/* mini two-tone preview: top half = light bg, bottom half = dark bg */}
                <div
                  className="h-9 w-9 rounded-full shadow-sm overflow-hidden flex flex-col"
                  style={{ border: `2px solid ${preset.accent}` }}
                >
                  <div className="flex-1" style={{ background: preset.light.background }} />
                  <div className="flex-1 flex items-center justify-center" style={{ background: preset.dark.background }}>
                    {preset.special === "pride" ? (
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ background: "linear-gradient(135deg,#f87171,#fbbf24,#4ade80,#818cf8,#f472b6)" }}
                      />
                    ) : (
                      <div className="h-2 w-2 rounded-full" style={{ background: preset.accent }} />
                    )}
                  </div>
                </div>
                <span className="text-xs font-semibold text-primary">{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted">Custom</span>
          {config.type === "custom" && (
            <button
              type="button"
              onClick={resetToCustomDefaults}
              className="text-xs text-muted hover:text-primary transition"
            >
              Reset to defaults
            </button>
          )}
        </div>

        {/* Accent — shared */}
        <div className="rounded-xl bg-silver-200 dark:bg-(--surface-raised) px-3 py-3 flex flex-col gap-3">
          <ColorRow
            label="Accent (buttons)"
            value={custom?.accent ?? COLOR_THEME_PRESETS[0].accent}
            onChange={(v) => {
              const base = custom ?? toCustomFields(config, v);
              updateCustom({ ...base, accent: v });
            }}
          />
        </div>

        {/* Light / Dark tabs */}
        <div className="rounded-xl bg-silver-200 dark:bg-(--surface-raised) overflow-hidden">
          <div className="flex border-b border-(--surface-border)">
            {(["light", "dark"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setCustomTab(tab)}
                className={`flex-1 py-2 text-xs font-semibold capitalize transition ${
                  customTab === tab
                    ? "bg-accent-blue text-white"
                    : "text-muted hover:text-primary"
                }`}
              >
                {tab === "light" ? "☀️ Light mode" : "🌙 Dark mode"}
              </button>
            ))}
          </div>

          <div className="p-3 flex flex-col gap-2.5">
            {customTab === "light" ? (
              <>
                <ColorRow
                  label="Background"
                  value={custom?.lightBg ?? computeSemanticFromAccent(custom?.accent ?? "#307acf").light.background}
                  onChange={(v) => updateCustom({ ...(custom ?? toCustomFields(config, "#307acf")), lightBg: v })}
                />
                <ColorRow
                  label="Card / Tile"
                  value={custom?.lightCard ?? "rgba(255,255,255,0.97)"}
                  onChange={(v) => updateCustom({ ...(custom ?? toCustomFields(config, "#307acf")), lightCard: v })}
                />
                <ColorRow
                  label="Border"
                  value={custom?.lightBorder ?? computeSemanticFromAccent(custom?.accent ?? "#307acf").light.border}
                  onChange={(v) => updateCustom({ ...(custom ?? toCustomFields(config, "#307acf")), lightBorder: v })}
                />
                <ColorRow
                  label="Text"
                  value={custom?.lightText ?? "#0f172a"}
                  onChange={(v) => updateCustom({ ...(custom ?? toCustomFields(config, "#307acf")), lightText: v })}
                />
                <ColorRow
                  label="Muted text"
                  value={custom?.lightMuted ?? "#727272"}
                  onChange={(v) => updateCustom({ ...(custom ?? toCustomFields(config, "#307acf")), lightMuted: v })}
                />
              </>
            ) : (
              <>
                <ColorRow
                  label="Background"
                  value={custom?.darkBg ?? computeSemanticFromAccent(custom?.accent ?? "#307acf").dark.background}
                  onChange={(v) => updateCustom({ ...(custom ?? toCustomFields(config, "#307acf")), darkBg: v })}
                />
                <ColorRow
                  label="Card / Tile"
                  value={custom?.darkCard ?? computeSemanticFromAccent(custom?.accent ?? "#307acf").dark.card}
                  onChange={(v) => updateCustom({ ...(custom ?? toCustomFields(config, "#307acf")), darkCard: v })}
                />
                <ColorRow
                  label="Raised surface"
                  value={custom?.darkRaised ?? computeSemanticFromAccent(custom?.accent ?? "#307acf").dark.raised}
                  onChange={(v) => updateCustom({ ...(custom ?? toCustomFields(config, "#307acf")), darkRaised: v })}
                />
                <ColorRow
                  label="Border"
                  value={custom?.darkBorder ?? computeSemanticFromAccent(custom?.accent ?? "#307acf").dark.border}
                  onChange={(v) => updateCustom({ ...(custom ?? toCustomFields(config, "#307acf")), darkBorder: v })}
                />
                <ColorRow
                  label="Text"
                  value={custom?.darkText ?? "#e2e5ee"}
                  onChange={(v) => updateCustom({ ...(custom ?? toCustomFields(config, "#307acf")), darkText: v })}
                />
                <ColorRow
                  label="Muted text"
                  value={custom?.darkMuted ?? "#52586e"}
                  onChange={(v) => updateCustom({ ...(custom ?? toCustomFields(config, "#307acf")), darkMuted: v })}
                />
              </>
            )}
          </div>
        </div>

        <span className="text-xs text-muted">
          Changes apply live. Click a color swatch or type any CSS color value.
        </span>
      </div>

      {/* Dashboard card colours */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted">Dashboard Cards</span>
        <div className="rounded-xl bg-silver-200 dark:bg-(--surface-raised) p-3 flex flex-col gap-2.5">
          {(
            [
              { key: "capsuleToday",    label: "Today",     fallbackKey: "today" },
              { key: "capsuleTomorrow", label: "Tomorrow",  fallbackKey: "tomorrow" },
              { key: "capsuleWeek",     label: "This Week", fallbackKey: "week" },
              { key: "capsuleOverdue",  label: "Overdue",   fallbackKey: "overdue" },
            ] as const
          ).map(({ key, label, fallbackKey }) => {
            const caps = activeCapsules(config);
            return (
              <ColorRow
                key={key}
                label={label}
                value={config.type === "custom" ? (config[key] ?? caps[fallbackKey]) : caps[fallbackKey]}
                onChange={(v) => {
                  const base = custom ?? toCustomFields(config, config.type === "custom" ? config.accent : COLOR_THEME_PRESETS.find(p => p.id === (config as any).id)?.accent ?? "#307acf");
                  updateCustom({ ...base, [key]: v });
                }}
              />
            );
          })}
        </div>
        <span className="text-xs text-muted">
          Overdue-clear (no overdue tasks) is always green regardless of theme.
        </span>
      </div>
    </div>
  );
}
