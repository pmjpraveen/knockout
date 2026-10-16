import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Linking, Platform, Share, View } from 'react-native';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { theme } from '@/theme/tokens';

// The browser's share sheet is not on every desktop browser; phones always have one.
const canShare = Platform.OS !== 'web' || (typeof navigator !== 'undefined' && !!navigator.share);

/** A shareable URL with its Copy link, Share and Open buttons in a tinted footer, right-aligned. */
export function LinkCard({ url, note }: { url: string; note?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <View style={{ backgroundColor: theme.colors.paperWhite, borderWidth: 1, borderColor: theme.colors.mist, borderRadius: theme.radii.card, overflow: 'hidden' }}>
      <View style={{ padding: theme.spacing[16], gap: theme.spacing[4] }}>
        <Text selectable color="charcoal">{url}</Text>
        {note ? <Text variant="body" color="slateGray">{note}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: theme.spacing[8], padding: theme.spacing[8], paddingHorizontal: theme.spacing[16], backgroundColor: theme.colors.cloud }}>
        <Button size="medium" title={copied ? 'Copied' : 'Copy link'} variant={copied ? 'success' : 'secondary'} onPress={async () => { await Clipboard.setStringAsync(url); setCopied(true); }} />
        {canShare && <Button size="medium" title="Share" variant="secondary" onPress={() => Share.share({ message: url })} />}
        <Button size="medium" title="Open" variant="secondary" onPress={() => Linking.openURL(url)} />
      </View>
    </View>
  );
}
