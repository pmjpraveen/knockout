import { useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { GoogleIcon } from '@/components/GoogleIcon';
import { LoginArtwork, wideBreakpoint } from '@/components/LoginArtwork';
import { LogoLockup } from '@/components/LogoLockup';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { signInWithGoogle } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const wide = useWindowDimensions().width >= wideBreakpoint;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { run, busy, error } = useSubmit();
  const credentials = { email: email.trim(), password };

  const heading = (
    <View style={{ alignItems: wide ? 'flex-start' : 'center', gap: theme.spacing[8], paddingVertical: wide ? 0 : theme.spacing[16] }}>
      <Text variant="heading" style={{ textAlign: wide ? 'left' : 'center', fontFamily: theme.fonts.display }}>Log in to Knockout</Text>
      <Text variant="bodyLg" color="slateGray" style={{ textAlign: wide ? 'left' : 'center' }}>Your tournaments start here</Text>
    </View>
  );

  const form = (
    <>
      <TextField label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
      <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
      {error && <Text color="danger">{error}</Text>}
      <Button title="Log in" size="large" disabled={busy} onPress={() => run(() => supabase.auth.signInWithPassword(credentials))} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[12] }}>
        <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.mist }} />
        <Text color="slateGray">or</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.mist }} />
      </View>
      <Button title="Log in with Google" variant="secondary" size="large" icon={<GoogleIcon />} disabled={busy} onPress={() => run(signInWithGoogle)} />
    </>
  );

  const scroll = { keyboardShouldPersistTaps: 'handled', keyboardDismissMode: 'interactive', automaticallyAdjustKeyboardInsets: true } as const;

  if (wide) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.paperWhite, overflow: 'hidden' }}>
        <LoginArtwork />
        <ScrollView contentContainerStyle={{ alignItems: 'center', gap: theme.spacing[32], padding: theme.spacing[16], paddingTop: theme.spacing[48] }} {...scroll}>
          <LogoLockup width={170} />
          <View
            style={{
              width: '100%',
              maxWidth: 448,
              gap: theme.spacing[16],
              padding: theme.spacing[24],
              backgroundColor: theme.colors.paperWhite,
              borderWidth: 1,
              borderColor: theme.colors.mist,
              borderRadius: theme.radii.sheetTop,
              ...theme.shadows.subtle,
            }}
          >
            {heading}
            {form}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.colors.paperWhite }} contentContainerStyle={{ flexGrow: 1 }} {...scroll}>
      <View style={{ flexGrow: 1, alignItems: 'center', paddingHorizontal: theme.spacing[16] }}>
        <View style={{ width: '100%', maxWidth: 400, gap: theme.spacing[16], paddingTop: Math.max(insets.top, theme.spacing[32]) + theme.spacing[8], paddingBottom: theme.spacing[8] }}>
          <View style={{ alignItems: 'center' }}>
            <LogoLockup width={170} />
          </View>
          {heading}
          {form}
        </View>
      </View>
      <LoginArtwork />
    </ScrollView>
  );
}
