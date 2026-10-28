import { ThemeColors, ThemePreset } from '../types';

export const THEME_PRESETS: Record<Exclude<ThemePreset, 'custom'>, ThemeColors> = {
  dark: {
    bg: '#090D16',
    card: '#111827',
    border: '#1F2937',
    title: '#F9FAFB',
    text: '#E5E7EB',
    textMuted: '#9CA3AF',
    accent: '#3B82F6',
    accentHover: '#2563EB',
    badgeBg: '#1E293B',
  },
  light: {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
    title: '#0F172A',
    text: '#334155',
    textMuted: '#64748B',
    accent: '#2563EB',
    accentHover: '#1D4ED8',
    badgeBg: '#F1F5F9',
  },
  'retro-cyber': {
    bg: '#0D0E1C',
    card: '#16182E',
    border: '#282C52',
    title: '#38BDF8',
    text: '#E2E8F0',
    textMuted: '#818CF8',
    accent: '#A855F7',
    accentHover: '#9333EA',
    badgeBg: '#1E1B4B',
  },
  nord: {
    bg: '#242933',
    card: '#2E3440',
    border: '#3B4252',
    title: '#ECEFF4',
    text: '#E5E9F0',
    textMuted: '#88C0D0',
    accent: '#81A1C1',
    accentHover: '#5E81AC',
    badgeBg: '#3B4252',
  },
  emerald: {
    bg: '#061A14',
    card: '#0A261E',
    border: '#134E3A',
    title: '#34D399',
    text: '#D1FAE5',
    textMuted: '#6EE7B7',
    accent: '#10B981',
    accentHover: '#059669',
    badgeBg: '#064E3B',
  },
  sunset: {
    bg: '#140E1B',
    card: '#1F142B',
    border: '#3E2554',
    title: '#FB923C',
    text: '#FDE047',
    textMuted: '#F472B6',
    accent: '#F97316',
    accentHover: '#EA580C',
    badgeBg: '#2D1B3E',
  },
};

const THEME_STORAGE_KEY = 'retrobat_theme_preset';
const CUSTOM_COLORS_STORAGE_KEY = 'retrobat_custom_colors';

export function getStoredTheme(): { preset: ThemePreset; custom: ThemeColors } {
  try {
    const savedPreset = (localStorage.getItem(THEME_STORAGE_KEY) as ThemePreset) || 'dark';
    const savedCustomRaw = localStorage.getItem(CUSTOM_COLORS_STORAGE_KEY);
    const savedCustom = savedCustomRaw ? JSON.parse(savedCustomRaw) : THEME_PRESETS.dark;
    return { preset: savedPreset, custom: savedCustom };
  } catch {
    return { preset: 'dark', custom: THEME_PRESETS.dark };
  }
}

export function saveTheme(preset: ThemePreset, custom: ThemeColors): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preset);
    localStorage.setItem(CUSTOM_COLORS_STORAGE_KEY, JSON.stringify(custom));
  } catch (e) {
    console.warn('Could not save theme to localStorage', e);
  }
}

export function applyThemeCssVars(colors: ThemeColors): void {
  const root = document.documentElement;
  root.style.setProperty('--bg-app', colors.bg);
  root.style.setProperty('--card-app', colors.card);
  root.style.setProperty('--border-app', colors.border);
  root.style.setProperty('--title-app', colors.title);
  root.style.setProperty('--text-app', colors.text);
  root.style.setProperty('--text-muted-app', colors.textMuted);
  root.style.setProperty('--accent-app', colors.accent);
  root.style.setProperty('--accent-hover-app', colors.accentHover);
  root.style.setProperty('--badge-bg-app', colors.badgeBg);
}
