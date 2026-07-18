'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

type Direction = 'up' | 'down' | 'left' | 'right' | 'none';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Slide direction of the entrance. */
  direction?: Direction;
  /** Stagger delay in seconds. */
  delay?: number;
  /** Travel distance in px. */
  distance?: number;
  once?: boolean;
}

const offset = (dir: Direction, d: number) => {
  switch (dir) {
    case 'up': return { y: d };
    case 'down': return { y: -d };
    case 'left': return { x: d };
    case 'right': return { x: -d };
    default: return {};
  }
};

/** Scroll-reveal wrapper: fades + slides content in as it enters the viewport. */
export const Reveal: React.FC<RevealProps> = ({
  children,
  className = '',
  direction = 'up',
  delay = 0,
  distance = 28,
  once = true,
}) => {
  const reduce = useReducedMotion();
  const initial = reduce ? { opacity: 0 } : { opacity: 0, ...offset(direction, distance) };
  const animate = { opacity: 1, x: 0, y: 0 };

  return (
    <motion.div
      className={className}
      initial={initial}
      whileInView={animate}
      viewport={{ once, amount: 0.2 }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
};

export default Reveal;
