import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import Camera from 'lucide-react-native/icons/camera';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import FileText from 'lucide-react-native/icons/file-text';
import LogOut from 'lucide-react-native/icons/log-out';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Trash from 'lucide-react-native/icons/trash';
import { Pressable, View } from 'react-native';
import { Avatar } from '@/components/AccountMenu';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAccountProfile } from '@/hooks/useAccountProfile';
import { useAccountType } from '@/hooks/useAccountType';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useSession } from '@/hooks/useSession';
import { useSubmit } from '@/hooks/useSubmit';
import { changeAvatar } from '@/lib/avatar';
import { pressFeedback } from '@/lib/press';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

const avatarSize = 112;

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ gap: theme.spacing[4], paddingVertical: theme.spacing[12] }}>
      <Text variant="headingSm">{value}</Text>
      <Text variant="body" color="slateGray">{label}</Text>
    </View>
  );
}

function Row({ Icon, title, danger, chevron = true, onPress }: { Icon: LucideIcon; title: string; danger?: boolean; chevron?: boolean; onPress: () => void }) {
  const color = danger ? theme.colors.danger : theme.colors.inkBlack;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[16], minHeight: 56 }, pressFeedback(pressed)]}>
      <Icon size={26} color={color} strokeWidth={1.5} />
      <Text variant="bodyLg" color={danger ? 'danger' : 'inkBlack'} style={{ flex: 1 }}>{title}</Text>
      {chevron && <ChevronRight size={20} color={theme.colors.steelGray} strokeWidth={1.75} />}
    </Pressable>
  );
}

const Divider = () => <View style={{ height: 1, marginVertical: theme.spacing[8], backgroundColor: theme.colors.mist }} />;

/** Who is signed in, in a card with a couple of counts, then plain rows for the legal pages, sign out and account deletion. */
export default function Profile() {
  const router = useRouter();
  const user = useSession()?.user;
  const { avatar, name, reload } = useAccountProfile();
  const { run, busy, error } = useSubmit();
  const { isOrganizerAccount } = useAccountType();
  const { rows: memberships } = useFocusQuery(() => supabase.from('event_members').select('event_id').eq('user_id', user!.id), [user?.id], undefined, !!user);
  const fullName: string = user?.user_metadata?.full_name ?? name;
  const since = user?.created_at?.slice(0, 4) ?? '';

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[24], padding: theme.spacing[24], borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.mist, backgroundColor: theme.colors.paperWhite, ...theme.shadows.scorePanel }}>
        <View style={{ flex: 1, alignItems: 'center', gap: theme.spacing[4] }}>
          <View>
            <Avatar uri={avatar} name={fullName} size={avatarSize} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              disabled={busy}
              onPress={() => run(async () => { const { error: failure, changed } = await changeAvatar(); if (changed) await reload(); return { error: failure }; })}
              style={({ pressed }) => [{ position: 'absolute', right: 0, bottom: 0, width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.inkBlack, borderWidth: 3, borderColor: theme.colors.paperWhite, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }, pressFeedback(pressed)]}
            >
              <Camera size={18} color={theme.colors.paperWhite} strokeWidth={2} />
            </Pressable>
          </View>
          <Text variant="headingSm" numberOfLines={1} style={{ marginTop: theme.spacing[12], textAlign: 'center' }}>{fullName}</Text>
          <Text variant="body" color="slateGray" numberOfLines={1} style={{ textAlign: 'center' }}>{isOrganizerAccount ? 'Organizer' : 'Staff'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Stat value={String(memberships.length)} label={memberships.length === 1 ? 'Tournament' : 'Tournaments'} />
          <View style={{ height: 1, backgroundColor: theme.colors.mist }} />
          <Stat value={since} label="Member since" />
        </View>
      </View>

      <Text color="slateGray" style={{ textAlign: 'center' }}>{user?.email}</Text>
      {error && <Text color="danger" style={{ textAlign: 'center' }}>{error}</Text>}

      <View>
        <Row Icon={FileText} title="Terms and conditions" onPress={() => router.push('/terms')} />
        <Row Icon={ShieldCheck} title="Privacy policy" onPress={() => router.push('/privacy')} />
        <Divider />
        <Row Icon={LogOut} title="Log out" chevron={false} onPress={() => supabase.auth.signOut()} />
        <Row Icon={Trash} title="Delete account" danger chevron={false} onPress={() => router.push('/delete-account')} />
      </View>

      <Text variant="body" color="slateGray" style={{ textAlign: 'center' }}>Version {Constants.expoConfig?.version ?? '1.0.0'}</Text>
    </Screen>
  );
}
