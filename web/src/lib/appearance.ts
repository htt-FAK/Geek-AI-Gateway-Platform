export type AppearanceTheme = "system" | "light" | "dark";
export type AppearancePreset =
  | "default"
  | "night"
  | "rose"
  | "lake"
  | "sunset"
  | "forest"
  | "sea"
  | "lavender";
export type AppearanceFont = "auto" | "sans" | "serif";
export type AppearanceRadius = "auto" | "0" | "0.3" | "0.5" | "0.75" | "1";
export type AppearanceDensity = "compact" | "default" | "loose" | "xl";
export type AppearanceSidebar = "embedded" | "floating" | "inset";
export type AppearanceLayout = "default" | "compact" | "full";

export type AppearanceSettings = {
  theme: AppearanceTheme;
  preset: AppearancePreset;
  font: AppearanceFont;
  radius: AppearanceRadius;
  density: AppearanceDensity;
  sidebar: AppearanceSidebar;
  layout: AppearanceLayout;
};

export const APPEARANCE_KEY = "aigw.appearance.v1";

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "dark",
  preset: "default",
  font: "auto",
  radius: "auto",
  density: "default",
  sidebar: "embedded",
  layout: "default",
};

export function loadAppearance(): AppearanceSettings {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  try {
    const raw = window.localStorage.getItem(APPEARANCE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    return { ...DEFAULT_APPEARANCE, ...(JSON.parse(raw) as Partial<AppearanceSettings>) };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function saveAppearance(settings: AppearanceSettings) {
  window.localStorage.setItem(APPEARANCE_KEY, JSON.stringify(settings));
}

export function applyAppearance(settings: AppearanceSettings) {
  const root = document.documentElement;
  const theme =
    settings.theme === "system"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : settings.theme;

  root.dataset.theme = theme;
  root.dataset.preset = settings.preset;
  root.dataset.font = settings.font;
  root.dataset.radius = settings.radius;
  root.dataset.density = settings.density;
  root.dataset.sidebar = settings.sidebar;
  root.dataset.layout = settings.layout;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
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
