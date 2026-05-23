import { useEffect, useRef } from 'react';
import { useAppStore } from '@/app/store/app.store';

export function useIdleTimer() {
  const { config, isAuthenticated, setAuthenticated } = useAppStore();
  const lastActivityRef = useRef(Date.now());

  const timeoutMinutes: number = ((config?.settings as Record<string, unknown>)?.idleTimeoutMinutes as number) ?? 15;

  useEffect(() => {
    if (!isAuthenticated || timeoutMinutes === 0) return;

    const bump = () => { lastActivityRef.current = Date.now(); };

    window.addEventListener('mousemove', bump, { passive: true });
    window.addEventListener('mousedown', bump, { passive: true });
    window.addEventListener('keydown',   bump, { passive: true });
    window.addEventListener('touchstart', bump, { passive: true });
    window.addEventListener('scroll',    bump, { passive: true });

    const interval = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs >= timeoutMinutes * 60 * 1000) {
        setAuthenticated(false);
      }
    }, 30_000); // check every 30 seconds

    return () => {
      window.removeEventListener('mousemove', bump);
      window.removeEventListener('mousedown', bump);
      window.removeEventListener('keydown',   bump);
      window.removeEventListener('touchstart', bump);
      window.removeEventListener('scroll',    bump);
      clearInterval(interval);
    };
  }, [isAuthenticated, timeoutMinutes, setAuthenticated]);
}
