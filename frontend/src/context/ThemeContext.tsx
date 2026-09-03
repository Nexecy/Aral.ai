'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
export type FontSize = 'sm' | 'md' | 'lg' | 'xl';

export const FONT_SIZES: { id: FontSize; label: string; scale: string; px: string; desc: string }[] = [
  { id: 'sm', label: 'Small', scale: '90%', px: '14.4px', desc: 'Compact view for denser information' },
  { id: 'md', label: 'Default', scale: '100%', px: '16px', desc: 'Standard balanced reading size' },
  { id: 'lg', label: 'Large', scale: '112%', px: '18px', desc: 'Comfortable for prolonged study' },
  { id: 'xl', label: 'Extra Large', scale: '125%', px: '20px', desc: 'Maximum legibility & accessibility' }
];

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  cycleFontSize: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [fontSize, setFontSizeState] = useState<FontSize>('md');

  const applyFontSize = (size: FontSize) => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-font-size', size);
    const scale = size === 'sm' ? '90%' : size === 'lg' ? '112.5%' : size === 'xl' ? '125%' : '100%';
    document.documentElement.style.fontSize = scale;
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('aral_theme') as Theme;
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setThemeState(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    }

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
  };

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
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

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
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
