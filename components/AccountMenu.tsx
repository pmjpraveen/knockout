import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, View } from 'react-native';
import { Text } from '@/components/Text';
import { useReduceMotion } from '@/hooks/useReduceMotion';
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
      <Text>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

/** The avatar doubles as the account menu, whose only entry is Sign out. */
export function AccountMenu({ uri, name }: { uri?: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const entries = [
    { title: 'Terms and conditions', onPress: () => router.push('/terms') },
    { title: 'Privacy policy', onPress: () => router.push('/privacy') },
    { title: 'Account deletion', danger: true, onPress: () => router.push('/delete-account') },
    { title: 'Sign out', onPress: () => supabase.auth.signOut() },
  ];

  // Scales and fades from the avatar that opened it, rather than an instant show/hide, and stays mounted
  // through the close animation so it can reverse cleanly if reopened mid-close.
  useEffect(() => {
    if (open) {
      setRendered(true);
      if (reduceMotion) return progress.setValue(1);
      Animated.timing(progress, { toValue: 1, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (reduceMotion) {
      progress.setValue(0);
      setRendered(false);
    } else {
      Animated.timing(progress, { toValue: 0, duration: 120, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => finished && setRendered(false));
    }
  }, [open, reduceMotion, progress]);

  return (
    <View style={{ zIndex: 1 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Account menu for ${name}`} style={({ pressed }) => pressFeedback(pressed)} onPress={() => setOpen((o) => !o)}>
        <Avatar uri={uri} name={name} />
      </Pressable>
      {rendered && (
        <Animated.View
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
            opacity: progress,
            transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
            transformOrigin: 'top right',
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
        </Animated.View>
      )}
    </View>
  );
}
