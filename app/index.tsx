import { useRouter } from 'expo-router';
import { useWindowDimensions, View } from 'react-native';
import { Button } from '@/components/Button';
import { EmptyEvents } from '@/components/EmptyEvents';
import { EventHeroCard, EventTile } from '@/components/EventCards';
import { HomeScreen, wideColumn } from '@/components/HomeScreen';
import { wideBreakpoint } from '@/components/LoginArtwork';
import { SkeletonList } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { useAccountType } from '@/hooks/useAccountType';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { EventRow } from '@/lib/events';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

const phoneWidth = 640;
const running = ['registration_open', 'registration_closed', 'in_progress'];

const byStart = (a: EventRow, b: EventRow) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999');

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: theme.spacing[16], marginTop: theme.spacing[32] }}>
      <Text variant="bodyLg" color="slateGray">{title}</Text>
      {children}
    </View>
  );
}

export default function Events() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= wideBreakpoint;
  const gap = wide ? theme.spacing[24] : theme.spacing[16];
  const inner = Math.min(width, wide ? wideColumn : phoneWidth) - theme.spacing[24] * 2;
  const heroColumns = width >= 1000 ? 3 : wide ? 2 : 1;
  const draftColumns = width >= 1000 ? 4 : wide ? 3 : 2;
  const columnWidth = (columns: number) => (inner - gap * (columns - 1)) / columns;
  const { isOrganizerAccount, loading: loadingAccount } = useAccountType();
  const { rows: events, error, loading: loadingEvents, reload } = useFocusQuery(() =>
    supabase.from('events').select('*').order('created_at', { ascending: false }),
  );
  const { rows: covers } = useFocusQuery(() => supabase.from('event_covers').select('event_id, thumb'));
  const loading = loadingEvents || loadingAccount;
  const { run, error: deleteError } = useSubmit();

  if (isOrganizerAccount && !loading && !error && events.length === 0) return <EmptyEvents />;

  const thumbs = new Map(covers.map((cover) => [cover.event_id, cover.thumb]));
  const open = (event: EventRow) => () => router.push({ pathname: '/events/[id]', params: { id: event.id } });
  const upcoming = events.filter((e) => running.includes(e.status)).sort(byStart);
  const drafts = events.filter((e) => e.status === 'draft');
  const completed = events.filter((e) => e.status === 'completed');
  const deleteDraft = async (event: EventRow) => {
    if (await run(() => supabase.from('events').delete().eq('id', event.id))) reload();
  };
  const grid = (list: EventRow[], deletable = false) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {list.map((event) => (
        <EventTile key={event.id} event={event} thumb={thumbs.get(event.id)} width={columnWidth(draftColumns)} ratio={wide ? 16 / 9 : 1} onPress={open(event)} onDelete={deletable && isOrganizerAccount ? () => deleteDraft(event) : undefined} />
      ))}
    </View>
  );

  return (
    <HomeScreen contentWidth={wide ? wideColumn : phoneWidth} greeting={events.length === 0} footer={isOrganizerAccount ? <Button title="Create a tournament" onPress={() => router.push('/events/new')} /> : undefined}>
      {(error ?? deleteError) && <Text color="danger">{error ?? deleteError}</Text>}
      {loading && <SkeletonList />}
      {!loading && events.length === 0 && !error && (
        <Text color="slateGray" style={{ marginTop: theme.spacing[32] }}>No events yet. An organizer will add you to their event.</Text>
      )}
      {upcoming.length > 0 && (
        <Section title="Upcoming">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
            {upcoming.map((event) => (
              <View key={event.id} style={{ width: columnWidth(heroColumns) }}>
                <EventHeroCard event={event} thumb={thumbs.get(event.id)} onPress={open(event)} />
              </View>
            ))}
          </View>
        </Section>
      )}
      {drafts.length > 0 && <Section title="Drafts">{grid(drafts, true)}</Section>}
      {completed.length > 0 && <Section title="Completed">{grid(completed)}</Section>}
    </HomeScreen>
  );
}
