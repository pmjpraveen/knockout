import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Text } from '@/components/Text';
import { pressFeedback } from '@/lib/press';
import { theme } from '@/theme/tokens';

export function Avatar({ uri, name, size = 40 }: { uri?: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const shape = { width: size, height: size, borderRadius: size / 2 };
  return uri && !failed ? (
    <Image source={{ uri }} onError={() => setFailed(true)} style={shape} />
  ) : (
    <View style={[shape, { backgroundColor: theme.colors.cloud, alignItems: 'center', justifyContent: 'center' }]}>
      <Text variant={size > 60 ? 'heading' : 'body'}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

/** The signed-in person's avatar; tapping it opens their profile. */
export function AccountMenu({ uri, name }: { uri?: string; name: string }) {
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Profile for ${name}`} style={({ pressed }) => pressFeedback(pressed)} onPress={() => router.push('/profile')}>
      <Avatar uri={uri} name={name} />
    </Pressable>
  );
}
