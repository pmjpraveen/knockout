import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { haptic } from '@/lib/haptics';
import { theme } from '@/theme/tokens';

// `tint` is the hover/pressed fill for outlined buttons; filled buttons (tint null) dim instead.
const variants = {
  primary: { background: 'inkBlack', border: 'inkBlack', text: 'paperWhite', tint: null },
  secondary: { background: 'paperWhite', border: 'mist', text: 'inkBlack', tint: 'cloud' },
  danger: { background: 'paperWhite', border: 'danger', text: 'danger', tint: 'dangerTint' },
  success: { background: 'success', border: 'success', text: 'paperWhite', tint: null },
  warning: { background: 'paperWhite', border: 'warning', text: 'warning', tint: 'warningTint' },
  ghost: { background: 'paperWhite', border: 'paperWhite', text: 'inkBlack', tint: 'cloud' },
} as const;

const heights = {
  medium: theme.touchTarget.medium,
  normal: theme.touchTarget.normal,
  large: theme.touchTarget.minimum,
  /** The scoring screens' own 56pt controls (Start match, Pause/Resume clock) — used mid-match, one-handed. */
  scoreButton: theme.touchTarget.scoreButton,
};

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: keyof typeof variants;
  icon?: ReactNode;
  /** `medium` (36pt), `normal` (40pt, default), `large` (48pt), or `scoreButton` (56pt, for mid-match controls). */
  size?: keyof typeof heights;
  /** When set, the first press only arms the button and shows this text; the second press fires. */
  confirmTitle?: string;
};

export function Button({ title, onPress, disabled, variant = 'primary', icon, size = 'normal', confirmTitle }: Props) {
  const [armed, setArmed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const style = variants[variant];
  const disarmAfterMs = 4000;
  const dims = !style.tint && !disabled && !armed;
  const gradient = variant === 'primary' && !disabled && !armed;
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const countdown = useRef(new Animated.Value(1)).current; // 1 -> 0 while armed, so the wait to disarm is visible

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), disarmAfterMs);
    countdown.setValue(1);
    Animated.timing(countdown, { toValue: 0, duration: disarmAfterMs, easing: Easing.linear, useNativeDriver: false }).start();
    return () => clearTimeout(timer);
  }, [armed, countdown]);

  const press = () => {
    if (confirmTitle && !armed) {
      haptic.warning();
      return setArmed(true);
    }
    setArmed(false);
    onPress();
  };

  const pressIn = () => {
    if (disabled) return;
    if (reduceMotion) return scale.setValue(0.97);
    Animated.timing(scale, { toValue: 0.97, duration: 80, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };
  const pressOut = () => {
    if (reduceMotion) return scale.setValue(1);
    Animated.timing(scale, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        accessibilityHint={confirmTitle && !armed ? 'Needs a second tap to confirm' : undefined}
        onPress={press}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={({ pressed }) => [{
          minHeight: heights[size],
          borderRadius: theme.radii.button,
          paddingHorizontal: variant === 'ghost' ? theme.spacing[16] : theme.spacing[24],
          flexDirection: 'row',
          gap: theme.spacing[12],
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          backgroundColor: gradient ? 'transparent' : disabled ? theme.colors.cloud : armed ? theme.colors.dangerTint : style.tint && (hovered || pressed) ? theme.colors[style.tint] : theme.colors[style.background],
          borderWidth: 1,
          borderColor: disabled ? theme.colors.mist : theme.colors[style.border],
          opacity: dims && pressed ? 0.7 : dims && hovered ? 0.88 : 1,
        }]}
      >
        {gradient && <LinearGradient colors={theme.gradients.primary} start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0 }} style={StyleSheet.absoluteFill} />}
        {armed && (
          <Animated.View
            style={{
              position: 'absolute', left: 0, bottom: 0, height: 3, backgroundColor: theme.colors.danger,
              width: countdown.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }}
          />
        )}
        {icon ? <View>{icon}</View> : null}
        <Text variant="bodyLg" color={disabled ? 'slateGray' : armed ? 'danger' : style.text}>
          {armed ? confirmTitle : title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
