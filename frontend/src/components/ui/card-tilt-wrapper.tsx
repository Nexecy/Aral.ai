'use client';

import React, { useRef, useState } from 'react';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  HTMLMotionProps,
} from 'framer-motion';

export interface CardTiltWrapperProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  glareOpacity?: number;
  enableGlare?: boolean;
}

export function CardTiltWrapper({
  children,
  className = '',
  maxTilt = 8,
  glareOpacity = 0.45,
  enableGlare = true,
  style,
  onMouseMove,
  onMouseEnter,
  onMouseLeave,
  ...props
}: CardTiltWrapperProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Normalized cursor coordinates (-0.5 to 0.5)
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Percentage cursor position for glare highlight (0 to 100)
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);

  // Physical spring physics for buttery tilt responsiveness
  const springConfig = { stiffness: 280, damping: 22, mass: 0.2 };
  const mouseXSpring = useSpring(x, springConfig);
  const mouseYSpring = useSpring(y, springConfig);

  // Tilt calculations (rotateX maps inverted Y, rotateY maps X)
  const effectiveTilt = shouldReduceMotion ? 0 : maxTilt;
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], [effectiveTilt, -effectiveTilt]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], [-effectiveTilt, effectiveTilt]);

  // Dynamic glare radial gradient moving across card surface
  const glareBackground = useMotionTemplate`radial-gradient(420px circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, ${glareOpacity}) 0%, rgba(255, 255, 255, 0.08) 40%, transparent 75%)`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    onMouseMove?.(e);
    if (!cardRef.current || shouldReduceMotion) return;

    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (width === 0 || height === 0) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;

    x.set(xPct);
    y.set(yPct);

    glareX.set((mouseX / width) * 100);
    glareY.set((mouseY / height) * 100);
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    onMouseEnter?.(e);
    setIsHovered(true);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    onMouseLeave?.(e);
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        transformStyle: 'preserve-3d',
        perspective: 1000,
        rotateX,
        rotateY,
        ...style,
      }}
      whileHover={shouldReduceMotion ? {} : { y: -4, scale: 1.012 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className={`relative overflow-hidden rounded-2xl will-change-transform ${className}`}
      {...props}
    >
      {/* Glare / Glossy light sheen layer */}
      {enableGlare && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 rounded-2xl transition-opacity duration-300 dark:mix-blend-overlay"
          style={{
            background: glareBackground,
            opacity: isHovered ? 1 : 0,
          }}
        />
      )}

      {/* Card Content with 3D depth context */}
      <div className="relative z-10 h-full w-full" style={{ transformStyle: 'preserve-3d' }}>
        {children}
      </div>
    </motion.div>
  );
}

export default CardTiltWrapper;
