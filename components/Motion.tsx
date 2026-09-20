import { Children, ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, View, ViewStyle } from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';

// The motion vocabulary of the app. iOS and Android use React Native's Animated (this file); the web
// build swaps in Motion.web.tsx, which runs the same three effects on GSAP. Keep the two in step.

export type RevealProps = { children: ReactNode; delay?: number; y?: number; style?: StyleProp<ViewStyle> };
export type StaggerProps = { children: ReactNode; each?: number; max?: number; y?: number; style?: StyleProp<ViewStyle> };
export type PopProps = { trigger: unknown; children: ReactNode; style?: StyleProp<ViewStyle> };

/** Fades in and rises a few points on mount. */
export function Reveal({ children, delay = 0, y = 12, style }: RevealProps) {
  const reduce = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, { toValue: 1, duration: 400, delay: delay * 1000, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [reduce, delay, progress]);

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [y, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Reveals the first `max` children one after another; the rest appear at once. */
export function Stagger({ children, each = 0.05, max = 10, y = 12, style }: StaggerProps) {
  return (
    <View style={style}>
      {Children.toArray(children).map((child, index) =>
        index < max ? <Reveal key={index} delay={index * each} y={y}>{child}</Reveal> : child,
      )}
    </View>
  );
}

/** A quick scale punch whenever `trigger` changes (a score going up, say). Not on first render. */
export function Pop({ trigger, children, style }: PopProps) {
  const reduce = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduce) return;
    scale.setValue(1.15);
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true }).start();
  }, [trigger, reduce, scale]);

  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}
