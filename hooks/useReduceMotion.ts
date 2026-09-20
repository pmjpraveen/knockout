import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** True when the user has asked the OS to reduce motion (also works on web via prefers-reduced-motion). */
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => subscription.remove();
  }, []);
  return reduce;
}
