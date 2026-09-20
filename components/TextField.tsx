import { ReactNode } from 'react';
import { TextInput, TextInputProps, View } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/theme/tokens';

type Props = TextInputProps & { label: string; /** A control shown inside the field's right edge, such as a calendar button. */ trailing?: ReactNode };

export function TextField({ label, trailing, ...rest }: Props) {
  return (
    <View style={{ gap: theme.spacing[4] }}>
      <Text importantForAccessibility="no" accessibilityElementsHidden>{label}</Text>
      <View>
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
              borderRadius: theme.radii.card,
              paddingHorizontal: theme.spacing[12],
              paddingRight: trailing ? theme.spacing[12] + 40 : theme.spacing[12],
              color: theme.colors.inkBlack,
            },
          ]}
          {...rest}
        />
        {trailing && <View style={{ position: 'absolute', right: theme.spacing[4], top: 0, bottom: 0, justifyContent: 'center' }}>{trailing}</View>}
      </View>
    </View>
  );
}
