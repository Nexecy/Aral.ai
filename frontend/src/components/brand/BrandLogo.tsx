'use client';

import React from 'react';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';
import { BRAND_LOGO_FALLBACK, BRAND_LOGO_WHITE_FALLBACK } from '@/lib/brand';

interface BrandLogoProps {
  size?: number;
  showWordmark?: boolean;
  subtitle?: string;
  href?: string | null;
  align?: 'left' | 'center';
  wordmarkClassName?: string;
  asHeading?: boolean;
  /** auto follows the site theme. white is for dark surfaces even in light mode. */
  variant?: 'auto' | 'color' | 'white';
}

export function BrandLogo({
  size = 40,
  showWordmark = true,
  subtitle,
  href = '/',
  align = 'left',
  wordmarkClassName = 'text-lg',
  asHeading = false,
  variant = 'auto'
}: BrandLogoProps) {
  const { theme } = useTheme();
  const useWhite = variant === 'white' || (variant === 'auto' && theme === 'dark');

  const mark = (
    <span
      className="relative inline-block shrink-0 select-none"
      style={{ width: size, height: size }}
      role={showWordmark ? undefined : 'img'}
      aria-label={showWordmark ? undefined : 'Aral.ai'}
    >
      <img
        src={BRAND_LOGO_FALLBACK}
        alt=""
        width={size}
        height={size}
        draggable={false}
        className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-200 pointer-events-none select-none ${
          useWhite ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <img
        src={BRAND_LOGO_WHITE_FALLBACK}
        alt=""
        width={size}
        height={size}
        draggable={false}
        className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-200 pointer-events-none select-none ${
          useWhite ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </span>
  );

  const wordmark = (
    <>
      Aral<span className="text-primary font-black">.ai</span>
    </>
  );

  const label = showWordmark ? (
    <div className={`select-none ${align === 'center' ? 'text-center' : ''}`}>
      {asHeading ? (
        <h1 className={`font-bold tracking-tight text-foreground leading-none select-none ${wordmarkClassName}`}>
          {wordmark}
        </h1>
      ) : (
        <div className={`font-bold tracking-tight text-foreground leading-none select-none ${wordmarkClassName}`}>
          {wordmark}
        </div>
      )}
      {subtitle && (
        <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-1 select-none">
          {subtitle}
        </div>
      )}
    </div>
  ) : null;

  const content = (
    <span
      className={`inline-flex items-center gap-3 select-none ${
        align === 'center' ? 'flex-col gap-2' : ''
      }`}
    >
      {mark}
      {label}
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} draggable={false} className="inline-flex items-center no-underline select-none">
      {content}
    </Link>
  );
}
