import X from 'lucide-react-native/icons/x';
import { Pressable } from 'react-native';
import { pressFeedback } from '@/lib/press';
import { theme } from '@/theme/tokens';

/** The cross inside a field's right edge that empties it. */
export function ClearFieldButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Clear ${label}`}
      hitSlop={theme.spacing[4]}
      onPress={onPress}
      style={({ pressed }) => [{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }, pressFeedback(pressed)]}
    >
      <X size={20} color={theme.colors.charcoal} strokeWidth={1.75} />
    </Pressable>
  );
}
