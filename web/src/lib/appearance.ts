export type AppearanceTheme = "system" | "light" | "dark";

export type AppearanceSkin =
  | "minimal"
  | "trae"
  | "golden"
  | "google"
  | "doubao"
  | "claude"
  | "apple"
  | "21th";

export type AppearanceSettings = {
  skin: AppearanceSkin;
  theme: AppearanceTheme;
  onboarded: boolean;
};

export type SkinThemePolicy = {
  modes: AppearanceTheme[];
  preferred: AppearanceTheme;
};

export const APPEARANCE_KEY = "aigw.appearance.v2";
export const APPEARANCE_KEY_LEGACY = "aigw.appearance.v1";

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  skin: "minimal",
  theme: "dark",
  onboarded: false,
};

/** Per-skin allowed theme modes. Light-only skins force light. */
export const SKIN_THEME_POLICY: Record<AppearanceSkin, SkinThemePolicy> = {
  minimal: { modes: ["system", "light", "dark"], preferred: "dark" },
  trae: { modes: ["system", "light", "dark"], preferred: "dark" },
  golden: { modes: ["light"], preferred: "light" },
  google: { modes: ["light"], preferred: "light" },
  doubao: { modes: ["light"], preferred: "light" },
  claude: { modes: ["light"], preferred: "light" },
  apple: { modes: ["light"], preferred: "light" },
  "21th": { modes: ["system", "light", "dark"], preferred: "dark" },
};

export const SKIN_OPTIONS: Array<{
  id: AppearanceSkin;
  label: string;
  swatch: string;
  blurb: string;
}> = [
  { id: "minimal", label: "Minimal", swatch: "linear-gradient(135deg,#0a0a0a,#fafafa)", blurb: "极简黑白默认" },
  { id: "trae", label: "TRAE", swatch: "linear-gradient(135deg,#1A1B1D,#32F08C)", blurb: "IDE 小圆角芯片" },
  { id: "golden", label: "Golden Time", swatch: "linear-gradient(135deg,#1a1008,#e8dcc8)", blurb: "衬线暖金胶囊" },
  { id: "google", label: "Google", swatch: "linear-gradient(135deg,#161616,#4285f4)", blurb: "Material 胶囊蓝" },
  { id: "doubao", label: "Doubao", swatch: "linear-gradient(135deg,#eff1f4,#0065fd)", blurb: "浅灰侧栏白底选中" },
  { id: "claude", label: "Claude", swatch: "linear-gradient(135deg,#faf9f5,#c96442)", blurb: "书卷陶土圆角" },
  { id: "apple", label: "Apple", swatch: "linear-gradient(135deg,#f5f5f7,#007aff)", blurb: "毛玻璃大圆角" },
  { id: "21th", label: "21th", swatch: "linear-gradient(135deg,#0a0a0a,#0040ff)", blurb: "直角硬阴影电蓝" },
];

const SKIN_SET = new Set(SKIN_OPTIONS.map((s) => s.id));

function isSkin(v: unknown): v is AppearanceSkin {
  return typeof v === "string" && SKIN_SET.has(v as AppearanceSkin);
}

function isTheme(v: unknown): v is AppearanceTheme {
  return v === "system" || v === "light" || v === "dark";
}

export function getSkinThemePolicy(skin: AppearanceSkin): SkinThemePolicy {
  return SKIN_THEME_POLICY[skin] ?? SKIN_THEME_POLICY.minimal;
}

/** Clamp theme to what the skin allows (e.g. Doubao → light only). */
export function coerceAppearance(settings: AppearanceSettings): AppearanceSettings {
  const skin = isSkin(settings.skin) ? settings.skin : DEFAULT_APPEARANCE.skin;
  const policy = getSkinThemePolicy(skin);
  let theme = isTheme(settings.theme) ? settings.theme : policy.preferred;
  if (!policy.modes.includes(theme)) {
    theme = policy.preferred;
  }
  return {
    skin,
    theme,
    onboarded: Boolean(settings.onboarded),
  };
}

function migrateFromV1(raw: string): AppearanceSettings | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const theme = isTheme(parsed.theme) ? parsed.theme : "dark";
    return coerceAppearance({
      skin: "minimal",
      theme,
      onboarded: true,
    });
  } catch {
    return null;
  }
}

export function loadAppearance(): AppearanceSettings {
  if (typeof window === "undefined") return { ...DEFAULT_APPEARANCE };
  try {
    const v2 = window.localStorage.getItem(APPEARANCE_KEY);
    if (v2) {
      const parsed = JSON.parse(v2) as Partial<AppearanceSettings>;
      return coerceAppearance({
        skin: isSkin(parsed.skin) ? parsed.skin : DEFAULT_APPEARANCE.skin,
        theme: isTheme(parsed.theme) ? parsed.theme : DEFAULT_APPEARANCE.theme,
        onboarded: Boolean(parsed.onboarded),
      });
    }
    const v1 = window.localStorage.getItem(APPEARANCE_KEY_LEGACY);
    if (v1) {
      const migrated = migrateFromV1(v1);
      if (migrated) {
        saveAppearance(migrated);
        return migrated;
      }
    }
    return { ...DEFAULT_APPEARANCE };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function saveAppearance(settings: AppearanceSettings) {
  const next = coerceAppearance(settings);
  window.localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next));
}

export function resolveThemeMode(theme: AppearanceTheme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return theme;
}

export function applyAppearance(settings: AppearanceSettings) {
  const next = coerceAppearance(settings);
  const root = document.documentElement;
  const mode = resolveThemeMode(next.theme);
  root.dataset.skin = next.skin;
  root.dataset.theme = mode;
  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("light", mode === "light");
  delete root.dataset.preset;
  delete root.dataset.font;
  delete root.dataset.radius;
  delete root.dataset.density;
  delete root.dataset.sidebar;
  delete root.dataset.layout;
}

export type UserProfile = {
  displayName: string;
  avatarDataUrl: string | null;
};

export function profileKey(phone: string) {
  return `aigw.profile.${phone}`;
}

export function loadProfile(phone: string): UserProfile {
  const fallback: UserProfile = {
    displayName: phone,
    avatarDataUrl: null,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(profileKey(phone));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return {
      displayName: parsed.displayName?.trim() || phone,
      avatarDataUrl: parsed.avatarDataUrl ?? null,
    };
  } catch {
    return fallback;
  }
}

export function saveProfile(phone: string, profile: UserProfile) {
  window.localStorage.setItem(profileKey(phone), JSON.stringify(profile));
}
