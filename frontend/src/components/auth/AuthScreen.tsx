'use client';

import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { BrandLogo } from '@/components/brand/BrandLogo';

export function AuthScreen({
  subtitle,
  children,
  footer
}: {
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10">
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={toggleTheme}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </div>

      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <BrandLogo
            href={null}
            align="center"
            size={52}
            asHeading
            wordmarkClassName="text-2xl font-extrabold"
          />
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
        {footer}
      </div>
    </div>
  );
}
