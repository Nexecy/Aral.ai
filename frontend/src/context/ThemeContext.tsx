'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
export type FontSize = 'sm' | 'md' | 'lg' | 'xl';
export type ColorSchemeId = 'indigo' | 'emerald' | 'blue' | 'purple' | 'rose' | 'amber' | 'teal' | 'custom';

export interface ColorSchemeOption {
  id: ColorSchemeId;
  name: string;
  hex: string;
  description: string;
}

export const COLOR_SCHEMES: ColorSchemeOption[] = [
  {
    id: 'indigo',
    name: 'Royal Indigo',
    hex: '#4f46e5',
    description: 'Calm, focused indigo'
  },
  {
    id: 'emerald',
    name: 'Forest Emerald',
    hex: '#059669',
    description: 'Fresh, balanced green'
  },
  {
    id: 'blue',
    name: 'Ocean Blue',
    hex: '#2563eb',
    description: 'Crisp, confident blue'
  },
  {
    id: 'purple',
    name: 'Amethyst Violet',
    hex: '#7c3aed',
    description: 'Vibrant, creative purple'
  },
  {
    id: 'rose',
    name: 'Crimson Rose',
    hex: '#e11d48',
    description: 'Warm, energetic rose'
  },
  {
    id: 'amber',
    name: 'Sunset Amber',
    hex: '#d97706',
    description: 'Cozy, warm amber'
  },
  {
    id: 'teal',
    name: 'Midnight Teal',
    hex: '#0891b2',
    description: 'Modern, clean teal'
  }
];

export const FONT_SIZES: { id: FontSize; label: string; scale: string; px: string; desc: string }[] = [
  { id: 'sm', label: 'Small', scale: '90%', px: '14.4px', desc: 'Compact view for denser information' },
  { id: 'md', label: 'Default', scale: '100%', px: '16px', desc: 'Standard balanced reading size' },
  { id: 'lg', label: 'Large', scale: '112%', px: '18px', desc: 'Comfortable for prolonged study' },
  { id: 'xl', label: 'Extra Large', scale: '125%', px: '20px', desc: 'Maximum legibility & accessibility' }
];

export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6 && clean.length !== 3) return null;

  let r = 0, g = 0, b = 0;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else {
    r = parseInt(clean.substring(0, 2), 16);
    g = parseInt(clean.substring(2, 4), 16);
    b = parseInt(clean.substring(4, 6), 16);
  }

  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;

  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / delta + 2) * 60;
        break;
      case b:
        h = ((r - g) / delta + 4) * 60;
        break;
    }
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  colorScheme: ColorSchemeId;
  customPrimaryHex: string;
  setColorScheme: (schemeId: ColorSchemeId, customHex?: string) => void;
  activeHexColor: string;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  cycleFontSize: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [colorScheme, setColorSchemeState] = useState<ColorSchemeId>('indigo');
  const [customPrimaryHex, setCustomPrimaryHex] = useState<string>('#4f46e5');
  const [fontSize, setFontSizeState] = useState<FontSize>('md');

  const applyFontSize = (size: FontSize) => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-font-size', size);
    const scale = size === 'sm' ? '90%' : size === 'lg' ? '112.5%' : size === 'xl' ? '125%' : '100%';
    document.documentElement.style.fontSize = scale;
  };

  const applyColors = (schemeId: ColorSchemeId, customHex: string, currentTheme: Theme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    const preset = COLOR_SCHEMES.find((s) => s.id === schemeId);
    const targetHex = schemeId === 'custom' ? customHex : preset?.hex || '#4f46e5';
    const hsl = hexToHsl(targetHex);
    if (!hsl) return;

    const isDark = currentTheme === 'dark';
    const h = hsl.h;
    const s = hsl.s;
    const l = hsl.l;

    // Optimize contrast: in dark mode, keep lightness >= 64% so badges & buttons are luminous;
    // in light mode, keep lightness <= 54% so text/fills have crisp contrast on off-white paper canvas
    const primaryL = isDark ? Math.max(l, 64) : Math.min(l, 54);
    const containerL = isDark ? Math.max(primaryL - 10, 42) : Math.max(primaryL - 7, 22);
    const activeL = isDark ? Math.max(primaryL - 18, 34) : Math.max(primaryL - 15, 16);

    root.style.setProperty('--primary', `${h} ${s}% ${primaryL}%`);
    root.style.setProperty('--primary-container', `${h} ${s}% ${containerL}%`);
    root.style.setProperty('--primary-active', `${h} ${s}% ${activeL}%`);
    root.style.setProperty('--ring', `${h} ${s}% ${primaryL}%`);
  };

  useEffect(() => {
    const savedTheme = (localStorage.getItem('aral_theme') as Theme) || 'light';
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setThemeState(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    }

    const savedScheme = (localStorage.getItem('aral_color_scheme') as ColorSchemeId) || 'indigo';
    const savedCustomHex = localStorage.getItem('aral_custom_primary_hex') || '#4f46e5';
    setColorSchemeState(savedScheme);
    setCustomPrimaryHex(savedCustomHex);
    applyColors(savedScheme, savedCustomHex, savedTheme);

    const savedSize = localStorage.getItem('aral_font_size') as FontSize;
    if (['sm', 'md', 'lg', 'xl'].includes(savedSize)) {
      setFontSizeState(savedSize);
      applyFontSize(savedSize);
    } else {
      applyFontSize('md');
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('aral_theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    applyColors(colorScheme, customPrimaryHex, newTheme);
  };

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
  };

  const setColorScheme = (schemeId: ColorSchemeId, customHex?: string) => {
    setColorSchemeState(schemeId);
    localStorage.setItem('aral_color_scheme', schemeId);

    const hexToUse = customHex ? customHex : customPrimaryHex;
    if (customHex) {
      setCustomPrimaryHex(customHex);
      localStorage.setItem('aral_custom_primary_hex', customHex);
    }

    applyColors(schemeId, hexToUse, theme);
  };

  const setFontSize = (newSize: FontSize) => {
    setFontSizeState(newSize);
    localStorage.setItem('aral_font_size', newSize);
    applyFontSize(newSize);
  };

  const cycleFontSize = () => {
    const order: FontSize[] = ['sm', 'md', 'lg', 'xl'];
    const nextIndex = (order.indexOf(fontSize) + 1) % order.length;
    setFontSize(order[nextIndex]);
  };

  const activeHexColor = colorScheme === 'custom' 
    ? customPrimaryHex 
    : COLOR_SCHEMES.find((s) => s.id === colorScheme)?.hex || '#4f46e5';

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        colorScheme,
        customPrimaryHex,
        setColorScheme,
        activeHexColor,
        fontSize,
        setFontSize,
        cycleFontSize
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
