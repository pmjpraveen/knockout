import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';
import { Logo } from '@/components/Logo';
import { useReduceMotion } from '@/hooks/useReduceMotion';

const native = Platform.OS !== 'web';
const zoomScale = 14;

/**
 * Launch animation: the white logo fades in on a dark screen, holds, then zooms in until it fills the screen
 * while the backdrop dissolves, revealing the app underneath. With Reduce Motion it is a short cross-fade.
 */
export function Splash({ onReady, onDone }: { onReady?: () => void; onDone: () => void }) {
  const reduce = useReduceMotion();
  const appear = useRef(new Animated.Value(0)).current; // logo fade-in and settle
  const zoom = useRef(new Animated.Value(0)).current; // 0 = resting size, 1 = fully zoomed
  const fade = useRef(new Animated.Value(1)).current; // the dark backdrop

  useEffect(() => {
    const play = (value: Animated.Value, toValue: number, duration: number, easing: (t: number) => number) =>
      Animated.timing(value, { toValue, duration, easing, useNativeDriver: native });

    const sequence = reduce
      ? Animated.sequence([Animated.delay(600), play(fade, 0, 250, Easing.out(Easing.quad))])
      : Animated.sequence([
          play(appear, 1, 550, Easing.out(Easing.cubic)),
          Animated.delay(450),
          Animated.parallel([
            play(zoom, 1, 950, Easing.in(Easing.cubic)),
            Animated.sequence([Animated.delay(500), play(fade, 0, 450, Easing.in(Easing.quad))]),
          ]),
        ]);
    sequence.start(({ finished }) => finished && onDone());
    return () => sequence.stop();
  }, [reduce]);

  const scale = Animated.multiply(
    appear.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }),
    zoom.interpolate({ inputRange: [0, 1], outputRange: [1, zoomScale] }),
  );

  return (
    <Animated.View
      onLayout={onReady}
      style={[StyleSheet.absoluteFill, { backgroundColor: '#111111', alignItems: 'center', justifyContent: 'center', zIndex: 100, opacity: fade }]}
    >
      <Animated.View style={{ opacity: appear, transform: [{ scale }] }}>
        <Logo width={140} color="#FFFFFF" />
      </Animated.View>
    </Animated.View>
  );
}
