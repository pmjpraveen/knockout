import { useRouter } from 'expo-router';
import Award from 'lucide-react-native/icons/award';
import ClipboardCheck from 'lucide-react-native/icons/clipboard-check';
import FileSpreadsheet from 'lucide-react-native/icons/file-spreadsheet';
import Link from 'lucide-react-native/icons/link';
import Pencil from 'lucide-react-native/icons/pencil';
import Timer from 'lucide-react-native/icons/timer';
import Users from 'lucide-react-native/icons/users';
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
        {isOrganizer && isEditable(event.status) && <ListRow Icon={Pencil} title="Edit event details" subtitle="Name, venue, cover and dates" onPress={go('edit')} />}
      </ListGroup>
      {isOrganizer && (
        <ListGroup title="Registration">
          {active && <ListRow Icon={Award} title="Belt system" subtitle="Who can register, by belt" detail={`${event.belts.length} ${event.belts.length === 1 ? 'belt' : 'belts'}`} onPress={go('belts')} />}
          {active && <ListRow Icon={Link} title="Registration link" subtitle="Share with clubs, no account" onPress={go('link')} />}
          {event.status === 'registration_open' && <ListRow Icon={FileSpreadsheet} title="Import participants" subtitle="From an Excel or CSV sheet" onPress={go('import-athletes')} />}
          <ListRow Icon={ClipboardCheck} title="Review submissions" subtitle="Approve or flag entries" detail={counts.pending ? `${counts.pending} pending` : undefined} tone="warning" onPress={go('submissions')} />
        </ListGroup>
      )}
      {active && (
        <ListGroup title="Team and rings">
          {isOrganizer && <ListRow Icon={Users} title="Staff" subtitle="Directors and scorekeepers" onPress={go('staff')} />}
          <ListRow Icon={Timer} title="Tatamis and timing" subtitle="Rings, durations, public schedule" onPress={go('tatamis')} />
        </ListGroup>
      )}
      {isOrganizer && event.status === 'draft' && (
        <Button title="Delete draft" variant="danger" confirmTitle="Tap again to delete this draft" disabled={busy} onPress={deleteDraft} />
      )}
      {error && <Text color="danger">{error}</Text>}
    </TabScreen>
  );
}
