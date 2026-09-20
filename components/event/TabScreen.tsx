import { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/event/EventCover';
import { useTabBarSpace } from '@/components/GlassTabBar';
import { Text } from '@/components/Text';
import { theme } from '@/theme/tokens';

/** A tab without a cover: the back button and title on top, then the tab's content in a centred column. */
export function TabScreen({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  return (
    <ScrollView contentContainerStyle={{ paddingTop: Math.max(insets.top, theme.spacing[16]) + theme.spacing[8], paddingBottom: space }}>
      <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: theme.spacing[24], gap: theme.spacing[16] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[16] }}>
          <BackButton />
          <View style={{ flex: 1 }}>
            <Text variant="headingSm">{title}</Text>
            {subtitle ? <Text variant="body" color="slateGray" numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        </View>
        {children}
      </View>
    </ScrollView>
  );
}
