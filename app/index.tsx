import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, useWindowDimensions, View } from 'react-native';
import { Button } from '@/components/Button';
import { EmptyEvents } from '@/components/EmptyEvents';
import { EventHeroCard } from '@/components/EventCards';
import { HomeScreen, wideColumn } from '@/components/HomeScreen';
import { wideBreakpoint } from '@/components/LoginArtwork';
import { SkeletonList } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { useAccountType } from '@/hooks/useAccountType';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { EventRow } from '@/lib/events';
import { pressFeedback } from '@/lib/press';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

const phoneWidth = 640;
const running = ['registration_open', 'registration_closed', 'in_progress'];

const byStart = (a: EventRow, b: EventRow) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999');

const tabs = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'completed', label: 'Completed' },
] as const;
type Tab = (typeof tabs)[number]['key'];

const emptyMessage: Record<Tab, string> = {
  upcoming: 'No upcoming tournaments',
  drafts: 'No drafts are available',
  completed: 'No completed tournaments',
};

function EmptyTab({ tab }: { tab: Tab }) {
  return (
    <View style={{ alignItems: 'center', gap: theme.spacing[16], paddingVertical: theme.spacing[48] }}>
      <Image source={require('@/assets/images/empty-state.avif')} style={{ width: 180, height: 180 }} resizeMode="contain" />
      <Text color="slateGray">{emptyMessage[tab]}</Text>
    </View>
  );
}

function Tabs({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[8] }}>
      {tabs.map(({ key, label }) => {
        const selected = key === active;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(key)}
            style={({ pressed }) => [{
              minHeight: theme.touchTarget.minimum,
              paddingHorizontal: theme.spacing[16],
              borderRadius: theme.radii.button,
              justifyContent: 'center',
              backgroundColor: selected ? theme.colors.inkBlack : theme.colors.paperWhite,
              borderWidth: 1,
              borderColor: selected ? theme.colors.inkBlack : theme.colors.mist,
            }, pressFeedback(pressed)]}
          >
            <Text color={selected ? 'paperWhite' : 'inkBlack'}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Events() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= wideBreakpoint;
  const gap = wide ? theme.spacing[24] : theme.spacing[16];
  const inner = Math.min(width, wide ? wideColumn : phoneWidth) - theme.spacing[24] * 2;
  const columns = width >= 1000 ? 3 : wide ? 2 : 1;
  const columnWidth = (inner - gap * (columns - 1)) / columns;
  const [tab, setTab] = useState<Tab>('upcoming');
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
  const byTab: Record<Tab, EventRow[]> = {
    upcoming: events.filter((e) => running.includes(e.status)).sort(byStart),
    drafts: events.filter((e) => e.status === 'draft'),
    completed: events.filter((e) => e.status === 'completed'),
  };
  const shown = byTab[tab];
  const deleteDraft = async (event: EventRow) => {
    if (await run(() => supabase.from('events').delete().eq('id', event.id))) reload();
  };

  return (
    <HomeScreen contentWidth={wide ? wideColumn : phoneWidth} greeting={events.length === 0} footer={isOrganizerAccount ? <Button title="Create a tournament" size="large" onPress={() => router.push('/events/new')} /> : undefined}>
      {(error ?? deleteError) && <Text color="danger">{error ?? deleteError}</Text>}
      {loading && <SkeletonList />}
      {!loading && events.length === 0 && !error && (
        <Text color="slateGray" style={{ marginTop: theme.spacing[32] }}>No events yet. An organizer will add you to their event.</Text>
      )}
      {!loading && events.length > 0 && (
        <View style={{ gap: theme.spacing[16], marginTop: theme.spacing[32] }}>
          <Text variant="heading">All Tournaments</Text>
          <Tabs active={tab} onChange={setTab} />
          {shown.length === 0 ? (
            <EmptyTab tab={tab} />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
              {shown.map((event) => (
                <View key={event.id} style={{ width: columnWidth }}>
                  <EventHeroCard
                    event={event}
                    thumb={thumbs.get(event.id)}
                    onPress={open(event)}
                    onDelete={tab === 'drafts' && isOrganizerAccount ? () => deleteDraft(event) : undefined}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </HomeScreen>
  );
}
