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
  maxTilt = 14,
  glareOpacity = 0.4,
  enableGlare = true,
  style,
  onMouseMove,
  onMouseEnter,
  onMouseLeave,
  ...props
}: CardTiltWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Normalized cursor coordinates (-0.5 to 0.5)
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Percentage cursor position for glare highlight (0 to 100)
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);

  // Physical spring physics for lively, buttery smooth 3D tilt responsiveness
  const springConfig = { stiffness: 320, damping: 20, mass: 0.15 };
  const mouseXSpring = useSpring(x, springConfig);
  const mouseYSpring = useSpring(y, springConfig);

  // Tilt calculations (rotateX maps inverted Y, rotateY maps X)
  const effectiveTilt = shouldReduceMotion ? 0 : maxTilt;
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], [effectiveTilt, -effectiveTilt]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], [-effectiveTilt, effectiveTilt]);

  // Dynamic glare radial gradient that glides across the card surface
  const glareBackground = useMotionTemplate`radial-gradient(400px circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, ${glareOpacity}) 0%, rgba(255, 255, 255, 0.08) 35%, transparent 75%)`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    onMouseMove?.(e);
    if (!containerRef.current || shouldReduceMotion) return;

    const rect = containerRef.current.getBoundingClientRect();
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
    // Outer perspective boundary - MUST have perspective here so the child 3D rotate has real depth foreshortening!
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: 1000 }}
      className={`relative h-full w-full ${className}`}
    >
      {/* 3D Rotating Canvas - preserve-3d enables children with translateZ to pop forward */}
      <motion.div
        style={{
          transformStyle: 'preserve-3d',
          rotateX,
          rotateY,
          ...style,
        }}
        whileHover={shouldReduceMotion ? {} : { scale: 1.025 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="relative h-full w-full rounded-2xl will-change-transform"
        {...props}
      >
        {/* Glossy light sheen overlay (clipped inside its own layer so preserve-3d is NEVER flattened by overflow-hidden) */}
        {enableGlare && (
          <div
            className="pointer-events-none absolute inset-0 z-20 rounded-2xl overflow-hidden transition-opacity duration-300"
            style={{
              opacity: isHovered ? 1 : 0,
              transform: 'translateZ(1px)',
            }}
          >
            <motion.div
              className="w-full h-full"
              style={{ background: glareBackground }}
            />
          </div>
        )}

        {/* Card Content with 3D depth context */}
        <div
          className="relative z-10 h-full w-full"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {children}
        </div>
      </motion.div>
    </div>
  );
}

export default CardTiltWrapper;
