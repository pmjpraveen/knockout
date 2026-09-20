import { Children, ReactNode } from 'react';
import { View } from 'react-native';
import { theme } from '@/theme/tokens';

/** One column on a phone; cards sit side by side once the screen is wide enough for two of them. */
export function CardGrid({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[16] }}>
      {Children.toArray(children).map((child, index) => (
        <View key={index} style={{ flexBasis: 320, flexGrow: 1, flexShrink: 1 }}>{child}</View>
      ))}
    </View>
  );
}
