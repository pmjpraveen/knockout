import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { theme } from '@/theme/tokens';

/** A shareable URL with Copy and Open buttons. */
export function LinkCard({ url, note }: { url: string; note?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Card>
      <Text selectable color="charcoal">{url}</Text>
      {note ? <Text variant="body" color="slateGray">{note}</Text> : null}
      <View style={{ flexDirection: 'row', gap: theme.spacing[8], marginTop: theme.spacing[8] }}>
        <View style={{ flex: 1 }}>
          <Button title={copied ? 'Copied' : 'Copy link'} variant={copied ? 'success' : 'primary'} onPress={async () => { await Clipboard.setStringAsync(url); setCopied(true); }} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Open" variant="secondary" onPress={() => Linking.openURL(url)} />
        </View>
      </View>
    </Card>
  );
}
