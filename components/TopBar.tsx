import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { AccountMenu } from '@/components/AccountMenu';
import { LogoLockup } from '@/components/LogoLockup';
import { useAccountProfile } from '@/hooks/useAccountProfile';

/** The wide-screen bar: the logo, which goes home, and the account menu. */
export function TopBar() {
  const router = useRouter();
  const { name, avatar } = useAccountProfile();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 72 }}>
      <Pressable accessibilityRole="link" accessibilityLabel="Knockout home" onPress={() => router.replace('/')}>
        <LogoLockup />
      </Pressable>
      <AccountMenu uri={avatar} name={name} />
    </View>
  );
}
