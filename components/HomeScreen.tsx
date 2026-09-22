import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { ReactNode } from 'react';
import { Platform, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountMenu } from '@/components/AccountMenu';
import { wideBreakpoint } from '@/components/LoginArtwork';
import { Text } from '@/components/Text';
import { useSession } from '@/hooks/useSession';
import { theme } from '@/theme/tokens';

/** The widest the wide layout gets: 1224 of content plus the column's side padding. */
export const wideColumn = 1272;

/**
 * The signed-in home layout: a warm gradient, the greeting and account menu (with the logo on wide screens), then
 * `children` in a centred column. `footer` stays pinned to the bottom, outside the scroll. On wide screens the
 * greeting can be dropped (`greeting={false}`) once there is content to show; phones always keep it.
 */
export function HomeScreen({ children, footer, contentWidth = 400, greeting = true }: { children: ReactNode; footer?: ReactNode; contentWidth?: number; greeting?: boolean }) {
  const insets = useSafeAreaInsets();
  const wide = useWindowDimensions().width >= wideBreakpoint;
  const user = useSession()?.user;
  const profile = user?.user_metadata ?? {};
  const name: string = profile.given_name ?? profile.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? '';
  const menu = <AccountMenu uri={profile.avatar_url ?? profile.picture} name={name} />;
  const column = { width: '100%', alignSelf: 'center', paddingHorizontal: theme.spacing[24] } as const;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.paperWhite }}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={theme.gradients.welcome} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 300 }} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + theme.spacing[8], paddingBottom: theme.spacing[32] }}>
        <View style={[column, { maxWidth: wide ? wideColumn : contentWidth, zIndex: 1 }]}>
          {(greeting || !wide) && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: wide ? theme.spacing[32] : 0 }}>
              <View>
                <Text variant="bodyLg">Hi,</Text>
                <Text variant="subheading" weight="medium">{name}</Text>
              </View>
              {/* On web the persistent WebHeader already carries the account menu. */}
              {!wide && Platform.OS !== 'web' && menu}
            </View>
          )}
        </View>
        <View style={[column, { maxWidth: contentWidth }]}>{children}</View>
      </ScrollView>
      {footer && <View style={[column, { maxWidth: 400, paddingTop: theme.spacing[8], paddingBottom: wide ? theme.spacing[48] : insets.bottom + theme.spacing[16] }]}>{footer}</View>}
    </View>
  );
}
