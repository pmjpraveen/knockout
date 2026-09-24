import Trash from 'lucide-react-native/icons/trash';
import { useEffect, useState } from 'react';
import { Image, ImageSourcePropType, Pressable, View } from 'react-native';
import { Text } from '@/components/Text';
import { EventRow, formatDateRange, humanize } from '@/lib/events';
import { haptic } from '@/lib/haptics';
import { pressFeedback } from '@/lib/press';
import { theme } from '@/theme/tokens';

/** Shown wherever an event has no cover image of its own. */
export const fallbackCover: ImageSourcePropType = require('@/assets/images/event-fallback.png');

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

type CardProps = { event: EventRow; thumb?: string | null; onPress: () => void; onDelete?: () => void };

function Caption({ event }: { event: EventRow }) {
  return (
    <View style={{ gap: theme.spacing[4] }}>
      <Text variant="bodyLg" weight="medium" numberOfLines={1}>{event.name}</Text>
      <Text color="charcoal">{formatDateRange(event.start_date, event.end_date)}</Text>
    </View>
  );
}

/** A grid card for an event: cover, status pill, name and dates. */
export function EventHeroCard({ event, thumb, onPress, onDelete }: CardProps) {
  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [{ gap: theme.spacing[12] }, pressFeedback(pressed)]} onPress={onPress}>
      <View style={{ aspectRatio: 1.25, borderRadius: theme.radii.scorePanel, overflow: 'hidden', backgroundColor: theme.colors.cloud }}>
        <Image accessibilityLabel={`${event.name} cover`} source={coverSource(thumb)} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
        <View style={{ position: 'absolute', left: theme.spacing[12], bottom: theme.spacing[12] }}>
          <StatusBadge status={event.status} />
        </View>
        {onDelete && <DeleteChip name={event.name} onDelete={onDelete} />}
      </View>
      <Caption event={event} />
    </Pressable>
  );
}

/** A trash button for a card's corner. The first tap arms it ("Delete?"), the second deletes; it disarms after 4 seconds. */
function DeleteChip({ name, onDelete }: { name: string; onDelete: () => void }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={armed ? `Confirm deleting ${name}` : `Delete draft ${name}`}
      hitSlop={theme.spacing[8]}
      onPress={() => {
        if (armed) return onDelete();
        haptic.warning();
        setArmed(true);
      }}
      style={({ pressed }) => [
        {
          position: 'absolute',
          top: theme.spacing[12],
          right: theme.spacing[12],
          minWidth: 36,
          height: 36,
          borderRadius: 18,
          paddingHorizontal: armed ? theme.spacing[12] : 0,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: armed ? theme.colors.dangerTint : theme.colors.paperWhite,
        },
        pressFeedback(pressed),
      ]}
    >
      {armed ? (
        <Text variant="body" color="danger">Delete?</Text>
      ) : (
        <Trash size={18} color={theme.colors.charcoal} strokeWidth={1.75} />
      )}
    </Pressable>
  );
}
