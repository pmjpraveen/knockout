import { View } from 'react-native';
import { Text } from '@/components/Text';
import { humanize } from '@/lib/events';
import { theme } from '@/theme/tokens';

const tones = {
  gray: { background: 'cloud', text: 'charcoal' },
  amber: { background: 'warningTint', text: 'warning' },
  green: { background: 'successTint', text: 'success' },
} as const;

const toneOf: Record<string, keyof typeof tones> = {
  registration_open: 'amber',
  open: 'amber',
  in_progress: 'amber',
  paused: 'amber',
  completed: 'green',
  approved: 'green',
  submitted: 'amber',
  rejected: 'amber',
};

// The database says "rejected"; the Organizer's action and the club's view are "flagged".
const labelOf: Record<string, string> = { rejected: 'Flagged' };

export function StatusPill({ status }: { status: string }) {
  const tone = tones[toneOf[status] ?? 'gray'];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: theme.colors[tone.background],
        borderRadius: theme.radii.chip,
        paddingHorizontal: theme.spacing[8],
        paddingVertical: theme.spacing[4],
      }}
    >
      <Text variant="body" weight="medium" color={tone.text}>
        {labelOf[status] ?? humanize(status)}
      </Text>
    </View>
  );
}
