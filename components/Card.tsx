import { ReactNode } from 'react';
import { View } from 'react-native';
import { theme } from '@/theme/tokens';

export function Card({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.paperWhite,
        borderWidth: 1,
        borderColor: theme.colors.mist,
        borderRadius: theme.radii.card,
        padding: theme.spacing[16],
        gap: theme.spacing[4],
        ...theme.shadows.subtle,
      }}
    >
      {children}
    </View>
  );
}
