import { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/event/EventCover';
import { useTabBarSpace } from '@/components/GlassTabBar';
import { Text } from '@/components/Text';
import { theme } from '@/theme/tokens';

const column = { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: theme.spacing[24] } as const;

/** A tab without a cover: the back button and title (with an optional action at the right) stay fixed on top while the tab's content scrolls beneath, in a centred column. */
export function TabScreen({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.paperWhite }}>
      <View style={{ paddingTop: Math.max(insets.top, theme.spacing[16]) + theme.spacing[8], paddingBottom: theme.spacing[8], backgroundColor: theme.colors.paperWhite, zIndex: 1 }}>
        <View style={[column, { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[16] }]}>
          <BackButton />
          <View style={{ flex: 1 }}>
            <Text variant="headingSm">{title}</Text>
            {subtitle ? <Text variant="body" color="slateGray" numberOfLines={1}>{subtitle}</Text> : null}
          </View>
          {action}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingTop: theme.spacing[8], paddingBottom: space }}>
        <View style={[column, { gap: theme.spacing[16] }]}>{children}</View>
      </ScrollView>
    </View>
  );
}
