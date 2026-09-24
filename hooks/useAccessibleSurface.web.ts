import { useEffect, useState } from 'react';

/** Signals for adapting translucent surfaces: true when the OS asks for less transparency or more contrast. */
export function useAccessibleSurface() {
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const [increaseContrast, setIncreaseContrast] = useState(false);

  useEffect(() => {
    const transparencyQuery = window.matchMedia('(prefers-reduced-transparency: reduce)');
    const contrastQuery = window.matchMedia('(prefers-contrast: more)');
    const applyTransparency = () => setReduceTransparency(transparencyQuery.matches);
    const applyContrast = () => setIncreaseContrast(contrastQuery.matches);
    applyTransparency();
    applyContrast();
    transparencyQuery.addEventListener('change', applyTransparency);
    contrastQuery.addEventListener('change', applyContrast);
    return () => {
      transparencyQuery.removeEventListener('change', applyTransparency);
      contrastQuery.removeEventListener('change', applyContrast);
    };
  }, []);

  return { reduceTransparency, increaseContrast };
}
