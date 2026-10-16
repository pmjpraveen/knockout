import type { LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/Text';
import { pressFeedback } from '@/lib/press';
import { theme } from '@/theme/tokens';

type Option<T extends string> = { value: T; label: string; Icon: LucideIcon };

/** A small segmented control for switching how the same content is shown, such as a list or a table. */
export function ViewToggle<T extends string>({ label, options, value, onChange }: { label: string; options: readonly Option<T>[]; value: T; onChange: (value: T) => void }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', padding: 3, borderRadius: theme.radii.button, backgroundColor: theme.colors.cloud }}>
      {options.map(({ value: option, label: name, Icon }) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={name}
            hitSlop={{ top: 6, bottom: 6 }}
            onPress={() => onChange(option)}
            style={({ pressed }) => [
              { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[8], paddingHorizontal: theme.spacing[12], height: 32, borderRadius: theme.radii.button, backgroundColor: selected ? theme.colors.paperWhite : 'transparent' },
              selected && theme.shadows.subtle,
              pressFeedback(pressed),
            ]}
          >
            <Icon size={16} color={selected ? theme.colors.inkBlack : theme.colors.charcoal} strokeWidth={1.75} />
            <Text variant="body" color={selected ? 'inkBlack' : 'slateGray'}>{name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
