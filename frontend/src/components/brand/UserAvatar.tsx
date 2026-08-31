'use client';

import React from 'react';
import { User } from '@/lib/types';
import { userInitial } from '@/context/AuthContext';
import { resolveMediaUrl } from '@/lib/media';

export function UserAvatar({
  user,
  size = 40,
  className = ''
}: {
  user?: User | null;
  size?: number;
  className?: string;
}) {
  const src = resolveMediaUrl(user?.avatar_url);
  const label = user?.display_name?.trim() || user?.email || 'Account';

  if (src) {
    return (
      <img
        src={src}
        alt={label}
        width={size}
        height={size}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0 shadow-sm ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
      aria-label={label}
    >
      {userInitial(user)}
    </div>
  );
}
