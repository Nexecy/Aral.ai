'use client';

import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export interface CardTiltWrapperProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  glareOpacity?: number;
  enableGlare?: boolean;
}

export function CardTiltWrapper({
  children,
  className = '',
  maxTilt = 15,
  glareOpacity = 0.35,
  enableGlare = true,
}: CardTiltWrapperProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });

  // Spring-smoothed rotation angles
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { stiffness: 300, damping: 25, mass: 0.1 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  const rotateX = useTransform(smoothY, [-0.5, 0.5], [maxTilt, -maxTilt]);
  const rotateY = useTransform(smoothX, [-0.5, 0.5], [-maxTilt, maxTilt]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const xPct = x / rect.width - 0.5;
    const yPct = y / rect.height - 0.5;

    mouseX.set(xPct);
    mouseY.set(yPct);

    setGlarePos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
    });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: 1000 }}
      className={`relative h-full w-full ${className}`}
    >
      <motion.div
        style={{
          transformStyle: 'preserve-3d',
          rotateX,
          rotateY,
          transformPerspective: 1000,
        }}
        whileHover={{
          scale: 1.025,
          y: -6,
        }}
        transition={{
          type: 'spring',
          stiffness: 350,
          damping: 25,
        }}
        className="relative h-full w-full will-change-transform"
      >
        {/* Subtle dynamic glare overlay that tracks cursor */}
        {enableGlare && (
          <div
            className="pointer-events-none absolute inset-0 z-30 rounded-2xl overflow-hidden transition-opacity duration-300"
            style={{
              opacity: isHovered ? 1 : 0,
              background: `radial-gradient(400px circle at ${glarePos.x}% ${glarePos.y}%, rgba(255, 255, 255, ${glareOpacity}) 0%, rgba(255, 255, 255, 0.05) 45%, transparent 80%)`,
              transform: 'translateZ(1px)',
            }}
          />
        )}

        {/* Inner Content with true 3D perspective context */}
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
