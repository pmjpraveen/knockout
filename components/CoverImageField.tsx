import { Image, Pressable, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { useSubmit } from '@/hooks/useSubmit';
import { Cover, coverAspect, pickCover } from '@/lib/coverImage';
import { pressFeedback } from '@/lib/press';
import { theme } from '@/theme/tokens';

function ImageIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={theme.colors.inkBlack} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="4" width="18" height="16" rx="3" />
      <Circle cx="9" cy="10" r="1.5" />
      <Path d="M4 18l5-5 4 4 3-3 4 4" />
    </Svg>
  );
}

/** Add, change or remove a tournament's cover image. */
export function CoverImageField({ value, onChange }: { value: Pick<Cover, 'image'> | null; onChange: (cover: Cover | null) => void }) {
  const { run, busy, error } = useSubmit();

  const choose = () =>
    run(async () => {
      try {
        const cover = await pickCover();
        if (cover) onChange(cover);
        return { error: null };
      } catch {
        return { error: { message: 'That image could not be used. Try another one.' } };
      }
    });

  return (
    <View style={{ gap: theme.spacing[12] }}>
      {value ? (
        <>
          <Image accessibilityLabel="Tournament cover image" source={{ uri: value.image }} style={{ width: '100%', aspectRatio: coverAspect, borderRadius: theme.radii.card }} />
          <Button title="Change image" variant="secondary" disabled={busy} onPress={choose} />
          <Button title="Remove image" variant="ghost" onPress={() => onChange(null)} />
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={choose}
          style={({ pressed }) => [
            { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[16], minHeight: theme.touchTarget.minimum + theme.spacing[8], padding: theme.spacing[16], borderWidth: 1, borderColor: theme.colors.mist, borderRadius: theme.radii.card },
            pressFeedback(pressed),
          ]}
        >
          <ImageIcon />
          <Text variant="bodyLg">Add image</Text>
        </Pressable>
      )}
      {error && <Text color="danger">{error}</Text>}
    </View>
  );
}
