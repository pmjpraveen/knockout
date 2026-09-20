import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/event/EventCover';
import { Text } from '@/components/Text';
import { theme } from '@/theme/tokens';

/** The header every stack screen shares: a round back button and the screen's title, like the event tabs. */
export function PageHeader({ options }: NativeStackHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: theme.colors.paperWhite, paddingTop: Math.max(insets.top, theme.spacing[16]) + theme.spacing[8], paddingBottom: theme.spacing[8] }}>
      <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: theme.spacing[24], flexDirection: 'row', alignItems: 'center', gap: theme.spacing[16] }}>
        {options.headerBackVisible === false ? null : <BackButton />}
        <Text variant="headingSm" numberOfLines={1} style={{ flex: 1 }}>{options.title}</Text>
      </View>
    </View>
  );
}
