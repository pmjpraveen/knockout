import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { goBack } from '@/components/event/EventCover';
import { TabScreen } from '@/components/event/TabScreen';
import type { EventData } from '@/components/event/useEventData';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { Text } from '@/components/Text';
import { useSubmit } from '@/hooks/useSubmit';
import { isEditable } from '@/lib/events';
import { supabase } from '@/lib/supabase';

/** Setting the event up: its details, registration, and team. */
export function EventConfigure({ data }: { data: EventData }) {
  const { event, isOrganizer, counts } = data;
  const router = useRouter();
  const { run, busy, error } = useSubmit();
  const active = event.status !== 'completed';
  const go = (screen: string) => () => router.push({ pathname: `/events/[id]/${screen}` as '/events/[id]/edit', params: { id: event.id } });

  const deleteDraft = async () => {
    if (await run(() => supabase.from('events').delete().eq('id', event.id))) goBack(router);
  };

  return (
    <TabScreen title="Configure" subtitle={event.name}>
      {!active && <Text color="slateGray">This event is archived and read-only.</Text>}
      <ListGroup title="Event">
        {isOrganizer && isEditable(event.status) && <ListRow title="Edit event details" onPress={go('edit')} />}
      </ListGroup>
      {isOrganizer && (
        <ListGroup title="Registration">
          {active && <ListRow title="Belt system" detail={`${event.belts.length} belts`} onPress={go('belts')} />}
          {active && <ListRow title="Registration link" onPress={go('link')} />}
          {event.status === 'registration_open' && <ListRow title="Import participants from a sheet" onPress={go('import-athletes')} />}
          <ListRow title="Review submissions" detail={counts.pending ? `${counts.pending} pending` : undefined} tone="warning" onPress={go('submissions')} />
        </ListGroup>
      )}
      {active && (
        <ListGroup title="Team and rings">
          {isOrganizer && <ListRow title="Staff" onPress={go('staff')} />}
          <ListRow title="Tatamis and timing" onPress={go('tatamis')} />
        </ListGroup>
      )}
      {isOrganizer && event.status === 'draft' && (
        <Button title="Delete draft" variant="danger" confirmTitle="Tap again to delete this draft" disabled={busy} onPress={deleteDraft} />
      )}
      {error && <Text color="danger">{error}</Text>}
    </TabScreen>
  );
}
