import { ReactNode } from 'react';
import { View } from 'react-native';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { formatTime, queueLabels } from '@/lib/schedule';
import { theme } from '@/theme/tokens';

export type QueueItem = {
  key: string;
  a: string | null;
  b: string | null;
  /** Empty for a day that has not started: its queue has an order but no call times yet. */
  time: string | null;
  category: string;
  detail: string;
  conflict?: boolean;
  action?: ReactNode;
};

function Athlete({ name, corner }: { name: string | null; corner: 'aka' | 'ao' }) {
  return (
    <View accessible accessibilityLabel={`${corner === 'aka' ? 'Aka' : 'Ao'} corner: ${name ?? 'to be decided'}`} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[8] }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: name ? theme.colors[corner] : 'transparent' }} />
      <Text color={name ? 'inkBlack' : 'slateGray'}>{name ?? 'TBD'}</Text>
    </View>
  );
}

/** One ring's queue: the first three matches are Current / On deck / Up next, the rest are "Later". */
export function TatamiQueueCard({ name, paused, items, footer }: { name: string; paused?: boolean; items: QueueItem[]; footer?: ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.paperWhite,
        borderWidth: 1,
        borderColor: theme.colors.mist,
        borderRadius: theme.radii.card,
        padding: theme.spacing[16],
        gap: theme.spacing[12],
        ...theme.shadows.subtle,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[8] }}>
        <View style={{ backgroundColor: theme.colors.cloud, borderRadius: theme.radii.chip, paddingHorizontal: theme.spacing[8], paddingVertical: theme.spacing[4] }}>
          <Text variant="label" style={{ textTransform: 'uppercase' }}>{name}</Text>
        </View>
        {paused && <StatusPill status="paused" />}
      </View>

      {items.length === 0 && <Text color="slateGray">Nothing queued.</Text>}
      {items.map((item, index) => (
        <View key={item.key} style={{ gap: theme.spacing[4], borderTopWidth: index ? 1 : 0, borderTopColor: theme.colors.mist, paddingTop: index ? theme.spacing[12] : 0 }}>
          <Text variant="label" color="slateGray" style={{ textTransform: 'uppercase' }}>
            {queueLabels[index] ?? 'Later'}
          </Text>
          <Athlete name={item.a} corner="aka" />
          <Athlete name={item.b} corner="ao" />
          <Text variant="body" color="slateGray">
            {item.time ? `≈ ${formatTime(item.time)} · ` : ''}{item.category} · {item.detail}
          </Text>
          {item.conflict && <Text variant="body" color="warning">An athlete here is also called to another ring at this time.</Text>}
          {item.action}
        </View>
      ))}
      {footer}
    </View>
  );
}
