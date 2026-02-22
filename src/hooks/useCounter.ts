import { useEffect, useRef, useState } from "react";

export function useCounter(
  target: number,
  duration: number = 2000,
  startOnMount: boolean = true
): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);
  const started = useRef(false);

  useEffect(() => {
    if (!startOnMount) return;
    if (started.current) return;
    started.current = true;

    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    }

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration, startOnMount]);

  return value;
}
