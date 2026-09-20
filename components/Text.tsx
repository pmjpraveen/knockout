import { Text as RNText, TextProps } from 'react-native';
import { theme } from '@/theme/tokens';

// The 96px score and 56px clock must fit their panel however large the user's text size is.
const capped = new Set(['timerDisplay', 'scoreDisplay']);
const headings = new Set(['display', 'headingLg', 'heading', 'headingSm', 'subheading']);

type Props = TextProps & {
  variant?: keyof typeof theme.type;
  color?: keyof typeof theme.colors;
  weight?: keyof typeof theme.fonts.sans;
};

export function Text({ variant = 'body', color = 'inkBlack', weight = 'regular', style, ...rest }: Props) {
  return (
    <RNText
      style={[{ fontFamily: theme.fonts.sans[weight], color: theme.colors[color] }, theme.type[variant], style]}
      maxFontSizeMultiplier={capped.has(variant) ? 1.15 : undefined}
      accessibilityRole={headings.has(variant) ? 'header' : undefined}
      accessibilityLiveRegion={color === 'danger' ? 'polite' : undefined}
      {...rest}
    />
  );
}
