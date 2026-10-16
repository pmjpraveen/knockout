import type { LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { pressFeedback } from '@/lib/press';
import { theme } from '@/theme/tokens';

/** A 48pt icon-only button for row actions such as move up, move down and remove. */
export function IconAction({ label, Icon, disabled, onPress }: { label: string; Icon: LucideIcon; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [{ width: theme.touchTarget.minimum, height: theme.touchTarget.minimum, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1 }, pressFeedback(pressed)]}
    >
      <Icon size={20} color={theme.colors.charcoal} strokeWidth={1.75} />
    </Pressable>
  );
}
