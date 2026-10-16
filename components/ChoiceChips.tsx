import { Pressable, View } from 'react-native';
import { Text } from '@/components/Text';
import { humanize } from '@/lib/events';
import { pressFeedback } from '@/lib/press';
import { theme } from '@/theme/tokens';

// Chips look 36pt tall but keep the 48pt tap target: the hit area reaches past the chip, and the row gap stops neighbours' areas overlapping.
const slop = (theme.touchTarget.minimum - theme.touchTarget.medium) / 2;
const chipRowGap = theme.spacing[12];
const selectedFill = theme.gradients.primary[1]; // #444444, the light end of the primary button's gradient

type Props<T extends string> = {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  labels?: Partial<Record<T, string>>;
  /** False keeps every chip on one row (no wrapping). Defaults to true. */
  wrap?: boolean;
};

export function ChoiceChips<T extends string>({ label, options, value, onChange, labels, wrap = true }: Props<T>) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: theme.spacing[4] }}>
      <Text>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: wrap ? 'wrap' : 'nowrap', columnGap: theme.spacing[8], rowGap: chipRowGap }}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              aria-checked={selected}
              hitSlop={{ top: slop, bottom: slop }}
              onPress={() => onChange(option)}
              style={({ pressed }) => [{
                minHeight: theme.touchTarget.medium,
                paddingHorizontal: theme.spacing[12],
                borderRadius: theme.radii.button,
                justifyContent: 'center',
                backgroundColor: selected ? selectedFill : theme.colors.cloud,
              }, pressFeedback(pressed)]}
            >
              <Text color={selected ? 'paperWhite' : 'inkBlack'}>
                {labels?.[option] ?? humanize(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
