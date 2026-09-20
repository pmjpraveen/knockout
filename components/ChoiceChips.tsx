import { Pressable, View } from 'react-native';
import { Text } from '@/components/Text';
import { humanize } from '@/lib/events';
import { pressFeedback } from '@/lib/press';
import { theme } from '@/theme/tokens';

type Props<T extends string> = {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  labels?: Partial<Record<T, string>>;
};

export function ChoiceChips<T extends string>({ label, options, value, onChange, labels }: Props<T>) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: theme.spacing[4] }}>
      <Text>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[8] }}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              aria-checked={selected}
              onPress={() => onChange(option)}
              style={({ pressed }) => [{
                minHeight: theme.touchTarget.minimum,
                paddingHorizontal: theme.spacing[16],
                borderRadius: theme.radii.chip,
                justifyContent: 'center',
                backgroundColor: selected ? theme.colors.inkBlack : theme.colors.paperWhite,
                borderWidth: 1,
                borderColor: selected ? theme.colors.inkBlack : theme.colors.mist,
              }, pressFeedback(pressed)]}
            >
              <Text weight="medium" color={selected ? 'paperWhite' : 'inkBlack'}>
                {labels?.[option] ?? humanize(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
