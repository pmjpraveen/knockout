import { useEffect, useRef } from 'react';
import { Animated, DimensionValue, Easing, Platform, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { theme } from '@/theme/tokens';

/** One shared pulse: a gentle fade, or a still block when Reduce Motion is on. */
function usePulse() {
  const opacity = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(0.85);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.65, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(opacity, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, opacity]);

  return opacity;
}

export function Skeleton({ width = '100%', height = 16, radius = theme.radii.chip }: { width?: DimensionValue; height?: number; radius?: number }) {
  const opacity = usePulse();
  return <Animated.View style={{ width, height, borderRadius: radius, backgroundColor: theme.colors.mist, opacity }} />;
}

/** Placeholder shaped like a list Card: a title line and a caption line. */
export function SkeletonCard() {
  return (
    <View style={{ borderWidth: 1, borderColor: theme.colors.mist, borderRadius: theme.radii.card, padding: theme.spacing[16], gap: theme.spacing[8] }}>
      <Skeleton width="55%" height={20} />
      <Skeleton width="35%" height={14} />
    </View>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading" style={{ gap: theme.spacing[16] }}>
      {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}
    </View>
  );
}

/** Whole-screen placeholder for detail screens: a heading, a status pill and a few cards. */
export function SkeletonScreen() {
  return (
    <Screen>
      <Skeleton width="60%" height={32} />
      <Skeleton width={96} height={24} />
      <SkeletonList count={3} />
    </Screen>
  );
}
