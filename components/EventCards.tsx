import { Image, ImageSourcePropType, Pressable, View } from 'react-native';
import { Text } from '@/components/Text';
import { EventRow, formatDateRange, humanize } from '@/lib/events';
import { pressFeedback } from '@/lib/press';
import { theme } from '@/theme/tokens';

/** Shown wherever an event has no cover image of its own. */
export const fallbackCover: ImageSourcePropType = require('@/assets/images/event-fallback.jpg');

export const coverSource = (image: string | null | undefined): ImageSourcePropType => (image ? { uri: image } : fallbackCover);

const dotOf: Record<string, keyof typeof theme.colors> = {
  registration_open: 'success',
  registration_closed: 'warning',
  in_progress: 'warning',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[8], backgroundColor: theme.colors.paperWhite, borderRadius: theme.radii.button, paddingHorizontal: theme.spacing[12], paddingVertical: theme.spacing[8] }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors[dotOf[status] ?? 'slateGray'] }} />
      <Text variant="body" color="charcoal">{humanize(status)}</Text>
    </View>
  );
}

type CardProps = { event: EventRow; thumb?: string | null; onPress: () => void };

function Caption({ event }: { event: EventRow }) {
  return (
    <View style={{ gap: theme.spacing[4] }}>
      <Text variant="bodyLg" weight="light" numberOfLines={1}>{event.name}</Text>
      <Text color="charcoal">{formatDateRange(event.start_date, event.end_date)}</Text>
    </View>
  );
}

/** A full-width card for an event that is running or about to: cover, status and dates. */
export function EventHeroCard({ event, thumb, onPress }: CardProps) {
  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [{ gap: theme.spacing[12] }, pressFeedback(pressed)]} onPress={onPress}>
      <View style={{ aspectRatio: 2.15, borderRadius: theme.radii.scorePanel, overflow: 'hidden', backgroundColor: theme.colors.cloud }}>
        <Image accessibilityLabel={`${event.name} cover`} source={coverSource(thumb)} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
        <View style={{ position: 'absolute', left: theme.spacing[12], bottom: theme.spacing[12] }}>
          <StatusBadge status={event.status} />
        </View>
      </View>
      <Caption event={event} />
    </Pressable>
  );
}

/** A card for the drafts grid: `width` wide and `ratio` (width over height) shaped, square by default. */
export function EventTile({ event, thumb, onPress, width, ratio = 1 }: CardProps & { width: number; ratio?: number }) {
  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [{ width, gap: theme.spacing[12] }, pressFeedback(pressed)]} onPress={onPress}>
      <View style={{ width, height: width / ratio, borderRadius: theme.radii.scorePanel, overflow: 'hidden', backgroundColor: theme.colors.cloud }}>
        <Image accessibilityLabel={`${event.name} cover`} source={coverSource(thumb)} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
      </View>
      <Caption event={event} />
    </Pressable>
  );
}
