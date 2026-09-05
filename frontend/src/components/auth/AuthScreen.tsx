'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10 relative">
      {/* Top Left: Back to Home Link */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-surface-container border border-transparent hover:border-border"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to home</span>
        </Link>
      </div>

      {/* Top Right: Theme Switcher */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
        <button
          type="button"
          onClick={toggleTheme}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-surface-container"
        >
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </div>

      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <BrandLogo
            href="/"
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
