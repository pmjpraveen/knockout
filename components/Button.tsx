import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
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

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: keyof typeof variants;
  icon?: ReactNode;
  /** The taller 56pt size for the main action of a screen. */
  large?: boolean;
  /** When set, the first press only arms the button and shows this text; the second press fires. */
  confirmTitle?: string;
};

export function Button({ title, onPress, disabled, variant = 'primary', icon, large, confirmTitle }: Props) {
  const [armed, setArmed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const style = variants[variant];
  const disarmAfterMs = 4000;
  const dims = !style.tint && !disabled && !armed;
  const gradient = variant === 'primary' && !disabled && !armed;

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), disarmAfterMs);
    return () => clearTimeout(timer);
  }, [armed]);

  const press = () => {
    if (confirmTitle && !armed) {
      haptic.warning();
      return setArmed(true);
    }
    setArmed(false);
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityHint={confirmTitle && !armed ? 'Needs a second tap to confirm' : undefined}
      onPress={press}
      disabled={disabled}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [{
        minHeight: large ? theme.touchTarget.scoreButton : theme.touchTarget.minimum,
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
        transform: pressed && !disabled ? [{ scale: 0.97 }] : undefined,
      }]}
    >
      {gradient && <LinearGradient colors={theme.gradients.primary} start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0 }} style={StyleSheet.absoluteFill} />}
      {icon ? <View>{icon}</View> : null}
      <Text variant="bodyLg" color={disabled ? 'slateGray' : armed ? 'danger' : style.text}>
        {armed ? confirmTitle : title}
      </Text>
    </Pressable>
  );
}
