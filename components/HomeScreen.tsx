import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { ReactNode, useState } from 'react';
import { Image, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogoLockup } from '@/components/LogoLockup';
import { wideBreakpoint } from '@/components/LoginArtwork';
import { Text } from '@/components/Text';
import { useSession } from '@/hooks/useSession';
import { pressFeedback } from '@/lib/press';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

function Avatar({ uri, name }: { uri?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const size = 40;
  const shape = { width: size, height: size, borderRadius: size / 2 };
  return uri && !failed ? (
    <Image source={{ uri }} onError={() => setFailed(true)} style={shape} />
  ) : (
    <View style={[shape, { backgroundColor: theme.colors.cloud, alignItems: 'center', justifyContent: 'center' }]}>
      <Text weight="medium">{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

/** The widest the wide layout gets: 1224 of content plus the column's side padding. */
export const wideColumn = 1272;

/** The avatar doubles as the account menu, whose only entry is Sign out. */
function AccountMenu({ uri, name }: { uri?: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const entries = [
    { title: 'Terms and conditions', onPress: () => router.push('/terms') },
    { title: 'Privacy policy', onPress: () => router.push('/privacy') },
    { title: 'Account deletion', danger: true, onPress: () => router.push('/delete-account') },
    { title: 'Sign out', onPress: () => supabase.auth.signOut() },
  ];
  return (
    <View style={{ zIndex: 1 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Account menu for ${name}`} style={({ pressed }) => pressFeedback(pressed)} onPress={() => setOpen((o) => !o)}>
        <Avatar uri={uri} name={name} />
      </Pressable>
      {open && (
        <View
          style={{
            position: 'absolute',
            top: 48,
            right: 0,
            minWidth: 240,
            padding: theme.spacing[4],
            backgroundColor: theme.colors.paperWhite,
            borderWidth: 1,
            borderColor: theme.colors.mist,
            borderRadius: theme.radii.card,
            ...theme.shadows.scorePanel,
          }}
        >
          {entries.map((entry, index) => (
            <Pressable
              key={entry.title}
              accessibilityRole="button"
              style={({ pressed }) => [{ minHeight: theme.touchTarget.minimum, justifyContent: 'center', paddingHorizontal: theme.spacing[12], borderTopWidth: index === entries.length - 1 ? 1 : 0, borderTopColor: theme.colors.mist }, pressFeedback(pressed)]}
              onPress={() => { setOpen(false); entry.onPress(); }}
            >
              <Text color={entry.danger ? 'danger' : 'inkBlack'}>{entry.title}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

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
          {wide && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 72 }}>
              <LogoLockup />
              {menu}
            </View>
          )}
          {(greeting || !wide) && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: wide ? theme.spacing[32] : 0 }}>
              <View>
                <Text variant="bodyLg">Hi,</Text>
                <Text variant="subheading" weight="medium">{name}</Text>
              </View>
              {!wide && menu}
            </View>
          )}
        </View>
        <View style={[column, { maxWidth: contentWidth }]}>{children}</View>
      </ScrollView>
      {footer && <View style={[column, { maxWidth: 400, paddingTop: theme.spacing[8], paddingBottom: wide ? theme.spacing[48] : insets.bottom + theme.spacing[16] }]}>{footer}</View>}
    </View>
  );
}
