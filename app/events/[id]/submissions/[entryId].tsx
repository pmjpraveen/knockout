import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SkeletonScreen } from '@/components/Skeleton';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { competeLabels, toAthleteInput, toDraft } from '@/lib/athlete';
import { formatDate, formatDateTime } from '@/lib/events';
import { supabase } from '@/lib/supabase';

type Athlete = Parameters<typeof toDraft>[0] & { id: string };

function Suggested({ eventId, athlete }: { eventId: string; athlete: Athlete }) {
  const [labels, setLabels] = useState<string[]>([]);
  useEffect(() => {
    supabase
      .rpc('suggest_categories', {
        p_event_id: eventId,
        p_date_of_birth: athlete.date_of_birth as string,
        p_gender: athlete.gender as string,
        p_weight: athlete.weight as number,
        p_belt: athlete.belt_rank as string,
        p_disciplines: athlete.disciplines ?? undefined,
      })
      .then(({ data }) => setLabels((data ?? []).map((c) => c.label)));
  }, [eventId, athlete.id, athlete.date_of_birth, athlete.gender, athlete.weight, athlete.belt_rank, athlete.disciplines]);

  return <Text variant="body" color={labels.length ? 'success' : 'warning'}>{labels.length ? `Suggested: ${labels.join(' · ')}` : 'No matching category'}</Text>;
}

export default function SubmissionDetail() {
  const { id, entryId } = useLocalSearchParams<{ id: string; entryId: string }>();
  const router = useRouter();
  const { rows: entries } = useFocusQuery(() =>
    supabase.from('club_entries').select('*, athletes(*, registrations(categories(label)))').eq('id', entryId),
  );
  const { rows: events } = useFocusQuery(() => supabase.from('events').select('status').eq('id', id));
  const { rows: log } = useFocusQuery(() =>
    supabase.from('audit_log').select('*').eq('subject_id', entryId).order('created_at', { ascending: false }),
  );

  const entry = entries[0];
  if (!entry) return <SkeletonScreen />;
  const archived = events[0]?.status === 'completed';
  const approved = entry.approval_status === 'approved';
  const edit = (athleteId?: string) => router.push({ pathname: '/events/[id]/athlete', params: { id, entryId, ...(athleteId && { athleteId }) } });

  return (
    <Screen>
      <Text variant="heading" weight="medium">{entry.club_name}</Text>
      <Text color="slateGray">{entry.club_contact}</Text>
      <StatusPill status={entry.approval_status} />
      {entry.rejection_reason && <Text color="warning">Flagged: {entry.rejection_reason}</Text>}

      <Text variant="subheading" weight="medium">Participants</Text>
      {entry.athletes.map((athlete) => (
        <Card key={athlete.id}>
          <Text variant="bodyLg" weight="medium">{athlete.full_name}</Text>
          <Text variant="body" color="slateGray">
            {[athlete.gender, athlete.date_of_birth && formatDate(athlete.date_of_birth), athlete.weight && `${athlete.weight} kg`, athlete.belt_rank, competeLabels[toDraft(athlete).compete]].filter(Boolean).join(' · ')}
          </Text>
          {approved ? (
            <Text variant="body" color="success">
              Registered: {athlete.registrations.map((r) => r.categories?.label).join(' · ') || 'no category'}
            </Text>
          ) : (
            <Suggested eventId={id} athlete={athlete} />
          )}
          {!archived && <Button title="Edit" variant="secondary" onPress={() => edit(athlete.id)} />}
        </Card>
      ))}
      {!archived && <Button title="Add participant" variant="secondary" onPress={() => edit()} />}

      {log.length > 0 && <Text variant="subheading" weight="medium">Change log</Text>}
      {log.map((change) => (
        <Card key={change.id}>
          <Text weight="medium">{change.action === 'add_athlete' ? 'Participant added' : 'Participant edited'}</Text>
          <Text variant="body" color="slateGray">{change.reason} · {formatDateTime(change.created_at)}</Text>
        </Card>
      ))}
    </Screen>
  );
}
