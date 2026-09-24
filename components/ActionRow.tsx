import { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { theme } from '@/theme/tokens';

/** A group of equal-weight action buttons: side by side and wrapping on web, stacked on native (unchanged). */
export function ActionRow({ children }: { children: ReactNode }) {
  return (
    <View style={Platform.OS === 'web' ? { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[8] } : { gap: theme.spacing[4] }}>
      {children}
    </View>
  );
}
