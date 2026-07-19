'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';

/**
 * Lenis momentum smooth-scrolling — enabled ONLY on the marketing landing page ("/").
 * The dashboards are app-like with their own overflow scroll containers and fixed
 * layouts, where a global smooth-scroll hijack causes stutter, so we skip it there.
 * Also respects prefers-reduced-motion.
 */
export const SmoothScroll: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pathname !== '/') return; // only smooth-scroll the landing page
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      duration: 1.05,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.5,
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [pathname]);

  return <>{children}</>;
};

export default SmoothScroll;
