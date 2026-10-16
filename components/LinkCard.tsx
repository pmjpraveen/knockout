import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Linking, Platform, Share, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { theme } from '@/theme/tokens';

// The browser's share sheet is not on every desktop browser; phones always have one.
const canShare = Platform.OS !== 'web' || (typeof navigator !== 'undefined' && !!navigator.share);

/** A shareable URL with Copy, Share and Open buttons (Copy is short so all three fit a phone's width). */
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
          <Button title={copied ? 'Copied' : 'Copy'} variant={copied ? 'success' : 'primary'} onPress={async () => { await Clipboard.setStringAsync(url); setCopied(true); }} />
        </View>
        {canShare && (
          <View style={{ flex: 1 }}>
            <Button title="Share" variant="secondary" onPress={() => Share.share({ message: url })} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Button title="Open" variant="secondary" onPress={() => Linking.openURL(url)} />
        </View>
      </View>
    </Card>
  );
}
