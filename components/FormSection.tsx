import { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/theme/tokens';

/** An uppercase section label with its fields below, spaced to read as one group. */
export function FormSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ gap: theme.spacing[16] }}>
      <View style={{ gap: theme.spacing[4] }}>
        <Text variant="label" color="slateGray" style={{ textTransform: 'uppercase' }}>{title}</Text>
        {hint ? <Text color="slateGray">{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export const SectionDivider = () => <View style={{ height: 1, marginVertical: theme.spacing[8], backgroundColor: theme.colors.mist }} />;
