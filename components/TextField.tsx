import { TextInput, TextInputProps, View } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/theme/tokens';

type Props = TextInputProps & { label: string; plainLabel?: boolean };

export function TextField({ label, plainLabel, ...rest }: Props) {
  return (
    <View style={{ gap: theme.spacing[4] }}>
      {plainLabel ? (
        <Text importantForAccessibility="no" accessibilityElementsHidden>{label}</Text>
      ) : (
        <Text variant="label" weight="medium" color="charcoal" style={{ textTransform: 'uppercase' }} importantForAccessibility="no" accessibilityElementsHidden>
          {label}
        </Text>
      )}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.slateGray}
        autoCapitalize="none"
        style={[
          theme.type.bodyLg,
          {
            fontFamily: theme.fonts.sans.regular,
            minHeight: theme.touchTarget.minimum,
            borderWidth: 1,
            borderColor: theme.colors.mist,
            borderRadius: plainLabel ? theme.radii.card : theme.radii.chip,
            paddingHorizontal: theme.spacing[12],
            color: theme.colors.inkBlack,
          },
        ]}
        {...rest}
      />
    </View>
  );
}
