import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import { ReactNode, useState } from 'react';
import { Pressable, TextInput, TextInputProps, View } from 'react-native';
import { Text } from '@/components/Text';
import { pressFeedback } from '@/lib/press';
import { theme } from '@/theme/tokens';

type Props = TextInputProps & { label: string; /** A control shown inside the field's right edge, such as a calendar button. */ trailing?: ReactNode };

/** No lineHeight: a fixed line box pushes iOS text below the centre of a single-line field. */
export const inputText = {
  fontSize: theme.type.bodyLg.fontSize,
  letterSpacing: theme.type.bodyLg.letterSpacing,
  paddingVertical: 0,
  textAlignVertical: 'center',
} as const;

export function TextField({ label, trailing, secureTextEntry, onFocus, onBlur, ...rest }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);
  const [trailingWidth, setTrailingWidth] = useState(36);
  const toggle = secureTextEntry ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={revealed ? `Hide ${label}` : `Show ${label}`}
      hitSlop={theme.spacing[4]}
      onPress={() => setRevealed((r) => !r)}
      style={({ pressed }) => [{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }, pressFeedback(pressed)]}
    >
      {revealed ? <EyeOff size={20} color={theme.colors.charcoal} strokeWidth={1.75} /> : <Eye size={20} color={theme.colors.charcoal} strokeWidth={1.75} />}
    </Pressable>
  ) : null;
  const shown = trailing ?? toggle;

  const ringGap = 3;

  return (
    <View style={{ gap: theme.spacing[4] }}>
      <Text importantForAccessibility="no" accessibilityElementsHidden>{label}</Text>
      {/* Outer ring: a soft halo around the input's own solid border, offset by a constant gap so it never shifts layout. */}
      <View style={{ marginHorizontal: -ringGap, borderWidth: ringGap, borderRadius: theme.radii.card + ringGap, borderColor: focused ? theme.colors.aoTint : 'transparent' }}>
        <View>
          <TextInput
            accessibilityLabel={label}
            placeholderTextColor={theme.colors.slateGray}
            autoCapitalize="none"
            secureTextEntry={secureTextEntry && !revealed}
            onFocus={(e) => { setFocused(true); onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); onBlur?.(e); }}
            style={[
              inputText,
              {
                fontFamily: theme.fonts.sans.regular,
                minHeight: theme.touchTarget.minimum,
                borderWidth: 1,
                borderColor: focused ? theme.colors.ao : theme.colors.mist,
                borderRadius: theme.radii.card,
                paddingHorizontal: theme.spacing[12],
                paddingRight: shown ? theme.spacing[12] + theme.spacing[4] + trailingWidth : theme.spacing[12],
                color: theme.colors.inkBlack,
                outlineStyle: 'none', // the app's own focus border replaces the browser's default outline
              } as object,
            ]}
            {...rest}
          />
          {shown && (
            <View onLayout={(event) => setTrailingWidth(event.nativeEvent.layout.width)} style={{ position: 'absolute', right: theme.spacing[4], top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center' }}>
              {shown}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
