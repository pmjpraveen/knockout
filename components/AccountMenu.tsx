import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Text } from '@/components/Text';
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

/** The avatar doubles as the account menu, whose only entry is Sign out. */
export function AccountMenu({ uri, name }: { uri?: string; name: string }) {
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
