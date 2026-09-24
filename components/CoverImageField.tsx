import ImagePlus from 'lucide-react-native/icons/image-plus';
import { Image, Pressable, View } from 'react-native';
import { ActionRow } from '@/components/ActionRow';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { useSubmit } from '@/hooks/useSubmit';
import { Cover, coverAspect, pickCover } from '@/lib/coverImage';
import { pressFeedback } from '@/lib/press';
import { theme } from '@/theme/tokens';

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
          <ActionRow>
            <Button title="Change image" variant="secondary" disabled={busy} onPress={choose} />
            <Button title="Remove image" variant="ghost" onPress={() => onChange(null)} />
          </ActionRow>
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
          <ImagePlus size={24} color={theme.colors.inkBlack} strokeWidth={1.5} />
          <Text variant="bodyLg">Add image</Text>
        </Pressable>
      )}
      {error && <Text color="danger">{error}</Text>}
    </View>
  );
}
