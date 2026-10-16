import type { LucideIcon } from 'lucide-react-native';
import { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/theme/tokens';

/** An icon in a soft circle, a title and a line of explanation, with an optional action below. */
export function EmptyState({ Icon, title, text, children }: { Icon: LucideIcon; title: string; text: string; children?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: theme.spacing[16], paddingVertical: theme.spacing[48] }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.cloud, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={32} color={theme.colors.charcoal} strokeWidth={1.5} />
      </View>
      <View style={{ alignItems: 'center', gap: theme.spacing[4] }}>
        <Text variant="subheading">{title}</Text>
        <Text color="slateGray" style={{ textAlign: 'center' }}>{text}</Text>
      </View>
      {children}
    </View>
  );
}
