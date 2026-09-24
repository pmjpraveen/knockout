import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Signals for adapting translucent surfaces: true when the OS asks for less transparency or more contrast. */
export function useAccessibleSurface() {
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const [increaseContrast, setIncreaseContrast] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
    AccessibilityInfo.isHighTextContrastEnabled().then(setIncreaseContrast);
    const transparency = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    const contrast = AccessibilityInfo.addEventListener('highTextContrastChanged', setIncreaseContrast);
    return () => { transparency.remove(); contrast.remove(); };
  }, []);

  return { reduceTransparency, increaseContrast };
}
