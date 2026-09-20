import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { theme } from '@/theme/tokens';

/** One segment per step. A segment fills left to right when its step is completed and empties again on going back. */
export function StepBar({ steps, step }: { steps: number; step: number }) {
  const reduce = useReduceMotion();
  const fills = useRef(Array.from({ length: steps }, (_, index) => new Animated.Value(index < step ? 1 : 0))).current;

  useEffect(() => {
    fills.forEach((fill, index) => {
      const target = index < step ? 1 : 0;
      if (reduce) return fill.setValue(target);
      Animated.timing(fill, { toValue: target, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); // width is a layout property
    });
  }, [step, reduce, fills]);

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing[4] / 2 }}>
      {fills.map((fill, index) => (
        <View key={index} style={{ flex: 1, height: 8, backgroundColor: theme.colors.mist, overflow: 'hidden' }}>
          <Animated.View style={{ height: '100%', backgroundColor: theme.gradients.primary[1], width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
        </View>
      ))}
    </View>
  );
}
