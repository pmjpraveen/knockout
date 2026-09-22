import { Platform, View } from 'react-native';
import { AccountMenu } from '@/components/AccountMenu';
import { wideColumn } from '@/components/HomeScreen';
import { LogoLockup } from '@/components/LogoLockup';
import { useSession } from '@/hooks/useSession';
import { theme } from '@/theme/tokens';

/**
 * The persistent top bar for the web app: logo and account menu, above every signed-in screen. Native uses each
 * screen's own back-button header instead, and the tournament wizard skips this too since it renders as a
 * full-bleed overlay on web.
 */
export function WebHeader() {
  const session = useSession();
  if (Platform.OS !== 'web' || !session) return null;
  const profile = session.user.user_metadata ?? {};
  const name: string = profile.given_name ?? profile.full_name?.split(' ')[0] ?? session.user.email?.split('@')[0] ?? '';

  return (
    <View style={{ backgroundColor: theme.colors.paperWhite, borderBottomWidth: 1, borderBottomColor: theme.colors.mist }}>
      <View style={{ width: '100%', maxWidth: wideColumn, alignSelf: 'center', paddingHorizontal: theme.spacing[24], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 64 }}>
        <LogoLockup width={110} />
        <AccountMenu uri={profile.avatar_url ?? profile.picture} name={name} />
      </View>
    </View>
  );
}
