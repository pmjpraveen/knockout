import { useRouter } from 'expo-router';
import CalendarClock from 'lucide-react-native/icons/calendar-clock';
import Network from 'lucide-react-native/icons/network';
import Swords from 'lucide-react-native/icons/swords';
import Trophy from 'lucide-react-native/icons/trophy';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import { EmptyState } from '@/components/EmptyState';
import { TabScreen } from '@/components/event/TabScreen';
import type { EventData } from '@/components/event/useEventData';
import { ListGroup, ListRow } from '@/components/ListGroup';

/** Where the event is run: the scoreboard, the schedule and the brackets. What is available follows the event's stage. */
export function EventScoreboard({ data }: { data: EventData }) {
  const { event, live, memberships, canOverride, unresolvedConflicts } = data;
  const router = useRouter();
  const go = (screen: string) => () => router.push({ pathname: `/events/[id]/${screen}` as '/events/[id]/edit', params: { id: event.id } });
  const showBrackets = ['registration_closed', 'in_progress', 'completed'].includes(event.status);
  const nothing = !live && !showBrackets;
  const finished = data.categories.filter((category) => category.status === 'completed').length;

  return (
    <TabScreen title="Scoreboard" subtitle={event.name}>
      {nothing && (
        <EmptyState
          Icon={Trophy}
          title="Nothing to run yet"
          text="The scoreboard, schedule and brackets appear once registration closes. Until then, set up categories and registrations from the other tabs."
        />
      )}
      {canOverride && unresolvedConflicts > 0 && (
        <ListGroup title="Needs attention">
          <ListRow Icon={TriangleAlert} title="Scoring conflicts" subtitle="Needs a director's review" detail={`${unresolvedConflicts} unresolved`} tone="warning" onPress={go('conflicts')} />
        </ListGroup>
      )}
      {live && (
        <ListGroup title="Run the tournament">
          {memberships.length > 0 && <ListRow Icon={Swords} title="Scoreboard" subtitle="Score your tatami's matches" onPress={go('scoreboard')} />}
          <ListRow Icon={CalendarClock} title="Schedule" subtitle="Queues and call times" onPress={go('schedule')} />
        </ListGroup>
      )}
      {showBrackets && (
        <ListGroup title="Results">
          <ListRow Icon={Network} title="Brackets" subtitle="Draws and match results" onPress={go('brackets')} />
          {finished > 0 && <ListRow Icon={Trophy} title="Results" subtitle={`${finished} of ${data.categories.length} categories completed`} onPress={go('results')} />}
        </ListGroup>
      )}
    </TabScreen>
  );
}
